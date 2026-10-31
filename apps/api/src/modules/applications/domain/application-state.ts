import { UserRole } from '@campusjob/contracts';

/** Application states shared by the repository state diagram and SRS section 1.5. */
export enum ApplicationStatus {
  SUBMITTED = 'SUBMITTED',
  REVIEWING = 'REVIEWING',
  INTERVIEW_SCHEDULED = 'INTERVIEW_SCHEDULED',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  WITHDRAWN = 'WITHDRAWN',
}

/**
 * Mapping between curriculum/SRS Vietnamese display labels and internal enum (S3-M04-04).
 * Ensures consistency without creating redundant database enums.
 */
export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  [ApplicationStatus.SUBMITTED]: 'Đã nộp',
  [ApplicationStatus.REVIEWING]: 'Đã xem',
  [ApplicationStatus.INTERVIEW_SCHEDULED]: 'Hẹn phỏng vấn',
  [ApplicationStatus.ACCEPTED]: 'Trúng tuyển',
  [ApplicationStatus.REJECTED]: 'Không trúng tuyển',
  [ApplicationStatus.WITHDRAWN]: 'Đã rút hồ sơ',
};

export const VIETNAMESE_LABEL_TO_STATUS: Readonly<Record<string, ApplicationStatus>> = {
  'Đã nộp': ApplicationStatus.SUBMITTED,
  'Nộp hồ sơ': ApplicationStatus.SUBMITTED,
  'Chờ xem xét': ApplicationStatus.SUBMITTED,
  'Đã xem': ApplicationStatus.REVIEWING,
  'Hẹn phỏng vấn': ApplicationStatus.INTERVIEW_SCHEDULED,
  'Từ chối': ApplicationStatus.REJECTED,
  'Không trúng tuyển': ApplicationStatus.REJECTED,
  'Trúng tuyển': ApplicationStatus.ACCEPTED,
  'Đã rút hồ sơ': ApplicationStatus.WITHDRAWN,
  'Rút hồ sơ': ApplicationStatus.WITHDRAWN,
};

export type ApplicationAction =
  | 'MARK_VIEWED'
  | 'WITHDRAW'
  | 'REJECT'
  | 'SCHEDULE_INTERVIEW'
  | 'ACCEPT_AFTER_INTERVIEW'
  | 'REJECT_AFTER_INTERVIEW';

export type ApplicationTransitionRule = {
  actor: UserRole;
  from: readonly ApplicationStatus[];
  to: ApplicationStatus;
  requiresReason?: boolean;
};

/**
 * This table defines the formal state transition matrix (S3-M04-04).
 * Resource ownership, interview timing and persistence are enforced by application use cases.
 */
export const APPLICATION_TRANSITIONS: Record<ApplicationAction, ApplicationTransitionRule> = {
  MARK_VIEWED: {
    actor: UserRole.EMPLOYER,
    from: [ApplicationStatus.SUBMITTED],
    to: ApplicationStatus.REVIEWING,
  },
  WITHDRAW: {
    actor: UserRole.STUDENT,
    from: [ApplicationStatus.SUBMITTED, ApplicationStatus.REVIEWING],
    to: ApplicationStatus.WITHDRAWN,
  },
  REJECT: {
    actor: UserRole.EMPLOYER,
    from: [ApplicationStatus.REVIEWING],
    to: ApplicationStatus.REJECTED,
    requiresReason: true,
  },
  SCHEDULE_INTERVIEW: {
    actor: UserRole.EMPLOYER,
    from: [ApplicationStatus.REVIEWING],
    to: ApplicationStatus.INTERVIEW_SCHEDULED,
  },
  ACCEPT_AFTER_INTERVIEW: {
    actor: UserRole.EMPLOYER,
    from: [ApplicationStatus.INTERVIEW_SCHEDULED],
    to: ApplicationStatus.ACCEPTED,
  },
  REJECT_AFTER_INTERVIEW: {
    actor: UserRole.EMPLOYER,
    from: [ApplicationStatus.INTERVIEW_SCHEDULED],
    to: ApplicationStatus.REJECTED,
    requiresReason: true,
  },
};

export class InvalidApplicationTransitionError extends Error {
  constructor(message = 'Application action is not permitted for this role and state.') {
    super(message);
    this.name = 'InvalidApplicationTransitionError';
  }
}

export function nextApplicationStatus(
  current: ApplicationStatus,
  action: ApplicationAction,
  actor: UserRole,
  reason?: string,
): ApplicationStatus {
  const rule = APPLICATION_TRANSITIONS[action];
  if (actor !== rule.actor || !rule.from.includes(current)) {
    throw new InvalidApplicationTransitionError(
      `Transition ${action} not allowed from ${current} by ${actor}.`,
    );
  }
  if (rule.requiresReason && (!reason || !reason.trim())) {
    throw new InvalidApplicationTransitionError(`Reason is required for action ${action}.`);
  }
  return rule.to;
}

