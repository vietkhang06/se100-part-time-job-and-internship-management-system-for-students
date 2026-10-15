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

export type ApplicationAction =
  | 'MARK_VIEWED'
  | 'WITHDRAW'
  | 'REJECT'
  | 'SCHEDULE_INTERVIEW'
  | 'ACCEPT_AFTER_INTERVIEW'
  | 'REJECT_AFTER_INTERVIEW';

type Transition = {
  actor: UserRole;
  from: readonly ApplicationStatus[];
  to: ApplicationStatus;
};

/**
 * This table only defines state and role rules. Resource ownership, interview
 * timing and persistence must be checked by the application use case.
 */
const TRANSITIONS: Record<ApplicationAction, Transition> = {
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
  },
};

export class InvalidApplicationTransitionError extends Error {
  constructor() {
    super('Application action is not permitted for this role and state.');
    this.name = 'InvalidApplicationTransitionError';
  }
}

export function nextApplicationStatus(
  current: ApplicationStatus,
  action: ApplicationAction,
  actor: UserRole,
): ApplicationStatus {
  const rule = TRANSITIONS[action];
  if (actor !== rule.actor || !rule.from.includes(current)) {
    throw new InvalidApplicationTransitionError();
  }
  return rule.to;
}
