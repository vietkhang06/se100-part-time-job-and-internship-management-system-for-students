import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { CompanyReviewListDto } from '@campusjob/contracts';
import { ReviewSourcesRegistry } from '../ports/review-sources.port';
import { ListCompanyReviewsUseCase } from './list-company-reviews.use-case';

@Injectable()
export class ListEmployerReviewsUseCase {
  constructor(
    private readonly sources: ReviewSourcesRegistry,
    private readonly listCompanyReviews: ListCompanyReviewsUseCase,
  ) {}

  /** UC45 — nhà tuyển dụng xem đánh giá dành cho doanh nghiệp của mình (chỉ đánh giá đang hiển thị). */
  async execute(employerUserId: string, page: number, limit: number): Promise<CompanyReviewListDto> {
    const companies = this.sources.getCompanyDirectory();
    if (!companies) {
      throw new ServiceUnavailableException({
        message: 'Chưa thể tải đánh giá lúc này.',
        code: 'REVIEW_SOURCE_UNAVAILABLE',
      });
    }
    const company = await companies.findByEmployer(employerUserId);
    if (!company) {
      throw new NotFoundException({
        message: 'Tài khoản của bạn chưa gắn với doanh nghiệp nào.',
        code: 'REVIEW_COMPANY_NOT_FOUND',
      });
    }
    return this.listCompanyReviews.execute(company.companyId, page, limit);
  }
}
