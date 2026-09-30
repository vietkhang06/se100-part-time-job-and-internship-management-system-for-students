import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/ui/empty-state';

export default function AdminDashboardPage() {
  return (
    <div>
      <PageHeader
        title="Tổng quan hệ thống CampusJob"
        description="Bảng điều khiển quản trị tập trung, giám sát toàn diện hoạt động hệ thống."
      />

      <EmptyState
        title="Dữ liệu hệ thống"
        description="Các chỉ số hiệu năng và thống kê người dùng thực tế sẽ được hiển thị khi hệ thống bắt đầu vận hành."
      />
    </div>
  );
}
