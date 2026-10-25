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
  JobStatus,
} from '@campusjob/contracts';
import {
  IJobPostingRepository,
  JOB_POSTING_REPOSITORY_TOKEN,
} from '../../domain/repositories/job-posting.repository.interface';
import {
  ICompanyMemberRepository,
  COMPANY_MEMBER_REPOSITORY_TOKEN,
} from '../../domain/repositories/company-member.repository.interface';

@Injectable()
export class CloseJobPostingUseCase {
  constructor(
    @Inject(JOB_POSTING_REPOSITORY_TOKEN)
    private readonly jobRepo: IJobPostingRepository,
    @Inject(COMPANY_MEMBER_REPOSITORY_TOKEN)
    private readonly memberRepo: ICompanyMemberRepository,
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

    if (!membership.hasManagementPermission()) {
      throw new ForbiddenException({
        statusCode: 403,
        message: 'Chỉ chủ sở hữu hoặc quản trị viên doanh nghiệp mới có quyền đóng tin tuyển dụng.',
        error: 'Forbidden',
        code: CompanyErrorCode.FORBIDDEN,
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

    if (job.companyId !== membership.companyId) {
      throw new ForbiddenException({
        statusCode: 403,
        message: 'Bạn không có quyền thao tác trên tin tuyển dụng của doanh nghiệp khác.',
        error: 'Forbidden',
        code: JobErrorCode.JOB_NOT_OWNED,
      });
    }

    if (job.status === JobStatus.CLOSED) {
      return { job: job.toDto() }; // Idempotent
    }

    const updated = await this.jobRepo.update(jobId, { status: JobStatus.CLOSED });
    return { job: updated.toDto() };
  }
}
