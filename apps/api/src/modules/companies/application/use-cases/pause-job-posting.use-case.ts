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

@Injectable()
export class PauseJobPostingUseCase {
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
        message: 'Chỉ chủ sở hữu hoặc quản trị viên doanh nghiệp mới có quyền tạm dừng tin.',
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

    if (job.status === JobStatus.PAUSED) {
      return { job: job.toDto() }; // Idempotent
    }

    // F6: Khi phát hiện deadline < now trên tin chưa CLOSED, tự động chuyển sang CLOSED
    if (job.isExpired()) {
      await this.jobRepo.update(jobId, { status: JobStatus.CLOSED });
      throw new BadRequestException({
        statusCode: 400,
        message: 'Tin tuyển dụng đã quá hạn nộp hồ sơ và đã được chuyển sang trạng thái ĐÃ ĐÓNG (CLOSED).',
        error: 'Bad Request',
        code: JobErrorCode.JOB_INVALID_STATE_TRANSITION,
      });
    }

    if (job.status !== JobStatus.OPEN) {
      throw new BadRequestException({
        statusCode: 400,
        message: `Chỉ có thể tạm dừng tin đang tuyển dụng (OPEN). Trạng thái hiện tại: ${job.status}.`,
        error: 'Bad Request',
        code: JobErrorCode.JOB_INVALID_STATE_TRANSITION,
      });
    }

    const updated = await this.jobRepo.update(jobId, { status: JobStatus.PAUSED });
    return { job: updated.toDto() };
  }
}
