import { DynamicModule, Module, Provider } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { M04Workflow } from './application/m04-workflow';
import { CvSnapshotSource, JobAccessSource, M04Repository } from './application/m04-ports';
import { PrismaM04Repository } from './infrastructure/prisma-m04.repository';
import { M04Controller } from './presentation/m04.controller';

export const M04_CV_SOURCE = Symbol('M04_CV_SOURCE');
export const M04_JOB_SOURCE = Symbol('M04_JOB_SOURCE');
export const M04_REPOSITORY = Symbol('M04_REPOSITORY');

@Module({})
export class M04Module {
  /** M02 and M03 supply their real adapters when their contracts are ready. */
  static register(cvSource: Provider, jobSource: Provider, repository?: Provider): DynamicModule {
    return {
      module: M04Module,
      imports: [AuthModule],
      controllers: [M04Controller],
      providers: [
        cvSource, jobSource,
        repository ?? { provide: M04_REPOSITORY, useClass: PrismaM04Repository },
        {
          provide: M04Workflow,
          useFactory: (store: M04Repository, cvs: CvSnapshotSource, jobs: JobAccessSource) =>
            new M04Workflow(store, cvs, jobs),
          inject: [M04_REPOSITORY, M04_CV_SOURCE, M04_JOB_SOURCE],
        },
      ],
      exports: [M04Workflow],
    };
  }
}
