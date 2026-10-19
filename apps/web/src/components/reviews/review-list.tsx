'use client';

import * as React from 'react';
import type { PublicReviewDto, ReviewSummaryDto } from '@campusjob/contracts';
import { Card } from '@/components/ui/card';
import { StarRating } from '@/components/reviews/star-rating';
import { formatDateTime } from '@/lib/m05-labels';

/** Điểm trung bình và phân bố số sao của doanh nghiệp. */
export function ReviewSummaryCard({ summary }: { summary: ReviewSummaryDto }) {
  const stars = ['5', '4', '3', '2', '1'] as const;
  return (
    <Card className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
      <div className="text-center sm:w-40">
        <p className="text-3xl font-bold text-foreground">
          {summary.averageRating === null ? '—' : summary.averageRating.toFixed(1)}
        </p>
        {summary.averageRating !== null && <StarRating value={summary.averageRating} />}
        <p className="text-xs text-muted-foreground">{summary.totalReviews} đánh giá</p>
      </div>
      <div className="flex-1 space-y-1">
        {stars.map((star) => {
          const count = summary.distribution[star];
          const percent = summary.totalReviews === 0 ? 0 : Math.round((count / summary.totalReviews) * 100);
          return (
            <div key={star} className="flex items-center gap-2 text-xs">
              <span className="w-10 text-muted-foreground">{star} sao</span>
              <div className="h-2 flex-1 overflow-hidden rounded bg-muted">
                <div className="h-full bg-amber-500" style={{ width: `${percent}%` }} />
              </div>
              <span className="w-8 text-right text-muted-foreground">{count}</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/** Danh sách đánh giá công khai (người viết ẩn danh). `renderActions` dành cho nhà tuyển dụng (nút Phản hồi). */
export function ReviewItems({
  reviews,
  renderActions,
}: {
  reviews: PublicReviewDto[];
  renderActions?: (review: PublicReviewDto) => React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      {reviews.map((review) => (
        <Card key={review.id} className="space-y-2 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <StarRating value={review.rating} />
            <span className="text-xs text-muted-foreground">Sinh viên ẩn danh · {formatDateTime(review.createdAt)}</span>
          </div>
          {review.comment && <p className="whitespace-pre-wrap break-words text-sm">{review.comment}</p>}
          {review.reply && (
            <div className="rounded-lg border-l-4 border-primary bg-muted/50 p-3 text-sm">
              <p className="text-xs font-semibold text-foreground/80">Phản hồi của doanh nghiệp</p>
              <p className="whitespace-pre-wrap break-words">{review.reply.content}</p>
              <p className="text-xs text-muted-foreground">{formatDateTime(review.reply.createdAt)}</p>
            </div>
          )}
          {renderActions?.(review)}
        </Card>
      ))}
    </div>
  );
}
