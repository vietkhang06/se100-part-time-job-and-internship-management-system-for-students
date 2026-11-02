import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/database/prisma.service';
import { IJobExpiryReminderLogRepository } from '../../domain/repositories/job-expiry-reminder-log.repository.interface';

@Injectable()
export class PrismaJobExpiryReminderLogRepository
  implements IJobExpiryReminderLogRepository
{
  constructor(private readonly prisma: PrismaService) {}

  async hasBeenReminded(
    jobId: string,
    recipientId: string,
    deadlineDate: string,
  ): Promise<boolean> {
    const count = await this.prisma.jobExpiryReminderLog.count({
      where: {
        jobId,
        recipientId,
        deadlineDate,
      },
    });
    return count > 0;
  }

  async recordReminder(
    jobId: string,
    recipientId: string,
    deadlineDate: string,
  ): Promise<void> {
    try {
      await this.prisma.jobExpiryReminderLog.create({
        data: {
          jobId,
          recipientId,
          deadlineDate,
        },
      });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        // Duplicate key: already recorded concurrently
        return;
      }
      throw err;
    }
  }
}
