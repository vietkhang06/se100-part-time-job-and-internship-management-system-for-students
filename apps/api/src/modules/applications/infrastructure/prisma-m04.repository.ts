import { Injectable } from '@nestjs/common';
import { Application, Prisma } from '@prisma/client';
import { CvSnapshotDto } from '@campusjob/contracts';
import { PrismaService } from '../../../shared/database/prisma.service';
import { ApplicationStatus } from '../domain/application-state';
import { ApplicationRecord, M04Repository, M04WorkflowError } from '../application/m04-ports';

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

}
