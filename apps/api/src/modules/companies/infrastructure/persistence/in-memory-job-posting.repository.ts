import { Injectable } from '@nestjs/common';
import { JobStatus } from '@campusjob/contracts';
import { JobPostingEntity } from '../../domain/entities/job-posting.entity';
import {
  CreateJobPostingData,
  IJobPostingRepository,
  PublicJobWithDetails,
  SearchPublicJobsOptions,
  UpdateJobPostingData,
} from '../../domain/repositories/job-posting.repository.interface';
import { IJobBranchUsageChecker } from '../../domain/ports/job-branch-usage-checker.port';

@Injectable()
export class InMemoryJobPostingRepository
  implements IJobPostingRepository, IJobBranchUsageChecker
{
  private jobs: Map<string, JobPostingEntity> = new Map();
  private idCounter = 1;

  async create(data: CreateJobPostingData): Promise<JobPostingEntity> {
    const id = `job-${this.idCounter++}`;
    const entity = new JobPostingEntity({
      id,
      companyId: data.companyId,
      branchId: data.branchId,
      title: data.title,
      description: data.description,
      industry: data.industry,
      type: data.type,
      skills: data.skills,
      quantity: data.quantity,
      salary: data.salary,
      salaryMin: data.salaryMin,
      salaryMax: data.salaryMax,
      isSalaryNegotiable: data.isSalaryNegotiable,
      schedule: data.schedule,
      benefits: data.benefits,
      deadline: data.deadline,
      status: data.status ?? JobStatus.PENDING_APPROVAL,
      rejectionReason: data.rejectionReason ?? null,
      rejectedAt: data.rejectedAt ?? null,
      hiddenByModeration: data.hiddenByModeration ?? false,
      viewCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    this.jobs.set(id, entity);
    return entity;
  }

  async findById(id: string): Promise<JobPostingEntity | null> {
    const job = this.jobs.get(id);
    return job ? new JobPostingEntity(job) : null;
  }

  async findByCompanyId(
    companyId: string,
    options?: { status?: JobStatus; page?: number; limit?: number },
  ): Promise<{ jobs: JobPostingEntity[]; total: number }> {
    let matched = Array.from(this.jobs.values()).filter(
      (j) => j.companyId === companyId,
    );

    if (options?.status) {
      matched = matched.filter((j) => j.status === options.status);
    }

    matched.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const total = matched.length;
    const page = options?.page ?? 1;
    const limit = options?.limit ?? 20;
    const skip = (page - 1) * limit;
    const paged = matched.slice(skip, skip + limit);

    return {
      jobs: paged.map((j) => new JobPostingEntity(j)),
      total,
    };
  }

  async update(id: string, data: UpdateJobPostingData): Promise<JobPostingEntity> {
    const existing = this.jobs.get(id);
    if (!existing) {
      throw new Error(`JobPosting ${id} not found`);
    }

    const updated = new JobPostingEntity({
      id: existing.id,
      companyId: existing.companyId,
      branchId: data.branchId ?? existing.branchId,
      title: data.title ?? existing.title,
      description: data.description ?? existing.description,
      industry: data.industry ?? existing.industry,
      type: data.type ?? existing.type,
      skills: data.skills ?? existing.skills,
      quantity: data.quantity ?? existing.quantity,
      salary: data.salary !== undefined ? data.salary : existing.salary,
      salaryMin: data.salaryMin !== undefined ? data.salaryMin : existing.salaryMin,
      salaryMax: data.salaryMax !== undefined ? data.salaryMax : existing.salaryMax,
      isSalaryNegotiable: data.isSalaryNegotiable !== undefined ? data.isSalaryNegotiable : existing.isSalaryNegotiable,
      schedule: data.schedule !== undefined ? data.schedule : existing.schedule,
      benefits: data.benefits !== undefined ? data.benefits : existing.benefits,
      deadline: data.deadline ?? existing.deadline,
      status: data.status ?? existing.status,
      rejectionReason: data.rejectionReason !== undefined ? data.rejectionReason : existing.rejectionReason,
      rejectedAt: data.rejectedAt !== undefined ? data.rejectedAt : existing.rejectedAt,
      hiddenByModeration: data.hiddenByModeration !== undefined ? data.hiddenByModeration : existing.hiddenByModeration,
      viewCount: existing.viewCount,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    });

    this.jobs.set(id, updated);
    return updated;
  }

  async countByBranchId(branchId: string): Promise<number> {
    return Array.from(this.jobs.values()).filter((j) => j.branchId === branchId).length;
  }

  // IJobBranchUsageChecker implementation
  async isBranchInUse(branchId: string): Promise<boolean> {
    const count = await this.countByBranchId(branchId);
    return count > 0;
  }

  async assertBranchBelongsToCompany(branchId: string, companyId: string): Promise<void> {
    // Verified by repository / use case
  }

  async searchPublic(
    options: SearchPublicJobsOptions,
  ): Promise<{ jobs: PublicJobWithDetails[]; total: number }> {
    const now = new Date();
    let matched = Array.from(this.jobs.values()).filter((j) => {
      if (j.status !== JobStatus.OPEN) return false;
      if (j.deadline.getTime() <= now.getTime()) return false;
      if (j.hiddenByModeration) return false;
      if (options.keyword) {
        const kw = options.keyword.toLowerCase();
        const matchTitle = j.title.toLowerCase().includes(kw);
        const matchDesc = j.description.toLowerCase().includes(kw);
        if (!matchTitle && !matchDesc) return false;
      }
      if (options.industry && j.industry.toLowerCase() !== options.industry.toLowerCase()) {
        return false;
      }
      if (options.type && j.type !== options.type) {
        return false;
      }
      if (options.schedule) {
        if (!j.schedule || !j.schedule.toLowerCase().includes(options.schedule.toLowerCase())) {
          return false;
        }
      }
      if (options.salaryMin !== undefined) {
        if (!j.isSalaryNegotiable) {
          if (j.salaryMax !== null && j.salaryMax < options.salaryMin) return false;
          if (j.salaryMin !== null && j.salaryMin < options.salaryMin && j.salaryMax === null) return false;
        }
      }
      if (options.salaryMax !== undefined) {
        if (!j.isSalaryNegotiable) {
          if (j.salaryMin !== null && j.salaryMin > options.salaryMax) return false;
        }
      }
      return true;
    });

    matched.sort((a, b) => {
      const timeDiff = b.createdAt.getTime() - a.createdAt.getTime();
      if (timeDiff !== 0) return timeDiff;
      return b.id.localeCompare(a.id);
    });

    const total = matched.length;
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.min(Math.max(1, options.limit ?? 10), 50);
    const skip = (page - 1) * limit;
    const paged = matched.slice(skip, skip + limit);

    return {
      jobs: paged.map((j) => ({
        job: new JobPostingEntity(j),
        companyName: 'Test Company',
        companyLogoUrl: null,
        branchCity: 'Ho Chi Minh',
        branchName: 'Headquarter',
      })),
      total,
    };
  }

  async findPublicById(id: string): Promise<PublicJobWithDetails | null> {
    const job = this.jobs.get(id);
    if (!job) return null;

    const now = new Date();
    if (job.deadline.getTime() <= now.getTime()) {
      if (job.status !== JobStatus.CLOSED) {
        await this.update(job.id, { status: JobStatus.CLOSED });
      }
      return null;
    }

    if (job.status !== JobStatus.OPEN || job.hiddenByModeration) {
      return null;
    }

    return {
      job: new JobPostingEntity(job),
      companyName: 'Test Company',
      companyLogoUrl: null,
      branchCity: 'Ho Chi Minh',
      branchName: 'Headquarter',
    };
  }

  // Test helpers
  clear(): void {
    this.jobs.clear();
    this.idCounter = 1;
  }

  seed(entity: JobPostingEntity): void {
    this.jobs.set(entity.id, entity);
  }
}
