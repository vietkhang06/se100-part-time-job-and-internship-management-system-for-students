'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/spinner';
import { apiClient, ApiClientError } from '@/lib/api-client';
import {
  PASSWORD_RULES,
  validateNewPassword,
  validatePasswordConfirmation,
} from '@/lib/validation';
import type { ResetPasswordResponseDto } from '@campusjob/contracts';

type ResetErrors = { password?: string; confirmation?: string };

function getResetErrorMessage(error: unknown): { message: string; linkExpired: boolean } {
  if (error instanceof ApiClientError) {
    if (error.status === 0) return { message: error.message, linkExpired: false };
    if (error.status === 429) {
      return { message: 'Bạn thao tác quá nhanh. Vui lòng thử lại sau.', linkExpired: false };
    }
    if (error.status >= 500) {
      return { message: 'Máy chủ đang gặp sự cố. Vui lòng thử lại sau.', linkExpired: false };
    }
    if (error.status === 400) {
      return {
        message:
          'Liên kết đặt lại mật khẩu không hợp lệ, đã hết hạn hoặc đã được sử dụng. Vui lòng yêu cầu liên kết mới.',
        linkExpired: true,
      };
    }
  }
  return { message: 'Không thể đặt lại mật khẩu. Vui lòng thử lại.', linkExpired: false };
}

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = React.useState('');
  const [confirmation, setConfirmation] = React.useState('');
  const [errors, setErrors] = React.useState<ResetErrors>({});
  const [formError, setFormError] = React.useState('');
  const [linkExpired, setLinkExpired] = React.useState(false);
  const [isDone, setIsDone] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const redirectTimer = React.useRef<number | undefined>(undefined);

  React.useEffect(() => () => window.clearTimeout(redirectTimer.current), []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting || isDone) return;

    const next: ResetErrors = {};
    const passwordError = validateNewPassword(password);
    const confirmationError = validatePasswordConfirmation(password, confirmation);
    if (passwordError) next.password = passwordError;
    if (confirmationError) next.confirmation = confirmationError;
    setErrors(next);
    setFormError('');
    setLinkExpired(false);
    if (Object.keys(next).length > 0) return;

    setIsSubmitting(true);
    try {
      await apiClient<ResetPasswordResponseDto>('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, newPassword: password }),
      });
      setIsDone(true);
      setPassword('');
      setConfirmation('');
      redirectTimer.current = window.setTimeout(() => router.replace('/login'), 2000);
    } catch (requestError) {
      const result = getResetErrorMessage(requestError);
      setFormError(result.message);
      setLinkExpired(result.linkExpired);
    } finally {
      setIsSubmitting(false);
    }
  };

  const showForm = Boolean(token) && !isDone;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Đặt lại mật khẩu mới</CardTitle>
          <CardDescription>
            Thiết lập mật khẩu an toàn mới cho tài khoản của bạn.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!token && (
            <Alert variant="destructive">
              Liên kết đặt lại mật khẩu không hợp lệ hoặc thiếu mã xác thực.{' '}
              <Link href="/forgot-password" className="font-semibold underline">
                Yêu cầu liên kết mới
              </Link>
            </Alert>
          )}

          {isDone && (
            <Alert variant="success" role="status">
              Đặt lại mật khẩu thành công. Đang chuyển tới trang đăng nhập...
            </Alert>
          )}

          {showForm && (
            <form className="space-y-4" onSubmit={handleSubmit} noValidate aria-busy={isSubmitting}>
              {formError && (
                <Alert variant="destructive">
                  {formError}{' '}
                  {linkExpired && (
                    <Link href="/forgot-password" className="font-semibold underline">
                      Yêu cầu liên kết mới
                    </Link>
                  )}
                </Alert>
              )}
              <Input
                label="Mật khẩu mới"
                type="password"
                placeholder="Tối thiểu 8 ký tự"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
                }}
                error={errors.password}
                aria-invalid={Boolean(errors.password)}
                disabled={isSubmitting}
                autoComplete="new-password"
              />
              <ul className="space-y-1 text-xs" aria-label="Yêu cầu mật khẩu">
                {PASSWORD_RULES.map((rule) => {
                  const passed = rule.test(password);
                  return (
                    <li
                      key={rule.id}
                      className={passed ? 'text-green-600' : 'text-muted-foreground'}
                    >
                      <span aria-hidden="true">{passed ? '✓' : '•'}</span> {rule.label}
                    </li>
                  );
                })}
              </ul>
              <Input
                label="Xác nhận mật khẩu"
                type="password"
                placeholder="••••••••"
                value={confirmation}
                onChange={(e) => {
                  setConfirmation(e.target.value);
                  if (errors.confirmation) setErrors((prev) => ({ ...prev, confirmation: undefined }));
                }}
                error={errors.confirmation}
                aria-invalid={Boolean(errors.confirmation)}
                disabled={isSubmitting}
                autoComplete="new-password"
              />
            <Button type="submit" variant="primary" className="w-full" isLoading={isSubmitting}>
              {isSubmitting ? 'Đang lưu...' : 'Lưu mật khẩu mới'}
            </Button>
          </form>
          )}
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
export default function ResetPasswordPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Spinner />
        </div>
      }
    >
      <ResetPasswordForm />
    </React.Suspense>
  );
}
