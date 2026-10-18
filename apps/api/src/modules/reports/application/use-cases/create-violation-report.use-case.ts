import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  ModerationTargetType,
  NotificationEventType,
  UserRole,
  ViolationReason,
  ViolationReportDto,
  ViolationTargetType,
} from '@campusjob/contracts';
import {
  IViolationReportRepository,
  VIOLATION_REPORT_REPOSITORY_TOKEN,
} from '../../domain/repositories/violation-report.repository.interface';
import { buildOpenKey, canReportTarget } from '../../domain/policies/report-rules.policy';
import { ReportTargetResolverRegistry } from '../ports/report-target-resolver.port';
import { CreateViolationReportDto } from '../dto/violation-report.dto';
import { toReportDto } from '../dto/violation-report.mapper';
import {
  IModerationQueue,
  MODERATION_QUEUE_TOKEN,
} from '../../../moderation/application/ports/moderation-queue.port';
import {
  INotificationPublisher,
  NOTIFICATION_PUBLISHER_TOKEN,
} from '../../../notifications/application/ports/notification-publisher.port';

const REASON_LABEL: Record<ViolationReason, string> = {
  [ViolationReason.FRAUD]: 'Lừa đảo',
  [ViolationReason.FAKE_INFORMATION]: 'Thông tin sai sự thật',
  [ViolationReason.HARASSMENT]: 'Quấy rối',
  [ViolationReason.SPAM]: 'Spam',
  [ViolationReason.INAPPROPRIATE_CONTENT]: 'Nội dung không phù hợp',
  [ViolationReason.OTHER]: 'Khác',
};

@Injectable()
export class CreateViolationReportUseCase {
  private readonly logger = new Logger(CreateViolationReportUseCase.name);

  constructor(
    @Inject(VIOLATION_REPORT_REPOSITORY_TOKEN)
    private readonly repository: IViolationReportRepository,
    private readonly resolvers: ReportTargetResolverRegistry,
    @Inject(MODERATION_QUEUE_TOKEN)
    private readonly moderationQueue: IModerationQueue,
    @Inject(NOTIFICATION_PUBLISHER_TOKEN)
    private readonly notifications: INotificationPublisher,
  ) {}

  /** UC49 — gửi báo cáo, kiểm tra đối tượng, chặn trùng, rồi chuyển sang hàng chờ kiểm duyệt. */
  async execute(
    reporter: { id: string; role: UserRole },
    input: CreateViolationReportDto,
  ): Promise<ViolationReportDto> {
    if (!canReportTarget(reporter.role, input.targetType)) {
      throw new BadRequestException({
        message: 'Bạn không thể báo cáo loại đối tượng này.',
        code: 'REPORT_TARGET_NOT_ALLOWED',
      });
    }

    const resolver = this.resolvers.get(input.targetType);
    if (!resolver) {
      // Fail-closed: chưa kiểm tra được đối tượng thì không nhận báo cáo "mù".
      throw new ServiceUnavailableException({
        message: 'Chưa hỗ trợ báo cáo loại đối tượng này.',
        code: 'REPORT_TARGET_UNAVAILABLE',
      });
    }

    const target = await resolver.resolve(input.targetId);
    if (!target) {
      throw new NotFoundException({
        message: 'Không tìm thấy đối tượng cần báo cáo.',
        code: 'REPORT_TARGET_NOT_FOUND',
      });
    }
    if (target.ownerUserId && target.ownerUserId === reporter.id) {
      throw new BadRequestException({
        message: 'Bạn không thể báo cáo chính mình.',
        code: 'REPORT_SELF_TARGET',
      });
    }

    const { report, duplicate } = await this.repository.create({
      reporterId: reporter.id,
      targetType: input.targetType,
      targetId: input.targetId,
      targetLabel: target.label.slice(0, 200),
      reason: input.reason,
      description: input.description.trim(),
      openKey: buildOpenKey(reporter.id, input.targetType, input.targetId),
      evidence: (input.evidence ?? []).map((e) => ({ url: e.url, note: e.note?.trim() || null })),
    });

    if (duplicate || !report) {
      throw new ConflictException({
        message: 'Bạn đã có một báo cáo đang được xử lý về đối tượng này.',
        code: 'REPORT_DUPLICATE',
      });
    }

    await this.acknowledge(report.id, reporter.id);
    const status = await this.forwardToModeration(report.id, reporter.id, input, target.label);
    if (input.targetType === ViolationTargetType.REVIEW) {
      await this.flagReviewForModeration(input.targetId, target.label);
    }

    return toReportDto({ ...report, status } as typeof report);
  }

  private async acknowledge(reportId: string, reporterId: string): Promise<void> {
    try {
      await this.notifications.publish({
        eventType: NotificationEventType.REPORT_RECEIVED,
        recipientId: reporterId,
        dedupeKey: `${NotificationEventType.REPORT_RECEIVED}:${reportId}`,
      });
    } catch (err: any) {
      this.logger.error(`Ack notification for report ${reportId} failed: ${err?.message}`);
    }
  }

  /**
   * Báo cáo đã lưu thì không bao giờ bị mất: nếu chuyển sang kiểm duyệt lỗi, báo cáo ở lại SUBMITTED
   * (có thể chuyển lại sau) thay vì làm hỏng yêu cầu của người dùng.
   */
  private async forwardToModeration(
    reportId: string,
    reporterId: string,
    input: CreateViolationReportDto,
    targetLabel: string,
  ) {
    try {
      await this.moderationQueue.enqueue({
        targetType: ModerationTargetType.REPORT,
        targetId: reportId,
        submitterId: reporterId,
        summary: `[${REASON_LABEL[input.reason]}] ${input.targetType}: ${targetLabel}${
          input.evidence?.length ? '' : ' (chưa có bằng chứng)'
        }`,
      });
      await this.repository.markUnderReview(reportId);
      return 'UNDER_REVIEW' as const;
    } catch (err: any) {
      this.logger.error(`Forward report ${reportId} to moderation failed: ${err?.message}`);
      return 'SUBMITTED' as const;
    }
  }

  /**
   * UC53: đánh giá bị báo cáo thì đồng thời vào hàng chờ kiểm duyệt để Kiểm duyệt viên ẩn/khôi phục.
   * Không bắt buộc thành công: báo cáo đã lưu, lỗi ở đây chỉ được ghi log.
   */
  private async flagReviewForModeration(reviewId: string, label: string): Promise<void> {
    try {
      await this.moderationQueue.enqueue({
        targetType: ModerationTargetType.REVIEW,
        targetId: reviewId,
        summary: `Đánh giá bị báo cáo: ${label}`,
      });
    } catch (err: any) {
      this.logger.error(`Enqueue reported review ${reviewId} failed: ${err?.message}`);
    }
  }
}
