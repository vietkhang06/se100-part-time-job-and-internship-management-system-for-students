import type { CompanyReviewListDto, PaginatedResponse, ReviewDto } from '@campusjob/contracts';
import { buildQuery, request } from '@/lib/m05-request';

export interface CreateReviewBody {
  applicationId: string;
  rating: number;
  comment?: string;
}

/** UC46 — sinh viên đánh giá doanh nghiệp sau khi hồ sơ ứng tuyển có kết quả cuối. */
export function createReview(body: CreateReviewBody) {
  return request<ReviewDto>('/reviews', { method: 'POST', body: JSON.stringify(body) });
}

export function listMyReviews(page: number, limit = 10) {
  return request<PaginatedResponse<ReviewDto>>(`/reviews/mine${buildQuery({ page, limit })}`);
}

/** UC45 — nhà tuyển dụng xem đánh giá dành cho doanh nghiệp của mình. */
export function listEmployerReviews(page: number, limit = 10) {
  return request<CompanyReviewListDto>(`/reviews/employer${buildQuery({ page, limit })}`);
}

/** Đánh giá công khai của một doanh nghiệp (dùng cho trang doanh nghiệp của M03). */
export function listCompanyReviews(companyId: string, page: number, limit = 10) {
  return request<CompanyReviewListDto>(
    `/reviews/company/${encodeURIComponent(companyId)}${buildQuery({ page, limit })}`,
  );
}

/** UC47 — phản hồi đánh giá (một lần). */
export function replyToReview(id: string, content: string) {
  return request<ReviewDto>(`/reviews/${encodeURIComponent(id)}/reply`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
}
