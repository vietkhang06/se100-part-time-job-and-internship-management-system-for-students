import { PageHeader } from '@/components/layout/page-header';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

export default function EmployerCompanyPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Hồ sơ công ty"
        description="Quản lý thông tin thương hiệu và pháp lý của doanh nghiệp."
      />

      <Card>
        <CardHeader>
          <CardTitle>Thông tin doanh nghiệp</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4 max-w-xl">
            <Input label="Tên công ty" placeholder="Công ty TNHH Giải pháp Công nghệ..." />
            <Input label="Mã số thuế" placeholder="0123456789" />
            <Input label="Website chính thức" placeholder="https://example.com" />
            <Textarea label="Giới thiệu công ty" placeholder="Mô tả ngắn gọn về quy mô, lĩnh vực hoạt động..." />
            <Button type="button" variant="primary">
              Lưu thay đổi
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
