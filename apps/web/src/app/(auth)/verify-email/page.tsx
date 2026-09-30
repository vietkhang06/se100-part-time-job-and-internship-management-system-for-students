import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <CardTitle>Xác minh tài khoản Email</CardTitle>
          <CardDescription>
            Chúng tôi đã gửi thư kích hoạt tài khoản vào hộp thư của bạn. Vui lòng bấm vào liên kết trong email để kích hoạt.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            Trong môi trường kiểm thử cục bộ, vui lòng mở giao diện Mailpit (cổng 8026) để xem email kích hoạt.
          </p>
        </CardContent>
        <CardFooter className="justify-center border-t border-border">
          <Link href="/login">
            <Button variant="primary" size="md">
              Đến trang Đăng nhập
            </Button>
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
