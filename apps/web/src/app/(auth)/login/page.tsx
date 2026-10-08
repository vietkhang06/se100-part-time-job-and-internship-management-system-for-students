'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { getAuthErrorMessage, getDashboardPath, useAuth } from '@/lib/auth-context';
import {validateEmail } from '@/lib/validation';

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading: isAuthLoading } = useAuth();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [errors, setErrors] = React.useState<{ email?: string; password?: string; form?: string }>({});
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const validate = () => {
    const next: typeof errors = {};
    const emailError = validateEmail(email);
    if (emailError) next.email = emailError;
    if (!password) next.password = 'Vui lòng nhập mật khẩu.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting || !validate()) return;

    setIsSubmitting(true);
    setErrors({});
    try {
      const loggedInUser = await login({ email: email.trim(), password });
      router.replace(getDashboardPath(loggedInUser.role));
    } catch (error) {
      setErrors({ form: getAuthErrorMessage(error, 'Đăng nhập thất bại. Vui lòng thử lại.') });
      setPassword('');
    } finally {
      setIsSubmitting(false);
    }
  };
  const isBusy = isSubmitting || isAuthLoading;
    
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
          <form className="space-y-4" onSubmit={handleSubmit} noValidate aria-busy={isBusy}>
            <Input 
              label="Email đăng nhập" 
              type="email" 
              placeholder="name@domain.com" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errors.email}
              disabled={isSubmitting || isAuthLoading}
              autoComplete="email"/>
            <Input 
              label="Mật khẩu" 
              type="password" 
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={errors.password}
              disabled={isSubmitting || isAuthLoading}
              autoComplete="current-password"/>
            <div className="flex items-center justify-end">
              <Link
                href="/forgot-password"
                className="text-xs text-primary hover:underline"
              >
                Quên mật khẩu?
              </Link>
            </div>
            {errors.form && <p className="text-sm text-destructive" role="alert">{errors.form}</p>}
            <Button type="submit" variant="primary" className="w-full" isLoading={isSubmitting} disabled={isAuthLoading}>
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
