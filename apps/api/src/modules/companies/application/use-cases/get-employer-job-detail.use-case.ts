import {
  Inject,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import {
  CompanyErrorCode,
  JobErrorCode,
  JobPostingResponseDto,
} from '@campusjob/contracts';
import {
  IJobPostingRepository,
  JOB_POSTING_REPOSITORY_TOKEN,
} from '../../domain/repositories/job-posting.repository.interface';
import {
  ICompanyMemberRepository,
  COMPANY_MEMBER_REPOSITORY_TOKEN,
} from '../../domain/repositories/company-member.repository.interface';
import {
  ISavedJobRepository,
  SAVED_JOB_REPOSITORY_TOKEN,
} from '../../domain/repositories/saved-job.repository.interface';

@Injectable()
export class GetEmployerJobDetailUseCase {
  constructor(
    @Inject(JOB_POSTING_REPOSITORY_TOKEN)
    private readonly jobRepo: IJobPostingRepository,
    @Inject(COMPANY_MEMBER_REPOSITORY_TOKEN)
    private readonly memberRepo: ICompanyMemberRepository,
    @Inject(SAVED_JOB_REPOSITORY_TOKEN)
    private readonly savedJobRepo: ISavedJobRepository,
  ) {}

  async execute(userId: string, jobId: string): Promise<JobPostingResponseDto> {
    const membership = await this.memberRepo.findActiveByUserId(userId);
    if (!membership) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Tài khoản chưa được liên kết với doanh nghiệp nào.',
        error: 'Not Found',
        code: CompanyErrorCode.EMPLOYER_HAS_NO_COMPANY,
      });
    }

    const job = await this.jobRepo.findById(jobId);
    if (!job) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Không tìm thấy tin tuyển dụng.',
        error: 'Not Found',
        code: JobErrorCode.JOB_NOT_FOUND,
      });
    }

    // Kiểm tra quyền sở hữu đối với tin tuyển dụng (Tenant Isolation)
    if (job.companyId !== membership.companyId) {
      throw new ForbiddenException({
        statusCode: 403,
        message: 'Bạn không có quyền truy cập tin tuyển dụng của doanh nghiệp khác.',
        error: 'Forbidden',
        code: JobErrorCode.JOB_NOT_OWNED,
      });
    }

    // S6-M03-01: Trả thêm số lượt lưu cho doanh nghiệp sở hữu
    const saveCount = await this.savedJobRepo.countByJobId(job.id);

    return { job: job.toDto({ saveCount }) };
  }
}
