import { CompanyBranchEntity } from '../entities/company-branch.entity';

export const COMPANY_BRANCH_REPOSITORY_TOKEN = Symbol(
  'COMPANY_BRANCH_REPOSITORY_TOKEN',
);

export interface ICompanyBranchRepository {
  findById(id: string): Promise<CompanyBranchEntity | null>;
  findByCompanyId(companyId: string): Promise<CompanyBranchEntity[]>;
  create(data: {
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
  }): Promise<CompanyBranchEntity>;
  save(branch: CompanyBranchEntity): Promise<CompanyBranchEntity>;
  delete(id: string): Promise<void>;
  isBranchInUse(branchId: string): Promise<boolean>;
  unsetHeadquarter(companyId: string): Promise<void>;
}
