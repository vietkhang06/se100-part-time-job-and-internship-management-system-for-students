import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/ui/empty-state';

export default function EmployerInterviewsPage() {
  return (
    <div>
      <PageHeader
        title="Lịch phỏng vấn ứng viên"
        description="Quản lý lịch hẹn phỏng vấn trực tiếp hoặc trực tuyến với các ứng viên đạt yêu cầu."
      />

      <EmptyState
        title="Chưa có lịch phỏng vấn nào"
        description="Sau khi xem xét hồ sơ ứng tuyển, bạn có thể tạo lịch hẹn phỏng vấn cho ứng viên."
      />
    </div>
  );
}
