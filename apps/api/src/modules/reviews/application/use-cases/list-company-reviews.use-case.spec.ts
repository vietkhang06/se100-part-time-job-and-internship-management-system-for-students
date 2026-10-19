import { ReviewVisibility } from '@campusjob/contracts';
import { ListCompanyReviewsUseCase } from './list-company-reviews.use-case';
import { ReviewEntity } from '../../domain/entities/review.entity';

const make = (id: string) =>
  new ReviewEntity({
    id, applicationId: 'a' + id, studentId: 'secret-student', companyId: 'c1', rating: 5, comment: 'ok',
    visibility: ReviewVisibility.VISIBLE, createdAt: new Date(), reply: null,
  });

describe('ListCompanyReviewsUseCase', () => {
  it('returns anonymous public data with a rounded average and pagination', async () => {
    const repo = {
      listVisibleByCompany: jest.fn().mockResolvedValue({ items: [make('1')], total: 3 }),
      summarizeVisibleByCompany: jest.fn().mockResolvedValue({
        averageRating: 4.3333, totalReviews: 3, distribution: { '1': 0, '2': 0, '3': 1, '4': 0, '5': 2 },
      }),
    };
    const result = await new ListCompanyReviewsUseCase(repo as any).execute('c1', 1, 2);

    expect(result.summary.averageRating).toBe(4.3);
    expect(result.meta.totalPages).toBe(2);
    expect(result.meta.hasNextPage).toBe(true);
    expect(JSON.stringify(result)).not.toContain('secret-student');
    expect(JSON.stringify(result)).not.toContain('studentId');
  });

  it('reports a null average when there are no reviews', async () => {
    const repo = {
      listVisibleByCompany: jest.fn().mockResolvedValue({ items: [], total: 0 }),
      summarizeVisibleByCompany: jest.fn().mockResolvedValue({
        averageRating: null, totalReviews: 0, distribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
      }),
    };
    const result = await new ListCompanyReviewsUseCase(repo as any).execute('c1', 1, 10);
    expect(result.summary.averageRating).toBeNull();
    expect(result.meta.totalPages).toBe(1);
  });
});
