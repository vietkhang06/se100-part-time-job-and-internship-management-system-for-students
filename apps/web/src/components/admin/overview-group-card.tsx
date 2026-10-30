'use client';

import * as React from 'react';
import type { OverviewGroupDto } from '@campusjob/contracts';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

/**
 * Thẻ số liệu của một nhóm trong tổng quan hệ thống (UC54).
 * Nhóm chưa có nguồn dữ liệu hiển thị rõ lý do, KHÔNG hiển thị số 0 giả.
 */
export function OverviewGroupCard({ group }: { group: OverviewGroupDto }) {
  const isAvailable = group.status === 'AVAILABLE' && group.total !== null;

  return (
    <Card className="space-y-3 p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">{group.label}</h2>
        {!isAvailable && <Badge variant="warning">Chưa có dữ liệu</Badge>}
      </div>

      {isAvailable ? (
        <>
          <p className="text-3xl font-bold text-foreground">{(group.total as number).toLocaleString('vi-VN')}</p>
          {group.breakdown.length > 0 && (
            <div className="space-y-1.5 border-t border-border pt-3">
              {group.breakdownLabel && (
                <p className="text-xs font-semibold text-foreground/70">{group.breakdownLabel}</p>
              )}
              <ul className="space-y-1">
                {group.breakdown.map((item) => (
                  <li key={item.key} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="font-medium tabular-nums">{item.count.toLocaleString('vi-VN')}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">{group.unavailableReason ?? 'Chưa có nguồn dữ liệu.'}</p>
      )}
    </Card>
  );
}
