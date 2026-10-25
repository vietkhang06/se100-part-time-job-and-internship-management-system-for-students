import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CompanyVerificationStatus, JobStatus, JobType } from '@campusjob/contracts';
import { PrismaService } from '../../../../shared/database/prisma.service';
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
      rejectionReason: raw.rejectionReason ?? null,
      rejectedAt: raw.rejectedAt ?? null,
      hiddenByModeration: raw.hiddenByModeration ?? false,
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
        rejectionReason: data.rejectionReason ?? null,
        rejectedAt: data.rejectedAt ?? null,
        hiddenByModeration: data.hiddenByModeration ?? false,
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
    if (data.rejectionReason !== undefined) updateData.rejectionReason = data.rejectionReason;
    if (data.rejectedAt !== undefined) updateData.rejectedAt = data.rejectedAt;
    if (data.hiddenByModeration !== undefined) updateData.hiddenByModeration = data.hiddenByModeration;

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

  /**
   * S5-M03-03: Tìm kiếm tin tuyển dụng công khai với Shared Visibility Predicate
   */
  async searchPublic(
    options: SearchPublicJobsOptions,
  ): Promise<{ jobs: PublicJobWithDetails[]; total: number }> {
    const now = new Date();
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.min(Math.max(1, options.limit ?? 10), 50);
    const skip = (page - 1) * limit;

    const where: Prisma.JobPostingWhereInput = {
      status: JobStatus.OPEN as any,
      deadline: { gt: now },
      hiddenByModeration: false,
      company: {
        verificationStatus: CompanyVerificationStatus.VERIFIED as any,
      },
    };

    if (options.keyword) {
      where.OR = [
        { title: { contains: options.keyword, mode: 'insensitive' } },
        { description: { contains: options.keyword, mode: 'insensitive' } },
      ];
    }

    if (options.industry) {
      where.industry = { equals: options.industry, mode: 'insensitive' };
    }

    if (options.type) {
      where.type = options.type as any;
    }

    if (options.city) {
      where.branch = {
        city: { contains: options.city, mode: 'insensitive' },
      };
    }

    if (options.schedule) {
      where.schedule = { contains: options.schedule, mode: 'insensitive' };
    }

    const andConditions: Prisma.JobPostingWhereInput[] = [];

    if (options.salaryMin !== undefined) {
      andConditions.push({
        OR: [
          { isSalaryNegotiable: true },
          { salaryMax: { gte: new Prisma.Decimal(options.salaryMin) } },
          { salaryMin: { gte: new Prisma.Decimal(options.salaryMin) } },
        ],
      });
    }

    if (options.salaryMax !== undefined) {
      andConditions.push({
        OR: [
          { isSalaryNegotiable: true },
          { salaryMin: { lte: new Prisma.Decimal(options.salaryMax) } },
        ],
      });
    }

    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    const [rows, total] = await Promise.all([
      this.prisma.jobPosting.findMany({
        where,
        include: {
          company: true,
          branch: true,
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.jobPosting.count({ where }),
    ]);

    return {
      jobs: rows.map((r) => ({
        job: this.toDomain(r),
        companyName: r.company?.name ?? 'Unknown Company',
        companyLogoUrl: r.company?.logoUrl ?? null,
        branchCity: r.branch?.city ?? '',
        branchName: r.branch?.branchName ?? '',
      })),
      total,
    };
  }

  /**
   * S5-M03-03: Chi tiết tin tuyển dụng công khai (404 nếu không đủ điều kiện công khai)
   */
  async findPublicById(id: string): Promise<PublicJobWithDetails | null> {
    const row = await this.prisma.jobPosting.findUnique({
      where: { id },
      include: {
        company: true,
        branch: true,
      },
    });

    if (!row) return null;

    const now = new Date();
    if (row.deadline.getTime() <= now.getTime()) {
      if (row.status !== JobStatus.CLOSED) {
        await this.prisma.jobPosting.update({
          where: { id },
          data: { status: JobStatus.CLOSED as any },
        });
      }
      return null;
    }

    if (
      row.status !== JobStatus.OPEN ||
      row.hiddenByModeration ||
      row.company?.verificationStatus !== CompanyVerificationStatus.VERIFIED
    ) {
      return null;
    }

    return {
      job: this.toDomain(row),
      companyName: row.company?.name ?? 'Unknown Company',
      companyLogoUrl: row.company?.logoUrl ?? null,
      branchCity: row.branch?.city ?? '',
      branchName: row.branch?.branchName ?? '',
    };
  }
}
