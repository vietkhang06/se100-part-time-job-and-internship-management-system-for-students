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
import { isFinalApplicationStatus } from '../../domain/policies/review-rules.policy';
import { ReviewSourcesRegistry } from '../ports/review-sources.port';
import { CreateReviewDto } from '../dto/review.dto';
import { toReviewDto } from '../dto/review.mapper';

@Injectable()
export class CreateReviewUseCase {
  constructor(
    @Inject(REVIEW_REPOSITORY_TOKEN)
    private readonly repository: IReviewRepository,
    private readonly sources: ReviewSourcesRegistry,
  ) {}

  /** UC46 — sinh viên đánh giá doanh nghiệp sau khi hồ sơ ứng tuyển đã có kết quả cuối. */
  async execute(studentId: string, input: CreateReviewDto): Promise<ReviewDto> {
    const applications = this.sources.getApplicationSource();
    const companies = this.sources.getCompanyDirectory();
    if (!applications || !companies) {
      throw new ServiceUnavailableException({
        message: 'Chưa thể đánh giá doanh nghiệp lúc này.',
        code: 'REVIEW_SOURCE_UNAVAILABLE',
      });
    }

    const application = await applications.getOwnedApplication(studentId, input.applicationId);
    if (!application) {
      throw new NotFoundException({
        message: 'Không tìm thấy hồ sơ ứng tuyển của bạn.',
        code: 'REVIEW_APPLICATION_NOT_FOUND',
      });
    }

    if (!isFinalApplicationStatus(application.status)) {
      throw new ConflictException({
        message: 'Chỉ được đánh giá sau khi hồ sơ ứng tuyển đã có kết quả cuối.',
        code: 'REVIEW_NOT_ELIGIBLE',
      });
    }

    const company = await companies.findByJob(application.jobId);
    if (!company) {
      throw new NotFoundException({
        message: 'Không tìm thấy doanh nghiệp của tin tuyển dụng này.',
        code: 'REVIEW_COMPANY_NOT_FOUND',
      });
    }

    const { review, duplicate } = await this.repository.create({
      applicationId: application.applicationId,
      studentId,
      companyId: company.companyId,
      rating: input.rating,
      comment: input.comment?.trim() ? input.comment.trim() : null,
    });

    if (duplicate || !review) {
      throw new ConflictException({
        message: 'Bạn đã đánh giá doanh nghiệp cho hồ sơ ứng tuyển này.',
        code: 'REVIEW_ALREADY_EXISTS',
      });
    }
    return toReviewDto(review);
  }
}
