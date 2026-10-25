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
  IJobModerationQueuePort,
  JOB_MODERATION_QUEUE_PORT_TOKEN,
  JobModerationEnqueueResult,
} from '../../domain/ports/job-moderation-queue.port';

export interface SubmitJobPostingResponseDto {
  message: string;
  job: ReturnType<import('../../domain/entities/job-posting.entity').JobPostingEntity['toDto']>;
  moderation: JobModerationEnqueueResult;
}

@Injectable()
export class SubmitJobPostingUseCase {
  constructor(
    @Inject(JOB_POSTING_REPOSITORY_TOKEN)
    private readonly jobRepo: IJobPostingRepository,
    @Inject(COMPANY_MEMBER_REPOSITORY_TOKEN)
    private readonly memberRepo: ICompanyMemberRepository,
    @Inject(JOB_MODERATION_QUEUE_PORT_TOKEN)
    private readonly moderationQueue: IJobModerationQueuePort,
  ) {}

  async execute(userId: string, jobId: string): Promise<SubmitJobPostingResponseDto> {
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
        message: 'Chỉ chủ sở hữu hoặc quản trị viên doanh nghiệp mới có quyền gửi duyệt tin.',
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
      throw new BadRequestException({
        statusCode: 400,
        message: 'Tin tuyển dụng đã đóng, không thể gửi duyệt.',
        error: 'Bad Request',
        code: JobErrorCode.JOB_INVALID_STATE_TRANSITION,
      });
    }

    if (job.status === JobStatus.OPEN) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Tin tuyển dụng đang được công khai tuyển dụng, không cần gửi duyệt lại.',
        error: 'Bad Request',
        code: JobErrorCode.JOB_INVALID_STATE_TRANSITION,
      });
    }

    if (job.isExpired()) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Tin tuyển dụng đã quá hạn nộp, vui lòng cập nhật lại hạn nộp trước khi gửi duyệt.',
        error: 'Bad Request',
        code: JobErrorCode.JOB_EXPIRED_CANNOT_ACTIVATE,
      });
    }

    // Gửi sang cổng kiểm duyệt C-16
    const enqueueResult = await this.moderationQueue.enqueueJob(job, userId);

    return {
      message:
        enqueueResult.outcome === 'ALREADY_PENDING'
          ? 'Tin tuyển dụng đã có trong hàng chờ kiểm duyệt.'
          : 'Gửi tin tuyển dụng sang kiểm duyệt thành công.',
      job: job.toDto(),
      moderation: enqueueResult,
    };
  }
}
