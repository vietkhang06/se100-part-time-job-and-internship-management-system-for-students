import { NotificationEventType } from '@campusjob/contracts';

/**
 * Chính sách tùy chọn nhận email theo loại thông báo (C-20 / S6-M05-03).
 */
export class NotificationEmailPreferencePolicy {
  /**
   * Mặc định khi người dùng chưa lưu tùy chọn: bật nhận email cho các sự kiện có hỗ trợ email.
   */
  static readonly DEFAULT_EMAIL_ENABLED = true;

  /**
   * Danh sách các sự kiện thông báo có hỗ trợ gửi email theo C-20 / NOTIFICATION_EVENT_MATRIX.md.
   */
  static readonly EMAIL_CAPABLE_EVENT_TYPES: readonly NotificationEventType[] = [
    NotificationEventType.JOB_APPROVED,
    NotificationEventType.JOB_REJECTED,
    NotificationEventType.JOB_HIDDEN,
    NotificationEventType.COMPANY_VERIFICATION_RESULT,
    NotificationEventType.APPLICATION_STATUS_CHANGED,
    NotificationEventType.INTERVIEW_INVITED,
    NotificationEventType.INTERVIEW_RESCHEDULE_REQUESTED,
    NotificationEventType.INTERVIEW_RESCHEDULE_RESOLVED,
    NotificationEventType.INTERVIEW_RESULT_RECORDED,
    NotificationEventType.REPORT_RESOLVED,
    NotificationEventType.SANCTION_APPLIED,
  ] as const;

  private static readonly EMAIL_CAPABLE_SET = new Set<string>(
    NotificationEmailPreferencePolicy.EMAIL_CAPABLE_EVENT_TYPES,
  );

  /**
   * Kiểm tra một loại sự kiện có hỗ trợ gửi email hay không.
   */
  static isEmailCapable(eventType: string): boolean {
    return this.EMAIL_CAPABLE_SET.has(eventType);
  }

  /**
   * Mặc định cho phép người dùng tắt email đối với tất cả loại thông báo có email,
   * kể cả thông báo chế tài (SANCTION_APPLIED, REPORT_RESOLVED).
   */
  static canDisableEmail(eventType: string): boolean {
    return this.isEmailCapable(eventType);
  }

  /**
   * Quyết định cuối cùng về việc gửi email:
   * 1. Sự kiện không hỗ trợ email (in-app only) -> luôn false.
   * 2. Người dùng đã lưu tùy chọn rõ ràng -> sử dụng giá trị đó.
   * 3. Chưa lưu tùy chọn -> sử dụng DEFAULT_EMAIL_ENABLED (true).
   */
  static resolveEmailDelivery(
    eventType: string,
    persistedPreference?: boolean | null,
  ): boolean {
    if (!this.isEmailCapable(eventType)) {
      return false;
    }
    if (typeof persistedPreference === 'boolean') {
      return persistedPreference;
    }
    return this.DEFAULT_EMAIL_ENABLED;
  }
}
