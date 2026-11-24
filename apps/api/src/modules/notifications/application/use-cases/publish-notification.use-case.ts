import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { NotificationEmailStatus, NotificationEventType } from '@campusjob/contracts';
import {
  INotificationRepository,
  NOTIFICATION_REPOSITORY_TOKEN,
} from '../../domain/repositories/notification.repository.interface';
import {
  INotificationPreferenceRepository,
  NOTIFICATION_PREFERENCE_REPOSITORY_TOKEN,
} from '../../domain/repositories/notification-preference.repository.interface';
import {
  IUserRepository,
  USER_REPOSITORY_TOKEN,
} from '../../../users/domain/repositories/user.repository.interface';
import { buildNotificationContent } from '../../domain/templates/notification-content';
import {
  INotificationPublisher,
  PublishNotificationInput,
  PublishNotificationResult,
} from '../ports/notification-publisher.port';
import { DispatchNotificationEmailUseCase } from './dispatch-notification-email.use-case';

const KNOWN_EVENT_TYPES = new Set<string>(Object.values(NotificationEventType));

@Injectable()
export class PublishNotificationUseCase implements INotificationPublisher {
  private readonly logger = new Logger(PublishNotificationUseCase.name);

  constructor(
    @Inject(NOTIFICATION_REPOSITORY_TOKEN)
    private readonly notificationRepository: INotificationRepository,
    @Inject(USER_REPOSITORY_TOKEN)
    private readonly userRepository: IUserRepository,
    @Inject(NOTIFICATION_PREFERENCE_REPOSITORY_TOKEN)
    private readonly preferenceRepository: INotificationPreferenceRepository,
    private readonly dispatchEmail: DispatchNotificationEmailUseCase,
  ) {}

  async publish(input: PublishNotificationInput): Promise<PublishNotificationResult> {
    if (!KNOWN_EVENT_TYPES.has(input.eventType)) {
      throw new BadRequestException({
        message: `Loại sự kiện thông báo không hợp lệ: ${input.eventType}`,
        code: 'INVALID_NOTIFICATION_EVENT',
      });
    }

    const recipient = await this.userRepository.findById(input.recipientId);
    if (!recipient) {
      this.logger.warn(`Skip notification ${input.eventType}: recipient ${input.recipientId} not found`);
      return { outcome: 'RECIPIENT_NOT_FOUND' };
    }

    const payload = input.payload ?? {};
    const content = buildNotificationContent(input.eventType, payload);

    // Kiểm tra tùy chọn email của người nhận: nếu sự kiện gửi email nhưng người nhận tắt, hủy gửi email
    let shouldSendEmail = content.sendEmail;
    if (shouldSendEmail) {
      const emailEnabled = await this.preferenceRepository.isEmailEnabled(
        input.recipientId,
        input.eventType,
      );
      if (!emailEnabled) {
        shouldSendEmail = false;
      }
    }

    // 1) Lưu sự kiện trước: email lỗi hoặc email tắt không bao giờ làm mất thông báo in-app.
    const { notification, created } = await this.notificationRepository.create({
      recipientId: input.recipientId,
      eventType: input.eventType,
      title: content.title,
      body: content.body,
      payload: input.payload ?? null,
      dedupeKey: input.dedupeKey ?? null,
      emailStatus: shouldSendEmail
        ? NotificationEmailStatus.PENDING
        : NotificationEmailStatus.NOT_REQUIRED,
    });

    if (!created) {
      return { outcome: 'DUPLICATE', notificationId: notification.id };
    }

    // 2) Gửi email theo kiểu best-effort nếu tùy chọn bật; kết quả được ghi vào emailStatus.
    if (shouldSendEmail) {
      try {
        await this.dispatchEmail.execute(notification.id);
      } catch (err: unknown) {
        // Dispatch đã tự bắt lỗi SMTP; đây chỉ là lưới an toàn (ví dụ lỗi DB khi ghi trạng thái).
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(`Dispatch email crashed for ${notification.id}: ${message}`);
      }
    }

    return { outcome: 'CREATED', notificationId: notification.id };
  }

  async publishMany(inputs: PublishNotificationInput[]): Promise<PublishNotificationResult[]> {
    const results: PublishNotificationResult[] = [];
    for (const input of inputs) {
      results.push(await this.publish(input));
    }
    return results;
  }
}
