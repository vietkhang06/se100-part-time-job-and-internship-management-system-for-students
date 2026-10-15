import { Inject, Injectable } from '@nestjs/common';
import { UnreadCountResponseDto } from '@campusjob/contracts';
import {
  INotificationRepository,
  NOTIFICATION_REPOSITORY_TOKEN,
} from '../../domain/repositories/notification.repository.interface';

@Injectable()
export class GetUnreadCountUseCase {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY_TOKEN)
    private readonly notificationRepository: INotificationRepository,
  ) {}

  async execute(recipientId: string): Promise<UnreadCountResponseDto> {
    return { unreadCount: await this.notificationRepository.countUnread(recipientId) };
  }
}
