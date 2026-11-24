import { Inject, Injectable } from '@nestjs/common';
import { NotificationEmailPreferenceDto } from '@campusjob/contracts';
import { NotificationEmailPreferencePolicy } from '../../domain/policies/notification-email-preference.policy';
import {
  INotificationPreferenceRepository,
  NOTIFICATION_PREFERENCE_REPOSITORY_TOKEN,
} from '../../domain/repositories/notification-preference.repository.interface';

@Injectable()
export class GetNotificationEmailPreferencesUseCase {
  constructor(
    @Inject(NOTIFICATION_PREFERENCE_REPOSITORY_TOKEN)
    private readonly preferenceRepository: INotificationPreferenceRepository,
  ) {}

  async execute(userId: string): Promise<NotificationEmailPreferenceDto[]> {
    const existing = await this.preferenceRepository.findByUser(userId);
    const map = new Map<string, boolean>();
    for (const item of existing) {
      map.set(item.eventType, item.emailEnabled);
    }

    return NotificationEmailPreferencePolicy.EMAIL_CAPABLE_EVENT_TYPES.map(
      (eventType) => ({
        eventType,
        emailEnabled: map.has(eventType)
          ? (map.get(eventType) as boolean)
          : NotificationEmailPreferencePolicy.DEFAULT_EMAIL_ENABLED,
      }),
    );
  }
}
