import { NotFoundException } from '@nestjs/common';
import { JobStatus, JobType } from '@campusjob/contracts';
import { SaveJobUseCase } from './save-job.use-case';
import { UnsaveJobUseCase } from './unsave-job.use-case';
import { ListSavedJobsUseCase } from './list-saved-jobs.use-case';
import { GetSavedJobIdsUseCase } from './get-saved-job-ids.use-case';
import { InMemoryJobPostingRepository } from '../../infrastructure/persistence/in-memory-job-posting.repository';
import { InMemorySavedJobRepository } from '../../infrastructure/persistence/in-memory-saved-job.repository';
import { JobPostingEntity } from '../../domain/entities/job-posting.entity';

describe('Saved Jobs Use Cases (S3-M03-03, S5-M03-05 / UC28–UC29)', () => {
  let jobRepo: InMemoryJobPostingRepository;
  let savedJobRepo: InMemorySavedJobRepository;
  let saveUseCase: SaveJobUseCase;
  let unsaveUseCase: UnsaveJobUseCase;
  let listUseCase: ListSavedJobsUseCase;
  let getIdsUseCase: GetSavedJobIdsUseCase;

  const studentA = 'student-uuid-aaa';
  const studentB = 'student-uuid-bbb';

  let publicJob: JobPostingEntity;
  let closedJob: JobPostingEntity;
  let expiredJob: JobPostingEntity;
  let hiddenJob: JobPostingEntity;

  beforeEach(async () => {
    jobRepo = new InMemoryJobPostingRepository();
    savedJobRepo = new InMemorySavedJobRepository(jobRepo);

    saveUseCase = new SaveJobUseCase(jobRepo, savedJobRepo);
    unsaveUseCase = new UnsaveJobUseCase(savedJobRepo);
    listUseCase = new ListSavedJobsUseCase(savedJobRepo);
    getIdsUseCase = new GetSavedJobIdsUseCase(savedJobRepo);

    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000);

    publicJob = await jobRepo.create({
      companyId: 'comp-1',
      branchId: 'branch-1',
      title: 'Senior TypeScript Developer',
      description: 'Public job description',
      industry: 'Software',
      type: JobType.FULL_TIME,
      skills: ['TypeScript', 'NestJS'],
      quantity: 2,
      isSalaryNegotiable: true,
      deadline: future,
      status: JobStatus.OPEN,
    });

    closedJob = await jobRepo.create({
      companyId: 'comp-1',
      branchId: 'branch-1',
      title: 'Closed Position',
      description: 'Closed',
      industry: 'Software',
      type: JobType.PART_TIME,
      skills: ['SQL'],
      quantity: 1,
      isSalaryNegotiable: true,
      deadline: future,
      status: JobStatus.CLOSED,
    });

    expiredJob = await jobRepo.create({
      companyId: 'comp-1',
      branchId: 'branch-1',
      title: 'Expired Position',
      description: 'Expired',
      industry: 'Software',
      type: JobType.INTERNSHIP,
      skills: ['Node.js'],
      quantity: 1,
      isSalaryNegotiable: true,
      deadline: past,
      status: JobStatus.OPEN,
    });

    hiddenJob = await jobRepo.create({
      companyId: 'comp-1',
      branchId: 'branch-1',
      title: 'Hidden Position',
      description: 'Hidden',
      industry: 'Software',
      type: JobType.FULL_TIME,
      skills: ['Security'],
      quantity: 1,
      isSalaryNegotiable: true,
      deadline: future,
      status: JobStatus.OPEN,
      hiddenByModeration: true,
    });
  });

  describe('SaveJobUseCase (UC28)', () => {
    it('lưu thành công một tin tuyển dụng đang công khai', async () => {
      const res = await saveUseCase.execute(studentA, publicJob.id);
      expect(res.saved).toBe(true);
      expect(res.savedJobId).toBeDefined();

      const isSaved = await savedJobRepo.isSaved(studentA, publicJob.id);
      expect(isSaved).toBe(true);
    });

    it('idempotent: lưu 2 lần liên tiếp vẫn thành công và không tạo bản ghi trùng', async () => {
      const res1 = await saveUseCase.execute(studentA, publicJob.id);
      const res2 = await saveUseCase.execute(studentA, publicJob.id);

      expect(res1.saved).toBe(true);
      expect(res2.saved).toBe(true);
      expect(res2.savedJobId).toBe(res1.savedJobId);

      const count = await savedJobRepo.countByJobId(publicJob.id);
      expect(count).toBe(1);
    });

    it('từ chối 404 khi lưu tin không tồn tại', async () => {
      await expect(
        saveUseCase.execute(studentA, 'non-existent-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('từ chối 404 khi lưu tin CLOSED', async () => {
      await expect(saveUseCase.execute(studentA, closedJob.id)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('từ chối 404 khi lưu tin đã hết hạn (expired)', async () => {
      await expect(saveUseCase.execute(studentA, expiredJob.id)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('từ chối 404 khi lưu tin bị ẩn bởi kiểm duyệt (hiddenByModeration)', async () => {
      await expect(saveUseCase.execute(studentA, hiddenJob.id)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('UnsaveJobUseCase (UC29)', () => {
    it('bỏ lưu tin đã lưu trước đó thành công', async () => {
      await saveUseCase.execute(studentA, publicJob.id);
      expect(await savedJobRepo.isSaved(studentA, publicJob.id)).toBe(true);

      const res = await unsaveUseCase.execute(studentA, publicJob.id);
      expect(res.saved).toBe(false);
      expect(await savedJobRepo.isSaved(studentA, publicJob.id)).toBe(false);
    });

    it('idempotent: bỏ lưu tin chưa lưu trả về thành công không lỗi', async () => {
      const res = await unsaveUseCase.execute(studentA, 'some-unSaved-id');
      expect(res.saved).toBe(false);
    });

    it('bỏ lưu của sinh viên A không ảnh hưởng tới trạng thái đã lưu của sinh viên B', async () => {
      await saveUseCase.execute(studentA, publicJob.id);
      await saveUseCase.execute(studentB, publicJob.id);

      await unsaveUseCase.execute(studentA, publicJob.id);

      expect(await savedJobRepo.isSaved(studentA, publicJob.id)).toBe(false);
      expect(await savedJobRepo.isSaved(studentB, publicJob.id)).toBe(true);
    });
  });

  describe('ListSavedJobsUseCase & GetSavedJobIdsUseCase', () => {
    it('chỉ trả về danh sách việc làm đã lưu của chính sinh viên đang đăng nhập', async () => {
      await saveUseCase.execute(studentA, publicJob.id);

      const listA = await listUseCase.execute(studentA);
      const listB = await listUseCase.execute(studentB);

      expect(listA.total).toBe(1);
      expect(listA.savedJobs[0].job?.id).toBe(publicJob.id);
      expect(listB.total).toBe(0);
      expect(listB.savedJobs).toHaveLength(0);
    });

    it('trả về danh sách IDs đã lưu qua getSavedJobIds', async () => {
      await saveUseCase.execute(studentA, publicJob.id);

      const ids = await getIdsUseCase.execute(studentA);
      expect(ids.jobIds).toEqual([publicJob.id]);
    });

    it('khi tin tuyển dụng chuyển sang non-public, tin vẫn hiển thị với isAvailable=false và không rò rỉ thông tin kiểm duyệt', async () => {
      await saveUseCase.execute(studentA, publicJob.id);

      // Chuyển tin sang CLOSED
      await jobRepo.update(publicJob.id, {
        status: JobStatus.CLOSED,
        rejectionReason: 'Nội dung mật chỉ nội bộ',
        hiddenByModeration: true,
      });

      const list = await listUseCase.execute(studentA);
      expect(list.total).toBe(1);
      const item = list.savedJobs[0];

      expect(item.isAvailable).toBe(false);
      expect(item.job?.id).toBe(publicJob.id);
      // Đảm bảo không rò rỉ rejectionReason hay hiddenByModeration
      expect((item.job as any).rejectionReason).toBeUndefined();
      expect((item.job as any).hiddenByModeration).toBeUndefined();
    });
  });
});
