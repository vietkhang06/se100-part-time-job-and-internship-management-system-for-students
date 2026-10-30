import { ICompanyRepository } from '../../domain/repositories/company.repository.interface';
import { CompanyEntity } from '../../domain/entities/company.entity';
import { CompanyVerificationStatus } from '@campusjob/contracts';

export class InMemoryCompanyRepository implements ICompanyRepository {
  public companies: Map<string, CompanyEntity> = new Map();

  async findById(id: string): Promise<CompanyEntity | null> {
    const found = this.companies.get(id);
    return found ? this.clone(found) : null;
  }

  async findByTaxId(taxId: string): Promise<CompanyEntity | null> {
    for (const c of this.companies.values()) {
      if (c.taxId === taxId) {
        return this.clone(c);
      }
    }
    return null;
  }

  async save(company: CompanyEntity): Promise<CompanyEntity> {
    this.companies.set(company.id, this.clone(company));
    return this.clone(company);
  }

  async create(data: {
    name: string;
    taxId: string;
    legalName?: string | null;
    representativeName?: string | null;
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
    const id = `company-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const entity = new CompanyEntity({
      id,
      name: data.name,
      taxId: data.taxId,
      legalName: data.legalName ?? null,
      representativeName: data.representativeName ?? null,
      website: data.website ?? null,
      industry: data.industry ?? null,
      companySize: data.companySize ?? null,
      description: data.description ?? null,
      logoUrl: data.logoUrl ?? null,
      email: data.email ?? null,
      phone: data.phone ?? null,
      address: data.address ?? null,
      verificationStatus: data.verificationStatus as CompanyVerificationStatus,
    });
    this.companies.set(id, entity);
    return this.clone(entity);
  }

  private clone(entity: CompanyEntity): CompanyEntity {
    return new CompanyEntity({
      id: entity.id,
      name: entity.name,
      legalName: entity.legalName,
      representativeName: entity.representativeName,
      taxId: entity.taxId,
      website: entity.website,
      industry: entity.industry,
      companySize: entity.companySize,
      description: entity.description,
      logoUrl: entity.logoUrl,
      email: entity.email,
      phone: entity.phone,
      address: entity.address,
      verificationStatus: entity.verificationStatus,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    });
  }
}
