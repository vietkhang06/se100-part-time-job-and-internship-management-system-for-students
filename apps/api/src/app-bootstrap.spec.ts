import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from './app.module';
import { M04Workflow } from './modules/applications/application/m04-workflow';
import { JobAccessSourceAdapter } from '../src/modules/companies/infrastructure/adapters/job-access-source.adapter';
import { CvSnapshotSourceAdapter } from '../src/modules/students/infrastructure/adapters/cv-snapshot-source.adapter';
import { ReviewSourcesRegistry } from './modules/reviews/application/ports/review-sources.port';
import { CompaniesModule } from './modules/companies/companies.module';
import { CompaniesController } from './modules/companies/presentation/controllers/companies.controller';
import { CompanyBranchesController } from './modules/companies/presentation/controllers/company-branches.controller';
import { CompanyDirectoryAdapter } from './modules/companies/infrastructure/adapters/company-directory.adapter';
import { MODULE_METADATA } from '@nestjs/common/constants';

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

  it('đăng ký đường dẫn chi nhánh trước /companies/:id', () => {
    const controllers = Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, CompaniesModule) as unknown[];
    expect(controllers.indexOf(CompanyBranchesController)).toBeLessThan(controllers.indexOf(CompaniesController));
  });

  it('nối nguồn doanh nghiệp thật vào module đánh giá', () => {
    // compile() constructs providers but does not invoke Nest lifecycle hooks.
    moduleRef.get(CompaniesModule).onModuleInit();
    const sources = moduleRef.get(ReviewSourcesRegistry);
    expect(sources.getCompanyDirectory()).toBeInstanceOf(CompanyDirectoryAdapter);
  });
});
