import { Inject, Injectable } from '@nestjs/common';
import { CompanyReviewListDto } from '@campusjob/contracts';
import {
  IReviewRepository,
  REVIEW_REPOSITORY_TOKEN,
} from '../../domain/repositories/review.repository.interface';
import { toPublicReviewDto } from '../dto/review.mapper';

@Injectable()
export class ListCompanyReviewsUseCase {
  constructor(
    @Inject(REVIEW_REPOSITORY_TOKEN)
    private readonly repository: IReviewRepository,
  ) {}

  /**
   * Dữ liệu công khai của một doanh nghiệp: chỉ đánh giá VISIBLE, người viết ẩn danh,
   * kèm thống kê (điểm trung bình làm tròn 1 chữ số, phân bố theo số sao).
   */
  async execute(companyId: string, page: number, limit: number): Promise<CompanyReviewListDto> {
    const [{ items, total }, summary] = await Promise.all([
      this.repository.listVisibleByCompany(companyId, page, limit),
      this.repository.summarizeVisibleByCompany(companyId),
    ]);
    const totalPages = Math.max(1, Math.ceil(total / limit));
    return {
      data: items.map(toPublicReviewDto),
      meta: {
        page,
        limit,
        totalItems: total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
      summary: {
        averageRating:
          summary.averageRating === null ? null : Math.round(summary.averageRating * 10) / 10,
        totalReviews: summary.totalReviews,
        distribution: summary.distribution,
      },
    };
  }
}
