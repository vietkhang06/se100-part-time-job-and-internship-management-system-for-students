import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/ui/empty-state';

export default function AdminAnalyticsPage() {
  return (
    <div>
      <PageHeader
        title="Thống kê & Phân tích hệ thống"
        description="Báo cáo số liệu người dùng, tin tuyển dụng, lượt nộp hồ sơ theo thời gian."
      />

      <EmptyState
        title="Chưa có dữ liệu thống kê"
        description="Hệ thống cần dữ liệu tương tác thực tế từ sinh viên và doanh nghiệp để kết xuất biểu đồ."
      />
    </div>
  );
}
