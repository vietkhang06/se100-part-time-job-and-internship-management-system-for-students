import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../shared/database/database.module';
import { StorageModule } from '../../shared/storage/storage.module';
import { CompaniesController } from './presentation/controllers/companies.controller';
import { CompanyBranchesController } from './presentation/controllers/company-branches.controller';
import { GetCompanyProfileUseCase } from './application/use-cases/get-company-profile.use-case';
import { UpdateCompanyProfileUseCase } from './application/use-cases/update-company-profile.use-case';
import { CreateCompanyUseCase } from './application/use-cases/create-company.use-case';
import { VerifyCompanyUseCase } from './application/use-cases/verify-company.use-case';
import { ResubmitCompanyVerificationUseCase } from './application/use-cases/resubmit-company-verification.use-case';
import { GetCompanyVerificationHistoryUseCase } from './application/use-cases/get-company-verification-history.use-case';
import { CreateBranchUseCase } from './application/use-cases/create-branch.use-case';
import { ListBranchesUseCase } from './application/use-cases/list-branches.use-case';
import { GetBranchDetailUseCase } from './application/use-cases/get-branch-detail.use-case';
import { UpdateBranchUseCase } from './application/use-cases/update-branch.use-case';
import { DeleteBranchUseCase } from './application/use-cases/delete-branch.use-case';
import { COMPANY_REPOSITORY_TOKEN } from './domain/repositories/company.repository.interface';
import { COMPANY_MEMBER_REPOSITORY_TOKEN } from './domain/repositories/company-member.repository.interface';
import { COMPANY_BRANCH_REPOSITORY_TOKEN } from './domain/repositories/company-branch.repository.interface';
import { COMPANY_VERIFICATION_REPOSITORY_TOKEN } from './domain/repositories/company-verification.repository.interface';
import { PrismaCompanyRepository } from './infrastructure/persistence/prisma-company.repository';
import { PrismaCompanyMemberRepository } from './infrastructure/persistence/prisma-company-member.repository';
import { PrismaCompanyBranchRepository } from './infrastructure/persistence/prisma-company-branch.repository';
import { PrismaCompanyVerificationRepository } from './infrastructure/persistence/prisma-company-verification.repository';

@Module({
  imports: [DatabaseModule, StorageModule],
  controllers: [CompaniesController, CompanyBranchesController],
  providers: [
    GetCompanyProfileUseCase,
    UpdateCompanyProfileUseCase,
    CreateCompanyUseCase,
    VerifyCompanyUseCase,
    ResubmitCompanyVerificationUseCase,
    GetCompanyVerificationHistoryUseCase,
    CreateBranchUseCase,
    ListBranchesUseCase,
    GetBranchDetailUseCase,
    UpdateBranchUseCase,
    DeleteBranchUseCase,
    {
      provide: COMPANY_REPOSITORY_TOKEN,
      useClass: PrismaCompanyRepository,
    },
    {
      provide: COMPANY_MEMBER_REPOSITORY_TOKEN,
      useClass: PrismaCompanyMemberRepository,
    },
    {
      provide: COMPANY_BRANCH_REPOSITORY_TOKEN,
      useClass: PrismaCompanyBranchRepository,
    },
    {
      provide: COMPANY_VERIFICATION_REPOSITORY_TOKEN,
      useClass: PrismaCompanyVerificationRepository,
    },
  ],
  exports: [
    GetCompanyProfileUseCase,
    UpdateCompanyProfileUseCase,
    CreateCompanyUseCase,
    VerifyCompanyUseCase,
    ResubmitCompanyVerificationUseCase,
    GetCompanyVerificationHistoryUseCase,
    CreateBranchUseCase,
    ListBranchesUseCase,
    GetBranchDetailUseCase,
    UpdateBranchUseCase,
    DeleteBranchUseCase,
    COMPANY_REPOSITORY_TOKEN,
    COMPANY_MEMBER_REPOSITORY_TOKEN,
    COMPANY_BRANCH_REPOSITORY_TOKEN,
    COMPANY_VERIFICATION_REPOSITORY_TOKEN,
  ],
})
export class CompaniesModule {}
