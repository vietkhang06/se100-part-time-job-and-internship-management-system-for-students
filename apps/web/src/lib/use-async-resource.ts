'use client';

import * as React from 'react';
import { getM05ErrorMessage } from '@/lib/m05-labels';

export interface AsyncResource<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

/**
 * Tải dữ liệu khi `enabled` và mỗi khi `load` đổi (truyền hàm đã bọc useCallback).
 * Bỏ qua kết quả của các lần gọi cũ để tránh đua dữ liệu khi người dùng đổi bộ lọc nhanh.
 */
export function useAsyncResource<T>(
  load: () => Promise<T>,
  enabled: boolean,
  errorFallback: string,
): AsyncResource<T> {
  const [data, setData] = React.useState<T | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const latest = React.useRef(0);

  const reload = React.useCallback(async () => {
    const requestId = ++latest.current;
    setIsLoading(true);
    setError(null);
    try {
      const result = await load();
      if (requestId !== latest.current) return;
      setData(result);
    } catch (err) {
      if (requestId !== latest.current) return;
      setError(getM05ErrorMessage(err, errorFallback));
    } finally {
      if (requestId === latest.current) setIsLoading(false);
    }
  }, [load, errorFallback]);

  React.useEffect(() => {
    if (enabled) {
      void reload();
    }
  }, [enabled, reload]);

  return { data, isLoading, error, reload };
}
