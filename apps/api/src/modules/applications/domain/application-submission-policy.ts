import { ApplicationStatus } from './application-state';

export type PriorApplication = Readonly<{
  jobId: string;
  status: ApplicationStatus;
}>;

export type SubmissionPolicyErrorCode = 'APPLICATION_ALREADY_EXISTS_FOR_JOB';

export class ApplicationSubmissionPolicyError extends Error {
  constructor(readonly code: SubmissionPolicyErrorCode) {
    super(code);
    this.name = 'ApplicationSubmissionPolicyError';
  }
}

/**
 * Workbook FR-12 / domain glossary GL-16: one student can submit only once to
 * a job, including when an earlier application has ended. Persistence must
 * enforce this atomically with a unique student/job constraint.
 */
export function assertCanSubmitApplication(
  jobId: string,
  priorApplications: readonly PriorApplication[],
): void {
  const previousForJob = priorApplications.find((application) => application.jobId === jobId);
  if (previousForJob) {
    throw new ApplicationSubmissionPolicyError('APPLICATION_ALREADY_EXISTS_FOR_JOB');
  }
}
