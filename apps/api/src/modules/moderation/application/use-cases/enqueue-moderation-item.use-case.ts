import { Inject, Injectable } from '@nestjs/common';
import {
  IModerationRepository,
  MODERATION_REPOSITORY_TOKEN,
} from '../../domain/repositories/moderation.repository.interface';
import {
  EnqueueModerationInput,
  EnqueueModerationResult,
  IModerationQueue,
} from '../ports/moderation-queue.port';

@Injectable()
export class EnqueueModerationItemUseCase implements IModerationQueue {
  constructor(
    @Inject(MODERATION_REPOSITORY_TOKEN)
    private readonly repository: IModerationRepository,
  ) {}

  async enqueue(input: EnqueueModerationInput): Promise<EnqueueModerationResult> {
    const { item, created } = await this.repository.enqueue({
      targetType: input.targetType,
      targetId: input.targetId,
      submitterId: input.submitterId ?? null,
      summary: input.summary ? input.summary.slice(0, 300) : null,
    });
    return {
      itemId: item.id,
      round: item.round,
      outcome: created ? 'CREATED' : 'ALREADY_PENDING',
    };
  }
}
