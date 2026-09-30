import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';

export default function CandidateCvsPage() {
  return (
    <div>
      <PageHeader
        title="Quản lý CV"
        description="Tải lên và lưu trữ các phiên bản CV để sẵn sàng ứng tuyển."
        action={<Button variant="primary">Tải lên CV mới</Button>}
      />

      <EmptyState
        title="Bạn chưa có CV nào"
        description="Hãy tải lên tệp CV (định dạng PDF hoặc DOCX, tối đa 10MB) để bắt đầu ứng tuyển."
      />
    </div>
  );
}
