'use client';

import Link from 'next/link';
import * as React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { apiClient, ApiClientError } from '@/lib/api-client';
import { validateEmail } from '@/lib/validation';
import type { ForgotPasswordResponseDto } from '@campusjob/contracts';
import { Alert } from '@/components/ui/alert';

const DEFAULT_COOLDOWN_SECONDS = 60;

export default function ForgotPasswordPage() {
  const [email, setEmail] = React.useState('');
  const [fieldError, setFieldError] = React.useState('');
  const [formError, setFormError] = React.useState('');
  const [sentTo, setSentTo] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [cooldown, setCooldown] = React.useState(0);

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting || cooldown > 0) return;

    const validationError = validateEmail(email);
    if (validationError) {
      setFieldError(validationError);
      return;
    }

    const normalizedEmail = email.trim();
    setFieldError('');
    setFormError('');
    setSentTo('');
    setIsSubmitting(true);
    try {
      await apiClient<ForgotPasswordResponseDto>('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: normalizedEmail }),
      });
      setSentTo(normalizedEmail);
      setCooldown(DEFAULT_COOLDOWN_SECONDS);
    } catch (requestError) {
      if (requestError instanceof ApiClientError && requestError.status === 429) {
        const seconds = Number(/(\d+)/.exec(requestError.message)?.[1]) || DEFAULT_COOLDOWN_SECONDS;
        setCooldown(seconds);
        setFormError(`Bạn vừa yêu cầu gần đây. Vui lòng thử lại sau ${seconds} giây.`);
      } else if (requestError instanceof ApiClientError && requestError.status === 0) {
        setFormError(requestError.message);
      } else if (requestError instanceof ApiClientError && requestError.status >= 500) {
        setFormError('Máy chủ đang gặp sự cố. Vui lòng thử lại sau.');
      } else {
        setFormError('Không thể gửi email khôi phục. Vui lòng thử lại.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };
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
          <form className="space-y-4" onSubmit={handleSubmit} noValidate aria-busy={isSubmitting}>
            {formError && <Alert variant="destructive">{formError}</Alert>}
            {sentTo && (
              <Alert variant="success" role="status">
                Nếu <strong>{sentTo}</strong> đã được đăng ký, chúng tôi vừa gửi hướng dẫn đặt lại
                mật khẩu. Vui lòng kiểm tra hộp thư (kể cả mục Spam). Liên kết có hiệu lực trong 1 giờ.
              </Alert>
            )}
            <Input 
              label="Email đăng ký" 
              type="email" 
              placeholder="name@domain.com" 
              value={email} 
              onChange={(e) => {setEmail(e.target.value); if (fieldError) setFieldError('');}} 
              error={fieldError}
              aria-invalid={Boolean(fieldError)}
              disabled={isSubmitting} 
              autoComplete="email" />
            <Button type="submit" variant="primary" className="w-full" isLoading={isSubmitting} disabled={isSubmitting || cooldown > 0}>
              {isSubmitting
                ? 'Đang gửi...'
                : cooldown > 0
                  ? `Gửi lại sau ${cooldown}s`
                  : sentTo
                    ? 'Gửi lại email'
                    : 'Gửi email khôi phục'}
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
