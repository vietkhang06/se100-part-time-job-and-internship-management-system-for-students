import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import {
  CompanyVerificationStatus,
  CompanyMemberRole,
  CompanyMemberStatus,
} from '@campusjob/contracts';
import { InMemoryCompanyRepository } from '../../infrastructure/persistence/in-memory-company.repository';
import { InMemoryCompanyMemberRepository } from '../../infrastructure/persistence/in-memory-company-member.repository';
import { InMemoryCompanyVerificationRepository } from '../../infrastructure/persistence/in-memory-company-verification.repository';
import { VerifyCompanyUseCase } from './verify-company.use-case';
import { ResubmitCompanyVerificationUseCase } from './resubmit-company-verification.use-case';
import { FileAssetService } from '../../../../shared/storage/file-asset.service';

describe('S4-M03-02: Company Verification Workflow', () => {
  let companyRepo: InMemoryCompanyRepository;
  let memberRepo: InMemoryCompanyMemberRepository;
  let verificationRepo: InMemoryCompanyVerificationRepository;
  let fileAssetService: jest.Mocked<FileAssetService>;

  let verifyCompanyUseCase: VerifyCompanyUseCase;
  let resubmitUseCase: ResubmitCompanyVerificationUseCase;

  const adminUserId = 'user-admin-1';
  const ownerUserId = 'user-owner-1';
  const companyId = 'company-test-1';

  beforeEach(async () => {
    companyRepo = new InMemoryCompanyRepository();
    memberRepo = new InMemoryCompanyMemberRepository();
    verificationRepo = new InMemoryCompanyVerificationRepository();

    fileAssetService = {
      verifyOwnership: jest.fn().mockResolvedValue({
        id: 'file-asset-doc-1',
        ownerUserId,
        status: 'PERMANENT',
      } as any),
    } as any;

    verifyCompanyUseCase = new VerifyCompanyUseCase(
      companyRepo,
      verificationRepo,
    );
    resubmitUseCase = new ResubmitCompanyVerificationUseCase(
      companyRepo,
      memberRepo,
      verificationRepo,
      fileAssetService,
    );

    // Seed Company in PENDING_REVIEW status
    await companyRepo.create({
      name: 'Verify Corp',
      taxId: '0109998888',
      verificationStatus: CompanyVerificationStatus.PENDING_REVIEW,
    });
    const created = Array.from(companyRepo.companies.values())[0];
    (created as any)._id = companyId;
    companyRepo.companies.delete(created.id);
    companyRepo.companies.set(companyId, created);

    // Seed Owner membership
    await memberRepo.create({
      companyId,
      userId: ownerUserId,
      role: CompanyMemberRole.OWNER,
      status: CompanyMemberStatus.ACTIVE,
    });
  });

  describe('Admin Verification Decisions', () => {
    it('should reject approval if required legal documents are missing (hồ sơ thiếu giấy tờ không được duyệt)', async () => {
      // No documents attached to verification record
      await verificationRepo.createVerification({
        companyId,
        status: CompanyVerificationStatus.PENDING_REVIEW,
        documents: [],
      });

      await expect(
        verifyCompanyUseCase.execute(adminUserId, companyId, {
          status: CompanyVerificationStatus.VERIFIED,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should successfully approve company when required legal documents exist', async () => {
      // Create verification with valid legal document
      await verificationRepo.createVerification({
        companyId,
        status: CompanyVerificationStatus.PENDING_REVIEW,
        documents: [{ fileAssetId: 'license-doc-1' }],
      });

      const result = await verifyCompanyUseCase.execute(
        adminUserId,
        companyId,
        {
          status: CompanyVerificationStatus.VERIFIED,
        },
      );

      expect(result.company.verificationStatus).toBe(
        CompanyVerificationStatus.VERIFIED,
      );

      const latestVerif = await verificationRepo.findLatestByCompanyId(
        companyId,
      );
      expect(latestVerif?.status).toBe(CompanyVerificationStatus.VERIFIED);
      expect(latestVerif?.reviewerId).toBe(adminUserId);
      expect(latestVerif?.reviewedAt).toBeDefined();
    });

    it('should require a rejection reason when rejecting a company (từ chối bắt buộc lý do)', async () => {
      await verificationRepo.createVerification({
        companyId,
        status: CompanyVerificationStatus.PENDING_REVIEW,
        documents: [{ fileAssetId: 'doc-1' }],
      });

      // Attempt rejection without reason
      await expect(
        verifyCompanyUseCase.execute(adminUserId, companyId, {
          status: CompanyVerificationStatus.REJECTED,
          rejectionReason: '',
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        verifyCompanyUseCase.execute(adminUserId, companyId, {
          status: CompanyVerificationStatus.REJECTED,
          rejectionReason: undefined,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should successfully record rejection reason, actor, and timestamp when rejecting', async () => {
      await verificationRepo.createVerification({
        companyId,
        status: CompanyVerificationStatus.PENDING_REVIEW,
        documents: [{ fileAssetId: 'doc-1' }],
      });

      const reason = 'Giấy phép kinh doanh mờ, không thể đọc mã số thuế.';
      const result = await verifyCompanyUseCase.execute(
        adminUserId,
        companyId,
        {
          status: CompanyVerificationStatus.REJECTED,
          rejectionReason: reason,
        },
      );

      expect(result.company.verificationStatus).toBe(
        CompanyVerificationStatus.REJECTED,
      );

      const latestVerif = await verificationRepo.findLatestByCompanyId(
        companyId,
      );
      expect(latestVerif?.status).toBe(CompanyVerificationStatus.REJECTED);
      expect(latestVerif?.reviewerId).toBe(adminUserId);
      expect(latestVerif?.rejectionReason).toBe(reason);
      expect(latestVerif?.reviewedAt).toBeDefined();
    });
  });

  describe('Resubmission & Verification History (nộp lại không xóa lịch sử cũ)', () => {
    it('should create a new verification record on resubmission and preserve earlier history', async () => {
      // 1. Initial submission with document
      const firstVerif = await verificationRepo.createVerification({
        companyId,
        status: CompanyVerificationStatus.PENDING_REVIEW,
        documents: [{ fileAssetId: 'old-doc-1' }],
      });

      // 2. Admin rejects with reason
      await verifyCompanyUseCase.execute(adminUserId, companyId, {
        status: CompanyVerificationStatus.REJECTED,
        rejectionReason: 'Thiếu giấy tờ đại diện pháp lý.',
      });

      // 3. Employer fixes and resubmits with new document
      await resubmitUseCase.execute(ownerUserId, {
        documents: [{ fileAssetId: 'new-doc-2' }],
      });

      // 4. Verify history: Both old rejected record and new pending record must exist
      const allVerifications = await verificationRepo.findAllByCompanyId(
        companyId,
      );
      expect(allVerifications.length).toBe(2);

      const latest = allVerifications[0];
      const previous = allVerifications[1];

      // New record is PENDING_REVIEW with new document
      expect(latest.status).toBe(CompanyVerificationStatus.PENDING_REVIEW);
      expect(latest.reviewerId).toBeNull();
      expect(latest.reviewedAt).toBeNull();
      expect(latest.documents[0].fileAssetId).toBe('new-doc-2');

      // Previous record is preserved with its rejection reason and reviewer
      expect(previous.status).toBe(CompanyVerificationStatus.REJECTED);
      expect(previous.reviewerId).toBe(adminUserId);
      expect(previous.rejectionReason).toBe(
        'Thiếu giấy tờ đại diện pháp lý.',
      );
    });
  });
});
