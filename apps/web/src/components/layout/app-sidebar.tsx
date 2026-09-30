'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { NavItem } from '@/config/navigation.config';

export interface AppSidebarProps {
  items: NavItem[];
  roleTitle: string;
}

export function AppSidebar({ items, roleTitle }: AppSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="w-64 shrink-0 border-r border-border bg-card/50 min-h-[calc(100vh-4rem)] p-4 flex flex-col justify-between">
      <div className="space-y-4">
        <div className="px-3 py-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {roleTitle}
          </h2>
        </div>
        <nav className="space-y-1">
          {items.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={twMerge(
                  clsx(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                      : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                  ),
                )}
              >
                {item.title}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="border-t border-border pt-4 px-3 text-xs text-muted-foreground">
        CampusJob v1.0.0 &copy; 2026
      </div>
    </aside>
  );
}
