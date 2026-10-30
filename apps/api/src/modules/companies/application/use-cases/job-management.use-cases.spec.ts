import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  CompanyErrorCode,
  CompanyMemberRole,
  CompanyMemberStatus,
  JobErrorCode,
  JobStatus,
  JobType,
} from '@campusjob/contracts';
import { InMemoryCompanyRepository } from '../../infrastructure/persistence/in-memory-company.repository';
import { InMemoryCompanyMemberRepository } from '../../infrastructure/persistence/in-memory-company-member.repository';
import { InMemoryCompanyBranchRepository } from '../../infrastructure/persistence/in-memory-company-branch.repository';
import { InMemoryJobPostingRepository } from '../../infrastructure/persistence/in-memory-job-posting.repository';
import { CreateJobPostingUseCase } from './create-job-posting.use-case';
import { UpdateJobPostingUseCase } from './update-job-posting.use-case';
import { ListEmployerJobsUseCase } from './list-employer-jobs.use-case';
import { GetEmployerJobDetailUseCase } from './get-employer-job-detail.use-case';
import { CreateJobPostingDto } from '../dto/create-job-posting.dto';

describe('S4-M03-04: Employer Job Management API & FR-08 Validation', () => {
  let companyRepo: InMemoryCompanyRepository;
  let memberRepo: InMemoryCompanyMemberRepository;
  let branchRepo: InMemoryCompanyBranchRepository;
  let jobRepo: InMemoryJobPostingRepository;

  let createJobUseCase: CreateJobPostingUseCase;
  let updateJobUseCase: UpdateJobPostingUseCase;
  let listJobsUseCase: ListEmployerJobsUseCase;
  let getJobDetailUseCase: GetEmployerJobDetailUseCase;

  const ownerUserId = 'user-owner-1';
  const otherCompanyOwnerId = 'user-other-owner';
  const noCompanyUserId = 'user-no-company';

  let branchAId: string;
  let branchBId: string;

  beforeEach(async () => {
    companyRepo = new InMemoryCompanyRepository();
    memberRepo = new InMemoryCompanyMemberRepository();
    branchRepo = new InMemoryCompanyBranchRepository();
    jobRepo = new InMemoryJobPostingRepository();

    createJobUseCase = new CreateJobPostingUseCase(jobRepo, memberRepo, branchRepo);
    updateJobUseCase = new UpdateJobPostingUseCase(jobRepo, memberRepo, branchRepo);
    listJobsUseCase = new ListEmployerJobsUseCase(jobRepo, memberRepo);
    getJobDetailUseCase = new GetEmployerJobDetailUseCase(jobRepo, memberRepo);

    // Setup Company A & Owner
    const companyA = await companyRepo.create({
      name: 'Tech Corp',
      taxId: '0101010101',
      verificationStatus: 'VERIFIED',
    });
    await memberRepo.create({
      companyId: companyA.id,
      userId: ownerUserId,
      role: CompanyMemberRole.OWNER,
      status: CompanyMemberStatus.ACTIVE,
    });
    const branchA = await branchRepo.create({
      companyId: companyA.id,
      branchName: 'Headquarters A',
      addressLine: '123 Nguyen Hue',
      city: 'Ho Chi Minh',
    });
    branchAId = branchA.id;

    // Setup Company B & Owner
    const companyB = await companyRepo.create({
      name: 'Other Corp',
      taxId: '0202020202',
      verificationStatus: 'VERIFIED',
    });
    await memberRepo.create({
      companyId: companyB.id,
      userId: otherCompanyOwnerId,
      role: CompanyMemberRole.OWNER,
      status: CompanyMemberStatus.ACTIVE,
    });
    const branchB = await branchRepo.create({
      companyId: companyB.id,
      branchName: 'Branch B',
      addressLine: '456 Tran Hung Dao',
      city: 'Ha Noi',
    });
    branchBId = branchB.id;
  });

  describe('Create Job (S4-M03-04 / FR-08)', () => {
    const validFutureDate = new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString();

    const validDto: CreateJobPostingDto = {
      branchId: '',
      title: 'Thực tập sinh Frontend ReactJS',
      description: 'Lập trình ứng dụng web sử dụng ReactJS, TypeScript và TailwindCSS.',
      industry: 'Công nghệ thông tin',
      type: JobType.INTERNSHIP,
      skills: ['React', 'TypeScript', 'TailwindCSS'],
      quantity: 3,
      salary: '5 - 7 triệu VND',
      salaryMin: 5000000,
      salaryMax: 7000000,
      isSalaryNegotiable: false,
      schedule: 'Sáng từ 8h - 12h, từ thứ 2 đến thứ 6',
      benefits: 'Trợ cấp ăn trưa, cơ hội lên chính thức',
      deadline: validFutureDate,
    };

    it('should create a job in PENDING_APPROVAL status with viewCount = 0', async () => {
      validDto.branchId = branchAId;
      const res = await createJobUseCase.execute(ownerUserId, validDto);

      expect(res.job).toBeDefined();
      expect(res.job.id).toBeDefined();
      expect(res.job.status).toBe(JobStatus.PENDING_APPROVAL); // Tin mới luôn ở trạng thái Chờ duyệt
      expect(res.job.viewCount).toBe(0);
      expect(res.job.title).toBe(validDto.title);
      expect(res.job.quantity).toBe(3);
      expect(res.job.salaryMin).toBe(5000000);
      expect(res.job.salaryMax).toBe(7000000);
    });

    it('should reject creation when branch belongs to another company (Tenant Isolation)', async () => {
      // Owner of Company A tries to create job pointing to Company B's branch
      validDto.branchId = branchBId;
      await expect(
        createJobUseCase.execute(ownerUserId, validDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject creation if deadline is in the past', async () => {
      validDto.branchId = branchAId;
      const pastDto = {
        ...validDto,
        deadline: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
      };
      await expect(
        createJobUseCase.execute(ownerUserId, pastDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject creation if salaryMin > salaryMax', async () => {
      validDto.branchId = branchAId;
      const invalidSalaryDto = {
        ...validDto,
        salaryMin: 10000000,
        salaryMax: 5000000,
      };
      await expect(
        createJobUseCase.execute(ownerUserId, invalidSalaryDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject creation if user has no company membership', async () => {
      validDto.branchId = branchAId;
      await expect(
        createJobUseCase.execute(noCompanyUserId, validDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('Update Job (S4-M03-04)', () => {
    let createdJobId: string;
    const validFutureDate = new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString();

    beforeEach(async () => {
      const res = await createJobUseCase.execute(ownerUserId, {
        branchId: branchAId,
        title: 'Lập trình viên Backend Node.js',
        description: 'Phát triển RESTful APIs với NestJS và Prisma.',
        industry: 'CNTT',
        type: JobType.PART_TIME,
        skills: ['NestJS', 'PostgreSQL'],
        quantity: 2,
        deadline: validFutureDate,
      });
      createdJobId = res.job.id;
    });

    it('should successfully update job details', async () => {
      const res = await updateJobUseCase.execute(ownerUserId, createdJobId, {
        title: 'Senior Backend Engineer',
        quantity: 5,
        salary: 'Thoả thuận',
        isSalaryNegotiable: true,
      });

      expect(res.job.title).toBe('Senior Backend Engineer');
      expect(res.job.quantity).toBe(5);
      expect(res.job.isSalaryNegotiable).toBe(true);
    });

    it('should deny update when requested by another company owner (Cross-company denial test)', async () => {
      await expect(
        updateJobUseCase.execute(otherCompanyOwnerId, createdJobId, {
          title: 'Hacked Title',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject update if new branchId belongs to another company', async () => {
      await expect(
        updateJobUseCase.execute(ownerUserId, createdJobId, {
          branchId: branchBId,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject update if job is CLOSED', async () => {
      await jobRepo.update(createdJobId, { status: JobStatus.CLOSED });

      await expect(
        updateJobUseCase.execute(ownerUserId, createdJobId, {
          title: 'Cannot Update Closed Job',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject update if deadline is in the past', async () => {
      await expect(
        updateJobUseCase.execute(ownerUserId, createdJobId, {
          deadline: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('List & Detail Job (S4-M03-04)', () => {
    let jobAId: string;

    beforeEach(async () => {
      const validFutureDate = new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString();
      const jobA = await createJobUseCase.execute(ownerUserId, {
        branchId: branchAId,
        title: 'Job in Company A',
        description: 'Description A',
        industry: 'CNTT',
        type: JobType.FULL_TIME,
        skills: ['Java'],
        quantity: 1,
        deadline: validFutureDate,
      });
      jobAId = jobA.job.id;

      await createJobUseCase.execute(otherCompanyOwnerId, {
        branchId: branchBId,
        title: 'Job in Company B',
        description: 'Description B',
        industry: 'Marketing',
        type: JobType.PART_TIME,
        skills: ['SEO'],
        quantity: 2,
        deadline: validFutureDate,
      });
    });

    it('should list only jobs belonging to employer own company', async () => {
      const res = await listJobsUseCase.execute(ownerUserId, {});
      expect(res.total).toBe(1);
      expect(res.jobs[0].title).toBe('Job in Company A');

      const resB = await listJobsUseCase.execute(otherCompanyOwnerId, {});
      expect(resB.total).toBe(1);
      expect(resB.jobs[0].title).toBe('Job in Company B');
    });

    it('should get job detail for owner company', async () => {
      const res = await getJobDetailUseCase.execute(ownerUserId, jobAId);
      expect(res.job.id).toBe(jobAId);
      expect(res.job.title).toBe('Job in Company A');
    });

    it('should deny getting job detail of another company (Tenant Isolation)', async () => {
      await expect(
        getJobDetailUseCase.execute(otherCompanyOwnerId, jobAId),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
