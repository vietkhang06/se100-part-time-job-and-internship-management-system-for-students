import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Khôi phục mật khẩu</CardTitle>
          <CardDescription>
            Nhập email tài khoản để nhận liên kết đặt lại mật khẩu an toàn.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4">
            <Input label="Email đăng ký" type="email" placeholder="name@domain.com" required />
            <Button type="button" variant="primary" className="w-full">
              Gửi email khôi phục
            </Button>
          </form>
        </CardContent>
        <CardFooter className="justify-center border-t border-border text-xs text-muted-foreground">
          <Link href="/login" className="text-primary font-semibold hover:underline">
            Quay lại trang đăng nhập
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
