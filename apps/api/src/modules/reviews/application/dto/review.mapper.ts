import { PublicReviewDto, ReviewDto, ReviewReplyDto } from '@campusjob/contracts';
import { ReviewEntity } from '../../domain/entities/review.entity';

function toReplyDto(review: ReviewEntity): ReviewReplyDto | null {
  return review.reply
    ? { content: review.reply.content, createdAt: review.reply.createdAt.toISOString() }
    : null;
}

/** Góc nhìn của chính sinh viên đã viết đánh giá. */
export function toReviewDto(review: ReviewEntity): ReviewDto {
  return {
    id: review.id,
    applicationId: review.applicationId,
    companyId: review.companyId,
    rating: review.rating,
    comment: review.comment,
    visibility: review.visibility,
    createdAt: review.createdAt.toISOString(),
    reply: toReplyDto(review),
  };
}

/** Dữ liệu công khai: ẩn danh người viết (không có studentId/tên), không lộ trạng thái ẩn. */
export function toPublicReviewDto(review: ReviewEntity): PublicReviewDto {
  return {
    id: review.id,
    rating: review.rating,
    comment: review.comment,
    createdAt: review.createdAt.toISOString(),
    reply: toReplyDto(review),
  };
}
