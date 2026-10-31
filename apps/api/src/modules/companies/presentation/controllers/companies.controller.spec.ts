import { Test, TestingModule } from '@nestjs/testing';
import {
  CompanyVerificationStatus,
  CompanyMemberRole,
  CompanyMemberStatus,
  UserRole,
} from '@campusjob/contracts';
import { CompaniesController } from './companies.controller';
import { GetCompanyProfileUseCase } from '../../application/use-cases/get-company-profile.use-case';
import { UpdateCompanyProfileUseCase } from '../../application/use-cases/update-company-profile.use-case';
import { CreateCompanyUseCase } from '../../application/use-cases/create-company.use-case';
import { VerifyCompanyUseCase } from '../../application/use-cases/verify-company.use-case';
import { ResubmitCompanyVerificationUseCase } from '../../application/use-cases/resubmit-company-verification.use-case';
import { GetCompanyVerificationHistoryUseCase } from '../../application/use-cases/get-company-verification-history.use-case';
import { InMemoryCompanyRepository } from '../../infrastructure/persistence/in-memory-company.repository';
import { InMemoryCompanyMemberRepository } from '../../infrastructure/persistence/in-memory-company-member.repository';
import { InMemoryCompanyVerificationRepository } from '../../infrastructure/persistence/in-memory-company-verification.repository';
import { COMPANY_REPOSITORY_TOKEN } from '../../domain/repositories/company.repository.interface';
import { COMPANY_MEMBER_REPOSITORY_TOKEN } from '../../domain/repositories/company-member.repository.interface';
import { COMPANY_VERIFICATION_REPOSITORY_TOKEN } from '../../domain/repositories/company-verification.repository.interface';
import { FileAssetService } from '../../../../shared/storage/file-asset.service';

describe('CompaniesController', () => {
  let controller: CompaniesController;
  let companyRepo: InMemoryCompanyRepository;
  let memberRepo: InMemoryCompanyMemberRepository;
  let verificationRepo: InMemoryCompanyVerificationRepository;

  const employerUserId = 'user-emp-controller-1';
  const adminUserId = 'user-admin-1';
  let companyId: string;

  beforeEach(async () => {
    companyRepo = new InMemoryCompanyRepository();
    memberRepo = new InMemoryCompanyMemberRepository();
    verificationRepo = new InMemoryCompanyVerificationRepository();

    const mockFileAssetService = {
      verifyOwnership: jest.fn().mockResolvedValue({ id: 'file-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CompaniesController],
      providers: [
        GetCompanyProfileUseCase,
        UpdateCompanyProfileUseCase,
        CreateCompanyUseCase,
        VerifyCompanyUseCase,
        ResubmitCompanyVerificationUseCase,
        GetCompanyVerificationHistoryUseCase,
        {
          provide: COMPANY_REPOSITORY_TOKEN,
          useValue: companyRepo,
        },
        {
          provide: COMPANY_MEMBER_REPOSITORY_TOKEN,
          useValue: memberRepo,
        },
        {
          provide: COMPANY_VERIFICATION_REPOSITORY_TOKEN,
          useValue: verificationRepo,
        },
        {
          provide: FileAssetService,
          useValue: mockFileAssetService,
        },
      ],
    }).compile();

    controller = module.get<CompaniesController>(CompaniesController);

    // Seed company & verification record with documents
    const company = await companyRepo.create({
      name: 'Controller Test Corp',
      taxId: '0123456789',
      representativeName: 'Nguyen Van Controller',
      verificationStatus: CompanyVerificationStatus.PENDING_REVIEW,
    });
    companyId = company.id;

    await verificationRepo.createVerification({
      companyId,
      status: CompanyVerificationStatus.PENDING_REVIEW,
      documents: [{ fileAssetId: 'license-asset-1' }],
    });

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
    expect(res.company.representativeName).toBe('Nguyen Van Controller');
  });

  it('should update profile for employer', async () => {
    const res = await controller.updateProfile(employerUserId, {
      name: 'Updated Controller Corp',
      representativeName: 'Nguyen Van Updated',
    });
    expect(res.company.name).toBe('Updated Controller Corp');
    expect(res.company.representativeName).toBe('Nguyen Van Updated');
  });

  it('should get company by ID without exposing private document details', async () => {
    const res = await controller.getById(companyId);
    expect(res.company.id).toBe(companyId);
    expect('storageKey' in res.company).toBe(false);
    expect('fileBuffer' in res.company).toBe(false);
  });

  it('should allow Admin to decide verification status', async () => {
    const res = await controller.updateVerificationStatus(
      adminUserId,
      companyId,
      {
        status: CompanyVerificationStatus.VERIFIED,
      },
    );
    expect(res.company.verificationStatus).toBe(
      CompanyVerificationStatus.VERIFIED,
    );
  });

  it('should resubmit verification and retrieve verification history', async () => {
    // 1. Resubmit
    const resubmitRes = await controller.resubmitVerification(employerUserId, {
      documents: [{ fileAssetId: 'license-asset-2' }],
    });
    expect(resubmitRes.company.verificationStatus).toBe(
      CompanyVerificationStatus.PENDING_REVIEW,
    );

    // 2. Get history as Employer
    const historyRes = await controller.getVerificationHistory(
      employerUserId,
      UserRole.EMPLOYER,
    );
    expect(historyRes.data.length).toBeGreaterThanOrEqual(2);
  });
});
