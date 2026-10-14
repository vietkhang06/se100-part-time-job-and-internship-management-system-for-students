import { NotificationDto } from '@campusjob/contracts';
import { NotificationEntity } from '../../domain/entities/notification.entity';

export function toNotificationDto(entity: NotificationEntity): NotificationDto {
  return {
    id: entity.id,
    eventType: entity.eventType,
    title: entity.title,
    body: entity.body,
    payload: entity.payload,
    isRead: entity.isRead(),
    readAt: entity.readAt ? entity.readAt.toISOString() : null,
    createdAt: entity.createdAt.toISOString(),
  };
}
