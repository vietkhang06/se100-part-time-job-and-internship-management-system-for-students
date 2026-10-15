import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  INotificationRepository,
  NOTIFICATION_REPOSITORY_TOKEN,
} from '../../domain/repositories/notification.repository.interface';
import {
  IUserRepository,
  USER_REPOSITORY_TOKEN,
} from '../../../users/domain/repositories/user.repository.interface';
import {
  INotificationEmailSender,
  NOTIFICATION_EMAIL_SENDER_TOKEN,
} from '../ports/notification-email-sender.port';
import {
  EMAIL_LEASE_MS,
  computeNextRetryAt,
} from '../../domain/policies/email-retry.policy';

export type DispatchEmailOutcome = 'SENT' | 'FAILED' | 'SKIPPED';

@Injectable()
export class DispatchNotificationEmailUseCase {
  private readonly logger = new Logger(DispatchNotificationEmailUseCase.name);

  constructor(
    @Inject(NOTIFICATION_REPOSITORY_TOKEN)
    private readonly notificationRepository: INotificationRepository,
    @Inject(USER_REPOSITORY_TOKEN)
    private readonly userRepository: IUserRepository,
    @Inject(NOTIFICATION_EMAIL_SENDER_TOKEN)
    private readonly emailSender: INotificationEmailSender,
  ) {}

  /**
   * Gửi email cho một thông báo. An toàn khi gọi lặp/song song: chỉ một tiến trình chiếm được lease.
   * Không bao giờ ném lỗi do SMTP; kết quả được ghi vào emailStatus.
   */
  async execute(notificationId: string, now: Date = new Date()): Promise<DispatchEmailOutcome> {
    const notification = await this.notificationRepository.findById(notificationId);
    if (!notification || !notification.needsEmailDispatch()) {
      return 'SKIPPED';
    }

    const claimed = await this.notificationRepository.claimForEmailDispatch(
      notification.id,
      now,
      new Date(now.getTime() + EMAIL_LEASE_MS),
    );
    if (!claimed) {
      return 'SKIPPED';
    }

    const attempts = notification.emailAttempts + 1;

    try {
      const recipient = await this.userRepository.findById(notification.recipientId);
      if (!recipient) {
        // Không có người nhận thì thử lại cũng vô ích → hết lượt ngay.
        await this.notificationRepository.markEmailFailed(notification.id, {
          attempts,
          error: 'Recipient not found',
          nextRetryAt: null,
        });
        return 'FAILED';
      }

      await this.emailSender.send({
        to: recipient.email,
        subject: notification.title,
        text: notification.body,
        html: `<p>${escapeHtml(notification.body)}</p>`,
      });
      await this.notificationRepository.markEmailSent(notification.id, new Date());
      return 'SENT';
    } catch (err: any) {
      const message = String(err?.message ?? err).slice(0, 500);
      this.logger.warn(`Email for notification ${notification.id} failed (attempt ${attempts}): ${message}`);
      await this.notificationRepository.markEmailFailed(notification.id, {
        attempts,
        error: message,
        nextRetryAt: computeNextRetryAt(attempts, now),
      });
      return 'FAILED';
    }
  }
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
