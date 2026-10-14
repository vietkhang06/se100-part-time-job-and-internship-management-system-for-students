import { Inject, Injectable } from '@nestjs/common';
import {
  INotificationRepository,
  NOTIFICATION_REPOSITORY_TOKEN,
} from '../../domain/repositories/notification.repository.interface';
import { MAX_EMAIL_ATTEMPTS } from '../../domain/policies/email-retry.policy';
import { DispatchNotificationEmailUseCase } from './dispatch-notification-email.use-case';

export interface RetryEmailsSummary {
  picked: number;
  sent: number;
  failed: number;
  skipped: number;
}

/**
 * Xử lý hàng đợi email còn PENDING/FAILED và đã tới hạn.
 * Chưa gắn scheduler: chờ Lead chốt ai sở hữu UC61/UC68 (bảo trì định kỳ).
 * Khi có quyết định, chỉ cần gọi execute() từ job/maintenance endpoint.
 */
@Injectable()
export class RetryPendingNotificationEmailsUseCase {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY_TOKEN)
    private readonly notificationRepository: INotificationRepository,
    private readonly dispatchEmail: DispatchNotificationEmailUseCase,
  ) {}

  async execute(limit = 50, now: Date = new Date()): Promise<RetryEmailsSummary> {
    const candidates = await this.notificationRepository.findEmailDispatchable(
      now,
      limit,
      MAX_EMAIL_ATTEMPTS,
    );

    const summary: RetryEmailsSummary = { picked: candidates.length, sent: 0, failed: 0, skipped: 0 };
    for (const n of candidates) {
      const outcome = await this.dispatchEmail.execute(n.id, now);
      if (outcome === 'SENT') summary.sent++;
      else if (outcome === 'FAILED') summary.failed++;
      else summary.skipped++;
    }
    return summary;
  }
}
