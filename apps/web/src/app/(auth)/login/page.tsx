import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-white font-bold">
            CJ
          </div>
          <CardTitle>Đăng nhập CampusJob</CardTitle>
          <CardDescription>
            Truy cập hệ thống quản lý việc làm & thực tập sinh viên
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4">
            <Input label="Email đăng nhập" type="email" placeholder="name@domain.com" required />
            <Input label="Mật khẩu" type="password" placeholder="••••••••" required />
            <div className="flex items-center justify-end">
              <Link
                href="/forgot-password"
                className="text-xs text-primary hover:underline"
              >
                Quên mật khẩu?
              </Link>
            </div>
            <Button type="button" variant="primary" className="w-full">
              Đăng nhập
            </Button>
          </form>
        </CardContent>
        <CardFooter className="justify-center border-t border-border text-xs text-muted-foreground">
          Chưa có tài khoản?{' '}
          <Link href="/register" className="ml-1 text-primary font-semibold hover:underline">
            Đăng ký ngay
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
