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
import { Alert } from '@/components/ui/alert';
import { RoleGate } from '@/components/m05/role-gate';
import { Pager } from '@/components/m05/pager';
import { ModerationItemDialog } from '@/components/moderation/moderation-item-dialog';
import { VerdictDialog } from '@/components/sanctions/verdict-dialog';
import { useAuth } from '@/lib/auth-context';
import { listModerationQueue } from '@/lib/moderation-api';
import { listReportsAwaitingVerdict } from '@/lib/sanctions-api';
import { useAsyncResource } from '@/lib/use-async-resource';
import {
  STATUS_LABEL,
  STATUS_VARIANT,
  TARGET_TYPE_LABEL,
  formatDateTime,
  getModerationErrorMessage,
} from '@/lib/moderation-labels';
import {
  REPORT_STATUS_LABEL,
  VIOLATION_REASON_LABEL,
  VIOLATION_TARGET_LABEL,
} from '@/lib/m05-labels';

const baseHeader = (
  <PageHeader
    title="Báo cáo vi phạm & Hàng chờ kiểm duyệt"
    description="Quản trị viên tra cứu các báo cáo vi phạm, xem minh chứng, thẩm tra và ra phán quyết chế tài."
  />
);

const STATUS_OPTIONS = [
  { label: 'Chờ xử lý (PENDING)', value: 'PENDING' },
  { label: 'Có căn cứ (SUBSTANTIATED)', value: 'SUBSTANTIATED' },
  { label: 'Bác bỏ (DISMISSED)', value: 'DISMISSED' },
  { label: 'Đã duyệt (APPROVED)', value: 'APPROVED' },
  { label: 'Đã từ chối (REJECTED)', value: 'REJECTED' },
  { label: 'Đã ẩn (HIDDEN)', value: 'HIDDEN' },
  { label: 'Đã khôi phục (RESTORED)', value: 'RESTORED' },
];

export default function AdminReportsPage() {
  return (
    <RoleGate roles={['ADMIN']} header={baseHeader}>
      <AdminReportsContent />
    </RoleGate>
  );
}

function AdminReportsContent() {
  const [tab, setTab] = React.useState<'queue' | 'verdict' | 'audit'>('queue');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Báo cáo vi phạm & Hàng chờ kiểm duyệt"
        description="Quản trị viên tra cứu các báo cáo vi phạm, xem minh chứng, thẩm tra và ra phán quyết chế tài."
      />

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={tab === 'queue' ? 'primary' : 'outline'}
          onClick={() => setTab('queue')}
        >
          Hàng chờ báo cáo
        </Button>
        <Button
          type="button"
          variant={tab === 'verdict' ? 'primary' : 'outline'}
          onClick={() => setTab('verdict')}
        >
          Chờ phán quyết (UC59)
        </Button>
        <Button
          type="button"
          variant={tab === 'audit' ? 'primary' : 'outline'}
          onClick={() => setTab('audit')}
        >
          Nhật ký Audit
        </Button>
      </div>

      {tab === 'queue' ? (
        <ReportQueueTab />
      ) : tab === 'verdict' ? (
        <AwaitingVerdictTab />
      ) : (
        <AuditLogTab />
      )}
    </div>
  );
}

function ReportQueueTab() {
  const { user } = useAuth();
  const [status, setStatus] = React.useState('PENDING');
  const [page, setPage] = React.useState(1);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const load = React.useCallback(
    () =>
      listModerationQueue({
        status: status || 'PENDING',
        targetType: 'REPORT',
        page,
        limit: 10,
      }),
    [status, page],
  );

  const { data, isLoading, error, reload } = useAsyncResource(
    load,
    true,
    'Không thể tải hàng chờ báo cáo vi phạm.',
  );
  const items = data?.data ?? [];

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="w-full sm:max-w-xs">
            <Select
              label="Trạng thái kiểm duyệt"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              options={STATUS_OPTIONS}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => void reload()}
            disabled={isLoading}
          >
            Làm mới
          </Button>
        </div>
      </Card>

      {error ? (
        <ErrorState
          message={getModerationErrorMessage(error, 'Không thể tải hàng chờ báo cáo.')}
          onRetry={() => void reload()}
        />
      ) : isLoading && !data ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title="Không có báo cáo vi phạm nào"
          description="Hiện không có báo cáo nào khớp với bộ lọc kiểm duyệt hiện tại."
        />
      ) : (
        <div className="space-y-3" aria-busy={isLoading}>
          {items.map((item) => (
            <Card key={item.id} className="p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">
                      {TARGET_TYPE_LABEL[item.targetType] ?? item.targetType}
                    </Badge>
                    <Badge variant={STATUS_VARIANT[item.status] ?? 'outline'}>
                      {STATUS_LABEL[item.status] ?? item.status}
                    </Badge>
                    {item.round > 1 && (
                      <Badge variant="secondary">Vòng {item.round}</Badge>
                    )}
                  </div>
                  <p className="truncate text-sm font-semibold text-foreground">
                    {item.summary ?? `Báo cáo #${item.targetId.slice(0, 8)}`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Mã đối tượng: <span className="font-mono">{item.targetId}</span> · Vào hàng
                    chờ: {formatDateTime(item.enqueuedAt)}
                    {item.assigneeId
                      ? item.assigneeId === user?.id
                        ? ' · Bạn đã nhận'
                        : ' · Có người nhận'
                      : ' · Chưa ai nhận'}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant={item.status === 'PENDING' ? 'primary' : 'outline'}
                  onClick={() => setSelectedId(item.id)}
                >
                  {item.status === 'PENDING' ? 'Thẩm tra' : 'Xem'}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {data && <Pager meta={data.meta} isLoading={isLoading} onPage={setPage} />}

      <ModerationItemDialog
        itemId={selectedId}
        currentUserId={user?.id ?? ''}
        isAdmin={true}
        onClose={() => setSelectedId(null)}
        onChanged={() => void reload()}
      />
    </div>
  );
}

function AwaitingVerdictTab() {
  const [page, setPage] = React.useState(1);
  const [selected, setSelected] = React.useState<ViolationReportDetailDto | null>(null);

  const load = React.useCallback(() => listReportsAwaitingVerdict(page), [page]);
  const { data, isLoading, error, reload } = useAsyncResource(
    load,
    true,
    'Không thể tải danh sách báo cáo chờ phán quyết.',
  );
  const reports = data?.data ?? [];

  const handleDone = React.useCallback(() => {
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
          description="Các báo cáo được Kiểm duyệt viên thẩm tra kết luận có căn cứ sẽ xuất hiện ở đây để Quản trị viên ra phán quyết chế tài."
        />
      ) : (
        <div className="space-y-3" aria-busy={isLoading}>
          {reports.map((report) => (
            <Card key={report.id} className="p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">
                      {VIOLATION_TARGET_LABEL[report.targetType] ?? report.targetType}
                    </Badge>
                    <Badge variant="destructive">
                      {REPORT_STATUS_LABEL[report.status] ?? report.status}
                    </Badge>
                    <span className="text-sm font-medium">
                      {VIOLATION_REASON_LABEL[report.reason] ?? report.reason}
                    </span>
                  </div>
                  <p className="truncate text-sm text-muted-foreground">
                    {report.targetLabel ?? report.targetId} · {report.evidenceCount} bằng chứng
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Thẩm tra lúc {formatDateTime(report.moderatedAt)}
                  </p>
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

function AuditLogTab() {
  return (
    <div className="space-y-4">
      <Card className="p-6">
        <h3 className="text-base font-semibold text-foreground">
          Trạng thái Nhật ký Kiểm toán (Audit Log)
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Hệ thống CampusJob tự động ghi vết mọi hành vi bảo mật, thay đổi vai trò, xét duyệt và
          áp dụng chế tài vào bảng cơ sở dữ liệu <code className="font-mono">AuditLog</code> (S7-M01-01 / C-02).
        </p>

        <div className="mt-4 space-y-3">
          <Alert variant="info" title="Thông tin phụ thuộc">
            Hiện tại backend chưa cung cấp REST API endpoint công khai để truy vấn nhật ký kiểm toán.
            Theo tiêu chí AC-03, giao diện tuyệt đối không sử dụng dữ liệu giả (mock data) để hiển thị.
          </Alert>

          <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
            <h4 className="font-medium text-foreground">Truy vết qua cơ sở dữ liệu:</h4>
            <p className="mt-1 font-mono text-xs">
              Mọi thay đổi từ Quản trị viên tại các module Kiểm duyệt (M05) và Tài khoản (M01)
              đều được lưu trữ đầy đủ kèm actorId, action, entityType, entityId, metadata và ipAddress.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
