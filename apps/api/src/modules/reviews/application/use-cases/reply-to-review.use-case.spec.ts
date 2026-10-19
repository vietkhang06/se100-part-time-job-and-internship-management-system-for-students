import { ConflictException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ReviewVisibility } from '@campusjob/contracts';
import { ReplyToReviewUseCase } from './reply-to-review.use-case';
import { ReviewSourcesRegistry } from '../ports/review-sources.port';
import { ReviewEntity } from '../../domain/entities/review.entity';

const make = (over: Partial<ConstructorParameters<typeof ReviewEntity>[0]> = {}) =>
  new ReviewEntity({
    id: 'r1', applicationId: 'a1', studentId: 'stu1', companyId: 'c1', rating: 4, comment: null,
    visibility: ReviewVisibility.VISIBLE, createdAt: new Date(), reply: null, ...over,
  });

describe('ReplyToReviewUseCase', () => {
  let repo: { findById: jest.Mock; createReply: jest.Mock };
  let sources: ReviewSourcesRegistry;
  let companies: { findByEmployer: jest.Mock; findByJob: jest.Mock };
  let useCase: ReplyToReviewUseCase;

  beforeEach(() => {
    repo = { findById: jest.fn().mockResolvedValue(make()), createReply: jest.fn().mockResolvedValue({ created: true }) };
    sources = new ReviewSourcesRegistry();
    companies = {
      findByEmployer: jest.fn().mockResolvedValue({ companyId: 'c1', companyName: 'ACME', ownerUserId: 'emp1' }),
      findByJob: jest.fn(),
    };
    sources.registerCompanyDirectory(companies);
    useCase = new ReplyToReviewUseCase(repo as any, sources);
  });

  it('lets the owning employer reply once and trims the content', async () => {
    repo.findById
      .mockResolvedValueOnce(make())
      .mockResolvedValueOnce(make({ reply: { employerId: 'emp1', content: 'Cảm ơn', createdAt: new Date() } }));

    const dto = await useCase.execute('emp1', 'r1', '  Cảm ơn  ');

    expect(repo.createReply).toHaveBeenCalledWith({ reviewId: 'r1', employerId: 'emp1', content: 'Cảm ơn' });
    expect(dto.reply?.content).toBe('Cảm ơn');
  });

  it('returns 409 when the review already has a reply', async () => {
    repo.findById.mockResolvedValue(make({ reply: { employerId: 'emp1', content: 'x', createdAt: new Date() } }));
    await expect(useCase.execute('emp1', 'r1', 'again')).rejects.toBeInstanceOf(ConflictException);
    expect(repo.createReply).not.toHaveBeenCalled();
  });

  it('returns 409 when two replies race and the unique constraint rejects the second', async () => {
    repo.createReply.mockResolvedValue({ created: false });
    await expect(useCase.execute('emp1', 'r1', 'hi')).rejects.toBeInstanceOf(ConflictException);
  });

  it('hides reviews of other companies behind 404', async () => {
    companies.findByEmployer.mockResolvedValue({ companyId: 'other', companyName: 'X', ownerUserId: 'emp2' });
    await expect(useCase.execute('emp2', 'r1', 'hi')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('treats hidden reviews as not found', async () => {
    repo.findById.mockResolvedValue(make({ visibility: ReviewVisibility.HIDDEN }));
    await expect(useCase.execute('emp1', 'r1', 'hi')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns 404 for unknown review and 503 when the company directory is missing', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(useCase.execute('emp1', 'r1', 'hi')).rejects.toBeInstanceOf(NotFoundException);
    useCase = new ReplyToReviewUseCase(repo as any, new ReviewSourcesRegistry());
    await expect(useCase.execute('emp1', 'r1', 'hi')).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
