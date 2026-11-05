import * as React from 'react';
import { AppHeader } from '@/components/layout/app-header';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { EMPLOYER_NAV_ITEMS } from '@/config/navigation.config';

export default function EmployerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <AppHeader userRole="EMPLOYER" userName="Nhà tuyển dụng" />
      <div className="flex flex-1 flex-col md:flex-row">
        <AppSidebar items={EMPLOYER_NAV_ITEMS} roleTitle="Không gian Tuyển dụng" />
        <main className="min-w-0 flex-1 p-4 sm:p-6 md:p-8">{children}</main>
      </div>
    </div>
  );
}
