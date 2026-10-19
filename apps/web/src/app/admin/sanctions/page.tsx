'use client';

import * as React from 'react';
import type { ViolationReportDetailDto } from '@campusjob/contracts';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Select } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Pager } from '@/components/m05/pager';
import { RoleGate } from '@/components/m05/role-gate';
import { VerdictDialog } from '@/components/sanctions/verdict-dialog';
import { SanctionDetailDialog } from '@/components/sanctions/sanction-detail-dialog';
import { SanctionItems } from '@/components/sanctions/sanction-list';
import { listReportsAwaitingVerdict, listSanctions } from '@/lib/sanctions-api';
import { useAsyncResource } from '@/lib/use-async-resource';
import {
  REPORT_STATUS_LABEL,
  SANCTION_STATUS_LABEL,
  SANCTION_TYPE_LABEL,
  VIOLATION_REASON_LABEL,
  VIOLATION_TARGET_LABEL,
  formatDateTime,
} from '@/lib/m05-labels';

const header = (
  <PageHeader
    title="Xử lý vi phạm"
    description="Phán quyết các báo cáo đã có căn cứ, áp chế tài và theo dõi lịch sử chế tài."
  />
);

export default function AdminSanctionsPage() {
  return (
    <RoleGate roles={['ADMIN']} header={header}>
      <AdminSanctionsContent />
    </RoleGate>
  );
}

function AdminSanctionsContent() {
  const [tab, setTab] = React.useState<'verdict' | 'history'>('verdict');

  return (
    <div className="space-y-6">
      {header}
      <div className="flex gap-2">
        <Button type="button" variant={tab === 'verdict' ? 'primary' : 'outline'} onClick={() => setTab('verdict')}>
          Chờ phán quyết
        </Button>
        <Button type="button" variant={tab === 'history' ? 'primary' : 'outline'} onClick={() => setTab('history')}>
          Lịch sử chế tài
        </Button>
      </div>
      {tab === 'verdict' ? <VerdictTab /> : <HistoryTab />}
    </div>
  );
}

function VerdictTab() {
  const [page, setPage] = React.useState(1);
  const [selected, setSelected] = React.useState<ViolationReportDetailDto | null>(null);
  const load = React.useCallback(() => listReportsAwaitingVerdict(page), [page]);
  const { data, isLoading, error, reload } = useAsyncResource(load, true, 'Không thể tải danh sách báo cáo.');
  const reports = data?.data ?? [];

  const handleDone = React.useCallback(() => {
    // Trang hiện tại có thể vừa hết mục; lùi về trang trước nếu cần.
    if (data && data.data.length <= 1 && page > 1) {
      setPage(page - 1);
    } else {
      void reload();
    }
  }, [data, page, reload]);

  return (
    <div className="space-y-4">
      {error ? (
        <ErrorState message={error} onRetry={() => void reload()} />
      ) : isLoading && !data ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : reports.length === 0 ? (
        <EmptyState
          title="Không có báo cáo nào chờ phán quyết"
          description="Các báo cáo được Kiểm duyệt viên kết luận có căn cứ sẽ xuất hiện ở đây."
        />
      ) : (
        <div className="space-y-3" aria-busy={isLoading}>
          {reports.map((report) => (
            <Card key={report.id} className="p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{VIOLATION_TARGET_LABEL[report.targetType] ?? report.targetType}</Badge>
                    <Badge variant="destructive">{REPORT_STATUS_LABEL[report.status] ?? report.status}</Badge>
                    <span className="text-sm font-medium">
                      {VIOLATION_REASON_LABEL[report.reason] ?? report.reason}
                    </span>
                  </div>
                  <p className="truncate text-sm text-muted-foreground">
                    {report.targetLabel ?? report.targetId} · {report.evidenceCount} bằng chứng
                  </p>
                  <p className="text-xs text-muted-foreground">Thẩm tra lúc {formatDateTime(report.moderatedAt)}</p>
                </div>
                <Button type="button" size="sm" onClick={() => setSelected(report)}>
                  Phán quyết
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
      {data && <Pager meta={data.meta} isLoading={isLoading} onPage={setPage} />}

      <VerdictDialog report={selected} onClose={() => setSelected(null)} onDone={handleDone} />
    </div>
  );
}

const STATUS_FILTER = [
  { label: 'Tất cả trạng thái', value: '' },
  ...Object.entries(SANCTION_STATUS_LABEL).map(([value, label]) => ({ label, value })),
];
const TYPE_FILTER = [
  { label: 'Tất cả hình thức', value: '' },
  ...Object.entries(SANCTION_TYPE_LABEL).map(([value, label]) => ({ label, value })),
];

function HistoryTab() {
  const [status, setStatus] = React.useState('');
  const [type, setType] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const load = React.useCallback(
    () => listSanctions({ status: status || undefined, type: type || undefined, page }),
    [status, type, page],
  );
  const { data, isLoading, error, reload } = useAsyncResource(load, true, 'Không thể tải lịch sử chế tài.');
  const sanctions = data?.data ?? [];

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Trạng thái"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            options={STATUS_FILTER}
          />
          <Select
            label="Hình thức"
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setPage(1);
            }}
            options={TYPE_FILTER}
          />
        </div>
      </Card>

      {error ? (
        <ErrorState message={error} onRetry={() => void reload()} />
      ) : isLoading && !data ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : sanctions.length === 0 ? (
        <EmptyState title="Chưa có chế tài nào" description="Không có chế tài nào khớp với bộ lọc hiện tại." />
      ) : (
        <SanctionItems sanctions={sanctions} onOpen={setSelectedId} />
      )}
      {data && <Pager meta={data.meta} isLoading={isLoading} onPage={setPage} />}

      <SanctionDetailDialog
        sanctionId={selectedId}
        canLift
        onClose={() => setSelectedId(null)}
        onChanged={() => void reload()}
      />
    </div>
  );
}
