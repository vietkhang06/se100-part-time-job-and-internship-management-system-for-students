import { Test, TestingModule } from '@nestjs/testing';
import { PublicJobsController } from './public-jobs.controller';
import { SearchPublicJobsUseCase } from '../../application/use-cases/search-public-jobs.use-case';
import { GetPublicJobDetailUseCase } from '../../application/use-cases/get-public-job-detail.use-case';
import { SaveJobUseCase } from '../../application/use-cases/save-job.use-case';
import { UnsaveJobUseCase } from '../../application/use-cases/unsave-job.use-case';
import { JobStatus, JobType } from '@campusjob/contracts';
import { IS_PUBLIC_KEY } from '../../../../shared/decorators/public.decorator';

describe('PublicJobsController', () => {
  let controller: PublicJobsController;
  let searchUseCase: jest.Mocked<Partial<SearchPublicJobsUseCase>>;
  let getDetailUseCase: jest.Mocked<Partial<GetPublicJobDetailUseCase>>;
  let saveJobUseCase: jest.Mocked<Partial<SaveJobUseCase>>;
  let unsaveJobUseCase: jest.Mocked<Partial<UnsaveJobUseCase>>;

  const mockJobDto = {
    id: 'job-1',
    companyId: 'comp-1',
    branchId: 'branch-1',
    title: 'Public Job',
    description: 'Desc',
    industry: 'IT',
    type: JobType.PART_TIME,
    skills: ['TS'],
    quantity: 1,
    isSalaryNegotiable: true,
    deadline: new Date().toISOString(),
    status: JobStatus.OPEN,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(async () => {
    searchUseCase = {
      execute: jest.fn().mockResolvedValue({
        jobs: [mockJobDto],
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      }),
    };

    getDetailUseCase = {
      execute: jest.fn().mockResolvedValue({
        job: mockJobDto,
      }),
    };

    saveJobUseCase = {
      execute: jest.fn().mockResolvedValue({
        message: 'Đã lưu tin tuyển dụng thành công.',
        saved: true,
        savedJobId: 'saved-1',
      }),
    };

    unsaveJobUseCase = {
      execute: jest.fn().mockResolvedValue({
        message: 'Đã bỏ lưu tin tuyển dụng thành công.',
        saved: false,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PublicJobsController],
      providers: [
        { provide: SearchPublicJobsUseCase, useValue: searchUseCase },
        { provide: GetPublicJobDetailUseCase, useValue: getDetailUseCase },
        { provide: SaveJobUseCase, useValue: saveJobUseCase },
        { provide: UnsaveJobUseCase, useValue: unsaveJobUseCase },
      ],
    }).compile();

    controller = module.get<PublicJobsController>(PublicJobsController);
  });

  it('cả 2 endpoint search và getDetail đều được gắn metadata @Public()', () => {
    const isSearchPublic = Reflect.getMetadata(
      IS_PUBLIC_KEY,
      PublicJobsController.prototype.search,
    );
    const isGetDetailPublic = Reflect.getMetadata(
      IS_PUBLIC_KEY,
      PublicJobsController.prototype.getDetail,
    );

    expect(isSearchPublic).toBe(true);
    expect(isGetDetailPublic).toBe(true);
  });

  it('search() chuyển tiếp query chính xác tới SearchPublicJobsUseCase', async () => {
    const query = { keyword: 'Frontend', page: 1, limit: 10 };
    const res = await controller.search(query);

    expect(searchUseCase.execute).toHaveBeenCalledWith(query);
    expect(res.total).toBe(1);
    expect(res.jobs[0].title).toBe('Public Job');
  });

  it('getDetail() gọi đúng GetPublicJobDetailUseCase với id', async () => {
    const res = await controller.getDetail('job-1');

    expect(getDetailUseCase.execute).toHaveBeenCalledWith('job-1', expect.anything());
    expect(res.job.id).toBe('job-1');
  });

  it('saveJob() gọi đúng SaveJobUseCase với studentId và jobId', async () => {
    const res = await controller.saveJob('job-1', 'student-1');
    expect(saveJobUseCase.execute).toHaveBeenCalledWith('student-1', 'job-1');
    expect(res.saved).toBe(true);
    expect(res.savedJobId).toBe('saved-1');
  });

  it('unsaveJob() gọi đúng UnsaveJobUseCase với studentId và jobId', async () => {
    const res = await controller.unsaveJob('job-1', 'student-1');
    expect(unsaveJobUseCase.execute).toHaveBeenCalledWith('student-1', 'job-1');
    expect(res.saved).toBe(false);
  });
});
