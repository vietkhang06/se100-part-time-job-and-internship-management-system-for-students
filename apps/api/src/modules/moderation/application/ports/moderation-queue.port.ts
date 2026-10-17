import { ModerationTargetType } from '@campusjob/contracts';

export const MODERATION_QUEUE_TOKEN = Symbol('MODERATION_QUEUE_TOKEN');

export interface EnqueueModerationInput {
  targetType: ModerationTargetType;
  /** Id của đối tượng trong module sở hữu (jobId, reportId, reviewId). */
  targetId: string;
  /** Người gửi/chủ sở hữu, dùng để thông báo kết quả (ví dụ employer của tin). */
  submitterId?: string;
  /** Tiêu đề ngắn hiển thị trong hàng đợi (ví dụ tên tin tuyển dụng). */
  summary?: string;
}

export interface EnqueueModerationResult {
  itemId: string;
  round: number;
  outcome: 'CREATED' | 'ALREADY_PENDING';
}

/**
 * Cổng công khai của M05 (C-16) để module khác đưa nội dung vào hàng chờ kiểm duyệt.
 * Gọi lại khi vòng trước đã có quyết định → tạo vòng mới ("duyệt lại").
 */
export interface IModerationQueue {
  enqueue(input: EnqueueModerationInput): Promise<EnqueueModerationResult>;
}
