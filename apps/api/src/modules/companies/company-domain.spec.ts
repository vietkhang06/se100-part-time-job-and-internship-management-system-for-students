import {
  CompanyMemberRole,
  CompanyMemberStatus,
  CompanyVerificationStatus,
  DocumentType,
  CompanyDto,
  CompanyMemberDto,
  CompanyBranchDto,
  CompanyVerificationDto,
  CompanyVerificationDocumentDto,
} from '@campusjob/contracts';

describe('Company Domain & Verification Contracts (W2-DB-03 Schema Integrity)', () => {
  describe('Company Domain Enums', () => {
    it('should define all expected CompanyMemberRole values', () => {
      expect(CompanyMemberRole.OWNER).toBe('OWNER');
      expect(CompanyMemberRole.ADMIN).toBe('ADMIN');
      expect(CompanyMemberRole.HR_MANAGER).toBe('HR_MANAGER');
      expect(CompanyMemberRole.RECRUITER).toBe('RECRUITER');
      expect(CompanyMemberRole.MEMBER).toBe('MEMBER');
    });

    it('should define all expected CompanyMemberStatus values', () => {
      expect(CompanyMemberStatus.ACTIVE).toBe('ACTIVE');
      expect(CompanyMemberStatus.INVITED).toBe('INVITED');
      expect(CompanyMemberStatus.SUSPENDED).toBe('SUSPENDED');
    });

    it('should define all expected CompanyVerificationStatus values', () => {
      expect(CompanyVerificationStatus.UNVERIFIED).toBe('UNVERIFIED');
      expect(CompanyVerificationStatus.PENDING_REVIEW).toBe('PENDING_REVIEW');
      expect(CompanyVerificationStatus.VERIFIED).toBe('VERIFIED');
      expect(CompanyVerificationStatus.REJECTED).toBe('REJECTED');
    });

    it('should define all expected DocumentType values', () => {
      expect(DocumentType.BUSINESS_LICENSE).toBe('BUSINESS_LICENSE');
      expect(DocumentType.TAX_REGISTRATION).toBe('TAX_REGISTRATION');
      expect(DocumentType.OPERATION_PERMIT).toBe('OPERATION_PERMIT');
      expect(DocumentType.OTHER).toBe('OTHER');
    });
  });

  describe('Company Model & Membership Independence (Many-to-Many)', () => {
    it('should support multiple memberships for a single user without restricting them to 1:1 ownership', () => {
      const userId = 'user-employer-1';

      const membershipCompanyA: CompanyMemberDto = {
        id: 'mem-1',
        companyId: 'company-a',
        userId,
        role: CompanyMemberRole.OWNER,
        status: CompanyMemberStatus.ACTIVE,
        joinedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const membershipCompanyB: CompanyMemberDto = {
        id: 'mem-2',
        companyId: 'company-b',
        userId,
        role: CompanyMemberRole.HR_MANAGER,
        status: CompanyMemberStatus.ACTIVE,
        joinedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      expect(membershipCompanyA.userId).toBe(userId);
      expect(membershipCompanyB.userId).toBe(userId);
      expect(membershipCompanyA.companyId).not.toBe(membershipCompanyB.companyId);
    });

    it('should represent branches associated with parent company', () => {
      const branch: CompanyBranchDto = {
        id: 'branch-1',
        companyId: 'company-a',
        branchName: 'Chi nhánh Quận 1',
        addressLine: '123 Nguyễn Huệ',
        ward: 'Bến Nghé',
        district: 'Quận 1',
        city: 'Hồ Chí Minh',
        country: 'Vietnam',
        phone: '0281234567',
        email: 'hcm-branch@company.com',
        isHeadquarter: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      expect(branch.companyId).toBe('company-a');
      expect(branch.city).toBe('Hồ Chí Minh');
      expect(branch.isHeadquarter).toBe(true);
    });

    it('should represent company verification with document attachments linked to FileAsset', () => {
      const verificationDoc: CompanyVerificationDocumentDto = {
        id: 'doc-1',
        verificationId: 'verif-1',
        fileAssetId: 'file-asset-uuid-1',
        documentType: DocumentType.BUSINESS_LICENSE,
        createdAt: new Date().toISOString(),
        fileAsset: {
          id: 'file-asset-uuid-1',
          ownerUserId: 'user-employer-1',
          originalName: 'giay_phep_kinh_doanh.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 2048576,
          checksumSha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
          storageKey: '550e8400-e29b-41d4-a716-446655440000.pdf',
          status: 'PERMANENT' as any,
          uploadedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      };

      const verification: CompanyVerificationDto = {
        id: 'verif-1',
        companyId: 'company-a',
        reviewerId: 'moderator-uuid',
        status: CompanyVerificationStatus.VERIFIED,
        rejectionReason: null,
        submittedAt: new Date().toISOString(),
        reviewedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      expect(verification.companyId).toBe('company-a');
      expect(verification.status).toBe(CompanyVerificationStatus.VERIFIED);
      expect(verificationDoc.fileAssetId).toBe('file-asset-uuid-1');
      expect(verificationDoc.fileAsset?.storageKey).toBe('550e8400-e29b-41d4-a716-446655440000.pdf');
    });
  });
});
