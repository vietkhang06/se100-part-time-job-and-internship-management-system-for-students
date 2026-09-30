import * as React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'info' | 'success' | 'warning' | 'destructive';
  title?: string;
}

export function Alert({ className, variant = 'info', title, children, ...props }: AlertProps) {
  const variants = {
    info: 'bg-blue-50 text-blue-900 border-blue-200 dark:bg-blue-950/50 dark:text-blue-200 dark:border-blue-800',
    success: 'bg-emerald-50 text-emerald-900 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-200 dark:border-emerald-800',
    warning: 'bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-950/50 dark:text-amber-200 dark:border-amber-800',
    destructive: 'bg-red-50 text-red-900 border-red-200 dark:bg-red-950/50 dark:text-red-200 dark:border-red-800',
  };

  return (
    <div
      role="alert"
      className={twMerge(
        clsx('relative w-full rounded-lg border p-4 text-sm', variants[variant], className),
      )}
      {...props}
    >
      {title && <h5 className="mb-1 font-semibold leading-none tracking-tight">{title}</h5>}
      <div className="text-sm opacity-90">{children}</div>
    </div>
  );
}
