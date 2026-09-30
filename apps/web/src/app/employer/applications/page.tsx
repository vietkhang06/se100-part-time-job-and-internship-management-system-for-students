import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/ui/empty-state';

export default function EmployerApplicationsPage() {
  return (
    <div>
      <PageHeader
        title="Danh sách hồ sơ ứng tuyển"
        description="Xem xét CV Snapshot của sinh viên và cập nhật trạng thái tuyển dụng."
      />

      <EmptyState
        title="Chưa có hồ sơ ứng tuyển nào"
        description="Khi có sinh viên nộp CV vào các tin tuyển dụng của công ty, hồ sơ sẽ hiển thị tại đây để bạn duyệt."
      />
    </div>
  );
}
