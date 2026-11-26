'use client';

import * as React from 'react';
import type { SanctionDto } from '@campusjob/contracts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  SANCTION_STATUS_LABEL,
  SANCTION_STATUS_VARIANT,
  SANCTION_TYPE_LABEL,
  formatDate,
  formatDateTime,
} from '@/lib/m05-labels';

export function SanctionItems({
  sanctions,
  onOpen,
}: {
  sanctions: SanctionDto[];
  /** Có thì hiện nút "Chi tiết" (trang quản trị). */
  onOpen?: (id: string) => void;
}) {
  return (
    <div className="space-y-3">
      {sanctions.map((s) => {
        const isCompany = s.targetType === 'COMPANY';
        const isSuspension = s.type === 'COMPANY_SUSPENSION';

        return (
          <Card key={s.id} className="p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={isCompany ? 'destructive' : 'secondary'}>
                    {isCompany ? 'Doanh nghiệp' : 'Sinh viên'}
                  </Badge>
                  <Badge variant="outline">{SANCTION_TYPE_LABEL[s.type] ?? s.type}</Badge>
                  <Badge variant={SANCTION_STATUS_VARIANT[s.status] ?? 'outline'}>
                    {SANCTION_STATUS_LABEL[s.status] ?? s.status}
                  </Badge>
                  {isSuspension && s.status === 'ACTIVE' && (
                    <Badge variant="destructive">Cờ đình chỉ / cảnh báo</Badge>
                  )}
                </div>
                <p className="break-words text-sm font-medium text-foreground">{s.reason}</p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>Mã đối tượng: <span className="font-mono">{s.targetId}</span></span>
                  <span>·</span>
                  <span>
                    Áp dụng {formatDateTime(s.startsAt)}
                    {s.endsAt ? ` · đến ${formatDate(s.endsAt)}` : ' · đến khi gỡ'}
                  </span>
                  {s.liftedAt && (
                    <>
                      <span>·</span>
                      <span className="text-secondary-foreground">Đã gỡ {formatDateTime(s.liftedAt)}</span>
                    </>
                  )}
                </div>
              </div>
              {onOpen && (
                <Button type="button" size="sm" variant="outline" onClick={() => onOpen(s.id)}>
                  Chi tiết
                </Button>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
