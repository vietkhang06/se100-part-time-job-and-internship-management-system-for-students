import { Test, TestingModule } from '@nestjs/testing';
import { JobsController } from './jobs.controller';
import { CreateJobPostingUseCase } from '../../application/use-cases/create-job-posting.use-case';
import { UpdateJobPostingUseCase } from '../../application/use-cases/update-job-posting.use-case';
import { ListEmployerJobsUseCase } from '../../application/use-cases/list-employer-jobs.use-case';
import { GetEmployerJobDetailUseCase } from '../../application/use-cases/get-employer-job-detail.use-case';
import { PauseJobPostingUseCase } from '../../application/use-cases/pause-job-posting.use-case';
import { ResumeJobPostingUseCase } from '../../application/use-cases/resume-job-posting.use-case';
import { CloseJobPostingUseCase } from '../../application/use-cases/close-job-posting.use-case';
import { SubmitJobPostingUseCase } from '../../application/use-cases/submit-job-posting.use-case';
import { JobStatus, JobType, UserRole } from '@campusjob/contracts';
import { ROLES_KEY } from '../../../../shared/decorators/roles.decorator';

describe('JobsController Presentation Tests', () => {
  let controller: JobsController;
  let createJobUseCase: jest.Mocked<Partial<CreateJobPostingUseCase>>;
  let updateJobUseCase: jest.Mocked<Partial<UpdateJobPostingUseCase>>;
  let listJobsUseCase: jest.Mocked<Partial<ListEmployerJobsUseCase>>;
  let getDetailUseCase: jest.Mocked<Partial<GetEmployerJobDetailUseCase>>;
  let pauseJobUseCase: jest.Mocked<Partial<PauseJobPostingUseCase>>;
  let resumeJobUseCase: jest.Mocked<Partial<ResumeJobPostingUseCase>>;
  let closeJobUseCase: jest.Mocked<Partial<CloseJobPostingUseCase>>;
  let submitJobUseCase: jest.Mocked<Partial<SubmitJobPostingUseCase>>;

  const mockJobDto = {
    id: 'job-123',
    companyId: 'comp-1',
    branchId: 'branch-1',
    title: 'Software Developer',
    description: 'Build web applications',
    industry: 'IT',
    type: JobType.FULL_TIME,
    skills: ['Node.js'],
    quantity: 1,
    salary: 'Thoả thuận',
    salaryMin: null,
    salaryMax: null,
    isSalaryNegotiable: true,
    schedule: null,
    benefits: null,
    deadline: new Date(Date.now() + 86400000).toISOString(),
    status: JobStatus.PENDING_APPROVAL,
    viewCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(async () => {
    createJobUseCase = { execute: jest.fn().mockResolvedValue({ job: mockJobDto }) };
    updateJobUseCase = { execute: jest.fn().mockResolvedValue({ job: mockJobDto }) };
    listJobsUseCase = {
      execute: jest.fn().mockResolvedValue({ jobs: [mockJobDto], total: 1, page: 1, limit: 20 }),
    };
    getDetailUseCase = { execute: jest.fn().mockResolvedValue({ job: mockJobDto }) };
    pauseJobUseCase = {
      execute: jest.fn().mockResolvedValue({ job: { ...mockJobDto, status: JobStatus.PAUSED } }),
    };
    resumeJobUseCase = {
      execute: jest.fn().mockResolvedValue({ job: { ...mockJobDto, status: JobStatus.OPEN } }),
    };
    closeJobUseCase = {
      execute: jest.fn().mockResolvedValue({ job: { ...mockJobDto, status: JobStatus.CLOSED } }),
    };
    submitJobUseCase = {
      execute: jest.fn().mockResolvedValue({
        message: 'Gửi thành công',
        job: mockJobDto,
        moderation: { itemId: 'item-1', round: 1, outcome: 'CREATED' },
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [JobsController],
      providers: [
        { provide: CreateJobPostingUseCase, useValue: createJobUseCase },
        { provide: UpdateJobPostingUseCase, useValue: updateJobUseCase },
        { provide: ListEmployerJobsUseCase, useValue: listJobsUseCase },
        { provide: GetEmployerJobDetailUseCase, useValue: getDetailUseCase },
        { provide: PauseJobPostingUseCase, useValue: pauseJobUseCase },
        { provide: ResumeJobPostingUseCase, useValue: resumeJobUseCase },
        { provide: CloseJobPostingUseCase, useValue: closeJobUseCase },
        { provide: SubmitJobPostingUseCase, useValue: submitJobUseCase },
      ],
    }).compile();

    controller = module.get<JobsController>(JobsController);
  });

  describe('Route Protection & Role Guarding', () => {
    it('should have class-level EMPLOYER role metadata', () => {
      const roles = Reflect.getMetadata(ROLES_KEY, JobsController);
      expect(roles).toBeDefined();
      expect(roles).toContain(UserRole.EMPLOYER);
    });
  });

  describe('CRUD & Lifecycle Actions', () => {
    it('create should invoke CreateJobPostingUseCase', async () => {
      const res = await controller.create('user-1', {
        branchId: 'branch-1',
        title: 'Software Developer',
        description: 'Build web applications',
        industry: 'IT',
        type: JobType.FULL_TIME,
        skills: ['Node.js'],
        quantity: 1,
        deadline: new Date(Date.now() + 86400000).toISOString(),
      });
      expect(createJobUseCase.execute).toHaveBeenCalledWith('user-1', expect.any(Object));
      expect(res.job.id).toBe('job-123');
    });

    it('list should invoke ListEmployerJobsUseCase', async () => {
      const res = await controller.list('user-1', { page: 1, limit: 10 });
      expect(listJobsUseCase.execute).toHaveBeenCalledWith('user-1', { page: 1, limit: 10 });
      expect(res.jobs.length).toBe(1);
    });

    it('getDetail should invoke GetEmployerJobDetailUseCase', async () => {
      const res = await controller.getDetail('user-1', 'job-123');
      expect(getDetailUseCase.execute).toHaveBeenCalledWith('user-1', 'job-123');
      expect(res.job.id).toBe('job-123');
    });

    it('update should invoke UpdateJobPostingUseCase', async () => {
      const res = await controller.update('user-1', 'job-123', { title: 'New Title' });
      expect(updateJobUseCase.execute).toHaveBeenCalledWith('user-1', 'job-123', { title: 'New Title' });
      expect(res.job.id).toBe('job-123');
    });

    it('submit should invoke SubmitJobPostingUseCase', async () => {
      const res = await controller.submit('user-1', 'job-123');
      expect(submitJobUseCase.execute).toHaveBeenCalledWith('user-1', 'job-123');
      expect(res.moderation.outcome).toBe('CREATED');
    });

    it('pause should invoke PauseJobPostingUseCase', async () => {
      const res = await controller.pause('user-1', 'job-123');
      expect(pauseJobUseCase.execute).toHaveBeenCalledWith('user-1', 'job-123');
      expect(res.job.status).toBe(JobStatus.PAUSED);
    });

    it('resume should invoke ResumeJobPostingUseCase', async () => {
      const res = await controller.resume('user-1', 'job-123');
      expect(resumeJobUseCase.execute).toHaveBeenCalledWith('user-1', 'job-123');
      expect(res.job.status).toBe(JobStatus.OPEN);
    });

    it('close should invoke CloseJobPostingUseCase', async () => {
      const res = await controller.close('user-1', 'job-123');
      expect(closeJobUseCase.execute).toHaveBeenCalledWith('user-1', 'job-123');
      expect(res.job.status).toBe(JobStatus.CLOSED);
    });
  });
});
