import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ModerationItemDto, UserRole } from '@campusjob/contracts';
import {
  IModerationRepository,
  MODERATION_REPOSITORY_TOKEN,
} from '../../domain/repositories/moderation.repository.interface';
import { toItemDto } from '../dto/moderation.mapper';

@Injectable()
export class ClaimModerationItemUseCase {
  constructor(
    @Inject(MODERATION_REPOSITORY_TOKEN)
    private readonly repository: IModerationRepository,
  ) {}

  /** Nhận xử lý một mục. Admin được nhận lại mục đang giao cho người khác. */
  async execute(id: string, actor: { id: string; role: UserRole }): Promise<ModerationItemDto> {
    const found = await this.repository.findById(id);
    if (!found) {
      throw new NotFoundException({
        message: 'Không tìm thấy mục kiểm duyệt.',
        code: 'MODERATION_ITEM_NOT_FOUND',
      });
    }
    if (!found.item.isPending()) {
      throw new ConflictException({
        message: 'Mục này đã được xử lý.',
        code: 'MODERATION_ALREADY_DECIDED',
      });
    }

    const claimed = await this.repository.claim(id, actor.id, new Date(), actor.role === UserRole.ADMIN);
    if (!claimed) {
      throw new ConflictException({
        message: 'Mục này đã được giao cho người kiểm duyệt khác.',
        code: 'MODERATION_ALREADY_ASSIGNED',
      });
    }
    return toItemDto(claimed);
  }
}
