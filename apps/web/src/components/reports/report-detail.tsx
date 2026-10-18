'use client';

import * as React from 'react';
import type { ViolationReportDetailDto } from '@campusjob/contracts';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { getReportForReview } from '@/lib/reports-api';
import { useAsyncResource } from '@/lib/use-async-resource';
import {
  REPORT_STATUS_LABEL,
  REPORT_STATUS_VARIANT,
  VIOLATION_REASON_LABEL,
  VIOLATION_TARGET_LABEL,
  formatDateTime,
  isSafeHttpUrl,
} from '@/lib/m05-labels';

/** Nội dung báo cáo cho người thẩm tra/phán quyết: lý do, mô tả, bằng chứng (UC52, UC59). */
export function ReportDetailView({ report }: { report: ViolationReportDetailDto }) {
  return (
    <div className="space-y-3 rounded-lg border border-border p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{VIOLATION_TARGET_LABEL[report.targetType] ?? report.targetType}</Badge>
        <Badge variant={REPORT_STATUS_VARIANT[report.status] ?? 'outline'}>
          {REPORT_STATUS_LABEL[report.status] ?? report.status}
        </Badge>
        <span className="font-medium">{VIOLATION_REASON_LABEL[report.reason] ?? report.reason}</span>
      </div>
      {report.targetLabel && <p className="text-muted-foreground">Đối tượng: {report.targetLabel}</p>}
      <p className="whitespace-pre-wrap break-words text-foreground">{report.description}</p>

      <div>
        <p className="text-xs font-semibold text-foreground/80">Bằng chứng ({report.evidenceCount})</p>
        {report.evidence.length === 0 ? (
          <p className="text-muted-foreground">Báo cáo chưa kèm bằng chứng.</p>
        ) : (
          <ul className="list-disc space-y-1 pl-5">
            {report.evidence.map((item) => (
              <li key={item.id} className="break-all">
                {isSafeHttpUrl(item.url) ? (
                  <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                    {item.url}
                  </a>
                ) : (
                  <span>{item.url ?? '—'}</span>
                )}
                {item.note && <span className="text-muted-foreground"> — {item.note}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Gửi lúc {formatDateTime(report.createdAt)}
        {report.moderatedAt ? ` · Thẩm tra lúc ${formatDateTime(report.moderatedAt)}` : ''}
      </p>
    </div>
  );
}

/** Tải báo cáo theo id rồi hiển thị; dùng trong hộp chi tiết kiểm duyệt (UC52). */
export function ReportDetailLoader({ reportId }: { reportId: string }) {
  const load = React.useCallback(() => getReportForReview(reportId), [reportId]);
  const { data, isLoading, error } = useAsyncResource(load, true, 'Không thể tải nội dung báo cáo.');

  if (isLoading && !data) {
    return (
      <div className="flex justify-center py-4">
        <Spinner />
      </div>
    );
  }
  if (error) {
    return <Alert variant="destructive">{error}</Alert>;
  }
  return data ? <ReportDetailView report={data} /> : null;
}
