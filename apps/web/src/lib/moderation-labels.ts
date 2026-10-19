import { ApiClientError } from '@/lib/api-client';

/**
 * Nhãn tiếng Việt và quy tắc hiển thị cho màn hình kiểm duyệt (C-16, UC50-UC53).
 * Các giá trị dạng chuỗi khớp với enum ModerationTargetType / ModerationStatus / ModerationDecisionType ở BE.
 */
export type ModerationDecisionValue =
  | 'APPROVE'
  | 'REJECT'
  | 'HIDE'
  | 'RESTORE'
  | 'SUBSTANTIATE'
  | 'DISMISS';

export type BadgeVariant = 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline';

export const TARGET_TYPE_LABEL: Record<string, string> = {
  JOB: 'Tin tuyển dụng',
  REPORT: 'Báo cáo vi phạm',
  REVIEW: 'Đánh giá',
};

export const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Chờ xử lý',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Đã từ chối',
  HIDDEN: 'Đã ẩn',
  RESTORED: 'Đã khôi phục',
  SUBSTANTIATED: 'Có căn cứ',
  DISMISSED: 'Bác bỏ',
};

export const STATUS_VARIANT: Record<string, BadgeVariant> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'destructive',
  HIDDEN: 'secondary',
  RESTORED: 'success',
  SUBSTANTIATED: 'destructive',
  DISMISSED: 'secondary',
};

export const DECISION_LABEL: Record<string, string> = {
  APPROVE: 'Phê duyệt',
  REJECT: 'Từ chối',
  HIDE: 'Ẩn',
  RESTORE: 'Khôi phục',
  SUBSTANTIATE: 'Kết luận: có căn cứ',
  DISMISS: 'Kết luận: bác bỏ',
};

/** Quyết định được phép theo loại nội dung (UC51 tin, UC53 đánh giá, UC52 báo cáo). Khớp moderation-state.policy ở BE. */
export const DECISIONS_BY_TARGET: Record<string, ModerationDecisionValue[]> = {
  JOB: ['APPROVE', 'REJECT', 'HIDE'],
  REVIEW: ['HIDE', 'RESTORE'],
  REPORT: ['SUBSTANTIATE', 'DISMISS'],
};

/** Quyết định bắt buộc kèm lý do. Khớp BE. */
export const REASON_REQUIRED: ModerationDecisionValue[] = ['REJECT', 'HIDE', 'SUBSTANTIATE', 'DISMISS'];

export const REASON_MAX_LENGTH = 1000;
export const PROPOSED_ACTION_MAX_LENGTH = 500;

const ERROR_MESSAGE_BY_CODE: Record<string, string> = {
  MODERATION_ITEM_NOT_FOUND: 'Không tìm thấy mục kiểm duyệt.',
  MODERATION_DECISION_NOT_ALLOWED: 'Quyết định này không áp dụng cho loại nội dung đang xử lý.',
  MODERATION_REASON_REQUIRED: 'Vui lòng nhập lý do cho quyết định này.',
  MODERATION_PROPOSED_ACTION_NOT_ALLOWED: 'Chỉ báo cáo vi phạm mới có đề xuất xử lý.',
  MODERATION_NOT_ASSIGNED: 'Mục này đang được giao cho người kiểm duyệt khác.',
  MODERATION_ALREADY_ASSIGNED: 'Mục này đã được giao cho người kiểm duyệt khác.',
  MODERATION_ALREADY_DECIDED: 'Mục này đã được xử lý bởi người khác.',
};

export function getErrorCode(error: unknown): string | undefined {
  return error instanceof ApiClientError ? error.errorResponse.code : undefined;
}

export function getModerationErrorMessage(error: unknown, fallback: string): string {
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
