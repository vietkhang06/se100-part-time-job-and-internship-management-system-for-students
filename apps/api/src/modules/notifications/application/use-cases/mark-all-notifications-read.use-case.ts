import { Inject, Injectable } from '@nestjs/common';
import { MarkAllReadResponseDto } from '@campusjob/contracts';
import {
  INotificationRepository,
  NOTIFICATION_REPOSITORY_TOKEN,
} from '../../domain/repositories/notification.repository.interface';

@Injectable()
export class MarkAllNotificationsReadUseCase {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY_TOKEN)
    private readonly notificationRepository: INotificationRepository,
  ) {}

  async execute(recipientId: string): Promise<MarkAllReadResponseDto> {
    const updatedCount = await this.notificationRepository.markAllRead(recipientId, new Date());
    return { updatedCount };
  }
}
