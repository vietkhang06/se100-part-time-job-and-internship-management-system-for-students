import { CompanyEntity } from '../entities/company.entity';

export const COMPANY_REPOSITORY_TOKEN = Symbol('COMPANY_REPOSITORY_TOKEN');

export interface ICompanyRepository {
  findById(id: string): Promise<CompanyEntity | null>;
  findByTaxId(taxId: string): Promise<CompanyEntity | null>;
  save(company: CompanyEntity): Promise<CompanyEntity>;
  create(company: Partial<CompanyEntity> & { name: string; taxId: string; verificationStatus: string }): Promise<CompanyEntity>;
}
