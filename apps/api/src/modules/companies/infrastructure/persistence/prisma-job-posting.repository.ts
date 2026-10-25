import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { JobStatus, JobType } from '@campusjob/contracts';
import { PrismaService } from '../../../../shared/database/prisma.service';
import { JobPostingEntity } from '../../domain/entities/job-posting.entity';
import {
  CreateJobPostingData,
  IJobPostingRepository,
  UpdateJobPostingData,
} from '../../domain/repositories/job-posting.repository.interface';
import { IJobBranchUsageChecker } from '../../domain/ports/job-branch-usage-checker.port';

@Injectable()
export class PrismaJobPostingRepository
  implements IJobPostingRepository, IJobBranchUsageChecker
{
  constructor(private readonly prisma: PrismaService) {}

  private toDomain(raw: any): JobPostingEntity {
    return new JobPostingEntity({
      id: raw.id,
      companyId: raw.companyId,
      branchId: raw.branchId,
      title: raw.title,
      description: raw.description,
      industry: raw.industry,
      type: raw.type as JobType,
      skills: raw.skills,
      quantity: raw.quantity,
      salary: raw.salary,
      salaryMin: raw.salaryMin ? Number(raw.salaryMin) : null,
      salaryMax: raw.salaryMax ? Number(raw.salaryMax) : null,
      isSalaryNegotiable: raw.isSalaryNegotiable,
      schedule: raw.schedule,
      benefits: raw.benefits,
      deadline: raw.deadline,
      status: raw.status as JobStatus,
      viewCount: raw.viewCount,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    });
  }

  async create(data: CreateJobPostingData): Promise<JobPostingEntity> {
    const row = await this.prisma.jobPosting.create({
      data: {
        companyId: data.companyId,
        branchId: data.branchId,
        title: data.title,
        description: data.description,
        industry: data.industry,
        type: data.type as any,
        skills: data.skills,
        quantity: data.quantity,
        salary: data.salary ?? null,
        salaryMin: data.salaryMin !== undefined && data.salaryMin !== null ? new Prisma.Decimal(data.salaryMin) : null,
        salaryMax: data.salaryMax !== undefined && data.salaryMax !== null ? new Prisma.Decimal(data.salaryMax) : null,
        isSalaryNegotiable: data.isSalaryNegotiable ?? false,
        schedule: data.schedule ?? null,
        benefits: data.benefits ?? null,
        deadline: data.deadline,
        status: (data.status ?? JobStatus.PENDING_APPROVAL) as any,
        viewCount: 0,
      },
    });
    return this.toDomain(row);
  }

  async findById(id: string): Promise<JobPostingEntity | null> {
    const row = await this.prisma.jobPosting.findUnique({
      where: { id },
    });
    return row ? this.toDomain(row) : null;
  }

  async findByCompanyId(
    companyId: string,
    options?: { status?: JobStatus; page?: number; limit?: number },
  ): Promise<{ jobs: JobPostingEntity[]; total: number }> {
    const where: any = { companyId };
    if (options?.status) {
      where.status = options.status;
    }

    const page = options?.page ?? 1;
    const limit = options?.limit ?? 20;
    const skip = (page - 1) * limit;

    const [rows, total] = await Promise.all([
      this.prisma.jobPosting.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.jobPosting.count({ where }),
    ]);

    return {
      jobs: rows.map((r) => this.toDomain(r)),
      total,
    };
  }

  async update(id: string, data: UpdateJobPostingData): Promise<JobPostingEntity> {
    const updateData: any = {};
    if (data.branchId !== undefined) updateData.branchId = data.branchId;
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.industry !== undefined) updateData.industry = data.industry;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.skills !== undefined) updateData.skills = data.skills;
    if (data.quantity !== undefined) updateData.quantity = data.quantity;
    if (data.salary !== undefined) updateData.salary = data.salary;
    if (data.salaryMin !== undefined) {
      updateData.salaryMin = data.salaryMin !== null ? new Prisma.Decimal(data.salaryMin) : null;
    }
    if (data.salaryMax !== undefined) {
      updateData.salaryMax = data.salaryMax !== null ? new Prisma.Decimal(data.salaryMax) : null;
    }
    if (data.isSalaryNegotiable !== undefined) updateData.isSalaryNegotiable = data.isSalaryNegotiable;
    if (data.schedule !== undefined) updateData.schedule = data.schedule;
    if (data.benefits !== undefined) updateData.benefits = data.benefits;
    if (data.deadline !== undefined) updateData.deadline = data.deadline;
    if (data.status !== undefined) updateData.status = data.status;

    const row = await this.prisma.jobPosting.update({
      where: { id },
      data: updateData,
    });
    return this.toDomain(row);
  }

  async countByBranchId(branchId: string): Promise<number> {
    return this.prisma.jobPosting.count({
      where: { branchId },
    });
  }

  // IJobBranchUsageChecker implementation
  async isBranchInUse(branchId: string): Promise<boolean> {
    const count = await this.countByBranchId(branchId);
    return count > 0;
  }

  async assertBranchBelongsToCompany(branchId: string, companyId: string): Promise<void> {
    const count = await this.prisma.companyBranch.count({
      where: { id: branchId, companyId },
    });
    if (count === 0) {
      throw new Error(`Chi nhánh ${branchId} không thuộc doanh nghiệp ${companyId}`);
    }
  }
}
