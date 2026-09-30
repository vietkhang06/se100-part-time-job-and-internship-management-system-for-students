import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/ui/empty-state';

export default function AdminUsersPage() {
  return (
    <div>
      <PageHeader
        title="Quản lý tài khoản người dùng"
        description="Tra cứu, phân quyền, khóa hoặc mở khóa tài khoản trong hệ thống."
      />

      <EmptyState
        title="Danh sách người dùng"
        description="Chưa có dữ liệu người dùng được tải. Dùng CLI admin:create để tạo tài khoản quản trị ban đầu."
      />
    </div>
  );
}
