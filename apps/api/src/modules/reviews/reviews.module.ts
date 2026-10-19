import { Module, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { ModerationTargetType, ViolationTargetType } from '@campusjob/contracts';
import { DatabaseModule } from '../../shared/database/database.module';
import { ModerationModule } from '../moderation/moderation.module';
import { ReportsModule } from '../reports/reports.module';
import { ModerationTargetHandlerRegistry } from '../moderation/application/ports/moderation-target-handler.port';
import { ReportTargetResolverRegistry } from '../reports/application/ports/report-target-resolver.port';
import { ReviewsController } from './presentation/controllers/reviews.controller';
import { REVIEW_REPOSITORY_TOKEN } from './domain/repositories/review.repository.interface';
import { PrismaReviewRepository } from './infrastructure/persistence/prisma-review.repository';
import { ReviewSourcesRegistry } from './application/ports/review-sources.port';
import { CreateReviewUseCase } from './application/use-cases/create-review.use-case';
import { ListMyReviewsUseCase } from './application/use-cases/list-my-reviews.use-case';
import { ListCompanyReviewsUseCase } from './application/use-cases/list-company-reviews.use-case';
import { ListEmployerReviewsUseCase } from './application/use-cases/list-employer-reviews.use-case';
import { ReplyToReviewUseCase } from './application/use-cases/reply-to-review.use-case';
import { ReviewModerationTargetHandler } from './application/use-cases/review-moderation-target.handler';
import { ReviewReportTargetResolver } from './application/use-cases/review-report-target.resolver';

@Module({
  imports: [DatabaseModule, ModerationModule, ReportsModule],
  controllers: [ReviewsController],
  providers: [
    ReviewSourcesRegistry,
    CreateReviewUseCase,
    ListMyReviewsUseCase,
    ListCompanyReviewsUseCase,
    ListEmployerReviewsUseCase,
    ReplyToReviewUseCase,
    ReviewModerationTargetHandler,
    ReviewReportTargetResolver,
    { provide: REVIEW_REPOSITORY_TOKEN, useClass: PrismaReviewRepository },
  ],
  // M04 đăng ký IApplicationReviewSource, M03 đăng ký ICompanyDirectory qua ReviewSourcesRegistry.
  exports: [ReviewSourcesRegistry],
})
export class ReviewsModule implements OnModuleInit {
  constructor(private readonly moduleRef: ModuleRef) {}

  onModuleInit(): void {
    const handlers = this.moduleRef.get(ModerationTargetHandlerRegistry, { strict: false });
    handlers.register(ModerationTargetType.REVIEW, this.moduleRef.get(ReviewModerationTargetHandler));

    const resolvers = this.moduleRef.get(ReportTargetResolverRegistry, { strict: false });
    resolvers.register(ViolationTargetType.REVIEW, this.moduleRef.get(ReviewReportTargetResolver));
  }
}
