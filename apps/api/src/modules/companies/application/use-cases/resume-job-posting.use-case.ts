import {
  Inject,
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
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
import {
  ICompanyRepository,
  COMPANY_REPOSITORY_TOKEN,
} from '../../domain/repositories/company.repository.interface';

@Injectable()
export class ResumeJobPostingUseCase {
  constructor(
    @Inject(JOB_POSTING_REPOSITORY_TOKEN)
    private readonly jobRepo: IJobPostingRepository,
    @Inject(COMPANY_MEMBER_REPOSITORY_TOKEN)
    private readonly memberRepo: ICompanyMemberRepository,
    @Inject(COMPANY_REPOSITORY_TOKEN)
    private readonly companyRepo: ICompanyRepository,
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
        message: 'Chỉ chủ sở hữu hoặc quản trị viên doanh nghiệp mới có quyền mở lại tin.',
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

    if (job.status === JobStatus.OPEN) {
      return { job: job.toDto() }; // Idempotent
    }

    if (job.status !== JobStatus.PAUSED) {
      throw new BadRequestException({
        statusCode: 400,
        message: `Chỉ có thể mở lại tin đang tạm dừng (PAUSED). Trạng thái hiện tại: ${job.status}.`,
        error: 'Bad Request',
        code: JobErrorCode.JOB_INVALID_STATE_TRANSITION,
      });
    }

    // Không mở lại tin đã hết hạn
    if (job.isExpired()) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Tin tuyển dụng đã hết hạn, không thể mở lại tuyển dụng.',
        error: 'Bad Request',
        code: JobErrorCode.JOB_EXPIRED_CANNOT_ACTIVATE,
      });
    }

    // Cổng kiểm tra doanh nghiệp phải đang ở trạng thái Hoạt động / Xác thực
    const company = await this.companyRepo.findById(membership.companyId);
    if (!company || company.verificationStatus !== 'VERIFIED') {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Doanh nghiệp chưa được xác thực, không thể mở lại tin tuyển dụng.',
        error: 'Bad Request',
        code: JobErrorCode.JOB_COMPANY_NOT_ACTIVE,
      });
    }

    const updated = await this.jobRepo.update(jobId, { status: JobStatus.OPEN });
    return { job: updated.toDto() };
  }
}
