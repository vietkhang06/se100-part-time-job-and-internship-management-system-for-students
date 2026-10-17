import { Inject, Injectable } from '@nestjs/common';
import { ModerationItemDto, PaginatedResponse } from '@campusjob/contracts';
import {
  IModerationRepository,
  MODERATION_REPOSITORY_TOKEN,
} from '../../domain/repositories/moderation.repository.interface';
import { ListModerationQueueQueryDto } from '../dto/moderation.dto';
import { toItemDto } from '../dto/moderation.mapper';

@Injectable()
export class ListModerationQueueUseCase {
  constructor(
    @Inject(MODERATION_REPOSITORY_TOKEN)
    private readonly repository: IModerationRepository,
  ) {}

  /** UC50 — hàng đợi theo thứ tự cũ nhất trước. */
  async execute(
    actorId: string,
    query: Pick<ListModerationQueueQueryDto, 'status' | 'targetType' | 'assignedToMe' | 'page' | 'limit'>,
  ): Promise<PaginatedResponse<ModerationItemDto>> {
    const { items, total } = await this.repository.list({
      status: query.status,
      targetType: query.targetType,
      assigneeId: query.assignedToMe ? actorId : undefined,
      page: query.page,
      limit: query.limit,
    });
    const totalPages = Math.max(1, Math.ceil(total / query.limit));
    return {
      data: items.map(toItemDto),
      meta: {
        page: query.page,
        limit: query.limit,
        totalItems: total,
        totalPages,
        hasNextPage: query.page < totalPages,
        hasPrevPage: query.page > 1,
      },
    };
  }
}
