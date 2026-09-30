import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/ui/empty-state';

export default function ModerationPage() {
  return (
    <div>
      <PageHeader
        title="Trung tâm kiểm duyệt"
        description="Thẩm định doanh nghiệp mới đăng ký, phê duyệt tin tuyển dụng và xử lý báo cáo vi phạm."
      />

      <EmptyState
        title="Hàng đợi kiểm duyệt đang trống"
        description="Hiện không có tin tuyển dụng hoặc hồ sơ doanh nghiệp nào đang chờ phê duyệt."
      />
    </div>
  );
}
