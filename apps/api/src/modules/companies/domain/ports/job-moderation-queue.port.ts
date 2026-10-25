import { JobPostingEntity } from '../entities/job-posting.entity';

export const JOB_MODERATION_QUEUE_PORT_TOKEN = Symbol('JOB_MODERATION_QUEUE_PORT_TOKEN');

export interface JobModerationEnqueueResult {
  itemId: string;
  round: number;
  outcome: 'CREATED' | 'ALREADY_PENDING';
}

/**
 * Port C-16: Gửi tin tuyển dụng sang module kiểm duyệt M05
 * M03 không truy cập database của M05 trực tiếp.
 */
export interface IJobModerationQueuePort {
  enqueueJob(
    job: JobPostingEntity,
    submitterId: string,
  ): Promise<JobModerationEnqueueResult>;
}
