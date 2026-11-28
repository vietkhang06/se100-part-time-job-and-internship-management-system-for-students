import { DynamicModule, Module, Provider } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { M04Workflow } from './application/m04-workflow';
import {
  CvSnapshotSource, JobAccessSource, M04_CV_SOURCE, M04_JOB_SOURCE,
  M04_REPOSITORY, M04Repository,
} from './application/m04-ports';
import { PrismaM04Repository } from './infrastructure/prisma-m04.repository';
import { M04Controller } from './presentation/m04.controller';
import { PrismaM04EventDispatcher } from './infrastructure/m04-event-dispatcher';
import { ReviewsModule } from '../reviews/reviews.module';
import { ApplicationReviewSourceAdapter } from './infrastructure/application-review-source.adapter';
import { ReviewSourcesRegistry } from '../reviews/application/ports/review-sources.port';
import { SanctionsModule } from '../sanctions/sanctions.module';
import { ISanctionQuery, SANCTION_QUERY_TOKEN } from '../sanctions/application/ports/sanction-query.port';

export { M04_CV_SOURCE, M04_JOB_SOURCE, M04_REPOSITORY } from './application/m04-ports';

@Module({})
export class M04Module {
  /** M02/M03 provide their adapters without giving M04 access to owned persistence. */
  static register(cvSource: Provider, jobSource: Provider, repository?: Provider): DynamicModule {
    return {
      module: M04Module,
      imports: [AuthModule, NotificationsModule, ReviewsModule, SanctionsModule],
      controllers: [M04Controller],
      providers: [
        cvSource,
        jobSource,
        repository ?? { provide: M04_REPOSITORY, useClass: PrismaM04Repository },
        PrismaM04EventDispatcher,
        {
          provide: ApplicationReviewSourceAdapter,
          useFactory: (store: M04Repository, registry: ReviewSourcesRegistry) =>
            new ApplicationReviewSourceAdapter(store, registry),
          inject: [M04_REPOSITORY, ReviewSourcesRegistry],
        },
        {
          provide: M04Workflow,
          useFactory: (
            store: M04Repository,
            cvs: CvSnapshotSource,
            jobs: JobAccessSource,
            events: PrismaM04EventDispatcher,
            sanctions: ISanctionQuery,
          ) => new M04Workflow(store, cvs, jobs, () => new Date(), events, sanctions),
          inject: [M04_REPOSITORY, M04_CV_SOURCE, M04_JOB_SOURCE, PrismaM04EventDispatcher, SANCTION_QUERY_TOKEN],
        },
      ],
      exports: [M04Workflow],
    };
  }
}
