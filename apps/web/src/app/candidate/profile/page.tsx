import { PageHeader } from '@/components/layout/page-header';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';

export default function CandidateProfilePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Hồ sơ cá nhân"
        description="Quản lý thông tin liên hệ và xác thực tài khoản sinh viên chính quy."
      />

      <Alert variant="info" title="Xác thực email trường (.edu.vn)">
        Xác thực email trường giúp hồ sơ của bạn nhận được huy hiệu Sinh viên chính quy, tăng 3x tỷ lệ nhà tuyển dụng phản hồi.
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Thông tin cơ bản</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4 max-w-xl">
            <Input label="Họ và tên" placeholder="Nguyễn Văn A" />
            <Input label="Số điện thoại" placeholder="0901234567" />
            <Input label="Email trường đại học" placeholder="mssv@sv.uit.edu.vn" />
            <Button type="button" variant="primary">
              Cập nhật thông tin
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
