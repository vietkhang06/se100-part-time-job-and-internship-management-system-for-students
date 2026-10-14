import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { NotificationEmailStatus, NotificationEventType } from '@campusjob/contracts';
import {
  INotificationRepository,
  NOTIFICATION_REPOSITORY_TOKEN,
} from '../../domain/repositories/notification.repository.interface';
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

    // 1) Lưu sự kiện trước: email lỗi không bao giờ làm mất thông báo.
    const { notification, created } = await this.notificationRepository.create({
      recipientId: input.recipientId,
      eventType: input.eventType,
      title: content.title,
      body: content.body,
      payload: input.payload ?? null,
      dedupeKey: input.dedupeKey ?? null,
      emailStatus: content.sendEmail
        ? NotificationEmailStatus.PENDING
        : NotificationEmailStatus.NOT_REQUIRED,
    });

    if (!created) {
      return { outcome: 'DUPLICATE', notificationId: notification.id };
    }

    // 2) Gửi email theo kiểu best-effort; kết quả được ghi vào emailStatus.
    if (content.sendEmail) {
      try {
        await this.dispatchEmail.execute(notification.id);
      } catch (err: any) {
        // Dispatch đã tự bắt lỗi SMTP; đây chỉ là lưới an toàn (ví dụ lỗi DB khi ghi trạng thái).
        this.logger.error(`Dispatch email crashed for ${notification.id}: ${err?.message}`);
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
