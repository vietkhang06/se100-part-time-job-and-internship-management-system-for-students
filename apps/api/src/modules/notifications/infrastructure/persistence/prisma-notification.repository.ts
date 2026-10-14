import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { NotificationEmailStatus } from '@campusjob/contracts';
import { PrismaService } from '../../../../shared/database/prisma.service';
import { NotificationEntity } from '../../domain/entities/notification.entity';
import {
  CreateNotificationData,
  INotificationRepository,
  ListNotificationsFilter,
} from '../../domain/repositories/notification.repository.interface';

@Injectable()
export class PrismaNotificationRepository implements INotificationRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toDomain(raw: any): NotificationEntity {
    return new NotificationEntity({
      id: raw.id,
      recipientId: raw.recipientId,
      eventType: raw.eventType,
      title: raw.title,
      body: raw.body,
      payload: (raw.payload as Record<string, unknown> | null) ?? null,
      dedupeKey: raw.dedupeKey ?? null,
      readAt: raw.readAt ?? null,
      emailStatus: raw.emailStatus as NotificationEmailStatus,
      emailAttempts: raw.emailAttempts,
      emailLastError: raw.emailLastError ?? null,
      emailSentAt: raw.emailSentAt ?? null,
      emailNextRetryAt: raw.emailNextRetryAt ?? null,
      createdAt: raw.createdAt,
    });
  }

  async create(
    data: CreateNotificationData,
  ): Promise<{ notification: NotificationEntity; created: boolean }> {
    if (data.dedupeKey) {
      const existing = await this.prisma.notification.findUnique({
        where: { dedupeKey: data.dedupeKey },
      });
      if (existing) {
        return { notification: this.toDomain(existing), created: false };
      }
    }

    try {
      const raw = await this.prisma.notification.create({
        data: {
          recipientId: data.recipientId,
          eventType: data.eventType,
          title: data.title,
          body: data.body,
          payload: (data.payload ?? undefined) as Prisma.InputJsonValue | undefined,
          dedupeKey: data.dedupeKey,
          emailStatus: data.emailStatus,
        },
      });
      return { notification: this.toDomain(raw), created: true };
    } catch (err: any) {
      // Hai request cùng dedupeKey chạy song song: bên thua đua lấy lại bản ghi của bên thắng.
      if (err?.code === 'P2002' && data.dedupeKey) {
        const existing = await this.prisma.notification.findUnique({
          where: { dedupeKey: data.dedupeKey },
        });
        if (existing) {
          return { notification: this.toDomain(existing), created: false };
        }
      }
      throw err;
    }
  }

  async findById(id: string): Promise<NotificationEntity | null> {
    const raw = await this.prisma.notification.findUnique({ where: { id } });
    return raw ? this.toDomain(raw) : null;
  }

  async findByIdForRecipient(id: string, recipientId: string): Promise<NotificationEntity | null> {
    const raw = await this.prisma.notification.findFirst({ where: { id, recipientId } });
    return raw ? this.toDomain(raw) : null;
  }

  async list(filter: ListNotificationsFilter): Promise<{ items: NotificationEntity[]; total: number }> {
    const where: Prisma.NotificationWhereInput = {
      recipientId: filter.recipientId,
      ...(filter.unreadOnly ? { readAt: null } : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (filter.page - 1) * filter.limit,
        take: filter.limit,
      }),
      this.prisma.notification.count({ where }),
    ]);
    return { items: rows.map((r) => this.toDomain(r)), total };
  }

  async countUnread(recipientId: string): Promise<number> {
    return this.prisma.notification.count({ where: { recipientId, readAt: null } });
  }

  async markRead(id: string, recipientId: string, at: Date): Promise<NotificationEntity | null> {
    await this.prisma.notification.updateMany({
      where: { id, recipientId, readAt: null },
      data: { readAt: at },
    });
    return this.findByIdForRecipient(id, recipientId);
  }

  async markAllRead(recipientId: string, at: Date): Promise<number> {
    const result = await this.prisma.notification.updateMany({
      where: { recipientId, readAt: null },
      data: { readAt: at },
    });
    return result.count;
  }

  async claimForEmailDispatch(id: string, now: Date, leaseUntil: Date): Promise<boolean> {
    const result = await this.prisma.notification.updateMany({
      where: {
        id,
        emailStatus: { in: [NotificationEmailStatus.PENDING, NotificationEmailStatus.FAILED] },
        OR: [{ emailNextRetryAt: null }, { emailNextRetryAt: { lte: now } }],
      },
      data: { emailNextRetryAt: leaseUntil },
    });
    return result.count === 1;
  }

  async markEmailSent(id: string, at: Date): Promise<void> {
    await this.prisma.notification.update({
      where: { id },
      data: {
        emailStatus: NotificationEmailStatus.SENT,
        emailSentAt: at,
        emailAttempts: { increment: 1 },
        emailLastError: null,
        emailNextRetryAt: null,
      },
    });
  }

  async markEmailFailed(
    id: string,
    data: { attempts: number; error: string; nextRetryAt: Date | null },
  ): Promise<void> {
    await this.prisma.notification.update({
      where: { id },
      data: {
        emailStatus: NotificationEmailStatus.FAILED,
        emailAttempts: data.attempts,
        emailLastError: data.error,
        emailNextRetryAt: data.nextRetryAt,
      },
    });
  }

  async findEmailDispatchable(
    now: Date,
    limit: number,
    maxAttempts: number,
  ): Promise<NotificationEntity[]> {
    const rows = await this.prisma.notification.findMany({
      where: {
        emailStatus: { in: [NotificationEmailStatus.PENDING, NotificationEmailStatus.FAILED] },
        emailAttempts: { lt: maxAttempts },
        OR: [{ emailNextRetryAt: null }, { emailNextRetryAt: { lte: now } }],
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
    return rows.map((r) => this.toDomain(r));
  }
}
