import { Test, TestingModule } from '@nestjs/testing';
import {
  CompanyMemberRole,
  CompanyMemberStatus,
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

  const employerUserId = 'user-emp-branch-1';
  const companyId = 'company-branch-test-1';
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

    // Seed membership
    await memberRepo.create({
      companyId,
      userId: employerUserId,
      role: CompanyMemberRole.OWNER,
      status: CompanyMemberStatus.ACTIVE,
    });

    // Seed initial branch
    const branch = await branchRepo.create({
      companyId,
      branchName: 'Headquarter Branch',
      addressLine: '100 Main Street',
      city: 'Ha Noi',
      latitude: 21.0285,
      longitude: 105.8542,
      isHeadquarter: true,
    });
    branchId = branch.id;
  });

  it('should list branches for employer', async () => {
    const res = await controller.list(employerUserId);
    expect(res.data.length).toBe(1);
    expect(res.data[0].branchName).toBe('Headquarter Branch');
    expect(res.data[0].latitude).toBe(21.0285);
  });

  it('should get branch detail by ID', async () => {
    const res = await controller.getDetail(employerUserId, branchId);
    expect(res.branch.id).toBe(branchId);
    expect(res.branch.longitude).toBe(105.8542);
  });

  it('should create new branch with coordinates', async () => {
    const res = await controller.create(employerUserId, {
      branchName: 'Da Nang Branch',
      addressLine: '50 Bach Dang',
      city: 'Da Nang',
      latitude: 16.0544,
      longitude: 108.2022,
    });
    expect(res.branch).toBeDefined();
    expect(res.branch.branchName).toBe('Da Nang Branch');
    expect(res.branch.latitude).toBe(16.0544);
    expect(res.branch.longitude).toBe(108.2022);
  });

  it('should update existing branch', async () => {
    const res = await controller.update(employerUserId, branchId, {
      branchName: 'HQ Branch Updated',
    });
    expect(res.branch.branchName).toBe('HQ Branch Updated');
  });

  it('should delete branch', async () => {
    const res = await controller.delete(employerUserId, branchId);
    expect(res.deletedBranchId).toBe(branchId);
  });
});
