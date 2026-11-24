'use client';
import { useEffect, useState } from 'react';
import { apiClient } from './api-client';

export function useResource<T>(path: string) {
  const [version, setVersion] = useState(0);
  const [result, setResult] = useState<{path:string; version:number; data?:T; error?:string}>();
  useEffect(() => {
    let active = true;
    apiClient<T>(path).then(data => {
      if (active) setResult({ path, version, data });
    }).catch(err => {
      if (active) setResult({ path, version, error: err instanceof Error ? err.message : 'Không tải được dữ liệu.' });
    });
    return () => { active = false; };
  }, [path, version]);
  const current = result?.path === path && result.version === version ? result : undefined;
  return { ...current, reload: () => setVersion(v => v + 1) };
}
