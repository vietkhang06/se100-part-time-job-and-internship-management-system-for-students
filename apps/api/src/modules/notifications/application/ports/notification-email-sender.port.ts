export const NOTIFICATION_EMAIL_SENDER_TOKEN = Symbol('NOTIFICATION_EMAIL_SENDER_TOKEN');

export interface NotificationEmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * Khác IMailService dùng chung: sender này PHẢI ném lỗi khi gửi thất bại
 * để trạng thái PENDING/SENT/FAILED phản ánh đúng thực tế.
 */
export interface INotificationEmailSender {
  send(message: NotificationEmailMessage): Promise<void>;
}
