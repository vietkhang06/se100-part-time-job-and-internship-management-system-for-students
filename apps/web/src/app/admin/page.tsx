'use client';

import * as React from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { Spinner } from '@/components/ui/spinner';
import { RoleGate } from '@/components/m05/role-gate';
import { OverviewGroupCard } from '@/components/admin/overview-group-card';
import { getAdminOverview } from '@/lib/admin-overview-api';
import { formatDateTime } from '@/lib/m05-labels';
import { useAsyncResource } from '@/lib/use-async-resource';

const baseHeader = (
  <PageHeader
    title="Tổng quan hệ thống CampusJob"
    description="Số liệu tổng quan về người dùng, doanh nghiệp, tin tuyển dụng, hồ sơ ứng tuyển và báo cáo vi phạm."
  />
);

export default function AdminDashboardPage() {
  return (
    <RoleGate roles={['ADMIN']} header={baseHeader}>
      <AdminOverviewContent />
    </RoleGate>
  );
}

function AdminOverviewContent() {
  const load = React.useCallback(() => getAdminOverview(), []);
  const { data, isLoading, error, reload } = useAsyncResource(load, true, 'Không thể tải số liệu tổng quan.');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tổng quan hệ thống CampusJob"
        description="Số liệu tổng quan về người dùng, doanh nghiệp, tin tuyển dụng, hồ sơ ứng tuyển và báo cáo vi phạm."
        action={
          <Button type="button" variant="outline" onClick={() => void reload()} disabled={isLoading}>
            Làm mới
          </Button>
        }
      />

      {error ? (
        <ErrorState message={error} onRetry={() => void reload()} />
      ) : isLoading && !data ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy={isLoading}>
            {data.groups.map((group) => (
              <OverviewGroupCard key={group.key} group={group} />
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Cập nhật lúc {formatDateTime(data.generatedAt)}</p>
        </>
      ) : null}
    </div>
  );
}
