import { NotificationEmailStatus } from '@campusjob/contracts';

export interface NotificationProps {
  id: string;
  recipientId: string;
  eventType: string;
  title: string;
  body: string;
  payload: Record<string, unknown> | null;
  dedupeKey: string | null;
  readAt: Date | null;
  emailStatus: NotificationEmailStatus;
  emailAttempts: number;
  emailLastError: string | null;
  emailSentAt: Date | null;
  emailNextRetryAt: Date | null;
  createdAt: Date;
}

export class NotificationEntity {
  readonly id: string;
  readonly recipientId: string;
  readonly eventType: string;
  readonly title: string;
  readonly body: string;
  readonly payload: Record<string, unknown> | null;
  readonly dedupeKey: string | null;
  readonly readAt: Date | null;
  readonly emailStatus: NotificationEmailStatus;
  readonly emailAttempts: number;
  readonly emailLastError: string | null;
  readonly emailSentAt: Date | null;
  readonly emailNextRetryAt: Date | null;
  readonly createdAt: Date;

  constructor(props: NotificationProps) {
    this.id = props.id;
    this.recipientId = props.recipientId;
    this.eventType = props.eventType;
    this.title = props.title;
    this.body = props.body;
    this.payload = props.payload;
    this.dedupeKey = props.dedupeKey;
    this.readAt = props.readAt;
    this.emailStatus = props.emailStatus;
    this.emailAttempts = props.emailAttempts;
    this.emailLastError = props.emailLastError;
    this.emailSentAt = props.emailSentAt;
    this.emailNextRetryAt = props.emailNextRetryAt;
    this.createdAt = props.createdAt;
  }

  isRead(): boolean {
    return this.readAt !== null;
  }

  /** Email còn cần gửi (lần đầu hoặc gửi lại). */
  needsEmailDispatch(): boolean {
    return (
      this.emailStatus === NotificationEmailStatus.PENDING ||
      this.emailStatus === NotificationEmailStatus.FAILED
    );
  }
}
