import { Test, TestingModule } from '@nestjs/testing';
import { PublicCompaniesController } from './public-companies.controller';
import { SearchPublicCompaniesUseCase } from '../../application/use-cases/search-public-companies.use-case';
import { GetPublicCompanyDetailUseCase } from '../../application/use-cases/get-public-company-detail.use-case';
import { IS_PUBLIC_KEY } from '../../../../shared/decorators/public.decorator';

describe('PublicCompaniesController', () => {
  let controller: PublicCompaniesController;
  let searchUseCase: jest.Mocked<Partial<SearchPublicCompaniesUseCase>>;
  let getDetailUseCase: jest.Mocked<Partial<GetPublicCompanyDetailUseCase>>;

  const mockCompanyDto = {
    id: 'comp-1',
    name: 'Tech Corp',
    legalName: 'Tech Corporation',
    industry: 'IT',
    description: 'A great company',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockDetailDto = {
    ...mockCompanyDto,
    branches: [],
    activeJobs: [],
    reviewSummary: null,
  };

  beforeEach(async () => {
    searchUseCase = {
      execute: jest.fn().mockResolvedValue({
        companies: [mockCompanyDto],
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      }),
    };

    getDetailUseCase = {
      execute: jest.fn().mockResolvedValue({
        company: mockDetailDto,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PublicCompaniesController],
      providers: [
        { provide: SearchPublicCompaniesUseCase, useValue: searchUseCase },
        { provide: GetPublicCompanyDetailUseCase, useValue: getDetailUseCase },
      ],
    }).compile();

    controller = module.get<PublicCompaniesController>(PublicCompaniesController);
  });

  it('cả 2 endpoint search và getDetail đều được gắn metadata @Public()', () => {
    const isSearchPublic = Reflect.getMetadata(
      IS_PUBLIC_KEY,
      PublicCompaniesController.prototype.search,
    );
    const isDetailPublic = Reflect.getMetadata(
      IS_PUBLIC_KEY,
      PublicCompaniesController.prototype.getDetail,
    );

    expect(isSearchPublic).toBe(true);
    expect(isDetailPublic).toBe(true);
  });

  it('search() gọi đúng SearchPublicCompaniesUseCase', async () => {
    const query = { keyword: 'Tech', page: 1, limit: 10 };
    const res = await controller.search(query);

    expect(searchUseCase.execute).toHaveBeenCalledWith(query);
    expect(res.total).toBe(1);
    expect(res.companies[0].name).toBe('Tech Corp');
  });

  it('getDetail() gọi đúng GetPublicCompanyDetailUseCase', async () => {
    const res = await controller.getDetail('comp-1');

    expect(getDetailUseCase.execute).toHaveBeenCalledWith('comp-1');
    expect(res.company.id).toBe('comp-1');
  });
});
