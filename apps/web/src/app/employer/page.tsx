import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function EmployerDashboardPage() {
  return (
    <div>
      <PageHeader
        title="Bảng điều khiển tuyển dụng"
        description="Tổng quan về tin tuyển dụng, hồ sơ ứng tuyển mới và lịch phỏng vấn doanh nghiệp."
        action={
          <Link href="/employer/jobs">
            <Button variant="primary">Đăng tin mới</Button>
          </Link>
        }
      />

      <EmptyState
        title="Chưa có dữ liệu hoạt động"
        description="Doanh nghiệp của bạn chưa đăng tin tuyển dụng hoặc chưa nhận được hồ sơ nào. Bắt đầu đăng tin để tiếp cận sinh viên!"
      />
    </div>
  );
}
