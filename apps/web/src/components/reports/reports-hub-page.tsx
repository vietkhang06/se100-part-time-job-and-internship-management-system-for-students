'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { PageHeader } from '@/components/layout/page-header';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { RoleGate } from '@/components/m05/role-gate';
import { MyReportsList } from '@/components/reports/my-reports-page';
import {
  REPORT_TARGETS_BY_ROLE,
  ViolationReportForm,
} from '@/components/reports/violation-report-form';
import { useAuth } from '@/lib/auth-context';

type Tab = 'form' | 'sent';

const TABS: { id: Tab; label: string }[] = [
  { id: 'form', label: 'Gửi báo cáo' },
  { id: 'sent', label: 'Báo cáo đã gửi' },
];

const header = (
  <PageHeader
    title="Gửi báo cáo vi phạm"
    description="Báo cáo nội dung hoặc hành vi vi phạm để Kiểm duyệt viên thẩm tra, và theo dõi các báo cáo bạn đã gửi."
  />
);

function HubContent() {
  const params = useSearchParams();
  const { user } = useAuth();
  const role: string = user ? user.role : '';
  const allowedTypes = REPORT_TARGETS_BY_ROLE[role] ?? [];

  const [tab, setTab] = React.useState<Tab>(params.get('tab') === 'sent' ? 'sent' : 'form');
  const [submitted, setSubmitted] = React.useState(false);
  const [formKey, setFormKey] = React.useState(0);

  const resetForm = () => {
    setSubmitted(false);
    setFormKey((k) => k + 1);
  };

  return (
    <div className="space-y-6">
      {header}

      <div role="tablist" aria-label="Báo cáo vi phạm" className="flex gap-1 border-b border-border">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === item.id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Biểu mẫu được giữ nguyên (chỉ ẩn) khi chuyển tab để không mất nội dung đang nhập. */}
      <div className={tab === 'form' ? 'max-w-2xl' : 'hidden'}>
        {submitted ? (
          <Card className="space-y-4 p-6">
            <Alert variant="success" title="Đã gửi báo cáo">
              Cảm ơn bạn. Báo cáo sẽ được Kiểm duyệt viên thẩm tra; bạn có thể theo dõi trạng thái ở tab "Báo cáo đã
              gửi".
            </Alert>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() => {
                  resetForm();
                  setTab('sent');
                }}
              >
                Xem báo cáo đã gửi
              </Button>
              <Button type="button" variant="outline" onClick={resetForm}>
                Gửi báo cáo khác
              </Button>
            </div>
          </Card>
        ) : (
          <Card className="p-6">
            <ViolationReportForm
              key={formKey}
              allowedTypes={allowedTypes}
              initialTargetType={params.get('targetType') ?? ''}
              initialTargetId={params.get('targetId') ?? ''}
              onSubmitted={() => setSubmitted(true)}
            />
          </Card>
        )}
      </div>

      {tab === 'sent' && <MyReportsList />}
    </div>
  );
}

/**
 * Trang "Gửi báo cáo vi phạm" ở thanh bên (UC49 + UC48): tab "Gửi báo cáo" và tab "Báo cáo đã gửi".
 * Các trang khác có thể trỏ tới đây kèm `?targetType=...&targetId=<uuid>` để điền sẵn đối tượng,
 * hoặc `?tab=sent` để mở thẳng danh sách báo cáo đã gửi.
 */
export function ReportsHubPage() {
  return (
    <RoleGate roles={['STUDENT', 'EMPLOYER']} header={header}>
      {/* useSearchParams cần Suspense để `next build` không báo lỗi prerender. */}
      <React.Suspense
        fallback={
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        }
      >
        <HubContent />
      </React.Suspense>
    </RoleGate>
  );
}
