import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { NotificationDto } from '@campusjob/contracts';
import {
  INotificationRepository,
  NOTIFICATION_REPOSITORY_TOKEN,
} from '../../domain/repositories/notification.repository.interface';
import { toNotificationDto } from '../dto/notification-response.mapper';

@Injectable()
export class MarkNotificationReadUseCase {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY_TOKEN)
    private readonly notificationRepository: INotificationRepository,
  ) {}

  /** Idempotent. Thông báo của người khác trả 404 (không lộ sự tồn tại). */
  async execute(id: string, recipientId: string): Promise<NotificationDto> {
    const existing = await this.notificationRepository.findByIdForRecipient(id, recipientId);
    if (!existing) {
      throw new NotFoundException({
        message: 'Không tìm thấy thông báo.',
        code: 'NOTIFICATION_NOT_FOUND',
      });
    }
    if (existing.isRead()) {
      return toNotificationDto(existing);
    }

    const updated = await this.notificationRepository.markRead(id, recipientId, new Date());
    return toNotificationDto(updated ?? existing);
  }
}
