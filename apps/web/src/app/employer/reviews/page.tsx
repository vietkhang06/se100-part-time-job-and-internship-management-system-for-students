'use client';

import * as React from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Spinner } from '@/components/ui/spinner';
import { Pager } from '@/components/m05/pager';
import { RoleGate } from '@/components/m05/role-gate';
import { ReviewItems, ReviewSummaryCard } from '@/components/reviews/review-list';
import { ReplyDialog } from '@/components/reviews/reply-dialog';
import { listEmployerReviews } from '@/lib/reviews-api';
import { useAsyncResource } from '@/lib/use-async-resource';

const header = (
  <PageHeader
    title="Đánh giá doanh nghiệp"
    description="Xem đánh giá của sinh viên dành cho doanh nghiệp của bạn và phản hồi một lần cho mỗi đánh giá."
  />
);

export default function EmployerReviewsPage() {
  return (
    <RoleGate roles={['EMPLOYER']} header={header}>
      <EmployerReviewsContent />
    </RoleGate>
  );
}

function EmployerReviewsContent() {
  const [page, setPage] = React.useState(1);
  const [replyingId, setReplyingId] = React.useState<string | null>(null);
  const load = React.useCallback(() => listEmployerReviews(page), [page]);
  const { data, isLoading, error, reload } = useAsyncResource(load, true, 'Không thể tải đánh giá.');
  const reviews = data?.data ?? [];

  return (
    <div className="space-y-6">
      {header}
      {error ? (
        <ErrorState message={error} onRetry={() => void reload()} />
      ) : isLoading && !data ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : data ? (
        <>
          <ReviewSummaryCard summary={data.summary} />
          {reviews.length === 0 ? (
            <EmptyState
              title="Chưa có đánh giá nào"
              description="Đánh giá xuất hiện khi sinh viên hoàn tất quy trình ứng tuyển và gửi nhận xét."
            />
          ) : (
            <ReviewItems
              reviews={reviews}
              renderActions={(review) =>
                review.reply ? null : (
                  <Button type="button" size="sm" variant="outline" onClick={() => setReplyingId(review.id)}>
                    Phản hồi
                  </Button>
                )
              }
            />
          )}
          <Pager meta={data.meta} isLoading={isLoading} onPage={setPage} />
        </>
      ) : null}

      <ReplyDialog
        reviewId={replyingId}
        onClose={() => setReplyingId(null)}
        onReplied={() => void reload()}
      />
    </div>
  );
}