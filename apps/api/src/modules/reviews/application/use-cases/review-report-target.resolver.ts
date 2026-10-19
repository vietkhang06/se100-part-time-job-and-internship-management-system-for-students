import { Inject, Injectable } from '@nestjs/common';
import {
  IReportTargetResolver,
  ResolvedReportTarget,
} from '../../../reports/application/ports/report-target-resolver.port';
import {
  IReviewRepository,
  REVIEW_REPOSITORY_TOKEN,
} from '../../domain/repositories/review.repository.interface';

/** Cho phép báo cáo đánh giá (UC49, targetType REVIEW). Chủ sở hữu là sinh viên đã viết đánh giá. */
@Injectable()
export class ReviewReportTargetResolver implements IReportTargetResolver {
  constructor(
    @Inject(REVIEW_REPOSITORY_TOKEN)
    private readonly repository: IReviewRepository,
  ) {}

  async resolve(targetId: string): Promise<ResolvedReportTarget | null> {
    const review = await this.repository.findById(targetId);
    if (!review) return null;
    return { ownerUserId: review.studentId, label: `Đánh giá ${review.rating} sao` };
  }
}
