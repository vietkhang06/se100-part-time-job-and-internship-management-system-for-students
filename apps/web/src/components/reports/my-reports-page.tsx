'use client';

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Spinner } from '@/components/ui/spinner';
import { Pager } from '@/components/m05/pager';
import { listMyReports } from '@/lib/reports-api';
import { useAsyncResource } from '@/lib/use-async-resource';
import {
  REPORT_STATUS_LABEL,
  REPORT_STATUS_VARIANT,
  VIOLATION_REASON_LABEL,
  VIOLATION_TARGET_LABEL,
  formatDateTime,
} from '@/lib/m05-labels';

/** UC48 — danh sách báo cáo đã gửi (dùng chung cho sinh viên và nhà tuyển dụng). Tải lại mỗi lần được hiển thị. */
export function MyReportsList() {
  const [page, setPage] = React.useState(1);
  const load = React.useCallback(() => listMyReports(page), [page]);
  const { data, isLoading, error, reload } = useAsyncResource(load, true, 'Không thể tải danh sách báo cáo.');
  const items = data?.data ?? [];

  return (
    <div className="space-y-6">
      {error ? (
        <ErrorState message={error} onRetry={() => void reload()} />
      ) : isLoading && !data ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title="Bạn chưa gửi báo cáo nào"
          description='Chọn tab "Gửi báo cáo" để báo cáo nội dung hoặc hành vi vi phạm.'
        />
      ) : (
        <div className="space-y-3" aria-busy={isLoading}>
          {items.map((report) => (
            <Card key={report.id} className="space-y-2 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{VIOLATION_TARGET_LABEL[report.targetType] ?? report.targetType}</Badge>
                <Badge variant={REPORT_STATUS_VARIANT[report.status] ?? 'outline'}>
                  {REPORT_STATUS_LABEL[report.status] ?? report.status}
                </Badge>
                <span className="text-sm font-medium">{VIOLATION_REASON_LABEL[report.reason] ?? report.reason}</span>
              </div>
              {report.targetLabel && <p className="text-sm text-muted-foreground">Đối tượng: {report.targetLabel}</p>}
              <p className="line-clamp-3 whitespace-pre-wrap break-words text-sm">{report.description}</p>
              <p className="text-xs text-muted-foreground">
                Gửi lúc {formatDateTime(report.createdAt)} · {report.evidenceCount} bằng chứng
              </p>
            </Card>
          ))}
        </div>
      )}
      {data && <Pager meta={data.meta} isLoading={isLoading} onPage={setPage} />}
    </div>
  );
}
