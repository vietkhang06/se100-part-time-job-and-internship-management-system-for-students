import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import {
  CompanyVerificationStatus,
  JobStatus,
  JobType,
} from '@campusjob/contracts';
import { PrismaService } from '../../../../shared/database/prisma.service';
import { SavedJobEntity } from '../../domain/entities/saved-job.entity';
import { JobPostingEntity } from '../../domain/entities/job-posting.entity';
import {
  ISavedJobRepository,
  SavedJobWithDetails,
} from '../../domain/repositories/saved-job.repository.interface';

@Injectable()
export class PrismaSavedJobRepository implements ISavedJobRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(studentId: string, jobId: string): Promise<SavedJobEntity> {
    const existing = await this.prisma.savedJob.findUnique({
      where: {
        studentId_jobId: { studentId, jobId },
      },
    });

    if (existing) {
      return new SavedJobEntity({
        id: existing.id,
        studentId: existing.studentId,
        jobId: existing.jobId,
        createdAt: existing.createdAt,
      });
    }

    try {
      const created = await this.prisma.savedJob.create({
        data: {
          studentId,
          jobId,
        },
      });

      return new SavedJobEntity({
        id: created.id,
        studentId: created.studentId,
        jobId: created.jobId,
        createdAt: created.createdAt,
      });
    } catch (err: any) {
      // Concurrency protection: if created concurrently, return existing
      if (err?.code === 'P2002') {
        const row = await this.prisma.savedJob.findUnique({
          where: { studentId_jobId: { studentId, jobId } },
        });
        if (row) {
          return new SavedJobEntity({
            id: row.id,
            studentId: row.studentId,
            jobId: row.jobId,
            createdAt: row.createdAt,
          });
        }
      }
      throw err;
    }
  }

  async unsave(studentId: string, jobId: string): Promise<boolean> {
    try {
      await this.prisma.savedJob.delete({
        where: {
          studentId_jobId: { studentId, jobId },
        },
      });
      return true;
    } catch (err: any) {
      if (err?.code === 'P2025') {
        // Record to delete does not exist -> idempotent success
        return false;
      }
      throw err;
    }
  }

  async findByStudentId(
    studentId: string,
    options?: { page?: number; limit?: number },
  ): Promise<{ items: SavedJobWithDetails[]; total: number }> {
    const page = Math.max(1, options?.page ?? 1);
    const limit = Math.min(Math.max(1, options?.limit ?? 10), 50);
    const skip = (page - 1) * limit;

    const where = { studentId };

    const [rows, total] = await Promise.all([
      this.prisma.savedJob.findMany({
        where,
        include: {
          job: {
            include: {
              company: true,
              branch: true,
            },
          },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.savedJob.count({ where }),
    ]);

    const now = new Date();

    const items: SavedJobWithDetails[] = rows.map((r) => {
      const j = r.job;
      const isAvailable =
        j.status === (JobStatus.OPEN as any) &&
        j.deadline.getTime() > now.getTime() &&
        !j.hiddenByModeration &&
        j.company?.verificationStatus ===
          (CompanyVerificationStatus.VERIFIED as any);

      const jobEntity = new JobPostingEntity({
        id: j.id,
        companyId: j.companyId,
        branchId: j.branchId,
        title: j.title,
        description: j.description,
        industry: j.industry,
        type: j.type as JobType,
        skills: j.skills,
        quantity: j.quantity,
        salary: j.salary,
        salaryMin: j.salaryMin ? Number(j.salaryMin) : null,
        salaryMax: j.salaryMax ? Number(j.salaryMax) : null,
        isSalaryNegotiable: j.isSalaryNegotiable,
        schedule: j.schedule,
        benefits: j.benefits,
        deadline: j.deadline,
        status: j.status as JobStatus,
        viewCount: j.viewCount,
        rejectionReason: null, // sanitize
        rejectedAt: null, // sanitize
        hiddenByModeration: false, // sanitize
        createdAt: j.createdAt,
        updatedAt: j.updatedAt,
      });

      const savedEntity = new SavedJobEntity({
        id: r.id,
        studentId: r.studentId,
        jobId: r.jobId,
        createdAt: r.createdAt,
        job: jobEntity,
      });

      return {
        savedJob: savedEntity,
        isAvailable,
        companyName: j.company?.name ?? 'Unknown Company',
        companyLogoUrl: j.company?.logoUrl ?? null,
        branchCity: j.branch?.city ?? '',
        branchName: j.branch?.branchName ?? '',
      };
    });

    return { items, total };
  }

  async findSavedJobIds(studentId: string): Promise<string[]> {
    const rows = await this.prisma.savedJob.findMany({
      where: { studentId },
      select: { jobId: true },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => r.jobId);
  }

  async isSaved(studentId: string, jobId: string): Promise<boolean> {
    const count = await this.prisma.savedJob.count({
      where: { studentId, jobId },
    });
    return count > 0;
  }

  async countByJobId(jobId: string): Promise<number> {
    return this.prisma.savedJob.count({
      where: { jobId },
    });
  }

  async countByJobIds(jobIds: string[]): Promise<Record<string, number>> {
    if (jobIds.length === 0) return {};

    const groups = await this.prisma.savedJob.groupBy({
      by: ['jobId'],
      where: {
        jobId: { in: jobIds },
      },
      _count: {
        id: true,
      },
    });

    const result: Record<string, number> = {};
    jobIds.forEach((id) => {
      result[id] = 0;
    });
    groups.forEach((g) => {
      result[g.jobId] = g._count.id;
    });

    return result;
  }
}
