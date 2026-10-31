import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import { CompanyMemberRole } from '@campusjob/contracts';
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
import {
  IJobExpiryReminderLogRepository,
  JOB_EXPIRY_REMINDER_LOG_REPOSITORY_TOKEN,
} from '../../domain/repositories/job-expiry-reminder-log.repository.interface';
import {
  IJobExpiryNotifier,
  JOB_EXPIRY_NOTIFIER_TOKEN,
} from '../../domain/ports/job-expiry-notifier.port';

export interface ExpirySchedulerRunResult {
  correlationId: string;
  closedCount: number;
  remindersSent: number;
  errors: string[];
}

/**
 * JobExpirySchedulerService
 *
 * S6-M03-02 (C-07, C-11, C-20):
 * - Step 1: Tự động đóng (CLOSED) các tin tuyển dụng hết hạn (deadline < now).
 * - Step 2: Nhắc nhở trước 3 ngày tới người nhận hợp lệ của doanh nghiệp (Owner, fallback active members).
 * - Khử trùng lặp qua JobExpiryReminderLog (jobId + recipientId + deadlineDate).
 * - Lỗi gửi email ghi log kèm correlation ID, không rollback/block việc đóng tin và sẽ retry lần chạy kế.
 * - Idempotent, chống chạy đè (overlapping runs safe) qua running flag và DB unique constraints.
 */
@Injectable()
export class JobExpirySchedulerService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(JobExpirySchedulerService.name);
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(
    private readonly configService: ConfigService,
    @Inject(JOB_POSTING_REPOSITORY_TOKEN)
    private readonly jobRepo: IJobPostingRepository,
    @Inject(COMPANY_MEMBER_REPOSITORY_TOKEN)
    private readonly memberRepo: ICompanyMemberRepository,
    @Inject(COMPANY_REPOSITORY_TOKEN)
    private readonly companyRepo: ICompanyRepository,
    @Inject(JOB_EXPIRY_REMINDER_LOG_REPOSITORY_TOKEN)
    private readonly reminderLogRepo: IJobExpiryReminderLogRepository,
    @Inject(JOB_EXPIRY_NOTIFIER_TOKEN)
    private readonly notifier: IJobExpiryNotifier,
  ) {}

  onModuleInit() {
    const isEnabled =
      this.configService.get<string>('ENABLE_EXPIRY_SCHEDULER') === 'true';
    const intervalMs = Number(
      this.configService.get<string>(
        'EXPIRY_SCHEDULER_INTERVAL_MS',
        `${3600 * 1000}`,
      ),
    );

    if (isEnabled) {
      this.logger.log(
        `Starting JobExpirySchedulerService with interval ${intervalMs}ms`,
      );
      this.timer = setInterval(() => {
        this.runJobExpiryCheck().catch((err) => {
          this.logger.error(`Unhandled error in scheduler loop: ${err.message}`);
        });
      }, intervalMs);
    }
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async runJobExpiryCheck(
    customCorrelationId?: string,
  ): Promise<ExpirySchedulerRunResult> {
    const correlationId = customCorrelationId || uuidv4();

    if (this.isRunning) {
      this.logger.warn(
        `[JobExpiryScheduler] [${correlationId}] Another expiry check is already running. Skipping overlapping execution.`,
      );
      return {
        correlationId,
        closedCount: 0,
        remindersSent: 0,
        errors: ['Scheduler already running'],
      };
    }

    this.isRunning = true;
    const errors: string[] = [];
    let closedCount = 0;
    let remindersSent = 0;

    try {
      this.logger.log(
        `[JobExpiryScheduler] [${correlationId}] Starting expiry check run.`,
      );

      const now = new Date();

      // Step 1: Tự động đóng các tin tuyển dụng hết hạn (deadline < now)
      closedCount = await this.jobRepo.closeExpiredJobs(now);
      this.logger.log(
        `[JobExpiryScheduler] [${correlationId}] Step 1: Closed ${closedCount} expired jobs.`,
      );

      // Step 2: Nhắc nhở trước 3 ngày cho các tin OPEN
      const expiringJobs = await this.jobRepo.findExpiringJobs(now, 3);
      this.logger.log(
        `[JobExpiryScheduler] [${correlationId}] Step 2: Found ${expiringJobs.length} jobs expiring within 3 days.`,
      );

      for (const job of expiringJobs) {
        try {
          const company = await this.companyRepo.findById(job.companyId);
          const companyName = company?.name ?? 'Doanh nghiệp';

          // Quyết định: gửi cho thành viên OWNER; nếu không có, gửi cho mọi thành viên active
          const activeMembers =
            await this.memberRepo.findActiveMembersByCompanyId(job.companyId);

          let recipients = activeMembers.filter(
            (m) => m.member.role === CompanyMemberRole.OWNER,
          );
          if (recipients.length === 0) {
            recipients = activeMembers;
          }

          if (recipients.length === 0) {
            this.logger.warn(
              `[JobExpiryScheduler] [${correlationId}] Job ${job.id} has no active recipients. Skipping reminder.`,
            );
            continue;
          }

          const deadlineDate = job.deadline.toISOString().slice(0, 10);
          const daysRemaining = Math.max(
            1,
            Math.ceil(
              (job.deadline.getTime() - now.getTime()) / (24 * 3600 * 1000),
            ),
          );

          for (const recipient of recipients) {
            const hasReminded = await this.reminderLogRepo.hasBeenReminded(
              job.id,
              recipient.member.userId,
              deadlineDate,
            );

            if (hasReminded) {
              continue;
            }

            try {
              await this.notifier.sendExpiryReminder({
                jobId: job.id,
                jobTitle: job.title,
                companyId: job.companyId,
                companyName,
                recipientId: recipient.member.userId,
                recipientEmail: recipient.user.email,
                recipientName: recipient.user.fullName,
                deadline: job.deadline,
                daysRemaining,
              });

              // Ghi dedupe row sau khi gửi thành công
              await this.reminderLogRepo.recordReminder(
                job.id,
                recipient.member.userId,
                deadlineDate,
              );
              remindersSent++;

              this.logger.log(
                `[JobExpiryScheduler] [${correlationId}] Successfully sent reminder for job ${job.id} to ${recipient.user.email}.`,
              );
            } catch (err: any) {
              const errMsg = `Failed sending reminder for job ${job.id} to ${recipient.user.email}: ${err.message}`;
              this.logger.error(
                `[JobExpiryScheduler] [${correlationId}] ${errMsg}`,
              );
              errors.push(errMsg);
              // Lỗi email không ghi dedupe row -> sẽ được retry ở lần chạy sau
              // Lỗi email không làm gián đoạn hay rollback việc đóng tin (Step 1)
            }
          }
        } catch (jobErr: any) {
          const errMsg = `Error processing reminders for job ${job.id}: ${jobErr.message}`;
          this.logger.error(
            `[JobExpiryScheduler] [${correlationId}] ${errMsg}`,
          );
          errors.push(errMsg);
        }
      }

      this.logger.log(
        `[JobExpiryScheduler] [${correlationId}] Completed run. Closed: ${closedCount}, Reminders: ${remindersSent}, Errors: ${errors.length}.`,
      );
    } finally {
      this.isRunning = false;
    }

    return {
      correlationId,
      closedCount,
      remindersSent,
      errors,
    };
  }
}
