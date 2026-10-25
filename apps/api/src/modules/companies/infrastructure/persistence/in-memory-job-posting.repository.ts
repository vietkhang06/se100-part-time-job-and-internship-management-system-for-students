import { Injectable } from '@nestjs/common';
import { JobStatus } from '@campusjob/contracts';
import { JobPostingEntity } from '../../domain/entities/job-posting.entity';
import {
  CreateJobPostingData,
  IJobPostingRepository,
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

    // Sort descending by createdAt
    matched.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const total = matched.length;
    const page = options?.page ?? 1;
    const limit = options?.limit ?? 20;
    const start = (page - 1) * limit;
    const paged = matched.slice(start, start + limit).map((j) => new JobPostingEntity(j));

    return { jobs: paged, total };
  }

  async update(id: string, data: UpdateJobPostingData): Promise<JobPostingEntity> {
    const existing = this.jobs.get(id);
    if (!existing) {
      throw new Error(`Job ${id} not found`);
    }

    const updated = new JobPostingEntity({
      ...existing,
      branchId: data.branchId !== undefined ? data.branchId : existing.branchId,
      title: data.title !== undefined ? data.title : existing.title,
      description: data.description !== undefined ? data.description : existing.description,
      industry: data.industry !== undefined ? data.industry : existing.industry,
      type: data.type !== undefined ? data.type : existing.type,
      skills: data.skills !== undefined ? data.skills : existing.skills,
      quantity: data.quantity !== undefined ? data.quantity : existing.quantity,
      salary: data.salary !== undefined ? data.salary : existing.salary,
      salaryMin: data.salaryMin !== undefined ? data.salaryMin : existing.salaryMin,
      salaryMax: data.salaryMax !== undefined ? data.salaryMax : existing.salaryMax,
      isSalaryNegotiable:
        data.isSalaryNegotiable !== undefined
          ? data.isSalaryNegotiable
          : existing.isSalaryNegotiable,
      schedule: data.schedule !== undefined ? data.schedule : existing.schedule,
      benefits: data.benefits !== undefined ? data.benefits : existing.benefits,
      deadline: data.deadline !== undefined ? data.deadline : existing.deadline,
      status: data.status !== undefined ? data.status : existing.status,
      updatedAt: new Date(),
    });

    this.jobs.set(id, updated);
    return new JobPostingEntity(updated);
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

  // Test helpers
  clear(): void {
    this.jobs.clear();
    this.idCounter = 1;
  }

  seed(entity: JobPostingEntity): void {
    this.jobs.set(entity.id, entity);
  }
}
