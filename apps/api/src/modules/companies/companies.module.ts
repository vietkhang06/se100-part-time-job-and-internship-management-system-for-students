import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../shared/database/database.module';
import { CompaniesController } from './presentation/controllers/companies.controller';
import { GetCompanyProfileUseCase } from './application/use-cases/get-company-profile.use-case';
import { UpdateCompanyProfileUseCase } from './application/use-cases/update-company-profile.use-case';
import { CreateCompanyUseCase } from './application/use-cases/create-company.use-case';
import { VerifyCompanyUseCase } from './application/use-cases/verify-company.use-case';
import { COMPANY_REPOSITORY_TOKEN } from './domain/repositories/company.repository.interface';
import { COMPANY_MEMBER_REPOSITORY_TOKEN } from './domain/repositories/company-member.repository.interface';
import { PrismaCompanyRepository } from './infrastructure/persistence/prisma-company.repository';
import { PrismaCompanyMemberRepository } from './infrastructure/persistence/prisma-company-member.repository';

@Module({
  imports: [DatabaseModule],
  controllers: [CompaniesController],
  providers: [
    GetCompanyProfileUseCase,
    UpdateCompanyProfileUseCase,
    CreateCompanyUseCase,
    VerifyCompanyUseCase,
    {
      provide: COMPANY_REPOSITORY_TOKEN,
      useClass: PrismaCompanyRepository,
    },
    {
      provide: COMPANY_MEMBER_REPOSITORY_TOKEN,
      useClass: PrismaCompanyMemberRepository,
    },
  ],
  exports: [
    GetCompanyProfileUseCase,
    UpdateCompanyProfileUseCase,
    CreateCompanyUseCase,
    VerifyCompanyUseCase,
    COMPANY_REPOSITORY_TOKEN,
    COMPANY_MEMBER_REPOSITORY_TOKEN,
  ],
})
export class CompaniesModule {}
