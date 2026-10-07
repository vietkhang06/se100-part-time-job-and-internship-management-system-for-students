'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { apiClient, ApiClientError } from '@/lib/api-client';

function VerifyEmailContent() {

  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const emailFromUrl = searchParams.get('email');
  const [loading, setLoading] = useState(true);
  const [verifySuccess, setVerifySuccess] = useState(false);
  const [error, setError] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const [cooldown, setCooldown] = useState(0);

  // Cooldown timer for resend button
  useEffect(() => {
    if (cooldown <= 0) {
      return;
    }
    const timer = window.setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  //verify email
  useEffect(() => {
    if (!token) {
      setError('Liên kết xác minh không hợp lệ.');
      setLoading(false);
      return;
    }

    const verifyEmail = async () => {
      try {
        await apiClient('/auth/verify-email', {
          method: 'POST',
          body: JSON.stringify({ token }),
        });

        setVerifySuccess(true);
        setError('');
      } catch (error) {
        if (error instanceof ApiClientError) {
          setError(error.message);
        } else {
          setError('Đã xảy ra lỗi. Vui lòng thử lại.');
        }
      } finally {
        setLoading(false);
      }
    };

    verifyEmail();
  }, [token]);

  const handleResend = async () => {
    if (!emailFromUrl) {
      setError('Không tìm thấy email để gửi lại xác minh. Vui lòng đăng ký lại.');
      return;
    }
    setResendLoading(true);
    setError('');
    setResendMessage('');
    try {
      await apiClient('/auth/resend-verification', {
        method: 'POST',
        body: JSON.stringify({ email: emailFromUrl }),
      });
      setResendMessage('Email xác minh đã được gửi lại. Vui lòng kiểm tra hộp thư của bạn.');
      setCooldown(60); // Set cooldown to 60 seconds
    } catch (error) {
      if (error instanceof ApiClientError) {
        setError(error.message);
      } else {
        setError('Đã xảy ra lỗi. Vui lòng thử lại.');
      }
    } finally {
      setResendLoading(false);
    }
  };

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
            {loading && (
              <span className="block mt-2">
                Đang xác minh email của bạn...
              </span>
            )}

            {!loading && verifySuccess && (
              <span className="block mt-2">
                Email của bạn đã được xác minh thành công!
              </span>
            )}

            {!loading && !verifySuccess && error && (
              <span className="block mt-2">
                {error}
              </span>
            )}

            {!loading && !verifySuccess && resendMessage && (
              <span className="block mt-2">
                {resendMessage}
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            Trong môi trường kiểm thử cục bộ, vui lòng mở giao diện Mailpit (cổng 8026) để xem email kích hoạt.
          </p>
        </CardContent>
        <CardFooter className="justify-center border-t border-border">
          {!loading && !verifySuccess && (
            <Button type="button" variant="outline" size="md" onClick={handleResend} disabled={resendLoading || cooldown > 0 || !emailFromUrl}>
              {resendLoading ? 'Đang gửi lại...' : cooldown > 0 ? `Gửi lại sau (${cooldown}s)` : 'Gửi lại email xác minh'}
            </Button>
          )}
          {!loading && verifySuccess && (
            <Link href="/login">
              <Button variant="primary" size="md">
                Đến trang Đăng nhập
              </Button>
            </Link> 
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
function VerifyEmailFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md text-center">
        <CardContent className="pt-6">
          Đang tải trang xác minh email...
        </CardContent>
      </Card>
    </div>
  );
}

export default function VerifyEmailPage(){
  return (
    <Suspense fallback={<VerifyEmailFallback />}>
      <VerifyEmailContent />
    </Suspense>
  );
}