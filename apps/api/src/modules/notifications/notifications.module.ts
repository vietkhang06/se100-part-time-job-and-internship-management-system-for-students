import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../shared/database/database.module';
import { UsersModule } from '../users/users.module';
import { NotificationsController } from './presentation/controllers/notifications.controller';
import { NOTIFICATION_REPOSITORY_TOKEN } from './domain/repositories/notification.repository.interface';
import { PrismaNotificationRepository } from './infrastructure/persistence/prisma-notification.repository';
import { NOTIFICATION_PREFERENCE_REPOSITORY_TOKEN } from './domain/repositories/notification-preference.repository.interface';
import { PrismaNotificationPreferenceRepository } from './infrastructure/persistence/prisma-notification-preference.repository';
import { NOTIFICATION_EMAIL_SENDER_TOKEN } from './application/ports/notification-email-sender.port';
import { NodemailerNotificationEmailSender } from './infrastructure/email/nodemailer-notification-email.sender';
import { NOTIFICATION_PUBLISHER_TOKEN } from './application/ports/notification-publisher.port';
import { PublishNotificationUseCase } from './application/use-cases/publish-notification.use-case';
import { DispatchNotificationEmailUseCase } from './application/use-cases/dispatch-notification-email.use-case';
import { RetryPendingNotificationEmailsUseCase } from './application/use-cases/retry-pending-notification-emails.use-case';
import { ListMyNotificationsUseCase } from './application/use-cases/list-my-notifications.use-case';
import { GetUnreadCountUseCase } from './application/use-cases/get-unread-count.use-case';
import { MarkNotificationReadUseCase } from './application/use-cases/mark-notification-read.use-case';
import { MarkAllNotificationsReadUseCase } from './application/use-cases/mark-all-notifications-read.use-case';
import { GetNotificationEmailPreferencesUseCase } from './application/use-cases/get-notification-email-preferences.use-case';
import { UpdateNotificationEmailPreferenceUseCase } from './application/use-cases/update-notification-email-preference.use-case';

@Module({
  imports: [DatabaseModule, UsersModule],
  controllers: [NotificationsController],
  providers: [
    PublishNotificationUseCase,
    DispatchNotificationEmailUseCase,
    RetryPendingNotificationEmailsUseCase,
    ListMyNotificationsUseCase,
    GetUnreadCountUseCase,
    MarkNotificationReadUseCase,
    MarkAllNotificationsReadUseCase,
    GetNotificationEmailPreferencesUseCase,
    UpdateNotificationEmailPreferenceUseCase,
    { provide: NOTIFICATION_REPOSITORY_TOKEN, useClass: PrismaNotificationRepository },
    { provide: NOTIFICATION_PREFERENCE_REPOSITORY_TOKEN, useClass: PrismaNotificationPreferenceRepository },
    { provide: NOTIFICATION_EMAIL_SENDER_TOKEN, useClass: NodemailerNotificationEmailSender },
    { provide: NOTIFICATION_PUBLISHER_TOKEN, useExisting: PublishNotificationUseCase },
  ],
  // Module M03/M04/M05-xx inject NOTIFICATION_PUBLISHER_TOKEN để phát sự kiện (C-20).
  exports: [
    NOTIFICATION_PUBLISHER_TOKEN,
    NOTIFICATION_PREFERENCE_REPOSITORY_TOKEN,
    RetryPendingNotificationEmailsUseCase,
  ],
})
export class NotificationsModule {}
