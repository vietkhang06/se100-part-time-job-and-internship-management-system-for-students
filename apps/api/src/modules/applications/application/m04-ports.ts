import { CvSnapshotDto } from '@campusjob/contracts';
import { ApplicationStatus } from '../domain/application-state';
import { InterviewMode } from '../../interviews/domain/interview-rules';

export type ApplicationRecord = Readonly<{
  id: string;
  studentId: string;
  jobId: string;
  cvId: string;
  cvSnapshot: CvSnapshotDto;
  coverLetter: string | null;
  status: ApplicationStatus;
  rejectionReason: string | null;
  createdAt: Date;
}>;

export type InterviewRecord = Readonly<{
  id: string;
  applicationId: string;
  scheduledAt: Date;
  mode: InterviewMode;
  locationOrLink: string;
  message: string | null;
  confirmedAt: Date | null;
  result: 'ACCEPTED' | 'REJECTED' | null;
}>;

export type ChangeRequestRecord = Readonly<{
  id: string;
  interviewId: string;
  proposedAt: Date;
  message: string | null;
  decision: 'PENDING' | 'APPROVED' | 'REJECTED';
}>;

/** M02 must verify CV ownership and return an immutable snapshot. */
export interface CvSnapshotSource {
  getOwnedSnapshot(studentId: string, cvId: string): Promise<CvSnapshotDto>;
}

/** M03 owns job eligibility and the real employer-to-job relationship. */
export interface JobAccessSource {
  assertAcceptingApplications(jobId: string): Promise<void>;
  assertManagedBy(jobId: string, employerUserId: string): Promise<void>;
}

/**
 * All writes must enforce their preconditions atomically. A stale expected
 * status, duplicate submission, repeated response or request must fail rather
 * than overwrite a concurrent change.
 */
export interface M04Repository {
  createApplication(input: {
    studentId: string;
    jobId: string;
    cvId: string;
    cvSnapshot: CvSnapshotDto;
    coverLetter: string | null;
  }): Promise<ApplicationRecord>;
  getApplication(id: string): Promise<ApplicationRecord | null>;
  listStudentApplications(studentId: string): Promise<ApplicationRecord[]>;
  listJobApplications(jobId: string): Promise<ApplicationRecord[]>;
  changeApplicationStatus(input: {
    id: string;
    expected: ApplicationStatus;
    next: ApplicationStatus;
    actorId: string;
    reason?: string;
  }): Promise<ApplicationRecord>;
  createInterview(input: {
    applicationId: string;
    actorId: string;
    scheduledAt: Date;
    mode: InterviewMode;
    locationOrLink: string;
    message: string | null;
  }): Promise<InterviewRecord>;
  getInterview(id: string): Promise<InterviewRecord | null>;
  listStudentInterviews(studentId: string): Promise<InterviewRecord[]>;
  confirmInterview(id: string, at: Date): Promise<InterviewRecord>;
  getChangeRequest(interviewId: string): Promise<ChangeRequestRecord | null>;
  createChangeRequest(input: {
    interviewId: string;
    proposedAt: Date;
    message: string | null;
  }): Promise<ChangeRequestRecord>;
  decideChangeRequest(input: {
    interviewId: string;
    decision: 'APPROVED' | 'REJECTED';
    decidedBy: string;
    at: Date;
  }): Promise<ChangeRequestRecord>;
  recordInterviewResult(input: {
    interviewId: string;
    result: 'ACCEPTED' | 'REJECTED';
    actorId: string;
    at: Date;
    reason?: string;
  }): Promise<InterviewRecord>;
}

export class M04WorkflowError extends Error {
  constructor(
    readonly code:
      | 'NOT_FOUND'
      | 'FORBIDDEN'
      | 'INVALID_STATE'
      | 'INVALID_INPUT'
      | 'DUPLICATE_APPLICATION'
      | 'CONCURRENT_CHANGE',
  ) {
    super(code);
    this.name = 'M04WorkflowError';
  }
}
