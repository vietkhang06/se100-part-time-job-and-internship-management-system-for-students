export const JOB_EXPIRY_REMINDER_LOG_REPOSITORY_TOKEN = Symbol(
  'JOB_EXPIRY_REMINDER_LOG_REPOSITORY_TOKEN',
);

export interface IJobExpiryReminderLogRepository {
  hasBeenReminded(
    jobId: string,
    recipientId: string,
    deadlineDate: string,
  ): Promise<boolean>;
  recordReminder(
    jobId: string,
    recipientId: string,
    deadlineDate: string,
  ): Promise<void>;
}
