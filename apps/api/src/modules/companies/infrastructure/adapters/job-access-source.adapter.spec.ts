import {
  CompanyMemberRole,
  CompanyMemberStatus,
  CompanyVerificationStatus,
  JobStatus,
  JobType,
} from '@campusjob/contracts';
import { M04WorkflowError } from '../../../applications/application/m04-ports';
import { JobAccessSourceAdapter } from './job-access-source.adapter';
import { InMemoryJobPostingRepository } from '../persistence/in-memory-job-posting.repository';
import { InMemoryCompanyRepository } from '../persistence/in-memory-company.repository';
import { InMemoryCompanyMemberRepository } from '../persistence/in-memory-company-member.repository';
import { InMemoryCompanyBranchRepository } from '../persistence/in-memory-company-branch.repository';
import { JobPostingEntity } from '../../domain/entities/job-posting.entity';
import { CompanyEntity } from '../../domain/entities/company.entity';
import { CompanyBranchEntity } from '../../domain/entities/company-branch.entity';

describe('JobAccessSourceAdapter (C-07 / S2-M03-06, S5-M03-02)', () => {
  let adapter: JobAccessSourceAdapter;
  let jobRepo: InMemoryJobPostingRepository;
  let companyRepo: InMemoryCompanyRepository;
  let memberRepo: InMemoryCompanyMemberRepository;
  let branchRepo: InMemoryCompanyBranchRepository;

  const companyId = 'company-1';
  const branchId = 'branch-1';
  const employerUserId = 'user-employer-1';
  const futureDeadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const pastDeadline = new Date(Date.now() - 24 * 60 * 60 * 1000);

  beforeEach(async () => {
    jobRepo = new InMemoryJobPostingRepository();
    companyRepo = new InMemoryCompanyRepository();
    memberRepo = new InMemoryCompanyMemberRepository();
    branchRepo = new InMemoryCompanyBranchRepository();

    adapter = new JobAccessSourceAdapter(
      jobRepo,
      companyRepo,
      memberRepo,
      branchRepo,
    );

    // Seed verified company
    const company = new CompanyEntity({
      id: companyId,
      name: 'Acme Corp',
      taxId: '1234567890',
      verificationStatus: CompanyVerificationStatus.VERIFIED,
    });
    await companyRepo.save(company);

    // Seed branch belonging to company
    const branch = new CompanyBranchEntity({
      id: branchId,
      companyId,
      branchName: 'Headquarter',
      addressLine: '123 Main St',
      city: 'Ho Chi Minh',
      isHeadquarter: true,
    });
    await branchRepo.save(branch);

    // Seed active company member (employer)
    await memberRepo.create({
      companyId,
      userId: employerUserId,
      role: CompanyMemberRole.OWNER,
      status: CompanyMemberStatus.ACTIVE,
    });
  });

  describe('assertAcceptingApplications', () => {
    it('cho phép nộp đơn khi toàn bộ điều kiện hợp lệ (OPEN, unexpired, company VERIFIED, branch matches, unhidden)', async () => {
      const job = await jobRepo.create({
        companyId,
        branchId,
        title: 'Software Engineer',
        description: 'Join our team',
        industry: 'IT',
        type: JobType.PART_TIME,
        skills: ['TypeScript', 'NestJS'],
        quantity: 3,
        deadline: futureDeadline,
        status: JobStatus.OPEN,
      });

      await expect(adapter.assertAcceptingApplications(job.id)).resolves.toBeUndefined();
    });

    it('bị chặn khi tin không tồn tại -> NOT_FOUND', async () => {
      await expect(adapter.assertAcceptingApplications('non-existent')).rejects.toThrow(
        new M04WorkflowError('NOT_FOUND'),
      );
    });

    it('bị chặn và tự động cập nhật CLOSED khi tin đã hết hạn -> INVALID_STATE', async () => {
      const job = await jobRepo.create({
        companyId,
        branchId,
        title: 'Expired Job',
        description: 'Old job',
        industry: 'IT',
        type: JobType.PART_TIME,
        skills: ['Java'],
        quantity: 1,
        deadline: pastDeadline,
        status: JobStatus.OPEN,
      });

      await expect(adapter.assertAcceptingApplications(job.id)).rejects.toThrow(
        new M04WorkflowError('INVALID_STATE'),
      );

      // Kiểm tra trạng thái đã tự động lưu thành CLOSED
      const updated = await jobRepo.findById(job.id);
      expect(updated?.status).toBe(JobStatus.CLOSED);
    });

    it('bị chặn khi tin đang PENDING_APPROVAL -> INVALID_STATE', async () => {
      const job = await jobRepo.create({
        companyId,
        branchId,
        title: 'Pending Job',
        description: 'Awaiting moderation',
        industry: 'IT',
        type: JobType.INTERNSHIP,
        skills: ['Python'],
        quantity: 2,
        deadline: futureDeadline,
        status: JobStatus.PENDING_APPROVAL,
      });

      await expect(adapter.assertAcceptingApplications(job.id)).rejects.toThrow(
        new M04WorkflowError('INVALID_STATE'),
      );
    });

    it('bị chặn khi tin đang PAUSED -> INVALID_STATE', async () => {
      const job = await jobRepo.create({
        companyId,
        branchId,
        title: 'Paused Job',
        description: 'Temporarily paused',
        industry: 'IT',
        type: JobType.PART_TIME,
        skills: ['Go'],
        quantity: 1,
        deadline: futureDeadline,
        status: JobStatus.PAUSED,
      });

      await expect(adapter.assertAcceptingApplications(job.id)).rejects.toThrow(
        new M04WorkflowError('INVALID_STATE'),
      );
    });

    it('bị chặn khi tin đã CLOSED -> INVALID_STATE', async () => {
      const job = await jobRepo.create({
        companyId,
        branchId,
        title: 'Closed Job',
        description: 'Finished',
        industry: 'IT',
        type: JobType.PART_TIME,
        skills: ['C++'],
        quantity: 1,
        deadline: futureDeadline,
        status: JobStatus.CLOSED,
      });

      await expect(adapter.assertAcceptingApplications(job.id)).rejects.toThrow(
        new M04WorkflowError('INVALID_STATE'),
      );
    });

    it('bị chặn khi tin bị kiểm duyệt ẩn (hiddenByModeration = true) -> INVALID_STATE', async () => {
      const job = await jobRepo.create({
        companyId,
        branchId,
        title: 'Hidden Job',
        description: 'Violating terms',
        industry: 'IT',
        type: JobType.PART_TIME,
        skills: ['SQL'],
        quantity: 1,
        deadline: futureDeadline,
        status: JobStatus.OPEN,
        hiddenByModeration: true,
      });

      await expect(adapter.assertAcceptingApplications(job.id)).rejects.toThrow(
        new M04WorkflowError('INVALID_STATE'),
      );
    });

    it('bị chặn khi doanh nghiệp chưa được duyệt (UNVERIFIED / PENDING_REVIEW / REJECTED) -> INVALID_STATE', async () => {
      const unverifiedComp = new CompanyEntity({
        id: 'company-unverified',
        name: 'Unverified Co',
        taxId: '9999999999',
        verificationStatus: CompanyVerificationStatus.PENDING_REVIEW,
      });
      await companyRepo.save(unverifiedComp);

      const unverifiedBranch = new CompanyBranchEntity({
        id: 'branch-unverified',
        companyId: 'company-unverified',
        branchName: 'Branch 2',
        addressLine: '456 St',
        city: 'Da Nang',
      });
      await branchRepo.save(unverifiedBranch);

      const job = await jobRepo.create({
        companyId: 'company-unverified',
        branchId: 'branch-unverified',
        title: 'Job at Unverified Company',
        description: 'Desc',
        industry: 'IT',
        type: JobType.PART_TIME,
        skills: ['Ruby'],
        quantity: 1,
        deadline: futureDeadline,
        status: JobStatus.OPEN,
      });

      await expect(adapter.assertAcceptingApplications(job.id)).rejects.toThrow(
        new M04WorkflowError('INVALID_STATE'),
      );
    });

    it('bị chặn khi chi nhánh không thuộc sở hữu của doanh nghiệp -> INVALID_STATE', async () => {
      const otherBranch = new CompanyBranchEntity({
        id: 'branch-other',
        companyId: 'other-company',
        branchName: 'Foreign Branch',
        addressLine: '999 Other St',
        city: 'Hanoi',
      });
      await branchRepo.save(otherBranch);

      const job = await jobRepo.create({
        companyId,
        branchId: 'branch-other', // Chi nhánh của cty khác
        title: 'Cross Branch Job',
        description: 'Illegal branch assignment',
        industry: 'IT',
        type: JobType.PART_TIME,
        skills: ['NodeJS'],
        quantity: 1,
        deadline: futureDeadline,
        status: JobStatus.OPEN,
      });

      await expect(adapter.assertAcceptingApplications(job.id)).rejects.toThrow(
        new M04WorkflowError('INVALID_STATE'),
      );
    });
  });

  describe('assertManagedBy', () => {
    it('thành công khi user là active member của doanh nghiệp sở hữu tin', async () => {
      const job = await jobRepo.create({
        companyId,
        branchId,
        title: 'Owned Job',
        description: 'Owned',
        industry: 'IT',
        type: JobType.PART_TIME,
        skills: ['PHP'],
        quantity: 1,
        deadline: futureDeadline,
      });

      await expect(adapter.assertManagedBy(job.id, employerUserId)).resolves.toBeUndefined();
    });

    it('bị từ chối (NOT_FOUND) khi tin không tồn tại', async () => {
      await expect(adapter.assertManagedBy('non-existent', employerUserId)).rejects.toThrow(
        new M04WorkflowError('NOT_FOUND'),
      );
    });

    it('bị từ chối (FORBIDDEN) khi user không thuộc doanh nghiệp sở hữu tin', async () => {
      const job = await jobRepo.create({
        companyId,
        branchId,
        title: 'Owned Job',
        description: 'Owned',
        industry: 'IT',
        type: JobType.PART_TIME,
        skills: ['PHP'],
        quantity: 1,
        deadline: futureDeadline,
      });

      await expect(adapter.assertManagedBy(job.id, 'foreign-user-id')).rejects.toThrow(
        new M04WorkflowError('FORBIDDEN'),
      );
    });
  });

  describe('getEligibility (C-07 Snapshot DTO)', () => {
    it('trả đúng thông tin chuẩn hóa cho M04', async () => {
      const job = await jobRepo.create({
        companyId,
        branchId,
        title: 'Full Stack Dev',
        description: 'Develop apps',
        industry: 'IT',
        type: JobType.INTERNSHIP,
        skills: ['React', 'NestJS'],
        quantity: 5,
        deadline: futureDeadline,
        status: JobStatus.OPEN,
      });

      const result = await adapter.getEligibility(job.id);

      expect(result.jobId).toBe(job.id);
      expect(result.companyId).toBe(companyId);
      expect(result.companyName).toBe('Acme Corp');
      expect(result.branchId).toBe(branchId);
      expect(result.title).toBe('Full Stack Dev');
      expect(result.quantity).toBe(5);
      expect(result.status).toBe(JobStatus.OPEN);
      expect(result.acceptingApplications).toBe(true);
    });

    it('trả acceptingApplications = false khi tin đã hết hạn', async () => {
      const job = await jobRepo.create({
        companyId,
        branchId,
        title: 'Past Dev',
        description: 'Old',
        industry: 'IT',
        type: JobType.PART_TIME,
        skills: ['C'],
        quantity: 1,
        deadline: pastDeadline,
        status: JobStatus.OPEN,
      });

      const result = await adapter.getEligibility(job.id);

      expect(result.status).toBe(JobStatus.CLOSED);
      expect(result.acceptingApplications).toBe(false);
    });
  });
});
