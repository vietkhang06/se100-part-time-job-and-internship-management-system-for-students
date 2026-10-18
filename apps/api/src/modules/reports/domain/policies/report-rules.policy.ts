import { UserRole, ViolationTargetType as T } from '@campusjob/contracts';

export const MAX_EVIDENCE_PER_REPORT = 5;

/**
 * Ai được báo cáo loại đối tượng nào (UC49: doanh nghiệp, sinh viên hoặc nội dung). DRAFT — chờ Lead xác nhận.
 *   Sinh viên       : doanh nghiệp, tin tuyển dụng, đánh giá
 *   Nhà tuyển dụng  : sinh viên (ứng viên), đánh giá
 */
const ALLOWED_TARGETS: Partial<Record<UserRole, readonly T[]>> = {
  [UserRole.STUDENT]: [T.COMPANY, T.JOB, T.REVIEW],
  [UserRole.EMPLOYER]: [T.STUDENT, T.REVIEW],
};

export function canReportTarget(role: UserRole, targetType: T): boolean {
  return ALLOWED_TARGETS[role]?.includes(targetType) ?? false;
}

/** Khóa duy nhất cho báo cáo còn mở; báo cáo đã đóng thì openKey = null nên được phép báo cáo lại. */
export function buildOpenKey(reporterId: string, targetType: T, targetId: string): string {
  return `${reporterId}:${targetType}:${targetId}`;
}
