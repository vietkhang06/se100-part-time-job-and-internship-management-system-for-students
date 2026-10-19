'use client';

import * as React from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Spinner } from '@/components/ui/spinner';
import { Pager } from '@/components/m05/pager';
import { RoleGate } from '@/components/m05/role-gate';
import { StarRating } from '@/components/reviews/star-rating';
import { listMyReviews } from '@/lib/reviews-api';
import { useAsyncResource } from '@/lib/use-async-resource';
import { formatDateTime } from '@/lib/m05-labels';

const header = (
  <PageHeader title="Đánh giá của tôi" description="Các đánh giá bạn đã gửi cho doanh nghiệp sau khi ứng tuyển." />
);

export default function CandidateReviewsPage() {
  return (
    <RoleGate roles={['STUDENT']} header={header}>
      <CandidateReviewsContent />
    </RoleGate>
  );
}

function CandidateReviewsContent() {
  const [page, setPage] = React.useState(1);
  const load = React.useCallback(() => listMyReviews(page), [page]);
  const { data, isLoading, error, reload } = useAsyncResource(load, true, 'Không thể tải đánh giá của bạn.');
  const reviews = data?.data ?? [];

  return (
    <div className="space-y-6">
      {header}
      <Alert variant="info">
        Bạn có thể đánh giá doanh nghiệp sau khi hồ sơ ứng tuyển đã có kết quả cuối. Đánh giá hiển thị công khai ở dạng
        ẩn danh.
      </Alert>
      {error ? (
        <ErrorState message={error} onRetry={() => void reload()} />
      ) : isLoading && !data ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : reviews.length === 0 ? (
        <EmptyState title="Bạn chưa đánh giá doanh nghiệp nào" description="Các đánh giá của bạn sẽ hiện ở đây." />
      ) : (
        <div className="space-y-3" aria-busy={isLoading}>
          {reviews.map((review) => (
            <Card key={review.id} className="space-y-2 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <StarRating value={review.rating} />
                <span className="text-xs text-muted-foreground">{formatDateTime(review.createdAt)}</span>
                {review.visibility === 'HIDDEN' && <Badge variant="warning">Đã bị ẩn bởi kiểm duyệt</Badge>}
              </div>
              {review.comment && <p className="whitespace-pre-wrap break-words text-sm">{review.comment}</p>}
              {review.reply && (
                <div className="rounded-lg border-l-4 border-primary bg-muted/50 p-3 text-sm">
                  <p className="text-xs font-semibold text-foreground/80">Doanh nghiệp đã phản hồi</p>
                  <p className="whitespace-pre-wrap break-words">{review.reply.content}</p>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
      {data && <Pager meta={data.meta} isLoading={isLoading} onPage={setPage} />}
    </div>
  );
}
