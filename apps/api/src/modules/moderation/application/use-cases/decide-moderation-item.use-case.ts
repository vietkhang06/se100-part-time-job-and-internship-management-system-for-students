import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  ModerationDecisionDto,
  ModerationDecisionType,
  ModerationItemDto,
  ModerationTargetType,
  NotificationEventType,
  UserRole,
} from '@campusjob/contracts';
import {
  IModerationRepository,
  MODERATION_REPOSITORY_TOKEN,
} from '../../domain/repositories/moderation.repository.interface';
import {
  isDecisionAllowed,
  isReasonRequired,
  statusForDecision,
} from '../../domain/policies/moderation-state.policy';
import { ModerationTargetHandlerRegistry } from '../ports/moderation-target-handler.port';
import {
  INotificationPublisher,
  NOTIFICATION_PUBLISHER_TOKEN,
} from '../../../notifications/application/ports/notification-publisher.port';
import { DecideModerationItemDto } from '../dto/moderation.dto';
import { toDecisionDto, toItemDto } from '../dto/moderation.mapper';
import { ModerationDecisionEntity, ModerationItemEntity } from '../../domain/entities/moderation-item.entity';

export interface DecideResult {
  item: ModerationItemDto;
  decision: ModerationDecisionDto;
}

const JOB_DECISION_EVENT: Partial<Record<ModerationDecisionType, NotificationEventType>> = {
  [ModerationDecisionType.APPROVE]: NotificationEventType.JOB_APPROVED,
  [ModerationDecisionType.REJECT]: NotificationEventType.JOB_REJECTED,
  [ModerationDecisionType.HIDE]: NotificationEventType.JOB_HIDDEN,
};

@Injectable()
export class DecideModerationItemUseCase {
  private readonly logger = new Logger(DecideModerationItemUseCase.name);

  constructor(
    @Inject(MODERATION_REPOSITORY_TOKEN)
    private readonly repository: IModerationRepository,
    private readonly handlers: ModerationTargetHandlerRegistry,
    @Inject(NOTIFICATION_PUBLISHER_TOKEN)
    private readonly notifications: INotificationPublisher,
  ) {}

  /** UC51 (tin), UC52 (báo cáo — kết luận sơ bộ), UC53 (đánh giá). */
  async execute(
    itemId: string,
    actor: { id: string; role: UserRole },
    input: DecideModerationItemDto,
  ): Promise<DecideResult> {
    const found = await this.repository.findById(itemId);
    if (!found) {
      throw new NotFoundException({
        message: 'Không tìm thấy mục kiểm duyệt.',
        code: 'MODERATION_ITEM_NOT_FOUND',
      });
    }
    const { item } = found;

    if (!item.isPending()) {
      throw new ConflictException({
        message: 'Mục này đã được xử lý.',
        code: 'MODERATION_ALREADY_DECIDED',
      });
    }

    if (!isDecisionAllowed(item.targetType, input.decision)) {
      throw new BadRequestException({
        message: `Quyết định ${input.decision} không áp dụng cho nội dung loại ${item.targetType}.`,
        code: 'MODERATION_DECISION_NOT_ALLOWED',
      });
    }

    const reason = input.reason?.trim() ? input.reason.trim() : null;
    if (isReasonRequired(input.decision) && !reason) {
      throw new BadRequestException({
        message: 'Cần nhập lý do cho quyết định này.',
        code: 'MODERATION_REASON_REQUIRED',
      });
    }

    const proposedAction = input.proposedAction?.trim() ? input.proposedAction.trim() : null;
    if (proposedAction && item.targetType !== ModerationTargetType.REPORT) {
      throw new BadRequestException({
        message: 'Chỉ báo cáo vi phạm mới có đề xuất biện pháp xử lý.',
        code: 'MODERATION_PROPOSED_ACTION_NOT_ALLOWED',
      });
    }

    // "Chỉ xử lý đúng nội dung được phân quyền": mục đã giao cho người khác thì chỉ Admin được can thiệp.
    if (item.assigneeId && item.assigneeId !== actor.id && actor.role !== UserRole.ADMIN) {
      throw new ForbiddenException({
        message: 'Mục này đang được giao cho người kiểm duyệt khác.',
        code: 'MODERATION_NOT_ASSIGNED',
      });
    }

    const saved = await this.repository.decide({
      itemId,
      decision: input.decision,
      newStatus: statusForDecision(input.decision),
      reason,
      proposedAction,
      reviewerId: actor.id,
      now: new Date(),
    });
    if (!saved) {
      throw new ConflictException({
        message: 'Mục này vừa được xử lý bởi người khác.',
        code: 'MODERATION_ALREADY_DECIDED',
      });
    }

    const synced = await this.syncToTarget(saved.item, saved.decision);
    await this.notifySubmitter(saved.item, saved.decision);

    return {
      item: toItemDto(saved.item),
      decision: toDecisionDto(synced),
    };
  }

  /** Áp quyết định lên module sở hữu đối tượng. Lỗi không làm mất quyết định, chỉ đánh dấu chưa đồng bộ. */
  private async syncToTarget(
    item: ModerationItemEntity,
    decision: ModerationDecisionEntity,
  ): Promise<ModerationDecisionEntity> {
    const handler = this.handlers.get(item.targetType);
    try {
      if (!handler) {
        throw new Error('NO_HANDLER_REGISTERED');
      }
      await handler.applyDecision({
        itemId: item.id,
        decisionId: decision.id,
        targetType: item.targetType,
        targetId: item.targetId,
        decision: decision.decision,
        newStatus: item.status,
        reason: decision.reason,
        proposedAction: decision.proposedAction,
        reviewerId: decision.reviewerId,
      });
      const at = new Date();
      await this.repository.markDecisionSynced(decision.id, at);
      return new ModerationDecisionEntity({ ...decision, targetSyncedAt: at, targetSyncError: null });
    } catch (err: any) {
      const message = String(err?.message ?? err).slice(0, 500);
      this.logger.error(`Sync decision ${decision.id} to ${item.targetType}:${item.targetId} failed: ${message}`);
      try {
        await this.repository.markDecisionSyncFailed(decision.id, message);
      } catch (inner: any) {
        this.logger.error(`Could not record sync failure for ${decision.id}: ${inner?.message}`);
      }
      return decision;
    }
  }

  private async notifySubmitter(
    item: ModerationItemEntity,
    decision: ModerationDecisionEntity,
  ): Promise<void> {
    if (item.targetType !== ModerationTargetType.JOB || !item.submitterId) {
      return;
    }
    const eventType = JOB_DECISION_EVENT[decision.decision];
    if (!eventType) {
      return;
    }
    try {
      await this.notifications.publish({
        eventType,
        recipientId: item.submitterId,
        payload: { jobTitle: item.summary ?? undefined, jobId: item.targetId, reason: decision.reason ?? undefined },
        dedupeKey: `${eventType}:${item.targetId}:${decision.id}`,
      });
    } catch (err: any) {
      this.logger.error(`Notify submitter for decision ${decision.id} failed: ${err?.message}`);
    }
  }
}
