import { Inject, Injectable } from '@nestjs/common';
import { ModerationDecisionType, ReviewVisibility } from '@campusjob/contracts';
import {
  IModerationTargetHandler,
  ModerationDecisionContext,
} from '../../../moderation/application/ports/moderation-target-handler.port';
import {
  IReviewRepository,
  REVIEW_REPOSITORY_TOKEN,
} from '../../domain/repositories/review.repository.interface';

/** Nhận quyết định UC53 từ M05-01: HIDE → ẩn đánh giá, RESTORE → hiển thị lại. Idempotent. */
@Injectable()
export class ReviewModerationTargetHandler implements IModerationTargetHandler {
  constructor(
    @Inject(REVIEW_REPOSITORY_TOKEN)
    private readonly repository: IReviewRepository,
  ) {}

  async applyDecision(context: ModerationDecisionContext): Promise<void> {
    const visibility =
      context.decision === ModerationDecisionType.HIDE
        ? ReviewVisibility.HIDDEN
        : context.decision === ModerationDecisionType.RESTORE
          ? ReviewVisibility.VISIBLE
          : null;

    if (!visibility) {
      throw new Error(`Unsupported decision for REVIEW: ${context.decision}`);
    }

    const found = await this.repository.setVisibility(context.targetId, visibility);
    if (!found) {
      throw new Error(`Review ${context.targetId} not found`);
    }
  }
}
