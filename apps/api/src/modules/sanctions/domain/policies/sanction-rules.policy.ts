import {
  SanctionTargetType,
  SanctionType,
  ViolationTargetType,
} from '@campusjob/contracts';

/**
 * Quy tắc chế tài (C-19 — DRAFT). Các con số bên dưới là ĐỀ XUẤT, đang chờ Lead chốt (DG13:
 * "ngưỡng", "thời hạn" chưa được quy định trong đặc tả). Đổi tại đây, không rải trong use case.
 */
export const MIN_LOCK_DAYS = 1;
export const MAX_LOCK_DAYS = 90;

/** Số cảnh cáo còn hiệu lực trong cửa sổ thời gian trước khi buộc phải khóa quyền ứng tuyển. */
export const WARNING_ESCALATION_THRESHOLD = 3;
export const WARNING_ESCALATION_WINDOW_DAYS = 180;

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

export function escalationWindowStart(now: Date): Date {
  return new Date(now.getTime() - WARNING_ESCALATION_WINDOW_DAYS * DAY_MS);
}

export function requiresEscalation(recentWarnings: number): boolean {
  return recentWarnings >= WARNING_ESCALATION_THRESHOLD;
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
