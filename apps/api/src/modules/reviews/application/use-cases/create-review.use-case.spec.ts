import { ConflictException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ReviewVisibility } from '@campusjob/contracts';
import { CreateReviewUseCase } from './create-review.use-case';
import { ReviewSourcesRegistry } from '../ports/review-sources.port';
import { ReviewEntity } from '../../domain/entities/review.entity';
import { IReviewRepository } from '../../domain/repositories/review.repository.interface';

const review = () =>
  new ReviewEntity({
    id: 'r1', applicationId: 'a1', studentId: 'stu1', companyId: 'c1', rating: 5, comment: 'Tốt',
    visibility: ReviewVisibility.VISIBLE, createdAt: new Date(), reply: null,
  });

describe('CreateReviewUseCase', () => {
  let repo: jest.Mocked<IReviewRepository>;
  let sources: ReviewSourcesRegistry;
  let applications: { getOwnedApplication: jest.Mock };
  let companies: { findByJob: jest.Mock; findByEmployer: jest.Mock };
  let useCase: CreateReviewUseCase;

  beforeEach(() => {
    repo = {
      create: jest.fn(), findById: jest.fn(), listByStudent: jest.fn(), listVisibleByCompany: jest.fn(),
      summarizeVisibleByCompany: jest.fn(), createReply: jest.fn(), setVisibility: jest.fn(),
    };
    sources = new ReviewSourcesRegistry();
    applications = {
      getOwnedApplication: jest.fn().mockResolvedValue({ applicationId: 'a1', jobId: 'j1', status: 'ACCEPTED' }),
    };
    companies = {
      findByJob: jest.fn().mockResolvedValue({ companyId: 'c1', companyName: 'ACME', ownerUserId: 'emp1' }),
      findByEmployer: jest.fn(),
    };
    sources.registerApplicationSource(applications);
    sources.registerCompanyDirectory(companies);
    useCase = new CreateReviewUseCase(repo, sources);
  });

  const input = (over = {}) => ({ applicationId: 'a1', rating: 5, comment: '  Tốt  ', ...over });

  it('creates a review for a finished application and trims the comment', async () => {
    repo.create.mockResolvedValue({ review: review(), duplicate: false });

    const dto = await useCase.execute('stu1', input());

    expect(repo.create).toHaveBeenCalledWith({
      applicationId: 'a1', studentId: 'stu1', companyId: 'c1', rating: 5, comment: 'Tốt',
    });
    expect(dto.id).toBe('r1');
  });

  it('stores an empty comment as null', async () => {
    repo.create.mockResolvedValue({ review: review(), duplicate: false });
    await useCase.execute('stu1', input({ comment: '   ' }));
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ comment: null }));
  });

  it('fails closed (503) when M03/M04 adapters are not registered', async () => {
    useCase = new CreateReviewUseCase(repo, new ReviewSourcesRegistry());
    await expect(useCase.execute('stu1', input())).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('returns 404 for an application that is not the student\'s', async () => {
    applications.getOwnedApplication.mockResolvedValue(null);
    await expect(useCase.execute('stu1', input())).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects applications that are not at a final status', async () => {
    for (const status of ['SUBMITTED', 'REVIEWING', 'INTERVIEW_SCHEDULED', 'WITHDRAWN']) {
      applications.getOwnedApplication.mockResolvedValue({ applicationId: 'a1', jobId: 'j1', status });
      await expect(useCase.execute('stu1', input())).rejects.toBeInstanceOf(ConflictException);
    }
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('returns 404 when the job has no company', async () => {
    companies.findByJob.mockResolvedValue(null);
    await expect(useCase.execute('stu1', input())).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns 409 when the application already has a review', async () => {
    repo.create.mockResolvedValue({ review: null, duplicate: true });
    await expect(useCase.execute('stu1', input())).rejects.toBeInstanceOf(ConflictException);
  });
});
