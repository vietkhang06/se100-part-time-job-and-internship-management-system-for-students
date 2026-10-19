import { Test, TestingModule } from '@nestjs/testing';
import {
  CompanyMemberRole,
  CompanyMemberStatus,
  CompanyVerificationStatus,
} from '@campusjob/contracts';
import { CompanyBranchesController } from './company-branches.controller';
import { CreateBranchUseCase } from '../../application/use-cases/create-branch.use-case';
import { ListBranchesUseCase } from '../../application/use-cases/list-branches.use-case';
import { GetBranchDetailUseCase } from '../../application/use-cases/get-branch-detail.use-case';
import { UpdateBranchUseCase } from '../../application/use-cases/update-branch.use-case';
import { DeleteBranchUseCase } from '../../application/use-cases/delete-branch.use-case';
import { InMemoryCompanyBranchRepository } from '../../infrastructure/persistence/in-memory-company-branch.repository';
import { InMemoryCompanyMemberRepository } from '../../infrastructure/persistence/in-memory-company-member.repository';
import { COMPANY_BRANCH_REPOSITORY_TOKEN } from '../../domain/repositories/company-branch.repository.interface';
import { COMPANY_MEMBER_REPOSITORY_TOKEN } from '../../domain/repositories/company-member.repository.interface';

describe('CompanyBranchesController', () => {
  let controller: CompanyBranchesController;
  let branchRepo: InMemoryCompanyBranchRepository;
  let memberRepo: InMemoryCompanyMemberRepository;

  const employerUserId = 'emp-controller-branch-1';
  const companyId = 'company-test-branches-1';
  let branchId: string;

  beforeEach(async () => {
    branchRepo = new InMemoryCompanyBranchRepository();
    memberRepo = new InMemoryCompanyMemberRepository();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CompanyBranchesController],
      providers: [
        CreateBranchUseCase,
        ListBranchesUseCase,
        GetBranchDetailUseCase,
        UpdateBranchUseCase,
        DeleteBranchUseCase,
        {
          provide: COMPANY_BRANCH_REPOSITORY_TOKEN,
          useValue: branchRepo,
        },
        {
          provide: COMPANY_MEMBER_REPOSITORY_TOKEN,
          useValue: memberRepo,
        },
      ],
    }).compile();

    controller = module.get<CompanyBranchesController>(
      CompanyBranchesController,
    );

    // Setup active employer membership
    await memberRepo.create({
      companyId,
      userId: employerUserId,
      role: CompanyMemberRole.OWNER,
      status: CompanyMemberStatus.ACTIVE,
    });

    const b = await branchRepo.create({
      companyId,
      branchName: 'Chi nhánh Quận 1',
      addressLine: '123 Hai Bà Trưng',
      city: 'Hồ Chí Minh',
      isHeadquarter: true,
    });
    branchId = b.id;
  });

  it('should list branches', async () => {
    const res = await controller.list(employerUserId);
    expect(res.total).toBe(1);
    expect(res.data[0].branchName).toBe('Chi nhánh Quận 1');
  });

  it('should create branch', async () => {
    const res = await controller.create(employerUserId, {
      branchName: 'Chi nhánh Quận 3',
      addressLine: '456 Nam Kỳ Khởi Nghĩa',
      city: 'Hồ Chí Minh',
    });
    expect(res.branch).toBeDefined();
    expect(res.branch.branchName).toBe('Chi nhánh Quận 3');
  });

  it('should get branch detail', async () => {
    const res = await controller.getDetail(employerUserId, branchId);
    expect(res.branch.id).toBe(branchId);
  });

  it('should update branch', async () => {
    const res = await controller.update(employerUserId, branchId, {
      branchName: 'Chi nhánh Quận 1 Mới',
    });
    expect(res.branch.branchName).toBe('Chi nhánh Quận 1 Mới');
  });

  it('should delete branch', async () => {
    const res = await controller.delete(employerUserId, branchId);
    expect(res.deletedBranchId).toBe(branchId);
  });
});
