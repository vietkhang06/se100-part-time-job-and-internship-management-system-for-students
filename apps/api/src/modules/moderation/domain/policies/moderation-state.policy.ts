import {
  ModerationDecisionType as D,
  ModerationStatus as S,
  ModerationTargetType as T,
} from '@campusjob/contracts';

/**
 * State rule của C-16 (DRAFT):
 *   PENDING --decision--> trạng thái cuối của một vòng kiểm duyệt.
 * "Duyệt lại" = đối tượng được enqueue lần nữa → tạo vòng (round) mới, không sửa vòng cũ.
 *
 * Quyết định cho phép theo loại đối tượng (đối chiếu Danh sách Use Case):
 *   JOB    (UC51): phê duyệt, từ chối, ẩn
 *   REVIEW (UC53): ẩn, khôi phục
 *   REPORT (UC52): kết luận sơ bộ có/không căn cứ — KHÔNG phải quyết định chế tài (UC59 là của Admin)
 */
export const ALLOWED_DECISIONS: Record<T, readonly D[]> = {
  [T.JOB]: [D.APPROVE, D.REJECT, D.HIDE],
  [T.REVIEW]: [D.HIDE, D.RESTORE],
  [T.REPORT]: [D.SUBSTANTIATE, D.DISMISS],
};

const DECISION_TO_STATUS: Record<D, S> = {
  [D.APPROVE]: S.APPROVED,
  [D.REJECT]: S.REJECTED,
  [D.HIDE]: S.HIDDEN,
  [D.RESTORE]: S.RESTORED,
  [D.SUBSTANTIATE]: S.SUBSTANTIATED,
  [D.DISMISS]: S.DISMISSED,
};

/** Quyết định phải kèm lý do (người bị ảnh hưởng cần biết vì sao). APPROVE/RESTORE thì không bắt buộc. */
const REASON_REQUIRED = new Set<D>([D.REJECT, D.HIDE, D.SUBSTANTIATE, D.DISMISS]);

export function isDecisionAllowed(targetType: T, decision: D): boolean {
  return ALLOWED_DECISIONS[targetType].includes(decision);
}

export function statusForDecision(decision: D): S {
  return DECISION_TO_STATUS[decision];
}

export function isReasonRequired(decision: D): boolean {
  return REASON_REQUIRED.has(decision);
}
