import { Injectable } from '@nestjs/common';
import { CompanyVerificationStatus } from '@campusjob/contracts';
import { PrismaService } from '../../../../shared/database/prisma.service';
import { ICompanyRepository } from '../../domain/repositories/company.repository.interface';
import { CompanyEntity } from '../../domain/entities/company.entity';

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
}
