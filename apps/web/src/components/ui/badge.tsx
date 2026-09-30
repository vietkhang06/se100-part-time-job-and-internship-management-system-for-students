import * as React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline';
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  const variants = {
    default: 'bg-primary text-primary-foreground',
    secondary: 'bg-secondary text-secondary-foreground',
    success: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
    warning: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
    destructive: 'bg-destructive text-destructive-foreground',
    outline: 'border border-border text-foreground',
  };

  return (
    <div
      className={twMerge(
        clsx(
          'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors select-none',
          variants[variant],
          className,
        ),
      )}
      {...props}
    />
  );
}
