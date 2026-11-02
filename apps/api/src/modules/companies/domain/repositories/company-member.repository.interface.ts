import { CompanyMemberRole, CompanyMemberStatus } from '@campusjob/contracts';
import { CompanyMemberEntity } from '../entities/company-member.entity';

export const COMPANY_MEMBER_REPOSITORY_TOKEN = Symbol(
  'COMPANY_MEMBER_REPOSITORY_TOKEN',
);

export interface CompanyMemberWithUser {
  member: CompanyMemberEntity;
  user: {
    email: string;
    fullName: string;
  };
}

export interface ICompanyMemberRepository {
  findByCompanyAndUser(
    companyId: string,
    userId: string,
  ): Promise<CompanyMemberEntity | null>;
  findActiveByUserId(userId: string): Promise<CompanyMemberEntity | null>;
  findAllByUserId(userId: string): Promise<CompanyMemberEntity[]>;
  findActiveMembersByCompanyId(
    companyId: string,
  ): Promise<CompanyMemberWithUser[]>;
  create(data: {
    companyId: string;
    userId: string;
    role?: CompanyMemberRole;
    status?: CompanyMemberStatus;
  }): Promise<CompanyMemberEntity>;
  save(member: CompanyMemberEntity): Promise<CompanyMemberEntity>;
}
