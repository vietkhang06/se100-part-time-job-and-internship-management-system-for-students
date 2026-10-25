import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  JobStatus,
  ModerationDecisionType,
  ModerationTargetType,
} from '@campusjob/contracts';
import {
  IModerationTargetHandler,
  ModerationDecisionContext,
} from '../../../moderation/application/ports/moderation-target-handler.port';
import {
  IJobPostingRepository,
  JOB_POSTING_REPOSITORY_TOKEN,
} from '../../domain/repositories/job-posting.repository.interface';
import {
  ICompanyRepository,
  COMPANY_REPOSITORY_TOKEN,
} from '../../domain/repositories/company.repository.interface';

/**
 * Cài đặt nhận quyết định kiểm duyệt C-16 từ M05 cho đối tượng tin tuyển dụng (JOB).
 * Đảm bảo tính idempotent khi M05 đồng bộ lại (resync).
 */
@Injectable()
export class JobModerationTargetHandler implements IModerationTargetHandler {
  private readonly logger = new Logger(JobModerationTargetHandler.name);

  constructor(
    @Inject(JOB_POSTING_REPOSITORY_TOKEN)
    private readonly jobRepo: IJobPostingRepository,
    @Inject(COMPANY_REPOSITORY_TOKEN)
    private readonly companyRepo: ICompanyRepository,
  ) {}

  async applyDecision(context: ModerationDecisionContext): Promise<void> {
    if (context.targetType !== ModerationTargetType.JOB) {
      return;
    }

    const job = await this.jobRepo.findById(context.targetId);
    if (!job) {
      throw new NotFoundException(`Không tìm thấy tin tuyển dụng ID: ${context.targetId}`);
    }

    switch (context.decision) {
      case ModerationDecisionType.APPROVE: {
        // Idempotency: nếu tin đã ở trạng thái OPEN, kết thúc thành công
        if (job.status === JobStatus.OPEN) {
          this.logger.log(`Job ${job.id} is already OPEN, skipping duplicate approve`);
          return;
        }

        // Kiểm tra hạn nộp
        if (job.isExpired()) {
          throw new BadRequestException({
            statusCode: 400,
            message: 'Tin tuyển dụng đã quá hạn nộp, không thể duyệt mở.',
            code: 'JOB_EXPIRED_CANNOT_ACTIVATE',
          });
        }

        // Cổng kiểm tra doanh nghiệp phải đang ở trạng thái Hoạt động / Xác thực
        const company = await this.companyRepo.findById(job.companyId);
        if (!company || company.verificationStatus !== 'VERIFIED') {
          throw new BadRequestException({
            statusCode: 400,
            message: 'Doanh nghiệp chưa được xác thực, không thể duyệt tin tuyển dụng.',
            code: 'JOB_COMPANY_NOT_ACTIVE',
          });
        }

        await this.jobRepo.update(job.id, { status: JobStatus.OPEN });
        this.logger.log(`Job ${job.id} approved and moved to OPEN`);
        break;
      }

      case ModerationDecisionType.REJECT: {
        // Từ chối kiểm duyệt bắt buộc phải có lý do
        if (!context.reason || context.reason.trim().length === 0) {
          throw new BadRequestException({
            statusCode: 400,
            message: 'Quyết định từ chối kiểm duyệt tin tuyển dụng bắt buộc phải có lý do.',
            code: 'JOB_REJECTION_REASON_REQUIRED',
          });
        }

        // Giữ tin không công khai (không chuyển sang OPEN, không tự tiện gán sang CLOSED)
        // Duy trì trạng thái PENDING_APPROVAL / non-public và ghi log lý do
        this.logger.warn(
          `Job ${job.id} rejected by moderator ${context.reviewerId}. Reason: ${context.reason}`,
        );
        break;
      }

      case ModerationDecisionType.HIDE: {
        if (!context.reason || context.reason.trim().length === 0) {
          throw new BadRequestException({
            statusCode: 400,
            message: 'Quyết định ẩn tin tuyển dụng bắt buộc phải có lý do.',
            code: 'JOB_REJECTION_REASON_REQUIRED',
          });
        }

        if (job.status === JobStatus.OPEN) {
          await this.jobRepo.update(job.id, { status: JobStatus.PAUSED });
          this.logger.log(`Job ${job.id} hidden by moderator, transitioned to PAUSED`);
        }
        break;
      }

      default:
        this.logger.warn(`Unhandled moderation decision for JOB: ${context.decision}`);
        break;
    }
  }
}
