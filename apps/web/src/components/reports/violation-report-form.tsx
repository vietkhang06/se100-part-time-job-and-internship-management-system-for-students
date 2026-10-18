'use client';

import * as React from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { createReport } from '@/lib/reports-api';
import {
  VIOLATION_REASON_LABEL,
  VIOLATION_TARGET_LABEL,
  getM05ErrorMessage,
} from '@/lib/m05-labels';

const DESCRIPTION_MIN = 20;
const DESCRIPTION_MAX = 2000;
const MAX_EVIDENCE = 5;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Loại đối tượng mỗi vai trò được báo cáo (UC49). Khớp report-rules.policy ở BE; BE vẫn là nơi quyết định cuối. */
export const REPORT_TARGETS_BY_ROLE: Record<string, string[]> = {
  STUDENT: ['COMPANY', 'JOB', 'REVIEW'],
  EMPLOYER: ['STUDENT', 'REVIEW'],
};

export interface ViolationReportFormProps {
  /** Đối tượng cố định (nhúng từ trang của đối tượng): ẩn ô chọn loại và mã. */
  fixedTarget?: { targetType: string; targetId: string };
  /** Chế độ tự chọn đối tượng: các loại được phép chọn. */
  allowedTypes?: string[];
  initialTargetType?: string;
  initialTargetId?: string;
  onSubmitted?: () => void;
  onCancel?: () => void;
}

interface FormErrors {
  targetType?: string;
  targetId?: string;
  reason?: string;
  description?: string;
  evidence?: string;
  form?: string;
}

/** Biểu mẫu báo cáo vi phạm (UC49), dùng cho cả hộp thoại nhúng lẫn trang "Gửi báo cáo vi phạm". */
export function ViolationReportForm({
  fixedTarget,
  allowedTypes = [],
  initialTargetType = '',
  initialTargetId = '',
  onSubmitted,
  onCancel,
}: ViolationReportFormProps) {
  const [targetType, setTargetType] = React.useState(
    allowedTypes.includes(initialTargetType) ? initialTargetType : '',
  );
  const [targetId, setTargetId] = React.useState(initialTargetId);
  const [reason, setReason] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [evidenceUrls, setEvidenceUrls] = React.useState<string[]>([]);
  const [errors, setErrors] = React.useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const effectiveType = fixedTarget ? fixedTarget.targetType : targetType;
  const effectiveId = fixedTarget ? fixedTarget.targetId : targetId.trim();

  const validate = (): boolean => {
    const next: FormErrors = {};
    if (!fixedTarget) {
      if (!targetType) next.targetType = 'Vui lòng chọn loại đối tượng.';
      if (!UUID_PATTERN.test(effectiveId)) next.targetId = 'Mã đối tượng phải là một UUID hợp lệ.';
    }
    if (!reason) next.reason = 'Vui lòng chọn lý do báo cáo.';
    const text = description.trim();
    if (text.length < DESCRIPTION_MIN) next.description = `Mô tả cần ít nhất ${DESCRIPTION_MIN} ký tự.`;
    if (text.length > DESCRIPTION_MAX) next.description = `Mô tả tối đa ${DESCRIPTION_MAX} ký tự.`;
    const filled = evidenceUrls.map((u) => u.trim()).filter(Boolean);
    if (filled.some((u) => !/^https?:\/\/\S+$/i.test(u))) {
      next.evidence = 'Bằng chứng phải là đường dẫn bắt đầu bằng http:// hoặc https://.';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting || !validate()) return;

    setIsSubmitting(true);
    try {
      const evidence = evidenceUrls
        .map((u) => u.trim())
        .filter(Boolean)
        .map((url) => ({ url }));
      await createReport({
        targetType: effectiveType,
        targetId: effectiveId,
        reason,
        description: description.trim(),
        evidence: evidence.length > 0 ? evidence : undefined,
      });
      onSubmitted?.();
    } catch (error) {
      setErrors({ form: getM05ErrorMessage(error, 'Không thể gửi báo cáo. Vui lòng thử lại.') });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit} noValidate>
      {errors.form && <Alert variant="destructive">{errors.form}</Alert>}

      {!fixedTarget && (
        <>
          <Select
            label="Loại đối tượng bị báo cáo"
            value={targetType}
            onChange={(e) => setTargetType(e.target.value)}
            error={errors.targetType}
            disabled={isSubmitting}
            options={[
              { label: '-- Chọn loại đối tượng --', value: '' },
              ...allowedTypes.map((value) => ({ label: VIOLATION_TARGET_LABEL[value] ?? value, value })),
            ]}
          />
          <Input
            label="Mã đối tượng (UUID)"
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            error={errors.targetId}
            disabled={isSubmitting}
          />
          <p className="-mt-2 text-xs text-muted-foreground">
            Mã này lấy từ trang chi tiết của đối tượng. Khi các trang đó có nút "Báo cáo", mã sẽ được điền sẵn. Không lộ mã đối tượng.
          </p>
        </>
      )}

      <Select
        label="Lý do"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        error={errors.reason}
        disabled={isSubmitting}
        options={[
          { label: '-- Chọn lý do --', value: '' },
          ...Object.entries(VIOLATION_REASON_LABEL).map(([value, label]) => ({ label, value })),
        ]}
      />

      <Textarea
        label={`Mô tả chi tiết (tối thiểu ${DESCRIPTION_MIN} ký tự)`}
        placeholder="Nêu rõ sự việc, thời điểm và thiệt hại (nếu có)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        error={errors.description}
        disabled={isSubmitting}
        maxLength={DESCRIPTION_MAX}
      />

      <div className="space-y-2">
        <p className="text-xs font-semibold text-foreground/80">
          Bằng chứng (đường dẫn, tối đa {MAX_EVIDENCE}, không bắt buộc)
        </p>
        {evidenceUrls.map((url, index) => (
          <div key={index} className="flex items-start gap-2">
            <Input
              aria-label={`Bằng chứng ${index + 1}`}
              placeholder="https://..."
              value={url}
              onChange={(e) =>
                setEvidenceUrls((list) => list.map((item, i) => (i === index ? e.target.value : item)))
              }
              disabled={isSubmitting}
            />
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setEvidenceUrls((list) => list.filter((_, i) => i !== index))}
              disabled={isSubmitting}
            >
              Xóa
            </Button>
          </div>
        ))}
        {errors.evidence && <p className="text-xs text-destructive">{errors.evidence}</p>}
        {evidenceUrls.length < MAX_EVIDENCE && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setEvidenceUrls((list) => [...list, ''])}
            disabled={isSubmitting}
          >
            Thêm bằng chứng
          </Button>
        )}
        <p className="text-xs text-muted-foreground">Chưa hỗ trợ tải tệp lên; hãy dán đường dẫn tới ảnh/tài liệu.</p>
      </div>

      <div className="flex gap-2">
        <Button type="submit" isLoading={isSubmitting}>
          Gửi báo cáo
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Hủy
          </Button>
        )}
      </div>
    </form>
  );
}
