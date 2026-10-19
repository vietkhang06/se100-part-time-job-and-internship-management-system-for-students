import {
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import {
  CompanyVerificationStatus,
  CompanyMemberRole,
  CompanyMemberStatus,
  CompanyErrorCode,
} from '@campusjob/contracts';
import { InMemoryCompanyRepository } from '../../infrastructure/persistence/in-memory-company.repository';
import { InMemoryCompanyMemberRepository } from '../../infrastructure/persistence/in-memory-company-member.repository';
import { GetCompanyProfileUseCase } from './get-company-profile.use-case';
import { UpdateCompanyProfileUseCase } from './update-company-profile.use-case';
import { CreateCompanyUseCase } from './create-company.use-case';

describe('S2-M03-01: Company Profile & Verification Use Cases', () => {
  let companyRepo: InMemoryCompanyRepository;
  let memberRepo: InMemoryCompanyMemberRepository;
  let getProfileUseCase: GetCompanyProfileUseCase;
  let updateProfileUseCase: UpdateCompanyProfileUseCase;
  let createCompanyUseCase: CreateCompanyUseCase;

  const ownerUserId = 'user-owner-1';
  const adminUserId = 'user-admin-1';
  const recruiterUserId = 'user-recruiter-1';
  const outsiderUserId = 'user-outsider-99';

  let testCompanyId: string;

  beforeEach(async () => {
    companyRepo = new InMemoryCompanyRepository();
    memberRepo = new InMemoryCompanyMemberRepository();

    getProfileUseCase = new GetCompanyProfileUseCase(companyRepo, memberRepo);
    updateProfileUseCase = new UpdateCompanyProfileUseCase(
      companyRepo,
      memberRepo,
    );
    createCompanyUseCase = new CreateCompanyUseCase(companyRepo, memberRepo);

    // Seed test company
    const created = await companyRepo.create({
      name: 'CampusJob Inc',
      legalName: 'CÔNG TY TNHH CAMPUSJOB',
      taxId: '0312345678',
      website: 'https://campusjob.vn',
      industry: 'Công nghệ',
      companySize: '100-500',
      description: 'Nền tảng việc làm sinh viên',
      verificationStatus: CompanyVerificationStatus.PENDING_REVIEW,
    });
    testCompanyId = created.id;

    // Seed members
    await memberRepo.create({
      companyId: testCompanyId,
      userId: ownerUserId,
      role: CompanyMemberRole.OWNER,
      status: CompanyMemberStatus.ACTIVE,
    });

    await memberRepo.create({
      companyId: testCompanyId,
      userId: adminUserId,
      role: CompanyMemberRole.ADMIN,
      status: CompanyMemberStatus.ACTIVE,
    });

    await memberRepo.create({
      companyId: testCompanyId,
      userId: recruiterUserId,
      role: CompanyMemberRole.RECRUITER,
      status: CompanyMemberStatus.ACTIVE,
    });
  });

  describe('GetCompanyProfileUseCase', () => {
    it('should successfully return company profile for authorized owner', async () => {
      const result = await getProfileUseCase.execute(ownerUserId);

      expect(result.company).toBeDefined();
      expect(result.company.id).toBe(testCompanyId);
      expect(result.company.name).toBe('CampusJob Inc');
      expect(result.company.taxId).toBe('0312345678');
      expect(result.company.verificationStatus).toBe(
        CompanyVerificationStatus.PENDING_REVIEW,
      );
    });

    it('should throw NotFoundException if user has no company', async () => {
      await expect(getProfileUseCase.execute(outsiderUserId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if user attempts cross-company access with different companyId', async () => {
      const otherCompany = await companyRepo.create({
        name: 'Alien Corp',
        taxId: '0999999999',
        verificationStatus: CompanyVerificationStatus.VERIFIED,
      });

      await expect(
        getProfileUseCase.execute(ownerUserId, otherCompany.id),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('UpdateCompanyProfileUseCase — Authorization & Tenant Protection', () => {
    it('should allow owner to update company profile', async () => {
      const result = await updateProfileUseCase.execute(ownerUserId, undefined, {
        name: 'CampusJob Global Inc',
        website: 'https://global.campusjob.vn',
      });

      expect(result.company.name).toBe('CampusJob Global Inc');
      expect(result.company.website).toBe('https://global.campusjob.vn');
      expect(result.company.legalName).toBe('CÔNG TY TNHH CAMPUSJOB');
    });

    it('should allow admin role in company to update company profile', async () => {
      const result = await updateProfileUseCase.execute(adminUserId, undefined, {
        description: 'Updated by Company Admin',
      });

      expect(result.company.description).toBe('Updated by Company Admin');
    });

    it('should reject non-management members (e.g. RECRUITER) with 403 Forbidden', async () => {
      await expect(
        updateProfileUseCase.execute(recruiterUserId, undefined, {
          name: 'Hacked Name',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject cross-company update attempts (supplying different companyId) with 403 Forbidden', async () => {
      const otherCompany = await companyRepo.create({
        name: 'Target Company',
        taxId: '0888888888',
        verificationStatus: CompanyVerificationStatus.VERIFIED,
      });

      await expect(
        updateProfileUseCase.execute(ownerUserId, otherCompany.id, {
          name: 'Malicious Hijack',
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('UpdateCompanyProfileUseCase — Verification Rules & Immutability', () => {
    it('should never change verification status during a normal profile update', async () => {
      // 1. Initial state is PENDING_REVIEW
      const before = await companyRepo.findById(testCompanyId);
      expect(before?.verificationStatus).toBe(
        CompanyVerificationStatus.PENDING_REVIEW,
      );

      // 2. Perform normal update
      const updated = await updateProfileUseCase.execute(ownerUserId, undefined, {
        name: 'CampusJob Renamed',
      });

      // 3. Status must remain PENDING_REVIEW
      expect(updated.company.verificationStatus).toBe(
        CompanyVerificationStatus.PENDING_REVIEW,
      );
    });

    it('should ensure REJECTED company remains REJECTED after ordinary profile edits', async () => {
      // Set company status to REJECTED
      const company = await companyRepo.findById(testCompanyId);
      company!.setVerificationStatus(CompanyVerificationStatus.REJECTED);
      await companyRepo.save(company!);

      // Perform ordinary profile update
      const result = await updateProfileUseCase.execute(ownerUserId, undefined, {
        description: 'Amended description after rejection',
      });

      // Must remain REJECTED
      expect(result.company.verificationStatus).toBe(
        CompanyVerificationStatus.REJECTED,
      );
      expect(result.company.description).toBe(
        'Amended description after rejection',
      );
    });
  });

  describe('CreateCompanyUseCase', () => {
    it('should create company and assign OWNER role to the creator', async () => {
      const newUserId = 'user-new-employer-2';
      const result = await createCompanyUseCase.execute(newUserId, {
        name: 'New Startup Ltd',
        taxId: '0399887766',
        website: 'https://newstartup.com',
      });

      expect(result.company).toBeDefined();
      expect(result.company.name).toBe('New Startup Ltd');
      expect(result.company.verificationStatus).toBe(
        CompanyVerificationStatus.PENDING_REVIEW,
      );

      // Verify membership
      const membership = await memberRepo.findActiveByUserId(newUserId);
      expect(membership).toBeDefined();
      expect(membership?.role).toBe(CompanyMemberRole.OWNER);
      expect(membership?.companyId).toBe(result.company.id);
    });

    it('should reject creation if taxId is already registered', async () => {
      const newUserId = 'user-new-employer-3';
      await expect(
        createCompanyUseCase.execute(newUserId, {
          name: 'Duplicate Tax Corp',
          taxId: '0312345678', // Same as testCompanyId
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should reject creation if user already belongs to an active company', async () => {
      await expect(
        createCompanyUseCase.execute(ownerUserId, {
          name: 'Second Company Attempt',
          taxId: '0377777777',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });
});
