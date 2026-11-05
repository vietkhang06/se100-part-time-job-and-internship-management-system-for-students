import * as React from 'react';
import { AppHeader } from '@/components/layout/app-header';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { ADMIN_NAV_ITEMS } from '@/config/navigation.config';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <AppHeader userRole="ADMIN" userName="Quản trị viên" />
      <div className="flex flex-1 flex-col md:flex-row">
        <AppSidebar items={ADMIN_NAV_ITEMS} roleTitle="Không gian Quản trị" />
        <main className="min-w-0 flex-1 p-4 sm:p-6 md:p-8">{children}</main>
      </div>
    </div>
  );
}
