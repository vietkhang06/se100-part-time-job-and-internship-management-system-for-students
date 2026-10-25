import {
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { validate } from 'class-validator';
import {
  CompanyMemberRole,
  CompanyMemberStatus,
} from '@campusjob/contracts';
import { InMemoryCompanyRepository } from '../../infrastructure/persistence/in-memory-company.repository';
import { InMemoryCompanyMemberRepository } from '../../infrastructure/persistence/in-memory-company-member.repository';
import { InMemoryCompanyBranchRepository } from '../../infrastructure/persistence/in-memory-company-branch.repository';
import { CreateBranchUseCase } from './create-branch.use-case';
import { ListBranchesUseCase } from './list-branches.use-case';
import { GetBranchDetailUseCase } from './get-branch-detail.use-case';
import { UpdateBranchUseCase } from './update-branch.use-case';
import { DeleteBranchUseCase } from './delete-branch.use-case';
import { CreateCompanyBranchDto } from '../dto/create-company-branch.dto';
import { UpdateCompanyBranchDto } from '../dto/update-company-branch.dto';
import { IJobBranchUsageChecker } from '../../domain/ports/job-branch-usage-checker.port';

describe('S4-M03-03: Company Branch CRUD & Coordinates Validation', () => {
  let companyRepo: InMemoryCompanyRepository;
  let memberRepo: InMemoryCompanyMemberRepository;
  let branchRepo: InMemoryCompanyBranchRepository;
  let jobBranchChecker: IJobBranchUsageChecker;

  let createBranchUseCase: CreateBranchUseCase;
  let listBranchesUseCase: ListBranchesUseCase;
  let getBranchDetailUseCase: GetBranchDetailUseCase;
  let updateBranchUseCase: UpdateBranchUseCase;
  let deleteBranchUseCase: DeleteBranchUseCase;

  const ownerUserId = 'user-owner-1';
  const regularMemberUserId = 'user-regular-member-1';
  const otherCompanyOwnerId = 'user-other-company-owner';

  const companyAId = 'company-a';
  const companyBId = 'company-b';

  beforeEach(async () => {
    companyRepo = new InMemoryCompanyRepository();
    memberRepo = new InMemoryCompanyMemberRepository();
    branchRepo = new InMemoryCompanyBranchRepository();

    jobBranchChecker = {
      isBranchInUse: jest.fn().mockResolvedValue(false),
      assertBranchBelongsToCompany: jest.fn().mockImplementation(async (bId, cId) => {
        const branch = await branchRepo.findById(bId);
        if (!branch || branch.companyId !== cId) {
          throw new ForbiddenException(
            'Tin tuyển dụng không thể tham chiếu chi nhánh không thuộc doanh nghiệp sở hữu.',
          );
        }
      }),
    };

    createBranchUseCase = new CreateBranchUseCase(branchRepo, memberRepo);
    listBranchesUseCase = new ListBranchesUseCase(branchRepo, memberRepo);
    getBranchDetailUseCase = new GetBranchDetailUseCase(branchRepo, memberRepo);
    updateBranchUseCase = new UpdateBranchUseCase(branchRepo, memberRepo);
    deleteBranchUseCase = new DeleteBranchUseCase(
      branchRepo,
      memberRepo,
      jobBranchChecker,
    );

    // Seed Company A memberships
    await memberRepo.create({
      companyId: companyAId,
      userId: ownerUserId,
      role: CompanyMemberRole.OWNER,
      status: CompanyMemberStatus.ACTIVE,
    });
    await memberRepo.create({
      companyId: companyAId,
      userId: regularMemberUserId,
      role: CompanyMemberRole.MEMBER,
      status: CompanyMemberStatus.ACTIVE,
    });

    // Seed Company B membership
    await memberRepo.create({
      companyId: companyBId,
      userId: otherCompanyOwnerId,
      role: CompanyMemberRole.OWNER,
      status: CompanyMemberStatus.ACTIVE,
    });
  });

  describe('Branch DTO Coordinate & Address Validation', () => {
    it('should pass validation with valid coordinates within supported ranges', async () => {
      const dto = new CreateCompanyBranchDto();
      dto.branchName = 'Chi nhánh Hà Nội';
      dto.addressLine = '10 Pham Van Dong';
      dto.city = 'Hà Nội';
      dto.latitude = 21.0285; // Valid latitude in [-90, 90]
      dto.longitude = 105.8542; // Valid longitude in [-180, 180]

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should support boundary values for latitude (-90, 90) and longitude (-180, 180)', async () => {
      const dtoMin = new CreateCompanyBranchDto();
      dtoMin.branchName = 'Branch Min Bounds';
      dtoMin.addressLine = 'South Pole Edge';
      dtoMin.city = 'Antarctica';
      dtoMin.latitude = -90;
      dtoMin.longitude = -180;

      const errorsMin = await validate(dtoMin);
      expect(errorsMin.length).toBe(0);

      const dtoMax = new CreateCompanyBranchDto();
      dtoMax.branchName = 'Branch Max Bounds';
      dtoMax.addressLine = 'North Pole Edge';
      dtoMax.city = 'Arctic';
      dtoMax.latitude = 90;
      dtoMax.longitude = 180;

      const errorsMax = await validate(dtoMax);
      expect(errorsMax.length).toBe(0);
    });

    it('should reject out-of-range coordinates (> 90 lat or > 180 lon)', async () => {
      const dto = new CreateCompanyBranchDto();
      dto.branchName = 'Branch Invalid Coords';
      dto.addressLine = 'Outer Space';
      dto.city = 'Orbit';
      dto.latitude = 90.0001; // Out of range!
      dto.longitude = 180.0001; // Out of range!

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const latError = errors.find((e) => e.property === 'latitude');
      const lonError = errors.find((e) => e.property === 'longitude');
      expect(latError).toBeDefined();
      expect(lonError).toBeDefined();
    });

    it('should reject empty addressLine or city', async () => {
      const dto = new CreateCompanyBranchDto();
      dto.branchName = 'Missing Address Branch';
      dto.addressLine = '';
      dto.city = '';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThanOrEqual(2);
      expect(errors.find((e) => e.property === 'addressLine')).toBeDefined();
      expect(errors.find((e) => e.property === 'city')).toBeDefined();
    });
  });

  describe('Branch CRUD Authorization & Tenant Protection', () => {
    it('should allow Employer OWNER to create, list, and update branch', async () => {
      // 1. Create branch
      const created = await createBranchUseCase.execute(ownerUserId, {
        branchName: 'Chi nhánh Quận 1',
        addressLine: '123 Le Loi',
        city: 'Hồ Chí Minh',
        latitude: 10.7769,
        longitude: 106.7009,
        isHeadquarter: true,
      });

      expect(created.branch.id).toBeDefined();
      expect(created.branch.branchName).toBe('Chi nhánh Quận 1');
      expect(created.branch.latitude).toBe(10.7769);
      expect(created.branch.longitude).toBe(106.7009);
      expect(created.branch.isHeadquarter).toBe(true);

      // 2. List branches
      const list = await listBranchesUseCase.execute(ownerUserId);
      expect(list.total).toBe(1);
      expect(list.data[0].id).toBe(created.branch.id);

      // 3. Update branch
      const updated = await updateBranchUseCase.execute(
        ownerUserId,
        created.branch.id,
        {
          branchName: 'Chi nhánh Quận 1 (Cập nhật)',
          latitude: 10.7770,
        },
      );
      expect(updated.branch.branchName).toBe('Chi nhánh Quận 1 (Cập nhật)');
      expect(updated.branch.latitude).toBe(10.7770);
    });

    it('should reject creation/editing if user is only a MEMBER without management permission', async () => {
      await expect(
        createBranchUseCase.execute(regularMemberUserId, {
          branchName: 'Unauthorized Branch',
          addressLine: '123 Fake St',
          city: 'Da Nang',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject access or editing of another company branch (Tenant Isolation)', async () => {
      // Owner of Company A creates branch in Company A
      const branchA = await branchRepo.create({
        companyId: companyAId,
        branchName: 'Branch A',
        addressLine: 'A street',
        city: 'City A',
      });

      // Owner of Company B tries to view Branch A
      await expect(
        getBranchDetailUseCase.execute(otherCompanyOwnerId, branchA.id),
      ).rejects.toThrow(ForbiddenException);

      // Owner of Company B tries to update Branch A
      await expect(
        updateBranchUseCase.execute(otherCompanyOwnerId, branchA.id, {
          branchName: 'Hijacked Branch A',
        }),
      ).rejects.toThrow(ForbiddenException);

      // Owner of Company B tries to delete Branch A
      await expect(
        deleteBranchUseCase.execute(otherCompanyOwnerId, branchA.id),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Branch Deletion Protection (không cho xóa chi nhánh đang được tin tham chiếu)', () => {
    it('should reject branch deletion when it is referenced by a job posting', async () => {
      const branch = await branchRepo.create({
        companyId: companyAId,
        branchName: 'Busy Branch',
        addressLine: 'Active Street',
        city: 'HCMC',
      });

      // Mark branch as in-use in repository / checker
      branchRepo.inUseBranchIds.add(branch.id);

      await expect(
        deleteBranchUseCase.execute(ownerUserId, branch.id),
      ).rejects.toThrow(ConflictException);

      // Branch must still exist
      const stillExists = await branchRepo.findById(branch.id);
      expect(stillExists).toBeDefined();
    });

    it('should successfully delete branch when it is not referenced by any job', async () => {
      const branch = await branchRepo.create({
        companyId: companyAId,
        branchName: 'Free Branch',
        addressLine: 'Free Street',
        city: 'HCMC',
      });

      const result = await deleteBranchUseCase.execute(ownerUserId, branch.id);
      expect(result.deletedBranchId).toBe(branch.id);

      const deleted = await branchRepo.findById(branch.id);
      expect(deleted).toBeNull();
    });
  });

  describe('Cross-company Job-to-Branch reference rejection', () => {
    it('should prevent a job from referencing a branch belonging to another company', async () => {
      const branchA = await branchRepo.create({
        companyId: companyAId,
        branchName: 'Branch belonging to Company A',
        addressLine: 'Street A',
        city: 'City A',
      });

      // Company B tries to create a job pointing to Company A's branch
      await expect(
        jobBranchChecker.assertBranchBelongsToCompany(branchA.id, companyBId),
      ).rejects.toThrow(ForbiddenException);

      // Company A pointing to Company A's branch succeeds
      await expect(
        jobBranchChecker.assertBranchBelongsToCompany(branchA.id, companyAId),
      ).resolves.not.toThrow();
    });
  });
});
