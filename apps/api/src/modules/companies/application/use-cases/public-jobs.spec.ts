import { NotFoundException } from '@nestjs/common';
import {
  CompanyVerificationStatus,
  JobStatus,
  JobType,
} from '@campusjob/contracts';
import { SearchPublicJobsUseCase } from './search-public-jobs.use-case';
import { GetPublicJobDetailUseCase } from './get-public-job-detail.use-case';
import { InMemoryJobPostingRepository } from '../../infrastructure/persistence/in-memory-job-posting.repository';
import { InMemoryCompanyRepository } from '../../infrastructure/persistence/in-memory-company.repository';
import { InMemoryCompanyMemberRepository } from '../../infrastructure/persistence/in-memory-company-member.repository';
import { CompanyEntity } from '../../domain/entities/company.entity';

describe('Public Jobs Use Cases (UC22–UC23 / S5-M03-03)', () => {
  let searchUseCase: SearchPublicJobsUseCase;
  let getDetailUseCase: GetPublicJobDetailUseCase;
  let jobRepo: InMemoryJobPostingRepository;
  let companyRepo: InMemoryCompanyRepository;
  let memberRepo: InMemoryCompanyMemberRepository;

  const verifiedCompanyId = 'company-verified-1';
  const unverifiedCompanyId = 'company-unverified-2';
  const futureDeadline = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
  const pastDeadline = new Date(Date.now() - 24 * 60 * 60 * 1000);

  beforeEach(async () => {
    jobRepo = new InMemoryJobPostingRepository();
    companyRepo = new InMemoryCompanyRepository();
    memberRepo = new InMemoryCompanyMemberRepository();

    searchUseCase = new SearchPublicJobsUseCase(jobRepo);
    getDetailUseCase = new GetPublicJobDetailUseCase(jobRepo, memberRepo);

    // Seed verified company
    await companyRepo.save(
      new CompanyEntity({
        id: verifiedCompanyId,
        name: 'Tech Innovators',
        taxId: '1112223334',
        verificationStatus: CompanyVerificationStatus.VERIFIED,
      }),
    );
  });

  describe('SearchPublicJobsUseCase (UC22 Filters & Visibility)', () => {
    beforeEach(async () => {
      // Job 1: IT, Full-time, 15m - 25m, Morning
      await jobRepo.create({
        companyId: verifiedCompanyId,
        branchId: 'branch-1',
        title: 'Senior Frontend Developer',
        description: 'React, Next.js and Tailwind CSS expertise needed',
        industry: 'Information Technology',
        type: JobType.FULL_TIME,
        skills: ['React', 'Next.js'],
        quantity: 2,
        salaryMin: 15000000,
        salaryMax: 25000000,
        schedule: 'Morning shift 8AM - 12PM',
        deadline: futureDeadline,
        status: JobStatus.OPEN,
      });

      // Job 2: Marketing, Part-time, 5m - 10m, Evening
      await jobRepo.create({
        companyId: verifiedCompanyId,
        branchId: 'branch-1',
        title: 'Content Creator Intern',
        description: 'Create engaging marketing content for social media',
        industry: 'Marketing',
        type: JobType.PART_TIME,
        skills: ['Canva', 'Copywriting'],
        quantity: 1,
        salaryMin: 5000000,
        salaryMax: 10000000,
        schedule: 'Evening shift 6PM - 10PM',
        deadline: futureDeadline,
        status: JobStatus.OPEN,
      });

      // Job 3: IT, Internship, Negotiable salary
      await jobRepo.create({
        companyId: verifiedCompanyId,
        branchId: 'branch-1',
        title: 'Backend Node.js Intern',
        description: 'Backend services with NestJS and PostgreSQL',
        industry: 'Information Technology',
        type: JobType.INTERNSHIP,
        skills: ['Node.js', 'PostgreSQL'],
        quantity: 3,
        isSalaryNegotiable: true,
        schedule: 'Flexible hours',
        deadline: futureDeadline,
        status: JobStatus.OPEN,
      });

      // NON-VISIBLE JOBS (must NEVER appear in public search):
      // A: PENDING_APPROVAL
      await jobRepo.create({
        companyId: verifiedCompanyId,
        branchId: 'branch-1',
        title: 'Draft Job',
        description: 'Pending review',
        industry: 'Information Technology',
        type: JobType.PART_TIME,
        skills: [],
        quantity: 1,
        deadline: futureDeadline,
        status: JobStatus.PENDING_APPROVAL,
      });

      // B: PAUSED
      await jobRepo.create({
        companyId: verifiedCompanyId,
        branchId: 'branch-1',
        title: 'Paused Hiring',
        description: 'Temporarily on hold',
        industry: 'Information Technology',
        type: JobType.PART_TIME,
        skills: [],
        quantity: 1,
        deadline: futureDeadline,
        status: JobStatus.PAUSED,
      });

      // C: CLOSED
      await jobRepo.create({
        companyId: verifiedCompanyId,
        branchId: 'branch-1',
        title: 'Closed Position',
        description: 'Hiring completed',
        industry: 'Information Technology',
        type: JobType.PART_TIME,
        skills: [],
        quantity: 1,
        deadline: futureDeadline,
        status: JobStatus.CLOSED,
      });

      // D: EXPIRED (deadline in the past)
      await jobRepo.create({
        companyId: verifiedCompanyId,
        branchId: 'branch-1',
        title: 'Expired Position',
        description: 'Past deadline',
        industry: 'Information Technology',
        type: JobType.PART_TIME,
        skills: [],
        quantity: 1,
        deadline: pastDeadline,
        status: JobStatus.OPEN,
      });

      // E: Hidden by moderation
      await jobRepo.create({
        companyId: verifiedCompanyId,
        branchId: 'branch-1',
        title: 'Violating Post',
        description: 'Hidden post',
        industry: 'Information Technology',
        type: JobType.PART_TIME,
        skills: [],
        quantity: 1,
        deadline: futureDeadline,
        status: JobStatus.OPEN,
        hiddenByModeration: true,
      });
    });

    it('visibility rule: chỉ trả về tin OPEN, chưa hết hạn, không bị kiểm duyệt ẩn', async () => {
      const res = await searchUseCase.execute({});
      expect(res.total).toBe(3);
      expect(res.jobs.every((j) => j.status === JobStatus.OPEN)).toBe(true);
      expect(res.jobs.some((j) => j.title === 'Draft Job')).toBe(false);
      expect(res.jobs.some((j) => j.title === 'Paused Hiring')).toBe(false);
      expect(res.jobs.some((j) => j.title === 'Closed Position')).toBe(false);
      expect(res.jobs.some((j) => j.title === 'Expired Position')).toBe(false);
      expect(res.jobs.some((j) => j.title === 'Violating Post')).toBe(false);
    });

    it('bộ lọc từ khóa (keyword) khớp trong tiêu đề hoặc mô tả', async () => {
      const byTitle = await searchUseCase.execute({ keyword: 'Frontend' });
      expect(byTitle.total).toBe(1);
      expect(byTitle.jobs[0].title).toBe('Senior Frontend Developer');

      const byDesc = await searchUseCase.execute({ keyword: 'marketing content' });
      expect(byDesc.total).toBe(1);
      expect(byDesc.jobs[0].title).toBe('Content Creator Intern');
    });

    it('bộ lọc ngành nghề (industry)', async () => {
      const res = await searchUseCase.execute({ industry: 'Marketing' });
      expect(res.total).toBe(1);
      expect(res.jobs[0].title).toBe('Content Creator Intern');
    });

    it('bộ lọc loại hình (type)', async () => {
      const res = await searchUseCase.execute({ type: JobType.INTERNSHIP });
      expect(res.total).toBe(1);
      expect(res.jobs[0].title).toBe('Backend Node.js Intern');
    });

    it('bộ lọc mức lương (salaryMin / salaryMax) bao gồm cả tin thỏa thuận', async () => {
      const res = await searchUseCase.execute({ salaryMin: 20000000 });
      // Senior Frontend (15m-25m) và Backend Node.js (thỏa thuận)
      expect(res.total).toBe(2);
      expect(res.jobs.map((j) => j.title)).toEqual(
        expect.arrayContaining(['Senior Frontend Developer', 'Backend Node.js Intern']),
      );
    });

    it('bộ lọc lịch làm việc (schedule)', async () => {
      const res = await searchUseCase.execute({ schedule: 'Morning' });
      expect(res.total).toBe(1);
      expect(res.jobs[0].title).toBe('Senior Frontend Developer');
    });

    it('kết hợp nhiều bộ lọc cùng lúc', async () => {
      const res = await searchUseCase.execute({
        keyword: 'NestJS',
        industry: 'Information Technology',
        type: JobType.INTERNSHIP,
      });
      expect(res.total).toBe(1);
      expect(res.jobs[0].title).toBe('Backend Node.js Intern');
    });

    it('phân trang ổn định: thứ tự sắp xếp theo createdAt desc, id desc không mất tin hay lặp trang', async () => {
      const page1 = await searchUseCase.execute({ page: 1, limit: 2 });
      expect(page1.jobs.length).toBe(2);
      expect(page1.total).toBe(3);
      expect(page1.totalPages).toBe(2);

      const page2 = await searchUseCase.execute({ page: 2, limit: 2 });
      expect(page2.jobs.length).toBe(1);

      // Đảm bảo không trùng lặp id giữa các trang
      const idsPage1 = page1.jobs.map((j) => j.id);
      const idsPage2 = page2.jobs.map((j) => j.id);
      expect(idsPage1).not.toContain(idsPage2[0]);
    });

    it('DTO công khai tuyệt đối không chứa trường nội bộ nhạy cảm', async () => {
      const res = await searchUseCase.execute({});
      for (const job of res.jobs) {
        expect((job as any).rejectionReason).toBeUndefined();
        expect((job as any).rejectedAt).toBeUndefined();
        expect((job as any).hiddenByModeration).toBeUndefined();
      }
    });
  });

  describe('GetPublicJobDetailUseCase (UC23 Detail & 404 Gates)', () => {
    it('trả về chi tiết tin tuyển dụng công khai khi thỏa mãn mọi điều kiện', async () => {
      const job = await jobRepo.create({
        companyId: verifiedCompanyId,
        branchId: 'branch-1',
        title: 'Public Valid Job',
        description: 'Details for everyone',
        industry: 'IT',
        type: JobType.PART_TIME,
        skills: ['CSS'],
        quantity: 1,
        deadline: futureDeadline,
        status: JobStatus.OPEN,
        rejectionReason: 'Old reason that should not leak',
        hiddenByModeration: false,
      });

      const res = await getDetailUseCase.execute(job.id);
      expect(res.job.id).toBe(job.id);
      expect(res.job.title).toBe('Public Valid Job');
      // Không để lộ trường kiểm duyệt/từ chối
      expect((res.job as any).rejectionReason).toBeUndefined();
      expect((res.job as any).rejectedAt).toBeUndefined();
      expect((res.job as any).hiddenByModeration).toBeUndefined();
    });

    it('trả về 404 NotFoundException khi tin không tồn tại', async () => {
      await expect(getDetailUseCase.execute('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('trả về 404 NotFoundException khi tin ở trạng thái PENDING_APPROVAL', async () => {
      const job = await jobRepo.create({
        companyId: verifiedCompanyId,
        branchId: 'branch-1',
        title: 'Pending Job',
        description: 'Desc',
        industry: 'IT',
        type: JobType.PART_TIME,
        skills: [],
        quantity: 1,
        deadline: futureDeadline,
        status: JobStatus.PENDING_APPROVAL,
      });

      await expect(getDetailUseCase.execute(job.id)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('trả về 404 NotFoundException khi tin bị tạm dừng PAUSED', async () => {
      const job = await jobRepo.create({
        companyId: verifiedCompanyId,
        branchId: 'branch-1',
        title: 'Paused Job',
        description: 'Desc',
        industry: 'IT',
        type: JobType.PART_TIME,
        skills: [],
        quantity: 1,
        deadline: futureDeadline,
        status: JobStatus.PAUSED,
      });

      await expect(getDetailUseCase.execute(job.id)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('trả về 404 NotFoundException khi tin đã hết hạn', async () => {
      const job = await jobRepo.create({
        companyId: verifiedCompanyId,
        branchId: 'branch-1',
        title: 'Expired Job',
        description: 'Desc',
        industry: 'IT',
        type: JobType.PART_TIME,
        skills: [],
        quantity: 1,
        deadline: pastDeadline,
        status: JobStatus.OPEN,
      });

      await expect(getDetailUseCase.execute(job.id)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('trả về 404 NotFoundException khi tin bị kiểm duyệt ẩn', async () => {
      const job = await jobRepo.create({
        companyId: verifiedCompanyId,
        branchId: 'branch-1',
        title: 'Hidden Job',
        description: 'Desc',
        industry: 'IT',
        type: JobType.PART_TIME,
        skills: [],
        quantity: 1,
        deadline: futureDeadline,
        status: JobStatus.OPEN,
        hiddenByModeration: true,
      });

      await expect(getDetailUseCase.execute(job.id)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
