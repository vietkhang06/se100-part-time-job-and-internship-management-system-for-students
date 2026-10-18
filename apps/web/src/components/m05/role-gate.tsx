'use client';

import * as React from 'react';
import Link from 'next/link';
import { Alert } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/spinner';
import { useAuth } from '@/lib/auth-context';

export interface RoleGateProps {
  /** Các vai trò được phép xem nội dung. */
  roles: string[];
  /** Tiêu đề trang, luôn hiển thị kể cả khi chưa đủ quyền. */
  header: React.ReactNode;
  children: React.ReactNode;
}

/** Chờ khôi phục phiên đăng nhập rồi mới cho gọi API; chặn người chưa đăng nhập hoặc sai vai trò. */
export function RoleGate({ roles, header, children }: RoleGateProps) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const role: string | null = user ? user.role : null;

  if (isLoading) {
    return (
      <div>
        {header}
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div>
        {header}
        <Alert variant="warning" title="Cần đăng nhập">
          Vui lòng{' '}
          <Link href="/login" className="font-medium underline">
            đăng nhập
          </Link>{' '}
          để xem nội dung này.
        </Alert>
      </div>
    );
  }

  if (!role || !roles.includes(role)) {
    return (
      <div>
        {header}
        <Alert variant="destructive" title="Không có quyền truy cập">
          Tài khoản của bạn không có quyền xem trang này.
        </Alert>
      </div>
    );
  }

  return <>{children}</>;
}
