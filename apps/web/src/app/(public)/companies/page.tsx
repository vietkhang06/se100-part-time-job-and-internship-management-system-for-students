import { AppHeader } from '@/components/layout/app-header';
import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/ui/empty-state';

export default function CompaniesPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <PageContainer className="flex-1">
        <PageHeader
          title="Doanh nghiệp tuyển dụng"
          description="Danh sách các đối tác doanh nghiệp đã được kiểm định pháp lý và phê duyệt trên hệ thống."
        />

        <EmptyState
          title="Chưa có thông tin doanh nghiệp"
          description="Các hồ sơ doanh nghiệp đã được duyệt sẽ hiển thị tại đây."
        />
      </PageContainer>
    </div>
  );
}
