import {
  ApplicationJobContextDto, CvSnapshotDto, JobAccessSource as ContractJobAccessSource,
  NotificationEventType,
} from '@campusjob/contracts';
import { ApplicationStatus } from '../domain/application-state';
import { InterviewMode } from '../../interviews/domain/interview-rules';

export const M04_CV_SOURCE = Symbol('M04_CV_SOURCE');
export const M04_JOB_SOURCE = Symbol('M04_JOB_SOURCE');
export const M04_REPOSITORY = Symbol('M04_REPOSITORY');

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

export type InterviewViewRecord = Readonly<{
  interview: InterviewRecord;
  application: Pick<ApplicationRecord, 'id' | 'studentId' | 'jobId' | 'status' | 'cvSnapshot'>;
  changeRequest: ChangeRequestRecord | null;
}>;

export type JobApplicationContext = Readonly<ApplicationJobContextDto>;

export type M04EventDraft = Readonly<{
  eventType: NotificationEventType | 'JOB_CLOSE_SUGGESTED';
  entityType: 'APPLICATION' | 'INTERVIEW' | 'INTERVIEW_CHANGE_REQUEST';
  actorId: string;
  recipientId: string;
  payload: Readonly<Record<string, unknown>>;
}>;

export type ApplicationHistoryRecord = Readonly<{
  id: string;
  actorId: string;
  fromStatus: ApplicationStatus | null;
  toStatus: ApplicationStatus;
  reason: string | null;
  createdAt: Date;
}>;

/** M02 must verify CV ownership and return an immutable snapshot. */
export interface CvSnapshotSource {
  getOwnedSnapshot(studentId: string, cvId: string): Promise<CvSnapshotDto>;
}

/** M03 owns job eligibility and the real employer-to-job relationship. */
export type JobAccessSource = ContractJobAccessSource;

export interface M04EventDispatcher {
  dispatchPending(): Promise<void>;
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
  }, events?: readonly M04EventDraft[]): Promise<ApplicationRecord>;
  getApplication(id: string): Promise<ApplicationRecord | null>;
  getApplicationHistory(id: string): Promise<ApplicationHistoryRecord[]>;
  listStudentApplications(studentId: string): Promise<ApplicationRecord[]>;
  listJobApplications(jobId: string): Promise<ApplicationRecord[]>;
  changeApplicationStatus(input: {
    id: string;
    expected: ApplicationStatus;
    next: ApplicationStatus;
    actorId: string;
    reason?: string;
  }, events?: readonly M04EventDraft[]): Promise<ApplicationRecord>;
  createInterview(input: {
    applicationId: string;
    actorId: string;
    scheduledAt: Date;
    mode: InterviewMode;
    locationOrLink: string;
    message: string | null;
  }, events?: readonly M04EventDraft[]): Promise<InterviewRecord>;
  getInterview(id: string): Promise<InterviewRecord | null>;
  listStudentInterviews(studentId: string): Promise<InterviewRecord[]>;
  listStudentInterviewViews(studentId: string): Promise<InterviewViewRecord[]>;
  listJobInterviewViews(jobId: string): Promise<InterviewViewRecord[]>;
  confirmInterview(id: string, at: Date, events?: readonly M04EventDraft[]): Promise<InterviewRecord>;
  getChangeRequest(interviewId: string): Promise<ChangeRequestRecord | null>;
  createChangeRequest(input: {
    interviewId: string;
    proposedAt: Date;
    message: string | null;
  }, events?: readonly M04EventDraft[]): Promise<ChangeRequestRecord>;
  decideChangeRequest(input: {
    interviewId: string;
    decision: 'APPROVED' | 'REJECTED';
    decidedBy: string;
    at: Date;
  }, events?: readonly M04EventDraft[]): Promise<ChangeRequestRecord>;
  recordInterviewResult(input: {
    interviewId: string;
    result: 'ACCEPTED' | 'REJECTED';
    actorId: string;
    at: Date;
    reason?: string;
  }, events?: readonly M04EventDraft[]): Promise<InterviewRecord>;
}

export class M04WorkflowError extends Error {
  constructor(
    readonly code:
      | 'NOT_FOUND'
      | 'FORBIDDEN'
      | 'INVALID_STATE'
      | 'INVALID_INPUT'
      | 'DUPLICATE_APPLICATION'
      | 'QUOTA_EXCEEDED'
      | 'CONCURRENT_CHANGE',
  ) {
    super(code);
    this.name = 'M04WorkflowError';
  }
}
