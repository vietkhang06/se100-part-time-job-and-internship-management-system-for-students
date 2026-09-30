import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/ui/empty-state';

export default function CandidateInterviewsPage() {
  return (
    <div>
      <PageHeader
        title="Lịch phỏng vấn"
        description="Xem danh sách lịch hẹn phỏng vấn từ các nhà tuyển dụng."
      />

      <EmptyState
        title="Không có lịch phỏng vấn nào sắp tới"
        description="Khi nhà tuyển dụng mời bạn tham gia phỏng vấn, thời gian và địa điểm sẽ xuất hiện tại đây."
      />
    </div>
  );
}
