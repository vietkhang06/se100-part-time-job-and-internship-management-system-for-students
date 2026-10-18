import { ApiClientError } from '@/lib/api-client';

/** Nhãn tiếng Việt cho báo cáo vi phạm (C-17), đánh giá (C-18) và chế tài (C-19). */
export type BadgeVariant = 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline';

export const VIOLATION_REASON_LABEL: Record<string, string> = {
  FRAUD: 'Lừa đảo',
  FAKE_INFORMATION: 'Thông tin sai sự thật',
  HARASSMENT: 'Quấy rối',
  SPAM: 'Spam',
  INAPPROPRIATE_CONTENT: 'Nội dung không phù hợp',
  OTHER: 'Khác',
};

export const VIOLATION_TARGET_LABEL: Record<string, string> = {
  COMPANY: 'Doanh nghiệp',
  STUDENT: 'Sinh viên',
  JOB: 'Tin tuyển dụng',
  REVIEW: 'Đánh giá',
};

export const REPORT_STATUS_LABEL: Record<string, string> = {
  SUBMITTED: 'Đã gửi',
  UNDER_REVIEW: 'Đang thẩm tra',
  SUBSTANTIATED: 'Có căn cứ, chờ phán quyết',
  DISMISSED: 'Đã bác bỏ',
  RESOLVED: 'Đã xử lý',
};

export const REPORT_STATUS_VARIANT: Record<string, BadgeVariant> = {
  SUBMITTED: 'secondary',
  UNDER_REVIEW: 'warning',
  SUBSTANTIATED: 'destructive',
  DISMISSED: 'secondary',
  RESOLVED: 'success',
};

export const SANCTION_TYPE_LABEL: Record<string, string> = {
  WARNING: 'Cảnh cáo',
  APPLICATION_LOCK: 'Khóa quyền ứng tuyển',
  COMPANY_SUSPENSION: 'Đình chỉ doanh nghiệp',
};

export const SANCTION_STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Đang hiệu lực',
  LIFTED: 'Đã gỡ',
  EXPIRED: 'Đã hết hạn',
};

export const SANCTION_STATUS_VARIANT: Record<string, BadgeVariant> = {
  ACTIVE: 'destructive',
  LIFTED: 'secondary',
  EXPIRED: 'secondary',
};

/** Chế tài được phép theo loại đối tượng của báo cáo. Khớp sanction-rules.policy ở BE. */
export const SANCTIONS_BY_REPORT_TARGET: Record<string, string[]> = {
  STUDENT: ['WARNING', 'APPLICATION_LOCK'],
  COMPANY: ['COMPANY_SUSPENSION'],
  JOB: [],
  REVIEW: [],
};

export const LOCK_DAYS_MIN = 1;
export const LOCK_DAYS_MAX = 90;

const ERROR_MESSAGE_BY_CODE: Record<string, string> = {
  REPORT_TARGET_NOT_ALLOWED: 'Bạn không thể báo cáo loại đối tượng này.',
  REPORT_TARGET_UNAVAILABLE: 'Chưa hỗ trợ báo cáo loại đối tượng này.',
  REPORT_TARGET_NOT_FOUND: 'Không tìm thấy đối tượng cần báo cáo.',
  REPORT_SELF_TARGET: 'Bạn không thể báo cáo chính mình.',
  REPORT_DUPLICATE: 'Bạn đã có một báo cáo đang được xử lý về đối tượng này.',
  REPORT_NOT_FOUND: 'Không tìm thấy báo cáo.',
  REVIEW_SOURCE_UNAVAILABLE: 'Chức năng đánh giá chưa sẵn sàng. Vui lòng thử lại sau.',
  REVIEW_APPLICATION_NOT_FOUND: 'Không tìm thấy hồ sơ ứng tuyển của bạn.',
  REVIEW_NOT_ELIGIBLE: 'Chỉ được đánh giá sau khi hồ sơ ứng tuyển đã có kết quả cuối.',
  REVIEW_COMPANY_NOT_FOUND: 'Không tìm thấy doanh nghiệp.',
  REVIEW_ALREADY_EXISTS: 'Bạn đã đánh giá doanh nghiệp cho hồ sơ ứng tuyển này.',
  REVIEW_NOT_FOUND: 'Không tìm thấy đánh giá.',
  REVIEW_ALREADY_REPLIED: 'Đánh giá này đã có phản hồi.',
  SANCTION_REASON_REQUIRED: 'Vui lòng nhập lý do.',
  SANCTION_REPORT_NOT_FOUND: 'Không tìm thấy báo cáo.',
  SANCTION_REPORT_ALREADY_RESOLVED: 'Báo cáo này đã được phán quyết.',
  SANCTION_REPORT_NOT_SUBSTANTIATED: 'Chỉ xử lý các báo cáo đã được xác nhận có căn cứ.',
  SANCTION_TYPE_NOT_ALLOWED: 'Loại chế tài này không áp dụng cho đối tượng của báo cáo.',
  SANCTION_DURATION_INVALID: 'Thời hạn khóa không hợp lệ.',
  SANCTION_TARGET_NOT_FOUND: 'Không tìm thấy đối tượng bị chế tài.',
  SANCTION_TARGET_UNAVAILABLE: 'Chưa thể áp chế tài lên doanh nghiệp lúc này (module doanh nghiệp chưa kết nối).',
  SANCTION_TARGET_SYNC_FAILED: 'Không thể áp dụng lên doanh nghiệp lúc này. Vui lòng thử lại.',
  SANCTION_ALREADY_ACTIVE: 'Đối tượng này đang chịu chế tài cùng loại.',
  SANCTION_ESCALATION_REQUIRED: 'Đã đủ ngưỡng cảnh cáo. Cần áp dụng khóa quyền ứng tuyển.',
  SANCTION_ALREADY_APPLIED_FOR_REPORT: 'Báo cáo này đã có chế tài.',
  SANCTION_NOT_FOUND: 'Không tìm thấy chế tài.',
  SANCTION_NOT_ACTIVE: 'Chế tài này không còn hiệu lực để gỡ.',
};

export function getM05ErrorCode(error: unknown): string | undefined {
  return error instanceof ApiClientError ? error.errorResponse.code : undefined;
}

export function getM05ErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiClientError) {
    const code = error.errorResponse.code;
    if (code && ERROR_MESSAGE_BY_CODE[code]) return ERROR_MESSAGE_BY_CODE[code];
    if (error.status === 401) return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
    if (error.status === 403) return 'Bạn không có quyền thực hiện thao tác này.';
    if (error.status === 429) return 'Bạn thao tác quá nhanh. Vui lòng thử lại sau.';
    if (error.status >= 500) return fallback;
    return error.message || fallback;
  }
  return fallback;
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('vi-VN');
}

export function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('vi-VN');
}

export function isSafeHttpUrl(value: string | null): value is string {
  return value !== null && /^https?:\/\//i.test(value);
}
