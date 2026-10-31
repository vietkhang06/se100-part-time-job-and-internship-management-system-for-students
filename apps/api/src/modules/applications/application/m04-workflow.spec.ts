import { CvSnapshotDto } from '@campusjob/contracts';
import { ApplicationStatus } from '../domain/application-state';
import { M04Workflow } from './m04-workflow';
import {
  ApplicationRecord, ChangeRequestRecord, CvSnapshotSource, InterviewRecord,
  JobAccessSource, M04Repository, M04WorkflowError,
} from './m04-ports';

const snapshot: CvSnapshotDto = {
  snapshotId: 'snap-1', originalCvId: 'cv-1', studentId: 'student-a',
  fullName: 'Candidate A', email: 'a@example.org', title: 'CV A',
  educations: [], experiences: [], skills: ['typescript'], projects: [],
  certifications: [], capturedAt: '2026-10-14T00:00:00.000Z',
};

class MemoryRepository implements M04Repository {
  applications = new Map<string, ApplicationRecord>();
  interviews = new Map<string, InterviewRecord>();
  changes = new Map<string, ChangeRequestRecord>();
  history: { applicationId: string; from: ApplicationStatus | null; to: ApplicationStatus }[] = [];

  async createApplication(input: {
    studentId: string; jobId: string; cvId: string; cvSnapshot: CvSnapshotDto; coverLetter: string | null;
  }): Promise<ApplicationRecord> {
    if ([...this.applications.values()].some((a) => a.studentId === input.studentId && a.jobId === input.jobId)) {
      throw new M04WorkflowError('DUPLICATE_APPLICATION');
    }
    const activeCount = [...this.applications.values()].filter(
      (a) =>
        a.studentId === input.studentId &&
        [ApplicationStatus.SUBMITTED, ApplicationStatus.REVIEWING, ApplicationStatus.INTERVIEW_SCHEDULED].includes(a.status),
    ).length;
    if (activeCount >= 5) {
      throw new M04WorkflowError('QUOTA_EXCEEDED');
    }
    const row: ApplicationRecord = {
      ...input, id: `app-${this.applications.size + 1}`, status: ApplicationStatus.SUBMITTED,
      rejectionReason: null, createdAt: new Date('2026-10-14T00:00:00.000Z'),
    };
    this.applications.set(row.id, row);
    this.history.push({ applicationId: row.id, from: null, to: row.status });
    return row;
  }
  async getApplication(id: string) { return this.applications.get(id) ?? null; }
  async listStudentApplications(studentId: string) {
    return [...this.applications.values()].filter((a) => a.studentId === studentId);
  }
  async listJobApplications(jobId: string) {
    return [...this.applications.values()].filter((a) => a.jobId === jobId);
  }
  async changeApplicationStatus(input: {
    id: string; expected: ApplicationStatus; next: ApplicationStatus; actorId: string; reason?: string;
  }) {
    const old = this.applications.get(input.id);
    if (!old || old.status !== input.expected) throw new M04WorkflowError('CONCURRENT_CHANGE');
    const row = { ...old, status: input.next, rejectionReason: input.reason ?? old.rejectionReason };
    this.applications.set(input.id, row);
    this.history.push({ applicationId: input.id, from: old.status, to: input.next });
    return row;
  }
  async createInterview(input: {
    applicationId: string; actorId: string; scheduledAt: Date; mode: 'ONSITE' | 'ONLINE';
    locationOrLink: string; message: string | null;
  }) {
    await this.changeApplicationStatus({ id: input.applicationId, expected: ApplicationStatus.REVIEWING,
      next: ApplicationStatus.INTERVIEW_SCHEDULED, actorId: input.actorId });
    const row: InterviewRecord = {
      id: `interview-${this.interviews.size + 1}`, applicationId: input.applicationId,
      scheduledAt: input.scheduledAt, mode: input.mode, locationOrLink: input.locationOrLink,
      message: input.message, confirmedAt: null, result: null,
    };
    this.interviews.set(row.id, row);
    return row;
  }
  async getInterview(id: string) { return this.interviews.get(id) ?? null; }
  async listStudentInterviews(studentId: string) {
    return [...this.interviews.values()].filter(
      (i) => this.applications.get(i.applicationId)?.studentId === studentId,
    );
  }
  async confirmInterview(id: string, at: Date) {
    const old = this.interviews.get(id);
    if (!old || old.confirmedAt || old.result || old.scheduledAt <= at) throw new M04WorkflowError('CONCURRENT_CHANGE');
    const row = { ...old, confirmedAt: at };
    this.interviews.set(id, row);
    return row;
  }
  async getChangeRequest(interviewId: string) { return this.changes.get(interviewId) ?? null; }
  async createChangeRequest(input: { interviewId: string; proposedAt: Date; message: string | null }) {
    if (this.changes.has(input.interviewId)) throw new M04WorkflowError('CONCURRENT_CHANGE');
    const row: ChangeRequestRecord = { ...input, id: 'change-1', decision: 'PENDING' };
    this.changes.set(input.interviewId, row);
    return row;
  }
  async decideChangeRequest(input: {
    interviewId: string; decision: 'APPROVED' | 'REJECTED'; decidedBy: string; at: Date;
  }) {
    const old = this.changes.get(input.interviewId);
    if (!old || old.decision !== 'PENDING') throw new M04WorkflowError('CONCURRENT_CHANGE');
    const row: ChangeRequestRecord = { ...old, decision: input.decision };
    this.changes.set(input.interviewId, row);
    if (input.decision === 'APPROVED') {
      const interview = this.interviews.get(input.interviewId)!;
      this.interviews.set(input.interviewId, { ...interview, scheduledAt: row.proposedAt });
    }
    return row;
  }
  async recordInterviewResult(input: {
    interviewId: string; result: 'ACCEPTED' | 'REJECTED'; actorId: string; at: Date; reason?: string;
  }) {
    const old = this.interviews.get(input.interviewId);
    if (!old || old.result || old.scheduledAt > input.at) throw new M04WorkflowError('CONCURRENT_CHANGE');
    await this.changeApplicationStatus({ id: old.applicationId, expected: ApplicationStatus.INTERVIEW_SCHEDULED,
      next: input.result === 'ACCEPTED' ? ApplicationStatus.ACCEPTED : ApplicationStatus.REJECTED,
      actorId: input.actorId, reason: input.reason });
    const row: InterviewRecord = { ...old, result: input.result };
    this.interviews.set(input.interviewId, row);
    return row;
  }
}

describe('M04 workflow with contract fixtures', () => {
  let repository: MemoryRepository;
  let workflow: M04Workflow;
  let current: Date;
  let owner: string;
  let returnedSnapshot: CvSnapshotDto;
  const jobs: JobAccessSource = {
    assertAcceptingApplications: async (jobId) => {
      if (!jobId.startsWith('job-')) throw new M04WorkflowError('INVALID_INPUT');
    },
    assertManagedBy: async (jobId, employerId) => {
      if (!jobId.startsWith('job-') || employerId !== owner) throw new M04WorkflowError('FORBIDDEN');
    },
  };
  const cvs: CvSnapshotSource = {
    getOwnedSnapshot: async (studentId, cvId) => {
      if (studentId !== 'student-a' || cvId !== 'cv-1') throw new M04WorkflowError('NOT_FOUND');
      return returnedSnapshot;
    },
  };

  beforeEach(() => {
    repository = new MemoryRepository();
    current = new Date('2026-10-14T10:00:00.000Z');
    owner = 'employer-a';
    returnedSnapshot = snapshot;
    workflow = new M04Workflow(repository, cvs, jobs, () => current);
  });

  it('submits a frozen CV snapshot once and hides another student’s application', async () => {
    const app = await workflow.submit('student-a', 'job-a', 'cv-1', ' Hello ');
    expect(app.coverLetter).toBe('Hello');
    expect(app.cvSnapshot).toEqual(snapshot);
    expect(repository.history).toEqual([{ applicationId: app.id, from: null, to: ApplicationStatus.SUBMITTED }]);
    await expect(workflow.submit('student-a', 'job-a', 'cv-1')).rejects.toMatchObject({ code: 'DUPLICATE_APPLICATION' });
    await expect(workflow.getMine('student-b', app.id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(await workflow.listMine('student-a')).toHaveLength(1);
    expect(await workflow.listMine('student-b')).toHaveLength(0);
  });

  it('enforces maximum 5 active applications quota and allows new submission after withdrawal (S3-M04-03)', async () => {
    await workflow.submit('student-a', 'job-1', 'cv-1');
    await workflow.submit('student-a', 'job-2', 'cv-1');
    await workflow.submit('student-a', 'job-3', 'cv-1');
    await workflow.submit('student-a', 'job-4', 'cv-1');
    const app5 = await workflow.submit('student-a', 'job-5', 'cv-1');

    // 6th active application must be rejected with QUOTA_EXCEEDED
    await expect(workflow.submit('student-a', 'job-6', 'cv-1')).rejects.toMatchObject({
      code: 'QUOTA_EXCEEDED',
    });

    // Student withdraws one in-progress application -> freeing an active slot
    await workflow.withdraw('student-a', app5.id);

    // Now submitting a new job should succeed
    const app6 = await workflow.submit('student-a', 'job-6', 'cv-1');
    expect(app6.status).toBe(ApplicationStatus.SUBMITTED);
  });

  it('rejects a CV snapshot that does not match the actor and selected CV', async () => {
    returnedSnapshot = { ...snapshot, studentId: 'student-b' };
    await expect(workflow.submit('student-a', 'job-a', 'cv-1')).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(repository.applications.size).toBe(0);
  });

  it('allows only the managing employer to view and process a candidate', async () => {
    const app = await workflow.submit('student-a', 'job-a', 'cv-1');
    await expect(workflow.getCandidate('employer-b', app.id)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(workflow.markViewed('employer-b', app.id)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect((await workflow.markViewed('employer-a', app.id)).status).toBe(ApplicationStatus.REVIEWING);
    await expect(workflow.reject('employer-a', app.id, '  ')).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    expect((await workflow.reject('employer-a', app.id, 'Not a fit')).status).toBe(ApplicationStatus.REJECTED);
    expect(repository.history.map((h) => h.to)).toEqual([
      ApplicationStatus.SUBMITTED, ApplicationStatus.REVIEWING, ApplicationStatus.REJECTED,
    ]);
    await expect(workflow.withdraw('student-a', app.id)).rejects.toThrow();
  });

  it('supports candidate withdrawal only before an interview', async () => {
    const app = await workflow.submit('student-a', 'job-a', 'cv-1');
    expect((await workflow.withdraw('student-a', app.id)).status).toBe(ApplicationStatus.WITHDRAWN);
    await expect(workflow.markViewed('employer-a', app.id)).rejects.toThrow();
  });

  it('keeps invitation, confirmation, one reschedule and final result linked to the application', async () => {
    const app = await workflow.submit('student-a', 'job-a', 'cv-1');
    await workflow.markViewed('employer-a', app.id);
    const first = new Date('2026-10-15T10:00:00.000Z');
    const second = new Date('2026-10-16T10:00:00.000Z');
    const interview = await workflow.invite('employer-a', app.id, {
      scheduledAt: first, mode: 'ONLINE', locationOrLink: 'https://example.org/room',
    });
    expect((await workflow.getMine('student-a', app.id)).status).toBe(ApplicationStatus.INTERVIEW_SCHEDULED);
    await expect(workflow.confirmInterview('student-b', interview.id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect((await workflow.confirmInterview('student-a', interview.id)).confirmedAt).toEqual(current);
    await workflow.requestReschedule('student-a', interview.id, second, 'Exam');
    await expect(workflow.requestReschedule('student-a', interview.id, second)).rejects.toThrow();
    await expect(workflow.decideReschedule('employer-b', interview.id, 'APPROVED')).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect((await workflow.decideReschedule('employer-a', interview.id, 'APPROVED')).decision).toBe('APPROVED');
    expect((await repository.getInterview(interview.id))?.scheduledAt).toEqual(second);
    await expect(workflow.decideReschedule('employer-a', interview.id, 'APPROVED')).rejects.toThrow();
    await expect(workflow.recordResult('employer-a', interview.id, 'ACCEPTED')).rejects.toThrow();
    current = new Date('2026-10-17T10:00:00.000Z');
    expect((await workflow.recordResult('employer-a', interview.id, 'ACCEPTED')).result).toBe('ACCEPTED');
    expect((await workflow.getMine('student-a', app.id)).status).toBe(ApplicationStatus.ACCEPTED);
    await expect(workflow.recordResult('employer-a', interview.id, 'REJECTED')).rejects.toThrow();
    expect(repository.history.map((h) => h.to)).toEqual([
      ApplicationStatus.SUBMITTED, ApplicationStatus.REVIEWING,
      ApplicationStatus.INTERVIEW_SCHEDULED, ApplicationStatus.ACCEPTED,
    ]);
  });
});
