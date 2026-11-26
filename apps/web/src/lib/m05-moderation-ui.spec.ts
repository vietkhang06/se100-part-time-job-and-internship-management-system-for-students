import {
  DECISIONS_BY_TARGET,
  DECISION_LABEL,
  REASON_REQUIRED,
  STATUS_LABEL,
  STATUS_VARIANT,
  TARGET_TYPE_LABEL,
  formatDateTime,
  getModerationErrorMessage,
} from './moderation-labels';
import {
  LOCK_DAYS_MAX,
  LOCK_DAYS_MIN,
  REPORT_STATUS_LABEL,
  REPORT_STATUS_VARIANT,
  SANCTIONS_BY_REPORT_TARGET,
  SANCTION_STATUS_LABEL,
  SANCTION_STATUS_VARIANT,
  SANCTION_TYPE_LABEL,
  VIOLATION_REASON_LABEL,
  VIOLATION_TARGET_LABEL,
  getM05ErrorMessage,
  isSafeHttpUrl,
} from './m05-labels';
import { ApiClientError } from './api-client';

describe('S8-M05-02 — Moderator/Admin UI Labels, Policies, and Error States', () => {
  describe('Moderation target types and decisions policy (C-16, UC50-UC53)', () => {
    it('defines permitted decisions strictly by target type', () => {
      expect(DECISIONS_BY_TARGET.JOB).toEqual(['APPROVE', 'REJECT', 'HIDE']);
      expect(DECISIONS_BY_TARGET.REVIEW).toEqual(['HIDE', 'RESTORE']);
      expect(DECISIONS_BY_TARGET.REPORT).toEqual(['SUBSTANTIATE', 'DISMISS']);
    });

    it('requires a reason for sensitive decisions (AC-02)', () => {
      expect(REASON_REQUIRED).toContain('REJECT');
      expect(REASON_REQUIRED).toContain('HIDE');
      expect(REASON_REQUIRED).toContain('SUBSTANTIATE');
      expect(REASON_REQUIRED).toContain('DISMISS');
      expect(REASON_REQUIRED).not.toContain('APPROVE');
      expect(REASON_REQUIRED).not.toContain('RESTORE');
    });

    it('maps moderation status to appropriate display labels and UI variants', () => {
      expect(STATUS_LABEL.PENDING).toBe('Chờ xử lý');
      expect(STATUS_VARIANT.PENDING).toBe('warning');
      expect(STATUS_LABEL.APPROVED).toBe('Đã duyệt');
      expect(STATUS_VARIANT.APPROVED).toBe('success');
      expect(STATUS_LABEL.REJECTED).toBe('Đã từ chối');
      expect(STATUS_VARIANT.REJECTED).toBe('destructive');
      expect(STATUS_LABEL.SUBSTANTIATED).toBe('Có căn cứ');
      expect(STATUS_VARIANT.SUBSTANTIATED).toBe('destructive');
      expect(STATUS_LABEL.DISMISSED).toBe('Bác bỏ');
    });

    it('translates all decision types to clear Vietnamese labels', () => {
      expect(DECISION_LABEL.APPROVE).toBe('Phê duyệt');
      expect(DECISION_LABEL.REJECT).toBe('Từ chối');
      expect(DECISION_LABEL.HIDE).toBe('Ẩn');
      expect(DECISION_LABEL.RESTORE).toBe('Khôi phục');
      expect(DECISION_LABEL.SUBSTANTIATE).toBe('Kết luận: có căn cứ');
      expect(DECISION_LABEL.DISMISS).toBe('Kết luận: bác bỏ');
    });

    it('maps target type labels for queue filtering', () => {
      expect(TARGET_TYPE_LABEL.JOB).toBe('Tin tuyển dụng');
      expect(TARGET_TYPE_LABEL.REPORT).toBe('Báo cáo vi phạm');
      expect(TARGET_TYPE_LABEL.REVIEW).toBe('Đánh giá');
    });
  });

  describe('Report and Evidence handling (C-17, UC49, UC52)', () => {
    it('safely identifies valid HTTP and HTTPS URLs for evidence rendering', () => {
      expect(isSafeHttpUrl('https://example.com/evidence.png')).toBe(true);
      expect(isSafeHttpUrl('http://storage.local/upload/proof.pdf')).toBe(true);
      expect(isSafeHttpUrl('javascript:alert(1)')).toBe(false);
      expect(isSafeHttpUrl('data:text/html;base64,PHNjcmlwdD4=')).toBe(false);
      expect(isSafeHttpUrl('file:///etc/passwd')).toBe(false);
      expect(isSafeHttpUrl(null)).toBe(false);
      expect(isSafeHttpUrl('')).toBe(false);
    });

    it('maps violation reason labels and target labels accurately', () => {
      expect(VIOLATION_REASON_LABEL.FRAUD).toBe('Lừa đảo');
      expect(VIOLATION_REASON_LABEL.FAKE_INFORMATION).toBe('Thông tin sai sự thật');
      expect(VIOLATION_REASON_LABEL.HARASSMENT).toBe('Quấy rối');
      expect(VIOLATION_REASON_LABEL.SPAM).toBe('Spam');
      expect(VIOLATION_REASON_LABEL.INAPPROPRIATE_CONTENT).toBe('Nội dung không phù hợp');

      expect(VIOLATION_TARGET_LABEL.COMPANY).toBe('Doanh nghiệp');
      expect(VIOLATION_TARGET_LABEL.STUDENT).toBe('Sinh viên');
      expect(VIOLATION_TARGET_LABEL.JOB).toBe('Tin tuyển dụng');
      expect(VIOLATION_TARGET_LABEL.REVIEW).toBe('Đánh giá');
    });

    it('maps report statuses to appropriate labels and badge variants', () => {
      expect(REPORT_STATUS_LABEL.SUBMITTED).toBe('Đã gửi');
      expect(REPORT_STATUS_LABEL.SUBSTANTIATED).toBe('Có căn cứ, chờ phán quyết');
      expect(REPORT_STATUS_VARIANT.SUBSTANTIATED).toBe('destructive');
      expect(REPORT_STATUS_LABEL.RESOLVED).toBe('Đã xử lý');
      expect(REPORT_STATUS_VARIANT.RESOLVED).toBe('success');
    });
  });

  describe('Sanction policies, duration, and company flags (C-19, UC56, UC57, UC59, UC60)', () => {
    it('restricts allowed sanction types according to target type', () => {
      expect(SANCTIONS_BY_REPORT_TARGET.STUDENT).toEqual(['WARNING', 'APPLICATION_LOCK']);
      expect(SANCTIONS_BY_REPORT_TARGET.COMPANY).toEqual(['COMPANY_SUSPENSION']);
      expect(SANCTIONS_BY_REPORT_TARGET.JOB).toEqual([]);
      expect(SANCTIONS_BY_REPORT_TARGET.REVIEW).toEqual([]);
    });

    it('enforces application lock duration bounds between 30 and 90 days', () => {
      expect(LOCK_DAYS_MIN).toBe(30);
      expect(LOCK_DAYS_MAX).toBe(90);
    });

    it('maps sanction types and statuses to Vietnamese labels', () => {
      expect(SANCTION_TYPE_LABEL.WARNING).toBe('Cảnh cáo');
      expect(SANCTION_TYPE_LABEL.APPLICATION_LOCK).toBe('Khóa quyền ứng tuyển');
      expect(SANCTION_TYPE_LABEL.COMPANY_SUSPENSION).toBe('Đình chỉ doanh nghiệp');

      expect(SANCTION_STATUS_LABEL.ACTIVE).toBe('Đang hiệu lực');
      expect(SANCTION_STATUS_VARIANT.ACTIVE).toBe('destructive');
      expect(SANCTION_STATUS_LABEL.LIFTED).toBe('Đã gỡ');
    });
  });

  describe('Error handling & synchronization states (AC-04)', () => {
    it('maps moderation API error codes to user-friendly messages', () => {
      const alreadyDecidedError = new ApiClientError(
        {
          statusCode: 409,
          code: 'MODERATION_ALREADY_DECIDED',
          message: 'Conflict',
          error: 'Conflict',
          timestamp: new Date().toISOString(),
          path: '/moderation/items/1/decision',
        },
        409,
      );
      expect(getModerationErrorMessage(alreadyDecidedError, 'Lỗi')).toBe(
        'Mục này đã được xử lý bởi người khác.',
      );

      const notAssignedError = new ApiClientError(
        {
          statusCode: 403,
          code: 'MODERATION_NOT_ASSIGNED',
          message: 'Forbidden',
          error: 'Forbidden',
          timestamp: new Date().toISOString(),
          path: '/moderation/items/1/decision',
        },
        403,
      );
      expect(getModerationErrorMessage(notAssignedError, 'Lỗi')).toBe(
        'Mục này đang được giao cho người kiểm duyệt khác.',
      );
    });

    it('maps sanction API target synchronization errors accurately (AC-04)', () => {
      const syncFailedError = new ApiClientError(
        {
          statusCode: 502,
          code: 'SANCTION_TARGET_SYNC_FAILED',
          message: 'Bad Gateway',
          error: 'Bad Gateway',
          timestamp: new Date().toISOString(),
          path: '/sanctions',
        },
        502,
      );
      expect(getM05ErrorMessage(syncFailedError, 'Lỗi')).toBe(
        'Không thể áp dụng lên doanh nghiệp lúc này. Vui lòng thử lại.',
      );

      const notActiveError = new ApiClientError(
        {
          statusCode: 409,
          code: 'SANCTION_NOT_ACTIVE',
          message: 'Conflict',
          error: 'Conflict',
          timestamp: new Date().toISOString(),
          path: '/sanctions/1/lift',
        },
        409,
      );
      expect(getM05ErrorMessage(notActiveError, 'Lỗi')).toBe(
        'Chế tài này không còn hiệu lực để gỡ.',
      );
    });

    it('formats date and time safely handling invalid and null strings', () => {
      expect(formatDateTime(null)).toBe('—');
      expect(formatDateTime('invalid-date')).toBe('—');
      const valid = new Date('2026-10-18T10:30:00.000Z').toISOString();
      expect(formatDateTime(valid)).not.toBe('—');
    });
  });
});
