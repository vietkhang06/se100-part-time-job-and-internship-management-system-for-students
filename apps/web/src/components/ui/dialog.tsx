import * as React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function Dialog({ isOpen, onClose, title, description, children, footer }: DialogProps) {
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Content modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        className="relative z-50 w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-xl text-card-foreground animate-in fade-in-0 zoom-in-95 duration-200"
      >
        <div className="flex flex-col space-y-1.5 pb-4">
          <h2 id="dialog-title" className="text-lg font-semibold leading-none tracking-tight">
            {title}
          </h2>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        <div className="py-2">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 pt-4">{footer}</div>}
      </div>
    </div>
  );
}
