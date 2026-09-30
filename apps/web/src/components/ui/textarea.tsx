import * as React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
  label?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, label, id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-xs font-semibold text-foreground/80">
            {label}
          </label>
        )}
        <textarea
          id={inputId}
          ref={ref}
          className={twMerge(
            clsx(
              'flex min-h-[80px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-transparent disabled:cursor-not-allowed disabled:opacity-50 transition-colors',
              error && 'border-destructive focus-visible:ring-destructive',
              className,
            ),
          )}
          {...props}
        />
        {error && <span className="text-xs text-destructive">{error}</span>}
      </div>
    );
  },
);

Textarea.displayName = 'Textarea';
