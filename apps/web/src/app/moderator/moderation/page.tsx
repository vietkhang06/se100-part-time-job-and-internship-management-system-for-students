'use client';

import * as React from 'react';
import Link from 'next/link';
import type { ModerationItemDto, PaginatedResponse } from '@campusjob/contracts';
import { PageHeader } from '@/components/layout/page-header';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Select } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { ModerationItemDialog } from '@/components/moderation/moderation-item-dialog';
import { useAuth } from '@/lib/auth-context';
import { listModerationQueue } from '@/lib/moderation-api';
import {
  STATUS_LABEL,
  STATUS_VARIANT,
  TARGET_TYPE_LABEL,
  formatDateTime,
  getModerationErrorMessage,
} from '@/lib/moderation-labels';

const PAGE_SIZE = 10;

const STATUS_OPTIONS = [
  { label: 'Chờ xử lý', value: 'PENDING' },
  { label: 'Đã duyệt', value: 'APPROVED' },
  { label: 'Đã từ chối', value: 'REJECTED' },
  { label: 'Đã ẩn', value: 'HIDDEN' },
  { label: 'Đã khôi phục', value: 'RESTORED' },
  { label: 'Có căn cứ', value: 'SUBSTANTIATED' },
  { label: 'Bác bỏ', value: 'DISMISSED' },
];

const TARGET_OPTIONS = [
  { label: 'Tất cả loại nội dung', value: '' },
  { label: 'Tin tuyển dụng', value: 'JOB' },
  { label: 'Báo cáo vi phạm', value: 'REPORT' },
  { label: 'Đánh giá', value: 'REVIEW' },
];

function itemTitle(item: ModerationItemDto): string {
  return item.summary ?? `${TARGET_TYPE_LABEL[item.targetType] ?? item.targetType} #${item.targetId.slice(0, 8)}`;
}


export default function ModerationPage() {
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const role: string | null = user ? user.role : null;
  const canModerate = role === 'MODERATOR' || role === 'ADMIN';

  const [status, setStatus] = React.useState('PENDING');
  const [targetType, setTargetType] = React.useState('');
  const [assignedToMe, setAssignedToMe] = React.useState(false);
  const [page, setPage] = React.useState(1);

  const [data, setData] = React.useState<PaginatedResponse<ModerationItemDto> | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const latestRequest = React.useRef(0);

  const fetchQueue = React.useCallback(async () => {
    const requestId = ++latestRequest.current;
    setIsLoading(true);
    setError(null);
    try {
      const result = await listModerationQueue({
        status,
        targetType: targetType || undefined,
        assignedToMe,
        page,
        limit: PAGE_SIZE,
      });
      if (requestId !== latestRequest.current) return;
      if (result.data.length === 0 && page > 1) {
        // Trang hiện tại không còn mục nào (vừa xử lý xong): lùi về trang cuối còn dữ liệu.
        setPage(Math.max(1, result.meta.totalPages));
        return;
      }
      setData(result);
    } catch (err) {
      if (requestId !== latestRequest.current) return;
      setError(getModerationErrorMessage(err, 'Không thể tải hàng đợi kiểm duyệt. Vui lòng thử lại.'));
    } finally {
      if (requestId === latestRequest.current) setIsLoading(false);
    }
  }, [status, targetType, assignedToMe, page]);

  React.useEffect(() => {
    if (canModerate) {
      void fetchQueue();
    }
  }, [canModerate, fetchQueue]);

  const handleStatusChange = (value: string) => {
    setStatus(value);
    setPage(1);
  };
  const handleTargetTypeChange = (value: string) => {
    setTargetType(value);
    setPage(1);
  };
  const handleAssignedToMeChange = (checked: boolean) => {
    setAssignedToMe(checked);
    setPage(1);
  };

  const header = (
    <PageHeader
      title="Trung tâm kiểm duyệt"
      description="Thẩm định doanh nghiệp mới đăng ký, phê duyệt tin tuyển dụng và xử lý báo cáo vi phạm."
      action={
        canModerate ? (
          <Button type="button" variant="outline" onClick={() => void fetchQueue()} disabled={isLoading}>
            Làm mới
          </Button>
        ) : undefined
      }
    />
  );

  if (isAuthLoading) {
    return (
      <div>
        {header}
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div>
        {header}
        <Alert variant="warning" title="Cần đăng nhập">
          Vui lòng{' '}
          <Link href="/login" className="font-medium underline">
            đăng nhập
          </Link>{' '}
          bằng tài khoản Kiểm duyệt viên để xem hàng đợi.
        </Alert>
      </div>
    );
  }

  if (!canModerate) {
    return (
      <div>
        {header}
        <Alert variant="destructive" title="Không có quyền truy cập">
          Chỉ Kiểm duyệt viên và Quản trị viên mới xem được hàng đợi kiểm duyệt.
        </Alert>
      </div>
    );
  }

  const items = data?.data ?? [];
  const meta = data?.meta; 
  return (
    <div className="space-y-6">
      {header}

      <Card className="p-4">
        <div className="grid gap-4 sm:grid-cols-3 sm:items-end">
          <Select
            label="Trạng thái"
            value={status}
            onChange={(e) => handleStatusChange(e.target.value)}
            options={STATUS_OPTIONS}
          />
          <Select
            label="Loại nội dung"
            value={targetType}
            onChange={(e) => handleTargetTypeChange(e.target.value)}
            options={TARGET_OPTIONS}
          />
          <label className="flex h-10 items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={assignedToMe}
              onChange={(e) => handleAssignedToMeChange(e.target.checked)}
              className="h-4 w-4"
            />
            Chỉ mục tôi đã nhận
          </label>
        </div>
      </Card>

      {error ? (
        <ErrorState message={error} onRetry={() => void fetchQueue()} />
      ) : isLoading && !data ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title={status === 'PENDING' ? 'Hàng đợi kiểm duyệt đang trống' : 'Không có mục nào'}
          description="Không có nội dung nào khớp với bộ lọc hiện tại."
        />
      ) : (
        <div className="space-y-3" aria-busy={isLoading}>
          {items.map((item) => (
            <Card key={item.id} className="p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{TARGET_TYPE_LABEL[item.targetType] ?? item.targetType}</Badge>
                    <Badge variant={STATUS_VARIANT[item.status] ?? 'outline'}>
                      {STATUS_LABEL[item.status] ?? item.status}
                    </Badge>
                    {item.round > 1 && <Badge variant="secondary">Duyệt lại · vòng {item.round}</Badge>}
                  </div>
                  <p className="truncate text-sm font-semibold text-foreground">{itemTitle(item)}</p>
                  <p className="text-xs text-muted-foreground">
                    Vào hàng chờ: {formatDateTime(item.enqueuedAt)}
                    {item.assigneeId ? (item.assigneeId === user?.id ? ' · Bạn đã nhận' : ' · Đã có người nhận') : ''}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant={item.status === 'PENDING' ? 'primary' : 'outline'}
                  onClick={() => setSelectedId(item.id)}
                >
                  {item.status === 'PENDING' ? 'Xử lý' : 'Xem'}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {meta && meta.totalItems > 0 && !error && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Trang {meta.page}/{meta.totalPages} · {meta.totalItems} mục
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!meta.hasPrevPage || isLoading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Trước
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!meta.hasNextPage || isLoading}
              onClick={() => setPage((p) => p + 1)}
            >
              Sau
            </Button>
          </div>
        </div>
      )}

      <ModerationItemDialog
        itemId={selectedId}
        currentUserId={user?.id ?? ''}
        isAdmin={role === 'ADMIN'}
        onClose={() => setSelectedId(null)}
        onChanged={() => void fetchQueue()}
      />
    </div>
  );
}
