export const JOB_EXPIRY_NOTIFIER_TOKEN = Symbol('JOB_EXPIRY_NOTIFIER_TOKEN');

export interface JobExpiryReminderData {
  jobId: string;
  jobTitle: string;
  companyId: string;
  companyName: string;
  recipientId: string;
  recipientEmail: string;
  recipientName: string;
  deadline: Date;
  daysRemaining: number;
}

export interface IJobExpiryNotifier {
  sendExpiryReminder(data: JobExpiryReminderData): Promise<void>;
}
