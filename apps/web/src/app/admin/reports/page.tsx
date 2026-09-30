import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/ui/empty-state';

export default function AdminReportsPage() {
  return (
    <div>
      <PageHeader
        title="Báo cáo vi phạm & Nhật ký Audit"
        description="Tra cứu lịch sử thao tác hệ thống và các khiếu nại chưa xử lý."
      />

      <EmptyState
        title="Nhật ký Audit rỗng"
        description="Mọi thao tác quản trị và thay đổi trạng thái quan trọng sẽ tự động ghi vết tại đây."
      />
    </div>
  );
}
