import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/ui/empty-state';

export default function AdminCompaniesPage() {
  return (
    <div>
      <PageHeader
        title="Quản lý hồ sơ doanh nghiệp"
        description="Theo dõi toàn bộ các doanh nghiệp đã tham gia mạng lưới tuyển dụng."
      />

      <EmptyState
        title="Chưa có doanh nghiệp nào"
        description="Các doanh nghiệp đăng ký tài khoản sẽ xuất hiện tại đây sau khi được kiểm duyệt."
      />
    </div>
  );
}
