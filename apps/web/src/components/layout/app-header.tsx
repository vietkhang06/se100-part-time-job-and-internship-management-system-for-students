import * as React from 'react';
import Link from 'next/link';
import { PUBLIC_NAV_ITEMS } from '@/config/navigation.config';

export interface AppHeaderProps {
  userRole?: 'STUDENT' | 'EMPLOYER' | 'MODERATOR' | 'ADMIN';
  userName?: string;
}

export function AppHeader({ userRole, userName }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-card/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 text-xl font-bold tracking-tight text-primary">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white font-black text-sm">
              CJ
            </span>
            <span>CampusJob</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
            {PUBLIC_NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="transition-colors hover:text-foreground"
              >
                {item.title}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {userName ? (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Xin chào,</span>
              <span className="font-semibold text-foreground">{userName}</span>
              <span className="ml-1 rounded bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                {userRole}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                Đăng nhập
              </Link>
              <Link
                href="/register"
                className="rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover transition-colors shadow-sm"
              >
                Đăng ký
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
