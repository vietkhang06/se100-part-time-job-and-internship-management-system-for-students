import {
  SanctionTargetType,
  SanctionType,
  ViolationTargetType,
} from '@campusjob/contracts';

/**
 * Chính sách chế tài M05 (S3-M05-04 / ADR-015, docs/api/M05_SANCTION_POLICY_DECISION.md).
 * Trạng thái: ĐỀ XUẤT chờ Owner/PM duyệt. Đổi tại đây, không rải trong use case.
 *
 * "Lần vi phạm" N = số báo cáo về cùng sinh viên đã được kết luận SUBSTANTIATED trong cửa sổ 180 ngày
 * (tính cả đầu mút, tính cả báo cáo đang phán quyết, bỏ báo cáo có chế tài đã bị gỡ).
 *   N = 1  → chỉ ghi nhận (đóng không xử phạt)
 *   N = 2  → chỉ được cảnh cáo
 *   N >= 3 → buộc khóa quyền ứng tuyển 30–90 ngày
 */
export const MIN_LOCK_DAYS = 30;
export const MAX_LOCK_DAYS = 90;

export const VIOLATION_WINDOW_DAYS = 180;
export const WARNING_MIN_VIOLATION = 2;
export const LOCK_MIN_VIOLATION = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Chế tài được phép theo loại đối tượng của báo cáo.
 * JOB/REVIEW không có chế tài trực tiếp: nội dung xử lý qua kiểm duyệt (UC51/UC53), Admin vẫn có thể
 * đóng báo cáo không xử phạt.
 */
const ALLOWED_BY_REPORT_TARGET: Record<ViolationTargetType, readonly SanctionType[]> = {
  [ViolationTargetType.STUDENT]: [SanctionType.WARNING, SanctionType.APPLICATION_LOCK],
  [ViolationTargetType.COMPANY]: [SanctionType.COMPANY_SUSPENSION],
  [ViolationTargetType.JOB]: [],
  [ViolationTargetType.REVIEW]: [],
};

export function allowedSanctionTypes(reportTarget: ViolationTargetType): readonly SanctionType[] {
  return ALLOWED_BY_REPORT_TARGET[reportTarget];
}

export function sanctionTargetType(type: SanctionType): SanctionTargetType {
  return type === SanctionType.COMPANY_SUSPENSION ? SanctionTargetType.COMPANY : SanctionTargetType.STUDENT;
}

/** Trả mã lỗi nếu thời hạn không hợp lệ cho loại chế tài, ngược lại null. */
export function validateDuration(type: SanctionType, durationDays: number | undefined): string | null {
  if (type === SanctionType.APPLICATION_LOCK) {
    if (
      durationDays === undefined ||
      !Number.isInteger(durationDays) ||
      durationDays < MIN_LOCK_DAYS ||
      durationDays > MAX_LOCK_DAYS
    ) {
      return `Khóa quyền ứng tuyển cần thời hạn từ ${MIN_LOCK_DAYS} đến ${MAX_LOCK_DAYS} ngày.`;
    }
    return null;
  }
  if (durationDays !== undefined) {
    return 'Chế tài này không có thời hạn.';
  }
  return null;
}

export function computeEndsAt(type: SanctionType, durationDays: number | undefined, now: Date): Date | null {
  if (type === SanctionType.APPLICATION_LOCK && durationDays !== undefined) {
    return new Date(now.getTime() + durationDays * DAY_MS);
  }
  return null;
}

/** Đầu cửa sổ đếm vi phạm: đúng 180 ngày trước `now` vẫn được tính (so sánh >=). */
export function violationWindowStart(now: Date): Date {
  return new Date(now.getTime() - VIOLATION_WINDOW_DAYS * DAY_MS);
}

export interface SanctionTierError {
  code: 'SANCTION_ESCALATION_REQUIRED' | 'SANCTION_TIER_INVALID';
  message: string;
}

/**
 * Kiểm tra loại chế tài có đúng bậc theo số lần vi phạm N của sinh viên không.
 * Chỉ áp dụng cho báo cáo về sinh viên; doanh nghiệp (đình chỉ) không có ngưỡng đếm.
 */
export function checkSanctionTier(
  reportTarget: ViolationTargetType,
  type: SanctionType,
  violationCount: number,
): SanctionTierError | null {
  if (reportTarget !== ViolationTargetType.STUDENT) return null;

  if (violationCount < WARNING_MIN_VIOLATION) {
    return {
      code: 'SANCTION_TIER_INVALID',
      message: 'Đây là lần vi phạm đầu tiên trong 180 ngày: chỉ ghi nhận, chưa áp chế tài.',
    };
  }
  if (violationCount < LOCK_MIN_VIOLATION) {
    return type === SanctionType.WARNING
      ? null
      : {
          code: 'SANCTION_TIER_INVALID',
          message: 'Đây là lần vi phạm thứ hai trong 180 ngày: chỉ được cảnh cáo.',
        };
  }
  return type === SanctionType.APPLICATION_LOCK
    ? null
    : {
        code: 'SANCTION_ESCALATION_REQUIRED',
        message: 'Từ lần vi phạm thứ ba trong 180 ngày cần áp dụng khóa quyền ứng tuyển.',
      };
}

/** Mô tả ngắn hiển thị trong thông báo gửi người bị chế tài. */
export function describeSanction(type: SanctionType, endsAt: Date | null): string {
  switch (type) {
    case SanctionType.WARNING:
      return 'cảnh cáo';
    case SanctionType.APPLICATION_LOCK:
      return endsAt
        ? `khóa quyền ứng tuyển đến ${endsAt.toLocaleDateString('vi-VN')}`
        : 'khóa quyền ứng tuyển';
    case SanctionType.COMPANY_SUSPENSION:
      return 'đình chỉ hoạt động doanh nghiệp';
  }
}
