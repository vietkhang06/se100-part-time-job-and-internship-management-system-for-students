import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from './app.module';
import { M04Workflow } from './modules/applications/application/m04-workflow';
import { JobAccessSourceAdapter } from '../src/modules/companies/infrastructure/adapters/job-access-source.adapter';
import { CvSnapshotSourceAdapter } from '../src/modules/students/infrastructure/adapters/cv-snapshot-source.adapter';

describe('AppModule Bootstrap & M04 DynamicModule Binding (S5-M03-02)', () => {
  let moduleRef: TestingModule;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
  });

  afterAll(async () => {
    if (moduleRef) {
      await moduleRef.close();
    }
  });

  it('phải compile thành công toàn bộ AppModule tích hợp M04Module an toàn', () => {
    expect(moduleRef).toBeDefined();
  });

  it('phải resolve được M04Workflow với real JobAccessSource và CvSnapshotSource adapters', () => {
    const workflow = moduleRef.get<M04Workflow>(M04Workflow);
    expect(workflow).toBeDefined();
  });

  it('phải resolve được JobAccessSourceAdapter từ CompaniesModule', () => {
    const jobSource = moduleRef.get<JobAccessSourceAdapter>(JobAccessSourceAdapter);
    expect(jobSource).toBeDefined();
  });

  it('phải resolve được CvSnapshotSourceAdapter từ StudentsModule', () => {
    const cvSource = moduleRef.get<CvSnapshotSourceAdapter>(CvSnapshotSourceAdapter);
    expect(cvSource).toBeDefined();
  });
});
