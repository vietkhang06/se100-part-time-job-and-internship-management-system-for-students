import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/database/prisma.service';
import { NotificationEmailPreferenceEntity } from '../../domain/entities/notification-email-preference.entity';
import { NotificationEmailPreferencePolicy } from '../../domain/policies/notification-email-preference.policy';
import { INotificationPreferenceRepository } from '../../domain/repositories/notification-preference.repository.interface';

@Injectable()
export class PrismaNotificationPreferenceRepository
  implements INotificationPreferenceRepository
{
  constructor(private readonly prisma: PrismaService) {}

  private get model() {
    return (this.prisma as any).notificationEmailPreference;
  }

  private toDomain(raw: any): NotificationEmailPreferenceEntity {
    return new NotificationEmailPreferenceEntity({
      id: raw.id,
      userId: raw.userId,
      eventType: raw.eventType,
      emailEnabled: raw.emailEnabled,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    });
  }

  async findByUser(userId: string): Promise<NotificationEmailPreferenceEntity[]> {
    const rows = await this.model.findMany({
      where: { userId },
      orderBy: { eventType: 'asc' },
    });
    return rows.map((r: any) => this.toDomain(r));
  }

  async findByUserAndEvent(
    userId: string,
    eventType: string,
  ): Promise<NotificationEmailPreferenceEntity | null> {
    const row = await this.model.findUnique({
      where: {
        userId_eventType: { userId, eventType },
      },
    });
    return row ? this.toDomain(row) : null;
  }

  async upsert(
    userId: string,
    eventType: string,
    emailEnabled: boolean,
  ): Promise<NotificationEmailPreferenceEntity> {
    const row = await this.model.upsert({
      where: {
        userId_eventType: { userId, eventType },
      },
      create: {
        userId,
        eventType,
        emailEnabled,
      },
      update: {
        emailEnabled,
      },
    });
    return this.toDomain(row);
  }

  async isEmailEnabled(userId: string, eventType: string): Promise<boolean> {
    if (!NotificationEmailPreferencePolicy.isEmailCapable(eventType)) {
      return false;
    }
    const pref = await this.findByUserAndEvent(userId, eventType);
    return NotificationEmailPreferencePolicy.resolveEmailDelivery(
      eventType,
      pref ? pref.emailEnabled : null,
    );
  }
}
