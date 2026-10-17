import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  IModerationRepository,
  MODERATION_REPOSITORY_TOKEN,
} from '../../domain/repositories/moderation.repository.interface';
import { ModerationTargetHandlerRegistry } from '../ports/moderation-target-handler.port';

export interface ResyncSummary {
  picked: number;
  synced: number;
  failed: number;
}

/**
 * Áp lại các quyết định chưa đồng bộ (ví dụ M03 chưa đăng ký handler lúc quyết định được lưu).
 * Chưa gắn scheduler: gọi từ job/maintenance khi Lead chốt chủ sở hữu UC61/UC68.
 */
@Injectable()
export class ResyncModerationDecisionsUseCase {
  private readonly logger = new Logger(ResyncModerationDecisionsUseCase.name);

  constructor(
    @Inject(MODERATION_REPOSITORY_TOKEN)
    private readonly repository: IModerationRepository,
    private readonly handlers: ModerationTargetHandlerRegistry,
  ) {}

  async execute(limit = 50): Promise<ResyncSummary> {
    const pending = await this.repository.findUnsyncedDecisions(limit);
    const summary: ResyncSummary = { picked: pending.length, synced: 0, failed: 0 };

    for (const { decision, item } of pending) {
      const handler = this.handlers.get(item.targetType);
      try {
        if (!handler) throw new Error('NO_HANDLER_REGISTERED');
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
        await this.repository.markDecisionSynced(decision.id, new Date());
        summary.synced++;
      } catch (err: any) {
        const message = String(err?.message ?? err).slice(0, 500);
        this.logger.warn(`Resync decision ${decision.id} failed: ${message}`);
        await this.repository.markDecisionSyncFailed(decision.id, message);
        summary.failed++;
      }
    }
    return summary;
  }
}
