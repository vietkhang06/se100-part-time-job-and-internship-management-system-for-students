import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { NotificationEmailPreferenceDto } from '@campusjob/contracts';
import { NotificationEmailPreferencePolicy } from '../../domain/policies/notification-email-preference.policy';
import {
  INotificationPreferenceRepository,
  NOTIFICATION_PREFERENCE_REPOSITORY_TOKEN,
} from '../../domain/repositories/notification-preference.repository.interface';
import { UpdateNotificationEmailPreferenceDto } from '../dto/update-notification-email-preference.dto';

@Injectable()
export class UpdateNotificationEmailPreferenceUseCase {
  constructor(
    @Inject(NOTIFICATION_PREFERENCE_REPOSITORY_TOKEN)
    private readonly preferenceRepository: INotificationPreferenceRepository,
  ) {}

  async execute(
    userId: string,
    dto: UpdateNotificationEmailPreferenceDto,
  ): Promise<NotificationEmailPreferenceDto> {
    if (!NotificationEmailPreferencePolicy.isEmailCapable(dto.eventType)) {
      throw new BadRequestException({
        message: `Sự kiện "${dto.eventType}" không hỗ trợ gửi email`,
        code: 'EMAIL_NOT_SUPPORTED_FOR_EVENT',
      });
    }

    const updated = await this.preferenceRepository.upsert(
      userId,
      dto.eventType,
      dto.emailEnabled,
    );

    return {
      eventType: updated.eventType as NotificationEmailPreferenceDto['eventType'],
      emailEnabled: updated.emailEnabled,
    };
  }
}
