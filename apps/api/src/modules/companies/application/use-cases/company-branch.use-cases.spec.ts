import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  CompanyMemberRole,
  CompanyMemberStatus,
  CompanyVerificationStatus,
  CompanyErrorCode,
} from '@campusjob/contracts';
import { InMemoryCompanyBranchRepository } from '../../infrastructure/persistence/in-memory-company-branch.repository';
import { InMemoryCompanyMemberRepository } from '../../infrastructure/persistence/in-memory-company-member.repository';
import { InMemoryCompanyRepository } from '../../infrastructure/persistence/in-memory-company.repository';
import { CreateBranchUseCase } from './create-branch.use-case';
import { ListBranchesUseCase } from './list-branches.use-case';
import { GetBranchDetailUseCase } from './get-branch-detail.use-case';
import { UpdateBranchUseCase } from './update-branch.use-case';
import { DeleteBranchUseCase } from './delete-branch.use-case';

describe('S2-M03-02: Company Branch Slice Use Cases', () => {
  let branchRepo: InMemoryCompanyBranchRepository;
  let memberRepo: InMemoryCompanyMemberRepository;
  let companyRepo: InMemoryCompanyRepository;

  let createBranchUseCase: CreateBranchUseCase;
  let listBranchesUseCase: ListBranchesUseCase;
  let getDetailUseCase: GetBranchDetailUseCase;
  let updateBranchUseCase: UpdateBranchUseCase;
  let deleteBranchUseCase: DeleteBranchUseCase;

  const ownerUserId = 'owner-emp-1';
  const adminUserId = 'admin-emp-1';
  const recruiterUserId = 'recruiter-emp-1';
  const alienEmployerUserId = 'alien-emp-99';

  let companyAId: string;
  let companyBId: string;
  let branchA1Id: string;

  beforeEach(async () => {
    branchRepo = new InMemoryCompanyBranchRepository();
    memberRepo = new InMemoryCompanyMemberRepository();
    companyRepo = new InMemoryCompanyRepository();

    createBranchUseCase = new CreateBranchUseCase(branchRepo, memberRepo);
    listBranchesUseCase = new ListBranchesUseCase(branchRepo, memberRepo);
    getDetailUseCase = new GetBranchDetailUseCase(branchRepo, memberRepo);
    updateBranchUseCase = new UpdateBranchUseCase(branchRepo, memberRepo);
    deleteBranchUseCase = new DeleteBranchUseCase(branchRepo, memberRepo);

    // Setup Company A
    const compA = await companyRepo.create({
      name: 'Company A Corp',
      taxId: '0311111111',
      verificationStatus: CompanyVerificationStatus.VERIFIED,
    });
    companyAId = compA.id;

    // Setup Company B
    const compB = await companyRepo.create({
      name: 'Company B Corp',
      taxId: '0322222222',
      verificationStatus: CompanyVerificationStatus.VERIFIED,
    });
    companyBId = compB.id;

    // Memberships for Company A
    await memberRepo.create({
      companyId: companyAId,
      userId: ownerUserId,
      role: CompanyMemberRole.OWNER,
      status: CompanyMemberStatus.ACTIVE,
    });

    await memberRepo.create({
      companyId: companyAId,
      userId: adminUserId,
      role: CompanyMemberRole.ADMIN,
      status: CompanyMemberStatus.ACTIVE,
    });

    await memberRepo.create({
      companyId: companyAId,
      userId: recruiterUserId,
      role: CompanyMemberRole.RECRUITER,
      status: CompanyMemberStatus.ACTIVE,
    });

    // Membership for Company B
    await memberRepo.create({
      companyId: companyBId,
      userId: alienEmployerUserId,
      role: CompanyMemberRole.OWNER,
      status: CompanyMemberStatus.ACTIVE,
    });

    // Branch under Company A
    const b1 = await branchRepo.create({
      companyId: companyAId,
      branchName: 'Chi nhánh Quận 1',
      addressLine: '123 Nguyễn Huệ',
      ward: 'Bến Nghé',
      district: 'Quận 1',
      city: 'Hồ Chí Minh',
      country: 'Vietnam',
      isHeadquarter: true,
    });
    branchA1Id = b1.id;
  });

  describe('CreateBranchUseCase', () => {
    it('should allow authorized owner to create a branch', async () => {
      const result = await createBranchUseCase.execute(ownerUserId, {
        branchName: 'Chi nhánh Quận Bình Thạnh',
        addressLine: '456 Điện Biên Phủ',
        city: 'Hồ Chí Minh',
        district: 'Bình Thạnh',
        isHeadquarter: false,
      });

      expect(result.branch).toBeDefined();
      expect(result.branch.companyId).toBe(companyAId);
      expect(result.branch.branchName).toBe('Chi nhánh Quận Bình Thạnh');
      expect(result.branch.isHeadquarter).toBe(false);
    });

    it('should allow authorized admin to create a branch and update headquarter', async () => {
      const result = await createBranchUseCase.execute(adminUserId, {
        branchName: 'Trụ sở mới Cầu Giấy',
        addressLine: '789 Cầu Giấy',
        city: 'Hà Nội',
        isHeadquarter: true,
      });

      expect(result.branch.isHeadquarter).toBe(true);

      // Previous headquarter branchA1 should now have isHeadquarter = false
      const oldHq = await branchRepo.findById(branchA1Id);
      expect(oldHq?.isHeadquarter).toBe(false);
    });

    it('should reject non-management members (e.g. RECRUITER) with 403 Forbidden', async () => {
      await expect(
        createBranchUseCase.execute(recruiterUserId, {
          branchName: 'Unauthorized Branch',
          addressLine: '100 Street',
          city: 'Hồ Chí Minh',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject creation if employer has no company', async () => {
      await expect(
        createBranchUseCase.execute('unaffiliated-user', {
          branchName: 'No Company Branch',
          addressLine: '100 Street',
          city: 'Hồ Chí Minh',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('ListBranchesUseCase — Tenant Isolation', () => {
    it('should list all branches belonging to the current employer company', async () => {
      // Create another branch for Company A
      await branchRepo.create({
        companyId: companyAId,
        branchName: 'Chi nhánh Tân Bình',
        addressLine: '10 Phổ Quang',
        city: 'Hồ Chí Minh',
      });

      // Create branch for Company B
      await branchRepo.create({
        companyId: companyBId,
        branchName: 'Company B Branch',
        addressLine: '999 Đường B',
        city: 'Đà Nẵng',
      });

      const result = await listBranchesUseCase.execute(ownerUserId);

      expect(result.total).toBe(2);
      expect(result.data.every((b) => b.companyId === companyAId)).toBe(true);
    });

    it('should reject cross-company list request if companyId mismatch supplied', async () => {
      await expect(
        listBranchesUseCase.execute(ownerUserId, companyBId),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('GetBranchDetailUseCase — Tenant Protection', () => {
    it('should return branch details for employer within same company', async () => {
      const result = await getDetailUseCase.execute(ownerUserId, branchA1Id);

      expect(result.branch).toBeDefined();
      expect(result.branch.id).toBe(branchA1Id);
      expect(result.branch.companyId).toBe(companyAId);
    });

    it('should reject access to a branch belonging to another company with 403 Forbidden', async () => {
      // Alien employer from Company B tries to access Company A's branch
      await expect(
        getDetailUseCase.execute(alienEmployerUserId, branchA1Id),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should return 404 Not Found for non-existent branch ID', async () => {
      await expect(
        getDetailUseCase.execute(ownerUserId, 'non-existent-branch'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('UpdateBranchUseCase', () => {
    it('should allow owner to update branch fields', async () => {
      const result = await updateBranchUseCase.execute(ownerUserId, branchA1Id, {
        branchName: 'Trụ sở chính Quận 1 (Đã đổi tên)',
        phone: '02899998888',
      });

      expect(result.branch.branchName).toBe('Trụ sở chính Quận 1 (Đã đổi tên)');
      expect(result.branch.phone).toBe('02899998888');
    });

    it('should reject cross-company update attempts with 403 Forbidden', async () => {
      await expect(
        updateBranchUseCase.execute(alienEmployerUserId, branchA1Id, {
          branchName: 'Hacked Branch',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject non-management member update with 403 Forbidden', async () => {
      await expect(
        updateBranchUseCase.execute(recruiterUserId, branchA1Id, {
          branchName: 'Recruiter Attempt',
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('DeleteBranchUseCase — Acceptance Criterion 5.5 Integrity', () => {
    it('should successfully delete a branch when it is NOT referenced by any job posting', async () => {
      // Ensure branchA1 is not in use
      branchRepo.inUseBranchIds.delete(branchA1Id);

      const result = await deleteBranchUseCase.execute(ownerUserId, branchA1Id);

      expect(result.deletedBranchId).toBe(branchA1Id);

      // Verify branch is removed from repository
      const check = await branchRepo.findById(branchA1Id);
      expect(check).toBeNull();
    });

    it('should reject deletion with 409 Conflict if branch is in use by job postings (AC 5.5)', async () => {
      // Mark branchA1 as referenced by job posting
      branchRepo.inUseBranchIds.add(branchA1Id);

      await expect(
        deleteBranchUseCase.execute(ownerUserId, branchA1Id),
      ).rejects.toThrow(ConflictException);

      // Verify branch was NOT deleted
      const check = await branchRepo.findById(branchA1Id);
      expect(check).not.toBeNull();
    });

    it('should reject deletion of a branch belonging to another company with 403 Forbidden', async () => {
      await expect(
        deleteBranchUseCase.execute(alienEmployerUserId, branchA1Id),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject deletion for non-management member with 403 Forbidden', async () => {
      await expect(
        deleteBranchUseCase.execute(recruiterUserId, branchA1Id),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
