import { Inject, Injectable } from '@nestjs/common';
import { PaginatedResponse, ReviewDto } from '@campusjob/contracts';
import {
  IReviewRepository,
  REVIEW_REPOSITORY_TOKEN,
} from '../../domain/repositories/review.repository.interface';
import { toReviewDto } from '../dto/review.mapper';

@Injectable()
export class ListMyReviewsUseCase {
  constructor(
    @Inject(REVIEW_REPOSITORY_TOKEN)
    private readonly repository: IReviewRepository,
  ) {}

  async execute(studentId: string, page: number, limit: number): Promise<PaginatedResponse<ReviewDto>> {
    const { items, total } = await this.repository.listByStudent(studentId, page, limit);
    const totalPages = Math.max(1, Math.ceil(total / limit));
    return {
      data: items.map(toReviewDto),
      meta: {
        page,
        limit,
        totalItems: total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }
}
