'use client';

import * as React from 'react';
import type { ModerationItemDetailDto } from '@campusjob/contracts';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Spinner } from '@/components/ui/spinner';
import { ReportDetailLoader } from '@/components/reports/report-detail';
import {
  claimModerationItem,
  decideModerationItem,
  getModerationItem,
} from '@/lib/moderation-api';
import {
  DECISIONS_BY_TARGET,
  DECISION_LABEL,
  PROPOSED_ACTION_MAX_LENGTH,
  REASON_MAX_LENGTH,
  REASON_REQUIRED,
  STATUS_LABEL,
  STATUS_VARIANT,
  TARGET_TYPE_LABEL,
  formatDateTime,
  getErrorCode,
  getModerationErrorMessage,
  type ModerationDecisionValue,
} from '@/lib/moderation-labels';

export interface ModerationItemDialogProps {
  itemId: string | null;
  currentUserId: string;
  isAdmin: boolean;
  onClose: () => void;
  /** Gọi sau khi nhận xử lý hoặc ra quyết định để làm mới danh sách. */
  onChanged: () => void;
}

interface FormErrors {
  decision?: string;
  reason?: string;
  proposedAction?: string;
  form?: string;
}

interface Notice {
  variant: 'success' | 'warning';
  text: string;
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="col-span-2 text-foreground break-words">{children}</dd>
    </div>
  );
}

export function ModerationItemDialog({
  itemId,
  currentUserId,
  isAdmin,
  onClose,
  onChanged,
}: ModerationItemDialogProps) {
  const [detail, setDetail] = React.useState<ModerationItemDetailDto | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [isClaiming, setIsClaiming] = React.useState(false);
  const [decision, setDecision] = React.useState('');
  const [reason, setReason] = React.useState('');
  const [proposedAction, setProposedAction] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errors, setErrors] = React.useState<FormErrors>({});
  const [notice, setNotice] = React.useState<Notice | null>(null);
  const latestRequest = React.useRef(0);

  const resetForm = React.useCallback(() => {
    setDecision('');
    setReason('');
    setProposedAction('');
    setErrors({});
  }, []);

  const load = React.useCallback(async (id: string) => {
    const requestId = ++latestRequest.current;
    setIsLoading(true);
    setLoadError(null);
    try {
      const result = await getModerationItem(id);
      if (requestId !== latestRequest.current) return;
      setDetail(result);
    } catch (error) {
      if (requestId !== latestRequest.current) return;
      setLoadError(getModerationErrorMessage(error, 'Không thể tải chi tiết mục kiểm duyệt.'));
    } finally {
      if (requestId === latestRequest.current) setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    setDetail(null);
    setNotice(null);
    resetForm();
    if (itemId) {
      void load(itemId);
    } else {
      latestRequest.current++;
    }
  }, [itemId, load, resetForm]);

  const isPending = detail?.status === 'PENDING';
  const assigneeId = detail?.assigneeId ?? null;
  const assignedToMe = assigneeId !== null && assigneeId === currentUserId;
  const assignedToOther = assigneeId !== null && !assignedToMe;
  const canDecide = Boolean(isPending) && (!assignedToOther || isAdmin);
  const decisionOptions = detail ? (DECISIONS_BY_TARGET[detail.targetType] ?? []) : [];

  const assigneeText = assigneeId === null ? 'Chưa ai nhận' : assignedToMe ? 'Bạn' : 'Kiểm duyệt viên khác';

  const handleClaim = async () => {
    if (!detail || isClaiming) return;
    setIsClaiming(true);
    setErrors({});
    setNotice(null);
    try {
      await claimModerationItem(detail.id);
      setNotice({ variant: 'success', text: 'Bạn đã nhận xử lý mục này.' });
      onChanged();
      await load(detail.id);
    } catch (error) {
      setErrors({ form: getModerationErrorMessage(error, 'Không thể nhận xử lý mục này.') });
      if (getErrorCode(error) === 'MODERATION_ALREADY_DECIDED') {
        onChanged();
        await load(detail.id);
      }
    } finally {
      setIsClaiming(false);
    }
  };

  const validate = (): boolean => {
    const next: FormErrors = {};
    if (!decision) {
      next.decision = 'Vui lòng chọn quyết định.';
    }
    if (decision && REASON_REQUIRED.includes(decision as ModerationDecisionValue) && !reason.trim()) {
      next.reason = 'Vui lòng nhập lý do cho quyết định này.';
    }
    if (reason.length > REASON_MAX_LENGTH) {
      next.reason = `Lý do tối đa ${REASON_MAX_LENGTH} ký tự.`;
    }
    if (proposedAction.length > PROPOSED_ACTION_MAX_LENGTH) {
      next.proposedAction = `Đề xuất tối đa ${PROPOSED_ACTION_MAX_LENGTH} ký tự.`;
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!detail || isSubmitting || !validate()) return;

    setIsSubmitting(true);
    setNotice(null);
    try {
      const isReport = detail.targetType === 'REPORT';
      const result = await decideModerationItem(detail.id, {
        decision: decision as ModerationDecisionValue,
        reason: reason.trim() || undefined,
        proposedAction: isReport && proposedAction.trim() ? proposedAction.trim() : undefined,
      });
      setNotice(
        result.decision.targetSynced
          ? { variant: 'success', text: 'Đã ghi nhận quyết định.' }
          : {
              variant: 'warning',
              text: 'Đã ghi nhận quyết định, nhưng chưa áp dụng được lên nội dung gốc (module liên quan chưa kết nối). Hệ thống sẽ đồng bộ lại sau.',
            },
      );
      resetForm();
      onChanged();
      await load(detail.id);
    } catch (error) {
      setErrors({ form: getModerationErrorMessage(error, 'Không thể ghi nhận quyết định. Vui lòng thử lại.') });
      if (getErrorCode(error) === 'MODERATION_ALREADY_DECIDED') {
        onChanged();
        await load(detail.id);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const showProposedAction = detail?.targetType === 'REPORT';

  return (
    <Dialog
      isOpen={itemId !== null}
      onClose={onClose}
      title="Chi tiết kiểm duyệt"
      description={detail ? (TARGET_TYPE_LABEL[detail.targetType] ?? detail.targetType) : undefined}
      footer={
        <Button type="button" variant="outline" onClick={onClose}>
          Đóng
        </Button>
      }
    >
      <div className="max-h-[65vh] space-y-4 overflow-y-auto pr-1">
        {isLoading && !detail && (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        )}

        {loadError && (
          <Alert variant="destructive" title="Không tải được dữ liệu">
            {loadError}
          </Alert>
        )}

        {notice && <Alert variant={notice.variant}>{notice.text}</Alert>}

        {detail && (
          <>
            <dl className="space-y-2">
              <InfoRow label="Trạng thái">
                <Badge variant={STATUS_VARIANT[detail.status] ?? 'outline'}>
                  {STATUS_LABEL[detail.status] ?? detail.status}
                </Badge>
              </InfoRow>
              <InfoRow label="Nội dung">{detail.summary ?? '—'}</InfoRow>
              <InfoRow label="Mã đối tượng">
                <span className="font-mono text-xs">{detail.targetId}</span>
              </InfoRow>
              <InfoRow label="Vòng kiểm duyệt">{detail.round}</InfoRow>
              <InfoRow label="Vào hàng chờ">{formatDateTime(detail.enqueuedAt)}</InfoRow>
              <InfoRow label="Người phụ trách">{assigneeText}</InfoRow>
              {detail.decidedAt && <InfoRow label="Xử lý lúc">{formatDateTime(detail.decidedAt)}</InfoRow>}
            </dl>

            {detail.targetType === 'REPORT' && (
              // key theo số quyết định để tải lại báo cáo (trạng thái mới) sau khi vừa ra quyết định.
              <ReportDetailLoader key={`${detail.targetId}-${detail.decisions.length}`} reportId={detail.targetId} />
            )}

            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground">Lịch sử quyết định</h3>
              {detail.decisions.length === 0 ? (
                <p className="text-sm text-muted-foreground">Chưa có quyết định nào.</p>
              ) : (
                <ul className="space-y-2">
                  {detail.decisions.map((item) => (
                    <li key={item.id} className="rounded-lg border border-border p-3 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{DECISION_LABEL[item.decision] ?? item.decision}</span>
                        <span className="text-xs text-muted-foreground">{formatDateTime(item.createdAt)}</span>
                        {!item.targetSynced && <Badge variant="warning">Chưa đồng bộ</Badge>}
                      </div>
                      {item.reason && <p className="mt-1 text-muted-foreground">Lý do: {item.reason}</p>}
                      {item.proposedAction && (
                        <p className="mt-1 text-muted-foreground">Đề xuất xử lý: {item.proposedAction}</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {isPending && assignedToOther && (
              <Alert variant="info">
                {isAdmin
                  ? 'Mục này đang được giao cho người khác. Với quyền Quản trị viên, bạn vẫn có thể nhận lại hoặc quyết định.'
                  : 'Mục này đang được giao cho người kiểm duyệt khác nên bạn chưa thể quyết định.'}
              </Alert>
            )}

            {errors.form && <Alert variant="destructive">{errors.form}</Alert>}

            {isPending && !assignedToMe && (!assignedToOther || isAdmin) && (
              <Button type="button" variant="secondary" isLoading={isClaiming} onClick={handleClaim}>
                {assignedToOther ? 'Nhận lại xử lý' : 'Nhận xử lý'}
              </Button>
            )}

            {canDecide && (
              <form className="space-y-4 border-t border-border pt-4" onSubmit={handleSubmit} noValidate>
                <Select
                  label="Quyết định"
                  value={decision}
                  onChange={(e) => setDecision(e.target.value)}
                  error={errors.decision}
                  disabled={isSubmitting}
                  options={[
                    { label: '-- Chọn quyết định --', value: '' },
                    ...decisionOptions.map((value) => ({
                      label: DECISION_LABEL[value] ?? value,
                      value,
                    })),
                  ]}
                />
                {detail.targetType === 'REPORT' && decision === 'SUBSTANTIATE' && (
                  <Alert variant="info">
                    Kết luận "có căn cứ" chỉ là kết luận sơ bộ: báo cáo sẽ được chuyển cho Quản trị viên phán quyết.
                    Bạn không áp chế tài trực tiếp.
                  </Alert>
                )}
                <Textarea
                  label={
                    decision && REASON_REQUIRED.includes(decision as ModerationDecisionValue)
                      ? 'Lý do (bắt buộc)'
                      : 'Lý do (không bắt buộc)'
                  }
                  placeholder="Nêu rõ căn cứ để người liên quan hiểu quyết định này"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  error={errors.reason}
                  disabled={isSubmitting}
                  maxLength={REASON_MAX_LENGTH}
                />
                {showProposedAction && (
                  <Textarea
                    label="Đề xuất xử lý (không bắt buộc)"
                    placeholder="Ví dụ: đề xuất cảnh cáo hoặc khóa tạm thời. Quyết định cuối thuộc về Quản trị viên."
                    value={proposedAction}
                    onChange={(e) => setProposedAction(e.target.value)}
                    error={errors.proposedAction}
                    disabled={isSubmitting}
                    maxLength={PROPOSED_ACTION_MAX_LENGTH}
                  />
                )}
                <Button type="submit" isLoading={isSubmitting}>
                  Ghi nhận quyết định
                </Button>
              </form>
            )}
          </>
        )}
      </div>
    </Dialog>
  );
}
