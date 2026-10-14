import { Injectable } from '@nestjs/common';
import { Application, Interview, InterviewChangeRequest, Prisma } from '@prisma/client';
import { CvSnapshotDto } from '@campusjob/contracts';
import { PrismaService } from '../../../shared/database/prisma.service';
import { ApplicationStatus } from '../domain/application-state';
import { ApplicationRecord, ChangeRequestRecord, InterviewRecord, M04Repository, M04WorkflowError } from '../application/m04-ports';

@Injectable()
export class PrismaM04Repository implements M04Repository {
  constructor(private readonly prisma: PrismaService) {}

  async createApplication(input: {
    studentId: string; jobId: string; cvId: string; cvSnapshot: CvSnapshotDto; coverLetter: string | null;
  }): Promise<ApplicationRecord> {
    try {
      const row = await this.prisma.$transaction(async (tx) => {
        const application = await tx.application.create({ data: {
          studentId: input.studentId, jobId: input.jobId, cvId: input.cvId,
          cvSnapshot: input.cvSnapshot as unknown as Prisma.InputJsonValue,
          coverLetter: input.coverLetter,
        } });
        await tx.applicationStatusHistory.create({ data: {
          applicationId: application.id, actorId: input.studentId, toStatus: 'SUBMITTED',
        } });
        return application;
      });
      return this.application(row);
    } catch (error) {
      if (this.isUnique(error)) throw new M04WorkflowError('DUPLICATE_APPLICATION');
      throw error;
    }
  }

  async getApplication(id: string): Promise<ApplicationRecord | null> {
    const row = await this.prisma.application.findUnique({ where: { id } });
    return row ? this.application(row) : null;
  }

  async listStudentApplications(studentId: string): Promise<ApplicationRecord[]> {
    const rows = await this.prisma.application.findMany({ where: { studentId }, orderBy: { createdAt: 'desc' } });
    return rows.map((row) => this.application(row));
  }

  async listJobApplications(jobId: string): Promise<ApplicationRecord[]> {
    const rows = await this.prisma.application.findMany({ where: { jobId }, orderBy: { createdAt: 'asc' } });
    return rows.map((row) => this.application(row));
  }

  async changeApplicationStatus(input: {
    id: string; expected: ApplicationStatus; next: ApplicationStatus; actorId: string; reason?: string;
  }): Promise<ApplicationRecord> {
    return this.prisma.$transaction(async (tx) => {
      const changed = await tx.application.updateMany({
        where: { id: input.id, status: input.expected },
        data: { status: input.next, ...(input.reason ? { rejectionReason: input.reason } : {}) },
      });
      if (changed.count !== 1) throw new M04WorkflowError('CONCURRENT_CHANGE');
      await tx.applicationStatusHistory.create({ data: {
        applicationId: input.id, actorId: input.actorId, fromStatus: input.expected,
        toStatus: input.next, reason: input.reason,
      } });
      const row = await tx.application.findUniqueOrThrow({ where: { id: input.id } });
      return this.application(row);
    });
  }

  async createInterview(input: {
    applicationId: string; actorId: string; scheduledAt: Date; mode: 'ONSITE' | 'ONLINE';
    locationOrLink: string; message: string | null;
  }): Promise<InterviewRecord> {
    return this.prisma.$transaction(async (tx) => {
      const changed = await tx.application.updateMany({
        where: { id: input.applicationId, status: 'REVIEWING' },
        data: { status: 'INTERVIEW_SCHEDULED' },
      });
      if (changed.count !== 1) throw new M04WorkflowError('CONCURRENT_CHANGE');
      const interview = await tx.interview.create({ data: {
        applicationId: input.applicationId, scheduledAt: input.scheduledAt,
        mode: input.mode, locationOrLink: input.locationOrLink, message: input.message,
      } });
      await tx.applicationStatusHistory.create({ data: {
        applicationId: input.applicationId, actorId: input.actorId,
        fromStatus: 'REVIEWING', toStatus: 'INTERVIEW_SCHEDULED',
      } });
      return this.interview(interview);
    });
  }

  async getInterview(id: string): Promise<InterviewRecord | null> {
    const row = await this.prisma.interview.findUnique({ where: { id } });
    return row ? this.interview(row) : null;
  }

  async listStudentInterviews(studentId: string): Promise<InterviewRecord[]> {
    const rows = await this.prisma.interview.findMany({
      where: { application: { studentId } }, orderBy: { scheduledAt: 'asc' },
    });
    return rows.map((row) => this.interview(row));
  }

  async confirmInterview(id: string, at: Date): Promise<InterviewRecord> {
    const changed = await this.prisma.interview.updateMany({
      where: { id, confirmedAt: null, result: null, scheduledAt: { gt: at } },
      data: { confirmedAt: at },
    });
    if (changed.count !== 1) throw new M04WorkflowError('CONCURRENT_CHANGE');
    return this.interview(await this.prisma.interview.findUniqueOrThrow({ where: { id } }));
  }

  async getChangeRequest(interviewId: string): Promise<ChangeRequestRecord | null> {
    const row = await this.prisma.interviewChangeRequest.findUnique({ where: { interviewId } });
    return row ? this.changeRequest(row) : null;
  }

  async createChangeRequest(input: {
    interviewId: string; proposedAt: Date; message: string | null;
  }): Promise<ChangeRequestRecord> {
    try {
      const row = await this.prisma.interviewChangeRequest.create({ data: input });
      return this.changeRequest(row);
    } catch (error) {
      if (this.isUnique(error)) throw new M04WorkflowError('CONCURRENT_CHANGE');
      throw error;
    }
  }

  async decideChangeRequest(input: {
    interviewId: string; decision: 'APPROVED' | 'REJECTED'; decidedBy: string; at: Date;
  }): Promise<ChangeRequestRecord> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.interviewChangeRequest.findUnique({ where: { interviewId: input.interviewId } });
      if (!current || current.decision !== 'PENDING') throw new M04WorkflowError('CONCURRENT_CHANGE');
      if (input.decision === 'APPROVED' && current.proposedAt.getTime() <= input.at.getTime()) {
        throw new M04WorkflowError('INVALID_STATE');
      }
      const changed = await tx.interviewChangeRequest.updateMany({
        where: { id: current.id, decision: 'PENDING' },
        data: { decision: input.decision, decidedBy: input.decidedBy, decidedAt: input.at },
      });
      if (changed.count !== 1) throw new M04WorkflowError('CONCURRENT_CHANGE');
      if (input.decision === 'APPROVED') {
        await tx.interview.update({ where: { id: input.interviewId }, data: { scheduledAt: current.proposedAt } });
      }
      return this.changeRequest(await tx.interviewChangeRequest.findUniqueOrThrow({ where: { id: current.id } }));
    });
  }

  async recordInterviewResult(input: {
    interviewId: string; result: 'ACCEPTED' | 'REJECTED'; actorId: string; at: Date; reason?: string;
  }): Promise<InterviewRecord> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.interview.findUnique({ where: { id: input.interviewId } });
      if (!current || current.result || current.scheduledAt.getTime() > input.at.getTime()) {
        throw new M04WorkflowError('CONCURRENT_CHANGE');
      }
      const changed = await tx.application.updateMany({
        where: { id: current.applicationId, status: 'INTERVIEW_SCHEDULED' },
        data: { status: input.result, ...(input.reason ? { rejectionReason: input.reason } : {}) },
      });
      if (changed.count !== 1) throw new M04WorkflowError('CONCURRENT_CHANGE');
      const result = await tx.interview.updateMany({
        where: { id: input.interviewId, result: null }, data: { result: input.result, resultAt: input.at },
      });
      if (result.count !== 1) throw new M04WorkflowError('CONCURRENT_CHANGE');
      await tx.applicationStatusHistory.create({ data: {
        applicationId: current.applicationId, actorId: input.actorId,
        fromStatus: 'INTERVIEW_SCHEDULED', toStatus: input.result, reason: input.reason,
      } });
      return this.interview(await tx.interview.findUniqueOrThrow({ where: { id: input.interviewId } }));
    });
  }

  private isUnique(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }

  private application(row: Application): ApplicationRecord {
    return {
      id: row.id, studentId: row.studentId, jobId: row.jobId, cvId: row.cvId,
      cvSnapshot: row.cvSnapshot as unknown as CvSnapshotDto,
      coverLetter: row.coverLetter, status: row.status as ApplicationStatus,
      rejectionReason: row.rejectionReason, createdAt: row.createdAt,
    };
  }

  private interview(row: Interview): InterviewRecord {
    return {
      id: row.id, applicationId: row.applicationId, scheduledAt: row.scheduledAt,
      mode: row.mode, locationOrLink: row.locationOrLink, message: row.message,
      confirmedAt: row.confirmedAt, result: row.result,
    };
  }

  private changeRequest(row: InterviewChangeRequest): ChangeRequestRecord {
    return {
      id: row.id, interviewId: row.interviewId, proposedAt: row.proposedAt,
      message: row.message, decision: row.decision,
    };
  }
}
