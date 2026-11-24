import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import {
  RetryEmailsSummary,
  RetryPendingNotificationEmailsUseCase,
} from '../use-cases/retry-pending-notification-emails.use-case';

export interface EmailRetrySchedulerRunResult {
  correlationId: string;
  picked: number;
  sent: number;
  failed: number;
  skipped: number;
  status: 'COMPLETED' | 'SKIPPED_OVERLAPPING' | 'FAILED';
  error?: string;
}

/**
 * EmailRetrySchedulerService (R-M05-03 / S6-M05-04 / C-11, C-20)
 *
 * Tự động kích hoạt RetryPendingNotificationEmailsUseCase theo chu kỳ định cấu hình (mặc định 60 giây).
 * - Chống chạy đè (overlapping runs safe) qua cờ isRunning.
 * - Quản lý an toàn vòng đời ứng dụng (OnModuleInit, OnModuleDestroy, unref timer).
 * - Không bao giờ crash process ứng dụng khi use case hoặc cơ sở dữ liệu gặp lỗi.
 * - Khử trùng lặp và bảo vệ lease do tầng domain/use case (5 phút lease, backoff exponential) đảm nhiệm.
 */
@Injectable()
export class EmailRetrySchedulerService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(EmailRetrySchedulerService.name);
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly retryUseCase: RetryPendingNotificationEmailsUseCase,
  ) {}

  onModuleInit(): void {
    const isEnabled =
      this.configService.get<string>('ENABLE_EMAIL_RETRY_SCHEDULER', 'true') !==
      'false';
    const intervalMs = Number(
      this.configService.get<string>('EMAIL_RETRY_INTERVAL_MS', '60000'),
    );

    if (isEnabled) {
      this.logger.log(
        `Starting EmailRetrySchedulerService with interval ${intervalMs}ms`,
      );
      this.timer = setInterval(() => {
        this.runRetryCheck().catch((err: unknown) => {
          const message = err instanceof Error ? err.message : String(err);
          this.logger.error(
            `Unhandled error in email retry scheduler loop: ${message}`,
          );
        });
      }, intervalMs);

      // Cho phép Node process kết thúc sạch khi chạy script CLI hoặc test runner
      this.timer.unref();
    } else {
      this.logger.log(
        'EmailRetrySchedulerService is disabled by ENABLE_EMAIL_RETRY_SCHEDULER=false',
      );
    }
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Kích hoạt một chu kỳ retry email đang chờ hoặc lỗi tới hạn.
   * Chống chạy đè: nếu một chu kỳ trước đang thực thi thì bỏ qua và trả SKIPPED_OVERLAPPING.
   */
  async runRetryCheck(
    customCorrelationId?: string,
  ): Promise<EmailRetrySchedulerRunResult> {
    const correlationId = customCorrelationId || uuidv4();

    if (this.isRunning) {
      this.logger.warn(
        `[EmailRetryScheduler] [${correlationId}] Another email retry run is already in progress. Skipping overlapping execution.`,
      );
      return {
        correlationId,
        picked: 0,
        sent: 0,
        failed: 0,
        skipped: 0,
        status: 'SKIPPED_OVERLAPPING',
      };
    }

    this.isRunning = true;
    try {
      this.logger.log(
        `[EmailRetryScheduler] [${correlationId}] Starting email retry run.`,
      );

      const batchLimit = Number(
        this.configService.get<string>('EMAIL_RETRY_BATCH_LIMIT', '50'),
      );
      const summary: RetryEmailsSummary = await this.retryUseCase.execute(
        batchLimit,
        new Date(),
      );

      this.logger.log(
        `[EmailRetryScheduler] [${correlationId}] Completed email retry run: picked=${summary.picked}, sent=${summary.sent}, failed=${summary.failed}, skipped=${summary.skipped}.`,
      );

      return {
        correlationId,
        picked: summary.picked,
        sent: summary.sent,
        failed: summary.failed,
        skipped: summary.skipped,
        status: 'COMPLETED',
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `[EmailRetryScheduler] [${correlationId}] Error executing email retry: ${message}`,
      );
      return {
        correlationId,
        picked: 0,
        sent: 0,
        failed: 0,
        skipped: 0,
        status: 'FAILED',
        error: message,
      };
    } finally {
      this.isRunning = false;
    }
  }
}
