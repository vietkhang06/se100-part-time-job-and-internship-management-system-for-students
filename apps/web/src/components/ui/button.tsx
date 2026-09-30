import * as React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Spinner } from './spinner';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading = false, children, disabled, ...props }, ref) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none';

    const variants = {
      primary: 'bg-primary text-primary-foreground hover:bg-primary-hover focus-visible:ring-primary',
      secondary: 'bg-secondary text-secondary-foreground hover:bg-muted focus-visible:ring-secondary',
      outline: 'border border-border bg-transparent hover:bg-muted focus-visible:ring-primary',
      ghost: 'bg-transparent hover:bg-muted focus-visible:ring-primary',
      destructive: 'bg-destructive text-destructive-foreground hover:opacity-90 focus-visible:ring-destructive',
    };

    const sizes = {
      sm: 'h-8 px-3 text-xs gap-1.5',
      md: 'h-10 px-4 text-sm gap-2',
      lg: 'h-12 px-6 text-base gap-2.5',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={twMerge(clsx(baseStyles, variants[variant], sizes[size], className))}
        {...props}
      >
        {isLoading && <Spinner className="w-4 h-4 text-current mr-1" />}
        {children}
      </button>
    );
  },
);

Button.displayName = 'Button';
