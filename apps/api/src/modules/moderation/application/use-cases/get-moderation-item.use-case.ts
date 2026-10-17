import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ModerationItemDetailDto } from '@campusjob/contracts';
import {
  IModerationRepository,
  MODERATION_REPOSITORY_TOKEN,
} from '../../domain/repositories/moderation.repository.interface';
import { toItemDetailDto } from '../dto/moderation.mapper';

@Injectable()
export class GetModerationItemUseCase {
  constructor(
    @Inject(MODERATION_REPOSITORY_TOKEN)
    private readonly repository: IModerationRepository,
  ) {}

  async execute(id: string): Promise<ModerationItemDetailDto> {
    const found = await this.repository.findById(id);
    if (!found) {
      throw new NotFoundException({
        message: 'Không tìm thấy mục kiểm duyệt.',
        code: 'MODERATION_ITEM_NOT_FOUND',
      });
    }
    return toItemDetailDto(found.item, found.decisions);
  }
}
