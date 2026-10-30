import { ApplicationStatus } from './application-state';

export type PriorApplication = Readonly<{
  jobId: string;
  status: ApplicationStatus;
}>;

/** Maximum number of in-progress (active) applications a student can hold simultaneously */
export const MAX_ACTIVE_APPLICATIONS_PER_STUDENT = 5;

/** Active application statuses that count towards the concurrent processing quota */
export const ACTIVE_APPLICATION_STATUSES: readonly ApplicationStatus[] = [
  ApplicationStatus.SUBMITTED,
  ApplicationStatus.REVIEWING,
  ApplicationStatus.INTERVIEW_SCHEDULED,
] as const;

/** Terminal application statuses that do NOT count towards the active quota */
export const TERMINAL_APPLICATION_STATUSES: readonly ApplicationStatus[] = [
  ApplicationStatus.ACCEPTED,
  ApplicationStatus.REJECTED,
  ApplicationStatus.WITHDRAWN,
] as const;

export type SubmissionPolicyErrorCode =
  | 'APPLICATION_ALREADY_EXISTS_FOR_JOB'
  | 'APPLICATION_QUOTA_EXCEEDED';

export class ApplicationSubmissionPolicyError extends Error {
  constructor(readonly code: SubmissionPolicyErrorCode) {
    super(code);
    this.name = 'ApplicationSubmissionPolicyError';
  }
}

export function countActiveApplications(
  priorApplications: readonly PriorApplication[],
): number {
  return priorApplications.filter((application) =>
    ACTIVE_APPLICATION_STATUSES.includes(application.status),
  ).length;
}

/**
 * Workbook FR-12 / domain glossary GL-16 / S3-M04-03:
 * 1. One student can submit only once to a job, including when an earlier application has ended.
 * 2. Maximum 5 active applications (SUBMITTED, REVIEWING, INTERVIEW_SCHEDULED) at any time.
 * Terminal states (ACCEPTED, REJECTED, WITHDRAWN) do not count towards the quota.
 */
export function assertCanSubmitApplication(
  jobId: string,
  priorApplications: readonly PriorApplication[],
): void {
  const previousForJob = priorApplications.find((application) => application.jobId === jobId);
  if (previousForJob) {
    throw new ApplicationSubmissionPolicyError('APPLICATION_ALREADY_EXISTS_FOR_JOB');
  }

  const activeCount = countActiveApplications(priorApplications);
  if (activeCount >= MAX_ACTIVE_APPLICATIONS_PER_STUDENT) {
    throw new ApplicationSubmissionPolicyError('APPLICATION_QUOTA_EXCEEDED');
  }
}

