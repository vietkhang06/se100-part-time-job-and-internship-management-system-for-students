'use client';

import * as React from 'react';
import type { ViolationReportDetailDto } from '@campusjob/contracts';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ReportDetailView } from '@/components/reports/report-detail';
import { applySanction, closeReportWithoutSanction } from '@/lib/sanctions-api';
import {
  LOCK_DAYS_MAX,
  LOCK_DAYS_MIN,
  SANCTIONS_BY_REPORT_TARGET,
  SANCTION_TYPE_LABEL,
  getM05ErrorCode,
  getM05ErrorMessage,
} from '@/lib/m05-labels';

const CLOSE_VALUE = 'CLOSE';
const REASON_MAX = 1000;

export interface VerdictDialogProps {
  report: ViolationReportDetailDto | null;
  onClose: () => void;
  /** Gọi sau khi phán quyết thành công, hoặc khi báo cáo đã được xử lý ở nơi khác (để làm mới danh sách). */
  onDone: () => void;
}

interface FormErrors {
  action?: string;
  duration?: string;
  reason?: string;
  form?: string;
}

/** UC59 — Quản trị viên phán quyết cuối cho báo cáo đã có căn cứ: áp chế tài hoặc đóng không xử phạt. */
export function VerdictDialog({ report, onClose, onDone }: VerdictDialogProps) {
  const [action, setAction] = React.useState('');
  const [durationDays, setDurationDays] = React.useState('');
  const [reason, setReason] = React.useState('');
  const [errors, setErrors] = React.useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    setAction('');
    setDurationDays('');
    setReason('');
    setErrors({});
  }, [report?.id]);

  const allowed = report ? (SANCTIONS_BY_REPORT_TARGET[report.targetType] ?? []) : [];
  const isLock = action === 'APPLICATION_LOCK';

  const validate = (): boolean => {
    const next: FormErrors = {};
    if (!action) next.action = 'Vui lòng chọn hình thức xử lý.';
    if (isLock) {
      const days = Number(durationDays);
      if (!durationDays || !Number.isInteger(days) || days < LOCK_DAYS_MIN || days > LOCK_DAYS_MAX) {
        next.duration = `Nhập số ngày từ ${LOCK_DAYS_MIN} đến ${LOCK_DAYS_MAX}.`;
      }
    }
    if (!reason.trim()) next.reason = 'Vui lòng nhập lý do.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!report || isSubmitting || !validate()) return;

    setIsSubmitting(true);
    try {
      if (action === CLOSE_VALUE) {
        await closeReportWithoutSanction(report.id, reason.trim());
      } else {
        await applySanction({
          reportId: report.id,
          type: action,
          reason: reason.trim(),
          durationDays: isLock ? Number(durationDays) : undefined,
        });
      }
      onDone();
      onClose();
    } catch (error) {
      setErrors({ form: getM05ErrorMessage(error, 'Không thể ghi nhận phán quyết. Vui lòng thử lại.') });
      const code = getM05ErrorCode(error);
      if (code === 'SANCTION_REPORT_ALREADY_RESOLVED' || code === 'SANCTION_ALREADY_APPLIED_FOR_REPORT') {
        onDone();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      isOpen={report !== null}
      onClose={onClose}
      title="Phán quyết báo cáo vi phạm"
      description="Chế tài chỉ áp dụng khi báo cáo đã được xác nhận có căn cứ."
      className="max-w-2xl"
    >
      {report && (
        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          <ReportDetailView report={report} />

          {allowed.length === 0 && (
            <Alert variant="info">
              Báo cáo về {report.targetType === 'JOB' ? 'tin tuyển dụng' : 'đánh giá'} được xử lý qua kiểm duyệt nội dung.
              Bạn chỉ có thể đóng báo cáo mà không xử phạt.
            </Alert>
          )}

          {errors.form && <Alert variant="destructive">{errors.form}</Alert>}

          <form className="space-y-4 border-t border-border pt-4" onSubmit={handleSubmit} noValidate>
            <Select
              label="Hình thức xử lý"
              value={action}
              onChange={(e) => setAction(e.target.value)}
              error={errors.action}
              disabled={isSubmitting}
              options={[
                { label: '-- Chọn hình thức --', value: '' },
                ...allowed.map((value) => ({ label: SANCTION_TYPE_LABEL[value] ?? value, value })),
                { label: 'Không xử phạt, đóng báo cáo', value: CLOSE_VALUE },
              ]}
            />
            {isLock && (
              <Input
                label={`Thời hạn khóa (ngày, ${LOCK_DAYS_MIN}-${LOCK_DAYS_MAX})`}
                type="number"
                min={LOCK_DAYS_MIN}
                max={LOCK_DAYS_MAX}
                value={durationDays}
                onChange={(e) => setDurationDays(e.target.value)}
                error={errors.duration}
                disabled={isSubmitting}
              />
            )}
            <Textarea
              label="Lý do (gửi kèm thông báo cho các bên)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              error={errors.reason}
              disabled={isSubmitting}
              maxLength={REASON_MAX}
            />
            <div className="flex gap-2">
              <Button type="submit" isLoading={isSubmitting} variant={action && action !== CLOSE_VALUE ? 'destructive' : 'primary'}>
                {action === CLOSE_VALUE ? 'Đóng báo cáo' : 'Ghi nhận phán quyết'}
              </Button>
              <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                Hủy
              </Button>
            </div>
          </form>
        </div>
      )}
    </Dialog>
  );
}
