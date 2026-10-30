import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  CompanyMemberRole,
  CompanyMemberStatus,
  CompanyVerificationStatus,
} from '@campusjob/contracts';
import { InMemoryCompanyRepository } from '../../infrastructure/persistence/in-memory-company.repository';
import { InMemoryCompanyMemberRepository } from '../../infrastructure/persistence/in-memory-company-member.repository';
import { InMemoryCompanyVerificationRepository } from '../../infrastructure/persistence/in-memory-company-verification.repository';
import { CompanyEntity } from '../../domain/entities/company.entity';
import { CreateCompanyUseCase } from './create-company.use-case';
import { GetCompanyProfileUseCase } from './get-company-profile.use-case';
import { UpdateCompanyProfileUseCase } from './update-company-profile.use-case';
import { FileAssetService } from '../../../../shared/storage/file-asset.service';
import { FileAssetStatus } from '@prisma/client';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../../../shared/database/prisma.service';
import { STORAGE_SERVICE_TOKEN } from '../../../../shared/storage/storage.interface';

describe('S4-M03-01: Company Profile CRUD & Authorization', () => {
  let companyRepo: InMemoryCompanyRepository;
  let memberRepo: InMemoryCompanyMemberRepository;
  let verificationRepo: InMemoryCompanyVerificationRepository;
  let fileAssetService: FileAssetService;
  let verifyOwnership: jest.SpiedFunction<FileAssetService['verifyOwnership']>;

  let createCompanyUseCase: CreateCompanyUseCase;
  let getProfileUseCase: GetCompanyProfileUseCase;
  let updateProfileUseCase: UpdateCompanyProfileUseCase;

  const ownerUserId = 'user-owner-1';
  const memberUserId = 'user-regular-member-1';
  const otherOwnerUserId = 'user-other-owner-2';
  const companyAId = 'company-a';
  const companyBId = 'company-b';

  beforeEach(async () => {
    companyRepo = new InMemoryCompanyRepository();
    memberRepo = new InMemoryCompanyMemberRepository();
    verificationRepo = new InMemoryCompanyVerificationRepository();

    const fileAssetModule = await Test.createTestingModule({
      providers: [FileAssetService, { provide: PrismaService, useValue: {} }, { provide: STORAGE_SERVICE_TOKEN, useValue: {} }],
    }).compile();
    fileAssetService = fileAssetModule.get(FileAssetService);
    verifyOwnership = jest.spyOn(fileAssetService, 'verifyOwnership').mockResolvedValue({
        id: 'file-asset-1',
        ownerUserId,
        originalName: 'license.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 2048,
        checksumSha256: 'dummy-sha256',
        storageKey: 'secure-key-1',
        status: FileAssetStatus.PERMANENT,
        uploadedAt: new Date(),
        updatedAt: new Date(),
      });

    createCompanyUseCase = new CreateCompanyUseCase(
      companyRepo,
      memberRepo,
      verificationRepo,
      fileAssetService,
    );
    getProfileUseCase = new GetCompanyProfileUseCase(companyRepo, memberRepo);
    updateProfileUseCase = new UpdateCompanyProfileUseCase(
      companyRepo,
      memberRepo,
      verificationRepo,
      fileAssetService,
    );

    // Seed Company A
    const createdA = new CompanyEntity({
      id: companyAId,
      name: 'Tech Corp A',
      legalName: 'Technology Corporation A JSC',
      representativeName: 'Nguyen Van A',
      taxId: '0101234567',
      address: '123 Le Loi, District 1, HCMC',
      phone: '02811112222',
      email: 'contact@techcorpa.vn',
      website: 'https://techcorpa.vn',
      industry: 'Information Technology',
      companySize: '50-100',
      description: 'Leading software development',
      verificationStatus: CompanyVerificationStatus.PENDING_REVIEW,
    });
    companyRepo.companies.set(companyAId, createdA);

    // Seed Member roles for Company A
    await memberRepo.create({
      companyId: companyAId,
      userId: ownerUserId,
      role: CompanyMemberRole.OWNER,
      status: CompanyMemberStatus.ACTIVE,
    });
    await memberRepo.create({
      companyId: companyAId,
      userId: memberUserId,
      role: CompanyMemberRole.MEMBER,
      status: CompanyMemberStatus.ACTIVE,
    });

    // Seed Company B with another owner
    const compB = new CompanyEntity({
      id: companyBId,
      name: 'Tech Corp B',
      taxId: '0209876543',
      verificationStatus: CompanyVerificationStatus.VERIFIED,
    });
    companyRepo.companies.set(companyBId, compB);

    await memberRepo.create({
      companyId: companyBId,
      userId: otherOwnerUserId,
      role: CompanyMemberRole.OWNER,
      status: CompanyMemberStatus.ACTIVE,
    });
  });

  describe('CreateCompanyUseCase', () => {
    it('should create company and assign OWNER role to the creator', async () => {
      const newUserId = 'user-new-employer';
      const result = await createCompanyUseCase.execute(newUserId, {
        name: 'Startup XYZ',
        taxId: '0305556667',
        legalName: 'Startup XYZ Co., Ltd',
        representativeName: 'Tran Van B',
        address: '456 Nguyen Trai, HCMC',
        phone: '02899998888',
        email: 'info@xyz.vn',
        website: 'https://xyz.vn',
        industry: 'Fintech',
        companySize: '10-50',
      });

      expect(result.company).toBeDefined();
      expect(result.company.name).toBe('Startup XYZ');
      expect(result.company.taxId).toBe('0305556667');
      expect(result.company.representativeName).toBe('Tran Van B');
      expect(result.company.verificationStatus).toBe(
        CompanyVerificationStatus.PENDING_REVIEW,
      );

      const membership = await memberRepo.findActiveByUserId(newUserId);
      expect(membership).toBeDefined();
      expect(membership?.role).toBe(CompanyMemberRole.OWNER);
      expect(membership?.companyId).toBe(result.company.id);
    });

    it('should reject company creation if user is already associated with an active company', async () => {
      await expect(
        createCompanyUseCase.execute(ownerUserId, {
          name: 'Another Company',
          taxId: '9999999999',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should enforce Tax ID uniqueness and reject duplicate Tax ID', async () => {
      const newUserId = 'user-duplicate-tax';
      await expect(
        createCompanyUseCase.execute(newUserId, {
          name: 'Duplicate Tax Co',
          taxId: '0101234567', // already exists on Company A
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should verify document ownership via FileAssetService and link documents', async () => {
      const newUserId = 'user-with-docs';
      const result = await createCompanyUseCase.execute(newUserId, {
        name: 'Licensed Co',
        taxId: '0408889999',
        documents: [{ fileAssetId: 'asset-doc-1' }],
      });

      expect(verifyOwnership).toHaveBeenCalledWith(
        'asset-doc-1',
        newUserId,
      );

      const verif = await verificationRepo.findLatestByCompanyId(
        result.company.id,
      );
      expect(verif).toBeDefined();
      expect(verif?.documents.length).toBe(1);
      expect(verif?.documents[0].fileAssetId).toBe('asset-doc-1');
    });

    it('should reject creation if attached FileAsset is not owned by the user', async () => {
      verifyOwnership.mockRejectedValueOnce(
        new ForbiddenException('Not owner of file'),
      );

      const newUserId = 'user-unauthorized-doc';
      await expect(
        createCompanyUseCase.execute(newUserId, {
          name: 'Stolen Doc Co',
          taxId: '0501112223',
          documents: [{ fileAssetId: 'stolen-file-asset' }],
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('GetCompanyProfileUseCase', () => {
    it('should return company profile for active member', async () => {
      const result = await getProfileUseCase.execute(ownerUserId);
      expect(result.company.id).toBe(companyAId);
      expect(result.company.name).toBe('Tech Corp A');
      expect(result.company.representativeName).toBe('Nguyen Van A');
    });

    it('should throw NotFoundException if employer has no company', async () => {
      await expect(
        getProfileUseCase.execute('user-without-company'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('UpdateCompanyProfileUseCase — Role Authorization & Tenant Isolation', () => {
    it('should allow OWNER to update permitted company fields', async () => {
      const result = await updateProfileUseCase.execute(
        ownerUserId,
        companyAId,
        {
          name: 'Tech Corp A (Updated)',
          representativeName: 'Nguyen Van A Prime',
          phone: '02899990000',
        },
      );

      expect(result.company.name).toBe('Tech Corp A (Updated)');
      expect(result.company.representativeName).toBe('Nguyen Van A Prime');
      expect(result.company.phone).toBe('02899990000');
    });

    it('should reject update if member does not have management permission (regular MEMBER)', async () => {
      await expect(
        updateProfileUseCase.execute(memberUserId, companyAId, {
          name: 'Hacked Name',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject attempt to edit another company data (Tenant Isolation)', async () => {
      // Owner of Company A attempts to update Company B
      await expect(
        updateProfileUseCase.execute(ownerUserId, companyBId, {
          name: 'Hijacked Company B',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should never expose legal document binaries or storage keys in company profile response', async () => {
      const result = await getProfileUseCase.execute(ownerUserId);
      expect('storageKey' in result.company).toBe(false);
      expect('fileBuffer' in result.company).toBe(false);
      expect('documents' in result.company).toBe(false);
    });
  });

  describe('Company Job Publication Invariant', () => {
    it('should not allow unverified or pending company to publish jobs', async () => {
      const companyA = await companyRepo.findById(companyAId);
      expect(companyA?.verificationStatus).toBe(
        CompanyVerificationStatus.PENDING_REVIEW,
      );
      expect(companyA?.canPublishJob()).toBe(false);
    });

    it('should allow verified company to publish jobs', async () => {
      const companyB = await companyRepo.findById(companyBId);
      expect(companyB?.verificationStatus).toBe(
        CompanyVerificationStatus.VERIFIED,
      );
      expect(companyB?.canPublishJob()).toBe(true);
    });
  });
});
