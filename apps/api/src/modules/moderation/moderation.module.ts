import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../shared/database/database.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ModerationController } from './presentation/controllers/moderation.controller';
import { MODERATION_REPOSITORY_TOKEN } from './domain/repositories/moderation.repository.interface';
import { PrismaModerationRepository } from './infrastructure/persistence/prisma-moderation.repository';
import { MODERATION_QUEUE_TOKEN } from './application/ports/moderation-queue.port';
import { ModerationTargetHandlerRegistry } from './application/ports/moderation-target-handler.port';
import { EnqueueModerationItemUseCase } from './application/use-cases/enqueue-moderation-item.use-case';
import { ListModerationQueueUseCase } from './application/use-cases/list-moderation-queue.use-case';
import { GetModerationItemUseCase } from './application/use-cases/get-moderation-item.use-case';
import { ClaimModerationItemUseCase } from './application/use-cases/claim-moderation-item.use-case';
import { DecideModerationItemUseCase } from './application/use-cases/decide-moderation-item.use-case';
import { ResyncModerationDecisionsUseCase } from './application/use-cases/resync-moderation-decisions.use-case';

@Module({
  imports: [DatabaseModule, NotificationsModule],
  controllers: [ModerationController],
  providers: [
    ModerationTargetHandlerRegistry,
    EnqueueModerationItemUseCase,
    ListModerationQueueUseCase,
    GetModerationItemUseCase,
    ClaimModerationItemUseCase,
    DecideModerationItemUseCase,
    ResyncModerationDecisionsUseCase,
    { provide: MODERATION_REPOSITORY_TOKEN, useClass: PrismaModerationRepository },
    { provide: MODERATION_QUEUE_TOKEN, useExisting: EnqueueModerationItemUseCase },
  ],
  // M03 (JOB), M05-02 (REPORT), M05-03 (REVIEW): inject MODERATION_QUEUE_TOKEN để enqueue
  // và dùng ModerationTargetHandlerRegistry.register(...) trong onModuleInit để nhận quyết định.
  exports: [MODERATION_QUEUE_TOKEN, ModerationTargetHandlerRegistry, ResyncModerationDecisionsUseCase],
})
export class ModerationModule {}
