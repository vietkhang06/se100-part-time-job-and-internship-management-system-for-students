/**
 * Quy tắc đánh giá doanh nghiệp (C-18, DRAFT — UC45/UC46/UC47).
 *
 * "Chỉ được đánh giá sau trạng thái cuối": hồ sơ ứng tuyển phải kết thúc có kết quả.
 * Mặc định tính ACCEPTED và REJECTED; WITHDRAWN (sinh viên tự rút) KHÔNG được đánh giá.
 * Cần Lead/M04 xác nhận lại danh sách này (xem docs/api/REVIEW_API_CONTRACT.md).
 */
export const FINAL_APPLICATION_STATUSES: readonly string[] = ['ACCEPTED', 'REJECTED'];

export const MIN_RATING = 1;
export const MAX_RATING = 5;
export const MAX_COMMENT_LENGTH = 2000;
export const MAX_REPLY_LENGTH = 1000;

export function isFinalApplicationStatus(status: string): boolean {
  return FINAL_APPLICATION_STATUSES.includes(status);
}

export function isValidRating(rating: number): boolean {
  return Number.isInteger(rating) && rating >= MIN_RATING && rating <= MAX_RATING;
}
