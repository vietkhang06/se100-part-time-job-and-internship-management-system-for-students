import * as React from 'react';
import { AppHeader } from '@/components/layout/app-header';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { MODERATOR_NAV_ITEMS } from '@/config/navigation.config';

export default function ModeratorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <AppHeader userRole="MODERATOR" userName="Kiểm duyệt viên" />
      <div className="flex-1 flex">
        <AppSidebar items={MODERATOR_NAV_ITEMS} roleTitle="Không gian Kiểm duyệt" />
        <main className="flex-1 p-6 md:p-8">{children}</main>
      </div>
    </div>
  );
}
