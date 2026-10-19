import { ReviewVisibility } from '@campusjob/contracts';
import { ReviewEntity } from '../entities/review.entity';

export const REVIEW_REPOSITORY_TOKEN = Symbol('REVIEW_REPOSITORY_TOKEN');

export interface CreateReviewData {
  applicationId: string;
  studentId: string;
  companyId: string;
  rating: number;
  comment: string | null;
}

export interface ReviewSummary {
  averageRating: number | null;
  totalReviews: number;
  distribution: Record<'1' | '2' | '3' | '4' | '5', number>;
}

export interface IReviewRepository {
  /** duplicate=true khi hồ sơ ứng tuyển này đã có đánh giá. */
  create(data: CreateReviewData): Promise<{ review: ReviewEntity | null; duplicate: boolean }>;
  findById(id: string): Promise<ReviewEntity | null>;
  listByStudent(
    studentId: string,
    page: number,
    limit: number,
  ): Promise<{ items: ReviewEntity[]; total: number }>;
  /** Chỉ đánh giá đang hiển thị (VISIBLE), mới nhất trước. */
  listVisibleByCompany(
    companyId: string,
    page: number,
    limit: number,
  ): Promise<{ items: ReviewEntity[]; total: number }>;
  /** Thống kê chỉ tính đánh giá VISIBLE. */
  summarizeVisibleByCompany(companyId: string): Promise<ReviewSummary>;
  /** duplicate=true khi đánh giá đã có phản hồi (mỗi đánh giá chỉ một phản hồi). */
  createReply(data: {
    reviewId: string;
    employerId: string;
    content: string;
  }): Promise<{ created: boolean }>;
  /** Idempotent. false nếu không tìm thấy đánh giá. */
  setVisibility(id: string, visibility: ReviewVisibility): Promise<boolean>;
}
