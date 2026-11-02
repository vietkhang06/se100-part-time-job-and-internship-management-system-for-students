import { CompanyEntity } from '../entities/company.entity';
import { CompanyBranchEntity } from '../entities/company-branch.entity';
import { JobPostingEntity } from '../entities/job-posting.entity';

export const COMPANY_REPOSITORY_TOKEN = Symbol('COMPANY_REPOSITORY_TOKEN');

export interface SearchPublicCompaniesOptions {
  keyword?: string;
  industry?: string;
  city?: string;
  page?: number;
  limit?: number;
}

export interface PublicCompanyWithDetails {
  company: CompanyEntity;
  branches: CompanyBranchEntity[];
  activeJobs: JobPostingEntity[];
}

export interface ICompanyRepository {
  findById(id: string): Promise<CompanyEntity | null>;
  findByTaxId(taxId: string): Promise<CompanyEntity | null>;
  save(company: CompanyEntity): Promise<CompanyEntity>;
  create(company: Partial<CompanyEntity> & {
    name: string;
    taxId: string;
    representativeName?: string | null;
    verificationStatus: string;
  }): Promise<CompanyEntity>;
  searchPublic(
    options: SearchPublicCompaniesOptions,
  ): Promise<{ companies: CompanyEntity[]; total: number }>;
  findPublicById(id: string): Promise<PublicCompanyWithDetails | null>;
}
