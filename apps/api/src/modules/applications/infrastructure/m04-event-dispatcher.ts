import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { NotificationEventType } from '@campusjob/contracts';
import { PrismaService } from '../../../shared/database/prisma.service';
import {
  INotificationPublisher,
  NOTIFICATION_PUBLISHER_TOKEN,
} from '../../notifications/application/ports/notification-publisher.port';
import { JobAccessSource, M04EventDispatcher, M04_JOB_SOURCE } from '../application/m04-ports';

/** Delivers the transactional M04 outbox to M05 with bounded retry backoff. */
@Injectable()
export class PrismaM04EventDispatcher implements M04EventDispatcher, OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaM04EventDispatcher.name);
  private retryTimer?: ReturnType<typeof setInterval>;
  private scheduledDispatchRunning = false;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(NOTIFICATION_PUBLISHER_TOKEN)
    private readonly notifications: INotificationPublisher,
    @Inject(M04_JOB_SOURCE)
    private readonly jobs: JobAccessSource,
  ) {}

  onModuleInit(): void {
    void this.runScheduledDispatch();
    this.retryTimer = setInterval(() => void this.runScheduledDispatch(), 30_000);
    this.retryTimer.unref();
  }

  onModuleDestroy(): void {
    if (this.retryTimer) clearInterval(this.retryTimer);
  }

  private async runScheduledDispatch(): Promise<void> {
    if (this.scheduledDispatchRunning) return;
    this.scheduledDispatchRunning = true;
    try {
      await this.dispatchPending();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Scheduled M04 outbox dispatch failed: ${message}`);
    } finally {
      this.scheduledDispatchRunning = false;
    }
  }

  async dispatchPending(): Promise<void> {
    const now = new Date();
    const pending = await this.prisma.m04EventOutbox.findMany({
      where: { publishedAt: null, availableAt: { lte: now } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: 50,
    });

    for (const event of pending) {
      const retryAt = new Date(Date.now() + Math.min(15 * 60_000, 30_000 * 2 ** event.attemptCount));
      const claimed = await this.prisma.m04EventOutbox.updateMany({
        where: { id: event.id, publishedAt: null, availableAt: { lte: now } },
        data: { attemptCount: { increment: 1 }, availableAt: retryAt },
      });
      if (claimed.count !== 1) continue;

      try {
        const payload = event.payload as Record<string, unknown>;
        if (event.eventType === 'JOB_CLOSE_SUGGESTED') {
          if (
            typeof payload['jobId'] !== 'string' ||
            typeof payload['applicationId'] !== 'string' ||
            typeof payload['acceptedCount'] !== 'number'
          ) throw new TypeError('Invalid JOB_CLOSE_SUGGESTED payload.');
          await this.jobs.suggestClosingWhenFilled({
            jobId: payload['jobId'],
            applicationId: payload['applicationId'],
            acceptedCount: payload['acceptedCount'],
          });
        } else {
          await this.notifications.publish({
            eventType: event.eventType as NotificationEventType,
            recipientId: event.recipientId,
            payload,
            dedupeKey: event.dedupeKey,
          });
        }
        await this.prisma.m04EventOutbox.update({
          where: { id: event.id },
          data: { publishedAt: new Date(), lastError: null },
        });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        await this.prisma.m04EventOutbox.update({
          where: { id: event.id },
          data: { lastError: message.slice(0, 500), availableAt: retryAt },
        });
        this.logger.warn(`M04 event ${event.id} queued for retry: ${message}`);
      }
    }
  }
}
