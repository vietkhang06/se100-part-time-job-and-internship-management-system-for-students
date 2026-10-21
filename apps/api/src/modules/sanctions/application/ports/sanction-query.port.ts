export const SANCTION_QUERY_TOKEN = Symbol('SANCTION_QUERY_TOKEN');

export interface ApplicationLockState {
  locked: boolean;
  /** Thời điểm hết khóa; null nếu không bị khóa. */
  until: Date | null;
}

/**
 * Cổng đọc cho M04: trước khi nhận hồ sơ ứng tuyển (UC60), module ứng tuyển hỏi sinh viên có đang bị
 * khóa quyền ứng tuyển không. M05 KHÔNG tự sửa luồng nộp hồ sơ của M04; Gia Khang gọi cổng này.
 */
export interface ISanctionQuery {
  getApplicationLock(studentId: string): Promise<ApplicationLockState>;
}
