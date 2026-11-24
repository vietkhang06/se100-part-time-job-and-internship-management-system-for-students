import { NotificationEmailPreferenceEntity } from '../entities/notification-email-preference.entity';

export const NOTIFICATION_PREFERENCE_REPOSITORY_TOKEN = Symbol(
  'NOTIFICATION_PREFERENCE_REPOSITORY_TOKEN',
);

export interface INotificationPreferenceRepository {
  findByUser(userId: string): Promise<NotificationEmailPreferenceEntity[]>;
  findByUserAndEvent(
    userId: string,
    eventType: string,
  ): Promise<NotificationEmailPreferenceEntity | null>;
  upsert(
    userId: string,
    eventType: string,
    emailEnabled: boolean,
  ): Promise<NotificationEmailPreferenceEntity>;
  isEmailEnabled(userId: string, eventType: string): Promise<boolean>;
}
