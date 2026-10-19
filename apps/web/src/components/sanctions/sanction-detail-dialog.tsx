'use client';

import * as React from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { getSanction, liftSanction } from '@/lib/sanctions-api';
import { useAsyncResource } from '@/lib/use-async-resource';
import {
  SANCTION_STATUS_LABEL,
  SANCTION_STATUS_VARIANT,
  SANCTION_TYPE_LABEL,
  formatDateTime,
  getM05ErrorCode,
  getM05ErrorMessage,
} from '@/lib/m05-labels';

export interface SanctionDetailDialogProps {
  sanctionId: string | null;
  /** Chỉ Quản trị viên mới được gỡ chế tài. */
  canLift: boolean;
  onClose: () => void;
  onChanged: () => void;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="col-span-2 break-words">{children}</dd>
    </div>
  );
}

/** Chi tiết chế tài kèm lịch sử (áp dụng, gỡ). UC57 — gỡ chế tài đang hiệu lực. */
export function SanctionDetailDialog({ sanctionId, canLift, onClose, onChanged }: SanctionDetailDialogProps) {
  const load = React.useCallback(
    () => (sanctionId ? getSanction(sanctionId) : Promise.resolve(null)),
    [sanctionId],
  );
  const { data, isLoading, error, reload } = useAsyncResource(load, sanctionId !== null, 'Không thể tải chi tiết chế tài.');

  const [reason, setReason] = React.useState('');
  const [reasonError, setReasonError] = React.useState<string | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [isLifting, setIsLifting] = React.useState(false);

  React.useEffect(() => {
    setReason('');
    setReasonError(null);
    setFormError(null);
  }, [sanctionId]);

  const handleLift = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!sanctionId || isLifting) return;
    if (!reason.trim()) {
      setReasonError('Vui lòng nhập lý do gỡ.');
      return;
    }
    setReasonError(null);
    setFormError(null);
    setIsLifting(true);
    try {
      await liftSanction(sanctionId, reason.trim());
      setReason('');
      onChanged();
      await reload();
    } catch (err) {
      setFormError(getM05ErrorMessage(err, 'Không thể gỡ chế tài. Vui lòng thử lại.'));
      if (getM05ErrorCode(err) === 'SANCTION_NOT_ACTIVE') {
        onChanged();
        await reload();
      }
    } finally {
      setIsLifting(false);
    }
  };

  return (
    <Dialog isOpen={sanctionId !== null} onClose={onClose} title="Chi tiết chế tài" className="max-w-xl">
      <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
        {isLoading && !data && (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        )}
        {error && <Alert variant="destructive">{error}</Alert>}
        {data && (
          <>
            <dl className="space-y-2">
              <Row label="Hình thức">{SANCTION_TYPE_LABEL[data.type] ?? data.type}</Row>
              <Row label="Trạng thái">
                <Badge variant={SANCTION_STATUS_VARIANT[data.status] ?? 'outline'}>
                  {SANCTION_STATUS_LABEL[data.status] ?? data.status}
                </Badge>
              </Row>
              <Row label="Đối tượng">
                {data.targetType === 'COMPANY' ? 'Doanh nghiệp' : 'Sinh viên'}{' '}
                <span className="font-mono text-xs">{data.targetId}</span>
              </Row>
              <Row label="Lý do">{data.reason}</Row>
              <Row label="Bắt đầu">{formatDateTime(data.startsAt)}</Row>
              <Row label="Kết thúc">{data.endsAt ? formatDateTime(data.endsAt) : 'Đến khi được gỡ'}</Row>
              {data.liftedAt && <Row label="Đã gỡ lúc">{formatDateTime(data.liftedAt)}</Row>}
              {data.liftReason && <Row label="Lý do gỡ">{data.liftReason}</Row>}
            </dl>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Lịch sử</h3>
              <ul className="space-y-2">
                {data.events.map((event) => (
                  <li key={event.id} className="rounded-lg border border-border p-3 text-sm">
                    <span className="font-medium">{event.action === 'APPLIED' ? 'Áp dụng' : 'Gỡ'}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{formatDateTime(event.createdAt)}</span>
                    {event.note && <p className="mt-1 text-muted-foreground">{event.note}</p>}
                  </li>
                ))}
              </ul>
            </div>

            {canLift && data.status === 'ACTIVE' && (
              <form className="space-y-3 border-t border-border pt-4" onSubmit={handleLift} noValidate>
                {formError && <Alert variant="destructive">{formError}</Alert>}
                <Textarea
                  label="Lý do gỡ chế tài"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  error={reasonError ?? undefined}
                  disabled={isLifting}
                  maxLength={1000}
                />
                <Button type="submit" variant="outline" isLoading={isLifting}>
                  Gỡ chế tài
                </Button>
              </form>
            )}
          </>
        )}
        <Button type="button" variant="outline" onClick={onClose}>
          Đóng
        </Button>
      </div>
    </Dialog>
  );
}
