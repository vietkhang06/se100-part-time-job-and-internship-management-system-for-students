'use client';

import * as React from 'react';

/** Hiển thị số sao (chỉ đọc). */
export function StarRating({ value, className }: { value: number; className?: string }) {
  const rounded = Math.max(0, Math.min(5, Math.round(value)));
  return (
    <span className={className} role="img" aria-label={`${value} trên 5 sao`}>
      <span className="text-amber-500">{'★'.repeat(rounded)}</span>
      <span className="text-muted-foreground/40">{'★'.repeat(5 - rounded)}</span>
    </span>
  );
}

/** Chọn số sao (1-5). */
export function StarRatingInput({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex gap-1" role="radiogroup" aria-label="Số sao đánh giá">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={`${star} sao`}
          disabled={disabled}
          onClick={() => onChange(star)}
          className={`text-2xl leading-none transition-colors ${
            star <= value ? 'text-amber-500' : 'text-muted-foreground/40 hover:text-amber-400'
          } disabled:cursor-not-allowed`}
        >
          ★
        </button>
      ))}
    </div>
  );
}
