import { Inject, Injectable } from '@nestjs/common';
import { NotificationDto, PaginatedResponse } from '@campusjob/contracts';
import {
  INotificationRepository,
  NOTIFICATION_REPOSITORY_TOKEN,
} from '../../domain/repositories/notification.repository.interface';
import { toNotificationDto } from '../dto/notification-response.mapper';

@Injectable()
export class ListMyNotificationsUseCase {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY_TOKEN)
    private readonly notificationRepository: INotificationRepository,
  ) {}

  async execute(
    recipientId: string,
    query: { page: number; limit: number; unreadOnly: boolean },
  ): Promise<PaginatedResponse<NotificationDto>> {
    const { items, total } = await this.notificationRepository.list({
      recipientId,
      unreadOnly: query.unreadOnly,
      page: query.page,
      limit: query.limit,
    });

    const totalPages = Math.max(1, Math.ceil(total / query.limit));
    return {
      data: items.map(toNotificationDto),
      meta: {
        page: query.page,
        limit: query.limit,
        totalItems: total,
        totalPages,
        hasNextPage: query.page < totalPages,
        hasPrevPage: query.page > 1,
      },
    };
  }
}
