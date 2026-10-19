import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/database/prisma.service';
import { ICompanyBranchRepository } from '../../domain/repositories/company-branch.repository.interface';
import { CompanyBranchEntity } from '../../domain/entities/company-branch.entity';

@Injectable()
export class PrismaCompanyBranchRepository
  implements ICompanyBranchRepository
{
  constructor(private readonly prisma: PrismaService) {}

  private toDomain(raw: any): CompanyBranchEntity {
    return new CompanyBranchEntity({
      id: raw.id,
      companyId: raw.companyId,
      branchName: raw.branchName,
      addressLine: raw.addressLine,
      ward: raw.ward,
      district: raw.district,
      city: raw.city,
      country: raw.country,
      phone: raw.phone,
      email: raw.email,
      isHeadquarter: raw.isHeadquarter,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    });
  }

  async findById(id: string): Promise<CompanyBranchEntity | null> {
    const row = await this.prisma.companyBranch.findUnique({
      where: { id },
    });
    return row ? this.toDomain(row) : null;
  }

  async findByCompanyId(companyId: string): Promise<CompanyBranchEntity[]> {
    const rows = await this.prisma.companyBranch.findMany({
      where: { companyId },
      orderBy: [{ isHeadquarter: 'desc' }, { createdAt: 'asc' }],
    });
    return rows.map((r) => this.toDomain(r));
  }

  async create(data: {
    companyId: string;
    branchName: string;
    addressLine: string;
    ward?: string | null;
    district?: string | null;
    city: string;
    country?: string;
    phone?: string | null;
    email?: string | null;
    isHeadquarter?: boolean;
  }): Promise<CompanyBranchEntity> {
    const created = await this.prisma.companyBranch.create({
      data: {
        companyId: data.companyId,
        branchName: data.branchName,
        addressLine: data.addressLine,
        ward: data.ward ?? null,
        district: data.district ?? null,
        city: data.city,
        country: data.country ?? 'Vietnam',
        phone: data.phone ?? null,
        email: data.email ?? null,
        isHeadquarter: data.isHeadquarter ?? false,
      },
    });
    return this.toDomain(created);
  }

  async save(branch: CompanyBranchEntity): Promise<CompanyBranchEntity> {
    const updated = await this.prisma.companyBranch.update({
      where: { id: branch.id },
      data: {
        branchName: branch.branchName,
        addressLine: branch.addressLine,
        ward: branch.ward,
        district: branch.district,
        city: branch.city,
        country: branch.country,
        phone: branch.phone,
        email: branch.email,
        isHeadquarter: branch.isHeadquarter,
      },
    });
    return this.toDomain(updated);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.companyBranch.delete({
      where: { id },
    });
  }

  async isBranchInUse(branchId: string): Promise<boolean> {
    // Nếu có bảng jobPosting / job trong Prisma, kiểm tra trực tiếp
    if ('jobPosting' in this.prisma) {
      const count = await (this.prisma as any).jobPosting.count({
        where: { branchId },
      });
      return count > 0;
    }
    if ('job' in this.prisma) {
      const count = await (this.prisma as any).job.count({
        where: { branchId },
      });
      return count > 0;
    }
    return false;
  }

  async unsetHeadquarter(companyId: string): Promise<void> {
    await this.prisma.companyBranch.updateMany({
      where: { companyId, isHeadquarter: true },
      data: { isHeadquarter: false },
    });
  }
}
