import { NotificationEmailStatus } from '@campusjob/contracts';
import { NotificationEntity } from '../entities/notification.entity';

export const NOTIFICATION_REPOSITORY_TOKEN = Symbol('NOTIFICATION_REPOSITORY_TOKEN');

export interface CreateNotificationData {
  recipientId: string;
  eventType: string;
  title: string;
  body: string;
  payload: Record<string, unknown> | null;
  dedupeKey: string | null;
  emailStatus: NotificationEmailStatus;
}

export interface ListNotificationsFilter {
  recipientId: string;
  unreadOnly: boolean;
  page: number;
  limit: number;
}

export interface INotificationRepository {
  /** Idempotent theo dedupeKey: trùng key thì trả bản ghi cũ với created=false. */
  create(data: CreateNotificationData): Promise<{ notification: NotificationEntity; created: boolean }>;
  findById(id: string): Promise<NotificationEntity | null>;
  findByIdForRecipient(id: string, recipientId: string): Promise<NotificationEntity | null>;
  list(filter: ListNotificationsFilter): Promise<{ items: NotificationEntity[]; total: number }>;
  countUnread(recipientId: string): Promise<number>;
  markRead(id: string, recipientId: string, at: Date): Promise<NotificationEntity | null>;
  markAllRead(recipientId: string, at: Date): Promise<number>;

  /**
   * Chiếm "lease" gửi email: chỉ thành công khi email còn PENDING/FAILED và đã tới hạn thử lại.
   * Đặt emailNextRetryAt = leaseUntil để tiến trình khác không gửi trùng.
   */
  claimForEmailDispatch(id: string, now: Date, leaseUntil: Date): Promise<boolean>;
  markEmailSent(id: string, at: Date): Promise<void>;
  markEmailFailed(
    id: string,
    data: { attempts: number; error: string; nextRetryAt: Date | null },
  ): Promise<void>;
  findEmailDispatchable(now: Date, limit: number, maxAttempts: number): Promise<NotificationEntity[]>;
}
