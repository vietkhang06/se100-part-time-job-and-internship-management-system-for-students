import { CvSnapshotDto } from '@campusjob/contracts';
import { ApplicationStatus } from '../domain/application-state';

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

/** M02 checks ownership and supplies the submitted CV snapshot. */
export interface CvSnapshotSource {
  getOwnedSnapshot(studentId: string, cvId: string): Promise<CvSnapshotDto>;
}

/** M03 owns job eligibility and the employer-to-job relationship. */
export interface JobAccessSource {
  assertAcceptingApplications(jobId: string): Promise<void>;
  assertManagedBy(jobId: string, employerUserId: string): Promise<void>;
}

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
