import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';

export default function EmployerJobsPage() {
  return (
    <div>
      <PageHeader
        title="Quản lý tin tuyển dụng"
        description="Đăng tin mới, theo dõi trạng thái kiểm duyệt và số lượng ứng viên quan tâm."
        action={<Button variant="primary">Tạo tin tuyển dụng</Button>}
      />

      <EmptyState
        title="Chưa có tin tuyển dụng nào"
        description="Bạn chưa đăng tin tuyển dụng nào. Hãy bắt đầu tạo tin part-time hoặc thực tập đầu tiên!"
      />
    </div>
  );
}
