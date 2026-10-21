'use client';

import * as React from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Alert } from '@/components/ui/alert';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Spinner } from '@/components/ui/spinner';
import { Pager } from '@/components/m05/pager';
import { RoleGate } from '@/components/m05/role-gate';
import { SanctionItems } from '@/components/sanctions/sanction-list';
import { listMySanctions } from '@/lib/sanctions-api';
import { useAsyncResource } from '@/lib/use-async-resource';

const header = (
  <PageHeader title="Chế tài tài khoản" description="Các cảnh cáo và hạn chế quyền ứng tuyển áp dụng cho tài khoản của bạn." />
);

export default function CandidateSanctionsPage() {
  return (
    <RoleGate roles={['STUDENT']} header={header}>
      <CandidateSanctionsContent />
    </RoleGate>
  );
}

function CandidateSanctionsContent() {
  const [page, setPage] = React.useState(1);
  const load = React.useCallback(() => listMySanctions(page), [page]);
  const { data, isLoading, error, reload } = useAsyncResource(load, true, 'Không thể tải thông tin chế tài.');
  const sanctions = data?.data ?? [];
  const locked = sanctions.some((s) => s.type === 'APPLICATION_LOCK' && s.status === 'ACTIVE');

  return (
    <div className="space-y-6">
      {header}
      {locked && (
        <Alert variant="warning" title="Quyền ứng tuyển đang bị khóa">
          Bạn chưa thể nộp hồ sơ ứng tuyển mới cho tới khi hết thời hạn khóa.
        </Alert>
      )}
      {error ? (
        <ErrorState message={error} onRetry={() => void reload()} />
      ) : isLoading && !data ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : sanctions.length === 0 ? (
        <EmptyState title="Tài khoản của bạn không có chế tài nào" description="Bạn đang ở trạng thái bình thường." />
      ) : (
        <SanctionItems sanctions={sanctions} />
      )}
      {data && <Pager meta={data.meta} isLoading={isLoading} onPage={setPage} />}
    </div>
  );
}
