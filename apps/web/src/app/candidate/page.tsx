import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function CandidateDashboardPage() {
  return (
    <div>
      <PageHeader
        title="Tổng quan tài khoản sinh viên"
        description="Theo dõi trạng thái ứng tuyển, lịch phỏng vấn và quản lý hồ sơ cá nhân."
        action={
          <Link href="/jobs">
            <Button variant="primary">Tìm việc làm ngay</Button>
          </Link>
        }
      />

      <EmptyState
        title="Chưa có hoạt động ứng tuyển nào"
        description="Bạn chưa nộp hồ sơ ứng tuyển vào vị trí nào. Hãy bắt đầu tìm kiếm việc làm thêm hoặc cơ hội thực tập phù hợp!"
      />
    </div>
  );
}
