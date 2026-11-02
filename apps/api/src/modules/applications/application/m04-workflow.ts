import { Logger } from '@nestjs/common';
import { NotificationEventType, UserRole } from '@campusjob/contracts';
import {
  CvSnapshotSource, JobAccessSource, M04EventDispatcher, M04EventDraft, M04Repository,
  M04WorkflowError, ApplicationRecord, InterviewRecord,
} from './m04-ports';
import { ApplicationStatus, nextApplicationStatus } from '../domain/application-state';
import { ApplicationSubmissionPolicyError, assertCanSubmitApplication } from '../domain/application-submission-policy';
import { InterviewMode, assertCanDecideReschedule, assertCanRecordInterviewResult, assertCanRequestReschedule, assertValidInterviewSchedule } from '../../interviews/domain/interview-rules';
import { assessMatchingScore } from '../domain/matching-score';

/** M04 workflow. CV and Job decisions stay with the owning modules via ports. */
export class M04Workflow {
  private readonly logger = new Logger(M04Workflow.name);

  constructor(
    private readonly repository: M04Repository,
    private readonly cvs: CvSnapshotSource,
    private readonly jobs: JobAccessSource,
    private readonly now: () => Date = () => new Date(),
    private readonly events: M04EventDispatcher = { dispatchPending: async () => undefined },
  ) {}

  async submit(studentId: string, jobId: string, cvId: string, coverLetter?: string): Promise<ApplicationRecord> {
    await this.jobs.assertAcceptingApplications(jobId);
    const cvSnapshot = await this.cvs.getOwnedSnapshot(studentId, cvId);
    if (cvSnapshot.studentId !== studentId || cvSnapshot.originalCvId !== cvId) {
      throw new M04WorkflowError('FORBIDDEN');
    }
    const priorApplications = await this.repository.listStudentApplications(studentId);
    try {
      assertCanSubmitApplication(
        jobId,
        priorApplications.map((app) => ({ jobId: app.jobId, status: app.status })),
      );
    } catch (error) {
      if (error instanceof ApplicationSubmissionPolicyError) {
        if (error.code === 'APPLICATION_QUOTA_EXCEEDED') {
          throw new M04WorkflowError('QUOTA_EXCEEDED');
        }
        if (error.code === 'APPLICATION_ALREADY_EXISTS_FOR_JOB') {
          throw new M04WorkflowError('DUPLICATE_APPLICATION');
        }
      }
      throw error;
    }
    return this.repository.createApplication({
      studentId, jobId, cvId, cvSnapshot, coverLetter: coverLetter?.trim() || null,
    });
  }

  listMine(studentId: string): Promise<ApplicationRecord[]> {
    return this.repository.listStudentApplications(studentId);
  }

  async getMine(studentId: string, id: string): Promise<ApplicationRecord> {
    const application = await this.requireApplication(id);
    if (application.studentId !== studentId) throw new M04WorkflowError('NOT_FOUND');
    return application;
  }

  async getMineDetail(studentId: string, id: string) {
    const application = await this.getMine(studentId, id);
    return { ...application, history: await this.repository.getApplicationHistory(id) };
  }

  async withdraw(studentId: string, id: string): Promise<ApplicationRecord> {
    const application = await this.getMine(studentId, id);
    const next = nextApplicationStatus(application.status, 'WITHDRAW', UserRole.STUDENT);
    return this.repository.changeApplicationStatus({ id, expected: application.status, next, actorId: studentId });
  }

  async listCandidates(
    employerId: string,
    jobId: string,
    query: { sort?: 'asc' | 'desc'; page?: number; pageSize?: number } = {},
  ) {
    await this.jobs.assertManagedBy(jobId, employerId);
    const job = await this.jobs.getApplicationContext(jobId);
    const applications = await this.repository.listJobApplications(jobId);
    const sort = query.sort ?? 'asc';
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    const ordered = applications.sort((a, b) => {
      const time = a.createdAt.getTime() - b.createdAt.getTime();
      const stable = time === 0 ? a.id.localeCompare(b.id) : time;
      return sort === 'asc' ? stable : -stable;
    });
    const data = ordered.slice((page - 1) * pageSize, page * pageSize).map((application) => ({
      ...application,
      matchingScore: assessMatchingScore({
        cvSkills: application.cvSnapshot.skills,
        requiredSkills: job.requiredSkills,
      }),
    }));
    return { data, meta: { page, pageSize, total: ordered.length, totalPages: Math.ceil(ordered.length / pageSize) } };
  }

  async getCandidate(employerId: string, id: string): Promise<ApplicationRecord> {
    const application = await this.requireApplication(id);
    await this.jobs.assertManagedBy(application.jobId, employerId);
    return application;
  }

  async getCandidateDetail(employerId: string, id: string) {
    const application = await this.getCandidate(employerId, id);
    const job = await this.jobs.getApplicationContext(application.jobId);
    return {
      ...application,
      history: await this.repository.getApplicationHistory(id),
      matchingScore: assessMatchingScore({
        cvSkills: application.cvSnapshot.skills,
        requiredSkills: job.requiredSkills,
      }),
    };
  }

  async markViewed(employerId: string, id: string): Promise<ApplicationRecord> {
    const application = await this.getCandidate(employerId, id);
    const next = nextApplicationStatus(application.status, 'MARK_VIEWED', UserRole.EMPLOYER);
    return this.repository.changeApplicationStatus({ id, expected: application.status, next, actorId: employerId });
  }

  async reject(employerId: string, id: string, reason: string): Promise<ApplicationRecord> {
    if (!reason?.trim()) throw new M04WorkflowError('INVALID_INPUT');
    const application = await this.getCandidate(employerId, id);
    const next = nextApplicationStatus(application.status, 'REJECT', UserRole.EMPLOYER, reason.trim());
    return this.repository.changeApplicationStatus({ id, expected: application.status, next, actorId: employerId, reason: reason.trim() });
  }

  async invite(employerId: string, id: string, input: {
    scheduledAt: Date; mode: InterviewMode; locationOrLink: string; message?: string;
  }): Promise<InterviewRecord> {
    const application = await this.getCandidate(employerId, id);
    nextApplicationStatus(application.status, 'SCHEDULE_INTERVIEW', UserRole.EMPLOYER);
    assertValidInterviewSchedule(input.scheduledAt, input.mode, input.locationOrLink, this.now());
    return this.repository.createInterview({
      applicationId: id, actorId: employerId, scheduledAt: input.scheduledAt,
      mode: input.mode, locationOrLink: input.locationOrLink.trim(), message: input.message?.trim() || null,
    });
  }

  listMyInterviews(studentId: string): Promise<InterviewRecord[]> {
    return this.repository.listStudentInterviews(studentId);
  }

  async confirmInterview(studentId: string, interviewId: string): Promise<InterviewRecord> {
    const { interview } = await this.getMyInterview(studentId, interviewId);
    if (interview.confirmedAt || interview.result || interview.scheduledAt.getTime() <= this.now().getTime()) {
      throw new M04WorkflowError('INVALID_STATE');
    }
    return this.repository.confirmInterview(interviewId, this.now());
  }

  async requestReschedule(studentId: string, interviewId: string, proposedAt: Date, message?: string) {
    const { interview, application } = await this.getMyInterview(studentId, interviewId);
    if (application.status !== ApplicationStatus.INTERVIEW_SCHEDULED || interview.result) {
      throw new M04WorkflowError('INVALID_STATE');
    }
    const existing = await this.repository.getChangeRequest(interviewId);
    assertCanRequestReschedule(existing ? 1 : 0, interview.scheduledAt, proposedAt, this.now());
    return this.repository.createChangeRequest({ interviewId, proposedAt, message: message?.trim() || null });
  }

  async decideReschedule(employerId: string, interviewId: string, decision: 'APPROVED' | 'REJECTED') {
    const { application, interview } = await this.requireInterviewAndApplication(interviewId);
    await this.jobs.assertManagedBy(application.jobId, employerId);
    if (application.status !== ApplicationStatus.INTERVIEW_SCHEDULED || interview.result || interview.scheduledAt <= this.now()) {
      throw new M04WorkflowError('INVALID_STATE');
    }
    const request = await this.repository.getChangeRequest(interviewId);
    if (!request) throw new M04WorkflowError('NOT_FOUND');
    assertCanDecideReschedule(request.decision);
    if (decision === 'APPROVED' && request.proposedAt.getTime() <= this.now().getTime()) {
      throw new M04WorkflowError('INVALID_STATE');
    }
    return this.repository.decideChangeRequest({ interviewId, decision, decidedBy: employerId, at: this.now() });
  }

  async recordResult(employerId: string, interviewId: string, result: 'ACCEPTED' | 'REJECTED', reason?: string): Promise<InterviewRecord> {
    const { interview, application } = await this.requireInterviewAndApplication(interviewId);
    await this.jobs.assertManagedBy(application.jobId, employerId);
    assertCanRecordInterviewResult(application.status, interview.scheduledAt, this.now());
    if (interview.result) throw new M04WorkflowError('INVALID_STATE');
    if (result === 'REJECTED' && !reason?.trim()) throw new M04WorkflowError('INVALID_INPUT');
    nextApplicationStatus(application.status, result === 'ACCEPTED' ? 'ACCEPT_AFTER_INTERVIEW' : 'REJECT_AFTER_INTERVIEW', UserRole.EMPLOYER, reason?.trim());
    const job = await this.jobs.getApplicationContext(application.jobId);
    const recorded = await this.repository.recordInterviewResult(
      { interviewId, result, actorId: employerId, at: this.now(), reason: reason?.trim() },
      [
        this.event(NotificationEventType.INTERVIEW_RESULT_RECORDED, 'INTERVIEW', employerId, application.studentId,
          { jobId: application.jobId, jobTitle: job.title, result, reason: reason?.trim() }),
        this.statusEvent(application, job.title, employerId, application.studentId,
          result === 'ACCEPTED' ? ApplicationStatus.ACCEPTED : ApplicationStatus.REJECTED, reason?.trim()),
        ...(result === 'ACCEPTED' ? [{
          eventType: 'JOB_CLOSE_SUGGESTED' as const,
          entityType: 'APPLICATION' as const,
          actorId: employerId,
          recipientId: job.companyId,
          payload: { jobId: application.jobId, targetCount: job.targetCount },
        }] : []),
      ],
    );
    await this.dispatchEvents();
    return recorded;
  }

  private event(
    eventType: NotificationEventType,
    entityType: M04EventDraft['entityType'],
    actorId: string,
    recipientId: string,
    payload: Readonly<Record<string, unknown>>,
  ): M04EventDraft {
    return { eventType, entityType, actorId, recipientId, payload };
  }

  private statusEvent(
    application: ApplicationRecord,
    jobTitle: string,
    actorId: string,
    recipientId: string,
    status: ApplicationStatus,
    reason?: string,
  ): M04EventDraft {
    return this.event(NotificationEventType.APPLICATION_STATUS_CHANGED, 'APPLICATION', actorId, recipientId, {
      jobId: application.jobId, jobTitle, fromStatus: application.status, status, reason,
    });
  }

  private async dispatchEvents(): Promise<void> {
    try {
      await this.events.dispatchPending();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`M04 outbox delivery deferred: ${message}`);
    }
  }

  private async getMyInterview(studentId: string, interviewId: string) {
    const records = await this.requireInterviewAndApplication(interviewId);
    if (records.application.studentId !== studentId) throw new M04WorkflowError('NOT_FOUND');
    return records;
  }

  private async requireInterviewAndApplication(interviewId: string) {
    const interview = await this.repository.getInterview(interviewId);
    if (!interview) throw new M04WorkflowError('NOT_FOUND');
    const application = await this.requireApplication(interview.applicationId);
    return { interview, application };
  }

  private async requireApplication(id: string): Promise<ApplicationRecord> {
    const application = await this.repository.getApplication(id);
    if (!application) throw new M04WorkflowError('NOT_FOUND');
    return application;
  }
}
