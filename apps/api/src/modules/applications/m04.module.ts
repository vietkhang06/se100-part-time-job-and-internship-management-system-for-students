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

export { M04_CV_SOURCE, M04_JOB_SOURCE, M04_REPOSITORY } from './application/m04-ports';

@Module({})
export class M04Module {
  /** M02/M03 provide their adapters without giving M04 access to owned persistence. */
  static register(cvSource: Provider, jobSource: Provider, repository?: Provider): DynamicModule {
    return {
      module: M04Module,
      imports: [AuthModule, NotificationsModule],
      controllers: [M04Controller],
      providers: [
        cvSource,
        jobSource,
        repository ?? { provide: M04_REPOSITORY, useClass: PrismaM04Repository },
        PrismaM04EventDispatcher,
        {
          provide: M04Workflow,
          useFactory: (
            store: M04Repository,
            cvs: CvSnapshotSource,
            jobs: JobAccessSource,
            events: PrismaM04EventDispatcher,
          ) => new M04Workflow(store, cvs, jobs, () => new Date(), events),
          inject: [M04_REPOSITORY, M04_CV_SOURCE, M04_JOB_SOURCE, PrismaM04EventDispatcher],
        },
      ],
      exports: [M04Workflow],
    };
  }
}
