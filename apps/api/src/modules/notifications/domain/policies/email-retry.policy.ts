/** Số lần gửi tối đa (kể cả lần đầu). Hết lượt → FAILED vĩnh viễn, không còn lịch thử lại. */
export const MAX_EMAIL_ATTEMPTS = 5;

/** Thời gian "giữ chỗ" khi đang gửi; quá hạn mà chưa có kết quả (crash) thì được gửi lại. */
export const EMAIL_LEASE_MS = 5 * 60 * 1000;

/** Backoff (phút) sau lần thất bại thứ 1,2,3,4. Lần thứ 5 thất bại là hết lượt. */
const BACKOFF_MINUTES = [1, 5, 15, 60];

/**
 * @param attemptsAfterFailure số lần đã thử, tính cả lần vừa thất bại (>=1)
 * @returns thời điểm thử lại, hoặc null nếu đã hết lượt
 */
export function computeNextRetryAt(attemptsAfterFailure: number, now: Date): Date | null {
  if (attemptsAfterFailure >= MAX_EMAIL_ATTEMPTS) {
    return null;
  }
  const idx = Math.min(Math.max(attemptsAfterFailure, 1), BACKOFF_MINUTES.length) - 1;
  return new Date(now.getTime() + BACKOFF_MINUTES[idx] * 60 * 1000);
}
