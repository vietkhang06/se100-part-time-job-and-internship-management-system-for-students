import { Injectable } from '@nestjs/common';
import { CompanyVerificationStatus, JobStatus } from '@campusjob/contracts';
import { PrismaService } from '../../../../shared/database/prisma.service';
import {
  ICompanyRepository,
  PublicCompanyWithDetails,
  SearchPublicCompaniesOptions,
} from '../../domain/repositories/company.repository.interface';
import { CompanyEntity } from '../../domain/entities/company.entity';
import { CompanyBranchEntity } from '../../domain/entities/company-branch.entity';
import { JobPostingEntity } from '../../domain/entities/job-posting.entity';

@Injectable()
export class PrismaCompanyRepository implements ICompanyRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toDomain(raw: any): CompanyEntity {
    return new CompanyEntity({
      id: raw.id,
      name: raw.name,
      legalName: raw.legalName,
      representativeName: raw.representativeName,
      taxId: raw.taxId,
      website: raw.website,
      industry: raw.industry,
      companySize: raw.companySize,
      description: raw.description,
      logoUrl: raw.logoUrl,
      email: raw.email,
      phone: raw.phone,
      address: raw.address,
      verificationStatus: raw.verificationStatus as CompanyVerificationStatus,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    });
  }

  async findById(id: string): Promise<CompanyEntity | null> {
    const row = await this.prisma.company.findUnique({
      where: { id },
    });
    return row ? this.toDomain(row) : null;
  }

  async findByTaxId(taxId: string): Promise<CompanyEntity | null> {
    const row = await this.prisma.company.findUnique({
      where: { taxId },
    });
    return row ? this.toDomain(row) : null;
  }

  async create(data: {
    name: string;
    legalName?: string | null;
    representativeName?: string | null;
    taxId: string;
    website?: string | null;
    industry?: string | null;
    companySize?: string | null;
    description?: string | null;
    logoUrl?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    verificationStatus: string;
  }): Promise<CompanyEntity> {
    const created = await this.prisma.company.create({
      data: {
        name: data.name,
        legalName: data.legalName ?? null,
        representativeName: data.representativeName ?? null,
        taxId: data.taxId,
        website: data.website ?? null,
        industry: data.industry ?? null,
        companySize: data.companySize ?? null,
        description: data.description ?? null,
        logoUrl: data.logoUrl ?? null,
        email: data.email ?? null,
        phone: data.phone ?? null,
        address: data.address ?? null,
        verificationStatus:
          data.verificationStatus as CompanyVerificationStatus,
      },
    });
    return this.toDomain(created);
  }

  async save(company: CompanyEntity): Promise<CompanyEntity> {
    const updated = await this.prisma.company.update({
      where: { id: company.id },
      data: {
        name: company.name,
        legalName: company.legalName,
        representativeName: company.representativeName,
        website: company.website,
        industry: company.industry,
        companySize: company.companySize,
        description: company.description,
        logoUrl: company.logoUrl,
        email: company.email,
        phone: company.phone,
        address: company.address,
        verificationStatus: company.verificationStatus,
      },
    });
    return this.toDomain(updated);
  }

  /**
   * S5-M03-04: Danh sách doanh nghiệp đã được phê duyệt công khai (UC15)
   */
  async searchPublic(
    options: SearchPublicCompaniesOptions,
  ): Promise<{ companies: CompanyEntity[]; total: number }> {
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.min(Math.max(1, options.limit ?? 10), 50);
    const skip = (page - 1) * limit;

    const where: any = {
      verificationStatus: CompanyVerificationStatus.VERIFIED,
    };

    if (options.keyword) {
      where.OR = [
        { name: { contains: options.keyword, mode: 'insensitive' } },
        { industry: { contains: options.keyword, mode: 'insensitive' } },
        { description: { contains: options.keyword, mode: 'insensitive' } },
      ];
    }

    if (options.industry) {
      where.industry = { equals: options.industry, mode: 'insensitive' };
    }

    if (options.city) {
      where.branches = {
        some: {
          city: { contains: options.city, mode: 'insensitive' },
        },
      };
    }

    const [rows, total] = await Promise.all([
      this.prisma.company.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.company.count({ where }),
    ]);

    return {
      companies: rows.map((r) => this.toDomain(r)),
      total,
    };
  }

  /**
   * S5-M03-04: Chi tiết doanh nghiệp công khai kèm chi nhánh và tin đang tuyển (UC16)
   */
  async findPublicById(id: string): Promise<PublicCompanyWithDetails | null> {
    const row = await this.prisma.company.findUnique({
      where: { id },
      include: {
        branches: true,
        jobPostings: {
          where: {
            status: JobStatus.OPEN as any,
            deadline: { gt: new Date() },
            hiddenByModeration: false,
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        },
      },
    });

    if (!row || row.verificationStatus !== CompanyVerificationStatus.VERIFIED) {
      return null;
    }

    return {
      company: this.toDomain(row),
      branches: row.branches.map(
        (b) =>
          new CompanyBranchEntity({
            id: b.id,
            companyId: b.companyId,
            branchName: b.branchName,
            addressLine: b.addressLine,
            ward: b.ward,
            district: b.district,
            city: b.city,
            country: b.country,
            phone: b.phone,
            email: b.email,
            latitude: b.latitude,
            longitude: b.longitude,
            isHeadquarter: b.isHeadquarter,
            createdAt: b.createdAt,
            updatedAt: b.updatedAt,
          }),
      ),
      activeJobs: row.jobPostings.map(
        (j) =>
          new JobPostingEntity({
            id: j.id,
            companyId: j.companyId,
            branchId: j.branchId,
            title: j.title,
            description: j.description,
            industry: j.industry,
            type: j.type as any,
            skills: j.skills,
            quantity: j.quantity,
            salary: j.salary,
            salaryMin: j.salaryMin ? Number(j.salaryMin) : null,
            salaryMax: j.salaryMax ? Number(j.salaryMax) : null,
            isSalaryNegotiable: j.isSalaryNegotiable,
            schedule: j.schedule,
            benefits: j.benefits,
            deadline: j.deadline,
            status: j.status as any,
            viewCount: j.viewCount,
            rejectionReason: j.rejectionReason,
            rejectedAt: j.rejectedAt,
            hiddenByModeration: j.hiddenByModeration,
            createdAt: j.createdAt,
            updatedAt: j.updatedAt,
          }),
      ),
    };
  }
}
