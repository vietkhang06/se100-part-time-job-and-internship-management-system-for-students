import * as React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Button } from './button';

export interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = 'Đã xảy ra lỗi',
  message,
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={twMerge(
        clsx(
          'flex min-h-[250px] flex-col items-center justify-center rounded-xl border border-destructive/20 bg-destructive/5 p-8 text-center',
          className,
        ),
      )}
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <svg
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </div>
      <h4 className="text-base font-semibold text-foreground mb-1">{title}</h4>
      <p className="max-w-md text-sm text-muted-foreground mb-5">{message}</p>
      {onRetry && (
        <Button onClick={onRetry} variant="outline" size="sm">
          Thử lại
        </Button>
      )}
    </div>
  );
}
