import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ReviewDto } from '@campusjob/contracts';
import {
  IReviewRepository,
  REVIEW_REPOSITORY_TOKEN,
} from '../../domain/repositories/review.repository.interface';
import { ReviewSourcesRegistry } from '../ports/review-sources.port';
import { toReviewDto } from '../dto/review.mapper';

const NOT_FOUND = { message: 'Không tìm thấy đánh giá.', code: 'REVIEW_NOT_FOUND' };

@Injectable()
export class ReplyToReviewUseCase {
  constructor(
    @Inject(REVIEW_REPOSITORY_TOKEN)
    private readonly repository: IReviewRepository,
    private readonly sources: ReviewSourcesRegistry,
  ) {}

  /** UC47 — doanh nghiệp phản hồi đúng MỘT lần cho mỗi đánh giá. */
  async execute(employerUserId: string, reviewId: string, content: string): Promise<ReviewDto> {
    const companies = this.sources.getCompanyDirectory();
    if (!companies) {
      throw new ServiceUnavailableException({
        message: 'Chưa thể phản hồi đánh giá lúc này.',
        code: 'REVIEW_SOURCE_UNAVAILABLE',
      });
    }

    const review = await this.repository.findById(reviewId);
    // Đánh giá đã bị ẩn coi như không tồn tại với doanh nghiệp.
    if (!review || !review.isVisible()) {
      throw new NotFoundException(NOT_FOUND);
    }

    const company = await companies.findByEmployer(employerUserId);
    // Không phải doanh nghiệp được đánh giá → 404, không tiết lộ đánh giá có tồn tại.
    if (!company || company.companyId !== review.companyId) {
      throw new NotFoundException(NOT_FOUND);
    }

    if (review.hasReply()) {
      throw new ConflictException({
        message: 'Đánh giá này đã có phản hồi.',
        code: 'REVIEW_ALREADY_REPLIED',
      });
    }

    const { created } = await this.repository.createReply({
      reviewId,
      employerId: employerUserId,
      content: content.trim(),
    });
    if (!created) {
      throw new ConflictException({
        message: 'Đánh giá này đã có phản hồi.',
        code: 'REVIEW_ALREADY_REPLIED',
      });
    }

    const updated = await this.repository.findById(reviewId);
    return toReviewDto(updated ?? review);
  }
}
