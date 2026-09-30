import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Đặt lại mật khẩu mới</CardTitle>
          <CardDescription>
            Thiết lập mật khẩu an toàn mới cho tài khoản của bạn.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4">
            <Input label="Mật khẩu mới" type="password" placeholder="Tối thiểu 8 ký tự" required />
            <Input label="Xác nhận mật khẩu" type="password" placeholder="••••••••" required />
            <Button type="button" variant="primary" className="w-full">
              Lưu mật khẩu mới
            </Button>
          </form>
        </CardContent>
        <CardFooter className="justify-center border-t border-border text-xs text-muted-foreground">
          <Link href="/login" className="text-primary font-semibold hover:underline">
            Đăng nhập với mật khẩu mới
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
