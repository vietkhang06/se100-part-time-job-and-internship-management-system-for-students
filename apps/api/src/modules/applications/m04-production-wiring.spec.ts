import { Test } from '@nestjs/testing';
import { AppModule } from '../../app.module';
import { PrismaService } from '../../shared/database/prisma.service';
import { CvSnapshotSourceAdapter } from '../students/infrastructure/adapters/cv-snapshot-source.adapter';
import { JobAccessSourceAdapter } from '../companies/infrastructure/adapters/job-access-source.adapter';
import { M04Workflow } from './application/m04-workflow';
import { M04_CV_SOURCE, M04_JOB_SOURCE } from './application/m04-ports';

describe('S5-M04-01 production wiring', () => {
  it('resolves M04 through AppModule with the real M02 and M03 adapters', async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();

    expect(module.get(M04Workflow)).toBeInstanceOf(M04Workflow);
    expect(module.get(CvSnapshotSourceAdapter)).toBeInstanceOf(CvSnapshotSourceAdapter);
    expect(module.get(JobAccessSourceAdapter)).toBeInstanceOf(JobAccessSourceAdapter);
    expect(typeof module.get(M04_CV_SOURCE).getOwnedSnapshot).toBe('function');
    expect(typeof module.get(M04_JOB_SOURCE).getApplicationContext).toBe('function');
    await module.close();
  });
});
