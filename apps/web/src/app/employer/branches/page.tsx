import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';

export default function EmployerBranchesPage() {
  return (
    <div>
      <PageHeader
        title="Quản lý chi nhánh & địa điểm"
        description="Thêm địa chỉ các văn phòng làm việc để gắn vào tin tuyển dụng."
        action={<Button variant="primary">Thêm chi nhánh</Button>}
      />

      <EmptyState
        title="Chưa có chi nhánh nào"
        description="Thêm văn phòng hoặc cơ sở làm việc để sinh viên biết chính xác địa điểm làm việc khi ứng tuyển."
      />
    </div>
  );
}
