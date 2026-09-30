import { AppHeader } from '@/components/layout/app-header';
import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';

export default function JobsPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <PageContainer className="flex-1">
        <PageHeader
          title="Tìm kiếm việc làm & thực tập"
          description="Khám phá các vị trí part-time và thực tập được kiểm duyệt dành riêng cho sinh viên."
        />

        <div className="mb-8">
          <Input
            placeholder="Tìm theo chức danh, kỹ năng, ngành nghề..."
            className="max-w-md"
          />
        </div>

        <EmptyState
          title="Chưa có tin tuyển dụng nào phù hợp"
          description="Hiện tại hệ thống chưa có tin tuyển dụng nào được công khai trong danh mục này hoặc thử tìm kiếm với từ khóa khác."
        />
      </PageContainer>
    </div>
  );
}
