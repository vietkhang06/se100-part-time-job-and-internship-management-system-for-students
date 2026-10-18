'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';

export interface PagerProps {
  meta: { page: number; totalPages: number; totalItems: number; hasNextPage: boolean; hasPrevPage: boolean };
  isLoading?: boolean;
  onPage: (page: number) => void;
}

export function Pager({ meta, isLoading = false, onPage }: PagerProps) {
  if (meta.totalItems === 0) return null;
  return (
    <div className="flex items-center justify-between text-sm text-muted-foreground">
      <span>
        Trang {meta.page}/{meta.totalPages} · {meta.totalItems} mục
      </span>
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!meta.hasPrevPage || isLoading}
          onClick={() => onPage(Math.max(1, meta.page - 1))}
        >
          Trước
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!meta.hasNextPage || isLoading}
          onClick={() => onPage(meta.page + 1)}
        >
          Sau
        </Button>
      </div>
    </div>
  );
}
