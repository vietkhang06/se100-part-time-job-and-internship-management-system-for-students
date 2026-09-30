import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-white font-bold">
            CJ
          </div>
          <CardTitle>Đăng ký tài khoản</CardTitle>
          <CardDescription>
            Bắt đầu tìm kiếm cơ hội hoặc tuyển dụng nhân tài sinh viên
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4">
            <Input label="Họ và tên" placeholder="Nguyễn Văn A" required />
            <Input label="Email" type="email" placeholder="name@domain.com" required />
            <Select
              label="Vai trò"
              options={[
                { label: 'Sinh viên (Ứng viên)', value: 'STUDENT' },
                { label: 'Nhà tuyển dụng (Doanh nghiệp)', value: 'EMPLOYER' },
              ]}
            />
            <Input label="Mật khẩu" type="password" placeholder="Tối thiểu 8 ký tự" required />
            <Button type="button" variant="primary" className="w-full">
              Đăng ký tài khoản
            </Button>
          </form>
        </CardContent>
        <CardFooter className="justify-center border-t border-border text-xs text-muted-foreground">
          Đã có tài khoản?{' '}
          <Link href="/login" className="ml-1 text-primary font-semibold hover:underline">
            Đăng nhập
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
