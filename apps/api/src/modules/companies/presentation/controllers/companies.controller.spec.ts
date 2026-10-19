import { Test, TestingModule } from '@nestjs/testing';
import {
  CompanyVerificationStatus,
  CompanyMemberRole,
  CompanyMemberStatus,
} from '@campusjob/contracts';
import { CompaniesController } from './companies.controller';
import { GetCompanyProfileUseCase } from '../../application/use-cases/get-company-profile.use-case';
import { UpdateCompanyProfileUseCase } from '../../application/use-cases/update-company-profile.use-case';
import { CreateCompanyUseCase } from '../../application/use-cases/create-company.use-case';
import { VerifyCompanyUseCase } from '../../application/use-cases/verify-company.use-case';
import { InMemoryCompanyRepository } from '../../infrastructure/persistence/in-memory-company.repository';
import { InMemoryCompanyMemberRepository } from '../../infrastructure/persistence/in-memory-company-member.repository';
import { COMPANY_REPOSITORY_TOKEN } from '../../domain/repositories/company.repository.interface';
import { COMPANY_MEMBER_REPOSITORY_TOKEN } from '../../domain/repositories/company-member.repository.interface';

describe('CompaniesController', () => {
  let controller: CompaniesController;
  let companyRepo: InMemoryCompanyRepository;
  let memberRepo: InMemoryCompanyMemberRepository;

  const employerUserId = 'user-emp-controller-1';
  let companyId: string;

  beforeEach(async () => {
    companyRepo = new InMemoryCompanyRepository();
    memberRepo = new InMemoryCompanyMemberRepository();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CompaniesController],
      providers: [
        GetCompanyProfileUseCase,
        UpdateCompanyProfileUseCase,
        CreateCompanyUseCase,
        VerifyCompanyUseCase,
        {
          provide: COMPANY_REPOSITORY_TOKEN,
          useValue: companyRepo,
        },
        {
          provide: COMPANY_MEMBER_REPOSITORY_TOKEN,
          useValue: memberRepo,
        },
      ],
    }).compile();

    controller = module.get<CompaniesController>(CompaniesController);

    // Seed
    const company = await companyRepo.create({
      name: 'Controller Test Corp',
      taxId: '0123456789',
      verificationStatus: CompanyVerificationStatus.PENDING_REVIEW,
    });
    companyId = company.id;

    await memberRepo.create({
      companyId,
      userId: employerUserId,
      role: CompanyMemberRole.OWNER,
      status: CompanyMemberStatus.ACTIVE,
    });
  });

  it('should get profile for employer', async () => {
    const res = await controller.getProfile(employerUserId);
    expect(res.company).toBeDefined();
    expect(res.company.name).toBe('Controller Test Corp');
  });

  it('should update profile for employer', async () => {
    const res = await controller.updateProfile(employerUserId, {
      name: 'Updated Controller Corp',
    });
    expect(res.company.name).toBe('Updated Controller Corp');
  });

  it('should get company by ID', async () => {
    const res = await controller.getById(companyId);
    expect(res.company.id).toBe(companyId);
  });

  it('should update verification status (mod/admin)', async () => {
    const res = await controller.updateVerificationStatus(
      'admin-1',
      companyId,
      {
        status: CompanyVerificationStatus.VERIFIED,
      },
    );
    expect(res.company.verificationStatus).toBe(
      CompanyVerificationStatus.VERIFIED,
    );
  });
});
