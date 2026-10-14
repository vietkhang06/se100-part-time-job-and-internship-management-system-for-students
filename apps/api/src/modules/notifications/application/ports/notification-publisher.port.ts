import { NotificationEventType } from '@campusjob/contracts';

export const NOTIFICATION_PUBLISHER_TOKEN = Symbol('NOTIFICATION_PUBLISHER_TOKEN');

export interface PublishNotificationInput {
  eventType: NotificationEventType;
  recipientId: string;
  /** Dữ liệu tối thiểu của sự kiện (jobTitle, companyName, status, reason...). Không đưa dữ liệu nhạy cảm. */
  payload?: Record<string, unknown>;
  /**
   * Khóa idempotent do module phát sự kiện đặt, ví dụ `JOB_APPROVED:<jobId>:<decisionId>`.
   * Gọi lại cùng khóa sẽ không tạo thông báo trùng.
   */
  dedupeKey?: string;
}

export type PublishNotificationOutcome = 'CREATED' | 'DUPLICATE' | 'RECIPIENT_NOT_FOUND';

export interface PublishNotificationResult {
  outcome: PublishNotificationOutcome;
  notificationId?: string;
}

/**
 * Cổng công khai của M05 (C-20) để module khác phát sự kiện thông báo.
 * Không ném lỗi do email: thông báo luôn được lưu trước, email gửi sau và có trạng thái riêng.
 */
export interface INotificationPublisher {
  publish(input: PublishNotificationInput): Promise<PublishNotificationResult>;
  publishMany(inputs: PublishNotificationInput[]): Promise<PublishNotificationResult[]>;
}
