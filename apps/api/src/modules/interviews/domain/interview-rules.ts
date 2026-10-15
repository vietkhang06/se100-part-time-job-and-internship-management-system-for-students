import { ApplicationStatus } from '../../applications/domain/application-state';

export type InterviewMode = 'ONSITE' | 'ONLINE';

export class InvalidInterviewActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidInterviewActionError';
  }
}

/** SRS PV01: a future time and the location appropriate to the interview mode are required. */
export function assertValidInterviewSchedule(
  scheduledAt: Date,
  mode: InterviewMode,
  locationOrLink: string,
  now: Date,
): void {
  if (
    !Number.isFinite(scheduledAt.getTime()) ||
    scheduledAt.getTime() <= now.getTime() ||
    locationOrLink.trim().length === 0
  ) {
    throw new InvalidInterviewActionError('Interview schedule is incomplete or not in the future.');
  }
  // The SRS requires a link for online interviews but does not restrict its scheme.
  // A provider-specific link policy belongs in the approved API contract.
  void mode;
}

/** SRS PV04: exactly one change request may be made for each interview. */
export function assertCanRequestReschedule(
  existingRequestCount: number,
  scheduledAt: Date,
  proposedAt: Date,
  now: Date,
): void {
  if (existingRequestCount !== 0 || scheduledAt.getTime() <= now.getTime()) {
    throw new InvalidInterviewActionError('Reschedule request is no longer allowed.');
  }
  if (!Number.isFinite(proposedAt.getTime()) || proposedAt.getTime() <= now.getTime()) {
    throw new InvalidInterviewActionError('Proposed interview time must be in the future.');
  }
}

/** SRS PV05: a request already decided cannot be processed again. */
export function assertCanDecideReschedule(decision: 'PENDING' | 'APPROVED' | 'REJECTED'): void {
  if (decision !== 'PENDING') {
    throw new InvalidInterviewActionError('Reschedule request has already been decided.');
  }
}

/** SRS PV06/PV07: HR records a result only after the interview takes place. */
export function assertCanRecordInterviewResult(
  applicationStatus: ApplicationStatus,
  scheduledAt: Date,
  now: Date,
): void {
  if (
    applicationStatus !== ApplicationStatus.INTERVIEW_SCHEDULED ||
    !Number.isFinite(scheduledAt.getTime()) ||
    scheduledAt.getTime() > now.getTime()
  ) {
    throw new InvalidInterviewActionError('Interview result cannot be recorded yet.');
  }
}
