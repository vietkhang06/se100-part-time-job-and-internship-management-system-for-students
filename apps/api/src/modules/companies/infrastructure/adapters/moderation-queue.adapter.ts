import { Inject, Injectable, Optional, ServiceUnavailableException } from '@nestjs/common';
import { ModerationTargetType } from '@campusjob/contracts';
import {
  IModerationQueue,
  MODERATION_QUEUE_TOKEN,
} from '../../../moderation/application/ports/moderation-queue.port';
import { JobPostingEntity } from '../../domain/entities/job-posting.entity';
import {
  IJobModerationQueuePort,
  JobModerationEnqueueResult,
} from '../../domain/ports/job-moderation-queue.port';

@Injectable()
export class ModerationQueueAdapter implements IJobModerationQueuePort {
  constructor(
    @Optional()
    @Inject(MODERATION_QUEUE_TOKEN)
    private readonly moderationQueue?: IModerationQueue,
  ) {}

  async enqueueJob(
    job: JobPostingEntity,
    submitterId: string,
  ): Promise<JobModerationEnqueueResult> {
    if (!this.moderationQueue) {
      throw new ServiceUnavailableException({
        statusCode: 503,
        message: 'Dịch vụ kiểm duyệt C-16 hiện chưa khả dụng trong môi trường này.',
        error: 'Service Unavailable',
        code: 'MODERATION_SERVICE_UNAVAILABLE',
      });
    }

    try {
      const res = await this.moderationQueue.enqueue({
        targetType: ModerationTargetType.JOB,
        targetId: job.id,
        submitterId,
        summary: job.title,
      });

      return {
        itemId: res.itemId,
        round: res.round,
        outcome: res.outcome,
      };
    } catch (error: any) {
      throw new ServiceUnavailableException({
        statusCode: 503,
        message: `Lỗi kết nối tới hàng đợi kiểm duyệt: ${error?.message ?? 'Unknown error'}`,
        error: 'Service Unavailable',
        code: 'MODERATION_SERVICE_UNAVAILABLE',
      });
    }
  }
}
