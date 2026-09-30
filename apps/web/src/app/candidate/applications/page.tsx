import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/ui/empty-state';

export default function CandidateApplicationsPage() {
  return (
    <div>
      <PageHeader
        title="Lịch sử ứng tuyển"
        description="Theo dõi tiến độ xét duyệt và trạng thái CV snapshot của bạn tại các vị trí đã nộp."
      />

      <EmptyState
        title="Chưa có hồ sơ ứng tuyển"
        description="Toàn bộ lịch sử các vị trí bạn đã nộp đơn sẽ được liệt kê tại đây."
      />
    </div>
  );
}
