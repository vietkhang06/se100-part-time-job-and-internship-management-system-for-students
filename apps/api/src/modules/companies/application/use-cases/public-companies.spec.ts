import { NotFoundException } from '@nestjs/common';
import {
  CompanyVerificationStatus,
  JobStatus,
  JobType,
} from '@campusjob/contracts';
import { SearchPublicCompaniesUseCase } from './search-public-companies.use-case';
import { GetPublicCompanyDetailUseCase } from './get-public-company-detail.use-case';
import { InMemoryCompanyRepository } from '../../infrastructure/persistence/in-memory-company.repository';
import { CompanyEntity } from '../../domain/entities/company.entity';
import { CompanyBranchEntity } from '../../domain/entities/company-branch.entity';
import { JobPostingEntity } from '../../domain/entities/job-posting.entity';

describe('Public Companies Use Cases (UC15–UC16 / S5-M03-04)', () => {
  let searchUseCase: SearchPublicCompaniesUseCase;
  let getDetailUseCase: GetPublicCompanyDetailUseCase;
  let companyRepo: InMemoryCompanyRepository;

  const verifiedCompany1 = new CompanyEntity({
    id: 'comp-1',
    name: 'FPT Software',
    taxId: '0101234567',
    industry: 'Information Technology',
    description: 'Leading software exporter in Vietnam',
    verificationStatus: CompanyVerificationStatus.VERIFIED,
  });

  const verifiedCompany2 = new CompanyEntity({
    id: 'comp-2',
    name: 'Vinamilk',
    taxId: '0301234567',
    industry: 'FMCG',
    description: 'Leading dairy company',
    verificationStatus: CompanyVerificationStatus.VERIFIED,
  });

  const pendingCompany = new CompanyEntity({
    id: 'comp-3',
    name: 'Startup Stealth',
    taxId: '0401234567',
    industry: 'AI',
    description: 'Secret project',
    verificationStatus: CompanyVerificationStatus.PENDING_REVIEW,
  });

  const rejectedCompany = new CompanyEntity({
    id: 'comp-4',
    name: 'Fake Business Corp',
    taxId: '0501234567',
    industry: 'Finance',
    description: 'Fraudulent records',
    verificationStatus: CompanyVerificationStatus.REJECTED,
  });

  beforeEach(async () => {
    companyRepo = new InMemoryCompanyRepository();
    searchUseCase = new SearchPublicCompaniesUseCase(companyRepo);
    getDetailUseCase = new GetPublicCompanyDetailUseCase(companyRepo);

    await companyRepo.save(verifiedCompany1);
    await companyRepo.save(verifiedCompany2);
    await companyRepo.save(pendingCompany);
    await companyRepo.save(rejectedCompany);
  });

  describe('SearchPublicCompaniesUseCase (UC15)', () => {
    it('chỉ trả về các doanh nghiệp có verificationStatus === VERIFIED', async () => {
      const res = await searchUseCase.execute({});
      expect(res.total).toBe(2);
      expect(res.companies.map((c) => c.id)).toEqual(
        expect.arrayContaining(['comp-1', 'comp-2']),
      );
      expect(res.companies.some((c) => c.id === 'comp-3')).toBe(false);
      expect(res.companies.some((c) => c.id === 'comp-4')).toBe(false);
    });

    it('tìm kiếm theo từ khóa (keyword) trong tên, ngành hoặc mô tả', async () => {
      const resName = await searchUseCase.execute({ keyword: 'FPT' });
      expect(resName.total).toBe(1);
      expect(resName.companies[0].name).toBe('FPT Software');

      const resDesc = await searchUseCase.execute({ keyword: 'dairy' });
      expect(resDesc.total).toBe(1);
      expect(resDesc.companies[0].name).toBe('Vinamilk');
    });

    it('lọc theo ngành nghề (industry)', async () => {
      const res = await searchUseCase.execute({ industry: 'Information Technology' });
      expect(res.total).toBe(1);
      expect(res.companies[0].name).toBe('FPT Software');
    });

    it('DTO công khai tuyệt đối không để lộ mã số thuế (taxId) hoặc giấy tờ nội bộ', async () => {
      const res = await searchUseCase.execute({});
      for (const comp of res.companies) {
        expect((comp as any).taxId).toBeUndefined();
        expect((comp as any).documents).toBeUndefined();
      }
    });

    it('phân trang ổn định không lặp và không mất dòng', async () => {
      const page1 = await searchUseCase.execute({ page: 1, limit: 1 });
      expect(page1.companies.length).toBe(1);
      expect(page1.total).toBe(2);
      expect(page1.totalPages).toBe(2);

      const page2 = await searchUseCase.execute({ page: 2, limit: 1 });
      expect(page2.companies.length).toBe(1);

      expect(page1.companies[0].id).not.toBe(page2.companies[0].id);
    });
  });

  describe('GetPublicCompanyDetailUseCase (UC16)', () => {
    it('trả về chi tiết doanh nghiệp công khai kèm chi nhánh và các tin tuyển dụng đang mở', async () => {
      // Mock findPublicById trả về chi nhánh và tin
      jest.spyOn(companyRepo, 'findPublicById').mockResolvedValueOnce({
        company: verifiedCompany1,
        branches: [
          new CompanyBranchEntity({
            id: 'b-1',
            companyId: verifiedCompany1.id,
            branchName: 'Headquarter',
            addressLine: 'Cau Giay',
            city: 'Hanoi',
            isHeadquarter: true,
          }),
        ],
        activeJobs: [
          new JobPostingEntity({
            id: 'j-1',
            companyId: verifiedCompany1.id,
            branchId: 'b-1',
            title: 'Frontend Intern',
            description: 'Learn and work',
            industry: 'IT',
            type: JobType.INTERNSHIP,
            skills: ['React'],
            quantity: 3,
            deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
            status: JobStatus.OPEN,
            viewCount: 10,
          }),
        ],
      });

      const res = await getDetailUseCase.execute('comp-1');

      expect(res.company.id).toBe('comp-1');
      expect(res.company.name).toBe('FPT Software');
      expect(res.company.branches.length).toBe(1);
      expect(res.company.branches[0].branchName).toBe('Headquarter');
      expect(res.company.activeJobs.length).toBe(1);
      expect(res.company.activeJobs[0].title).toBe('Frontend Intern');
      // Không để lộ taxId hay dữ liệu nhạy cảm
      expect((res.company as any).taxId).toBeUndefined();
      expect((res.company.activeJobs[0] as any).rejectionReason).toBeUndefined();
      // Review summary để null do C-18 là DRAFT
      expect(res.company.reviewSummary).toBeNull();
    });

    it('trả về 404 NotFoundException khi doanh nghiệp không tồn tại', async () => {
      await expect(getDetailUseCase.execute('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('trả về 404 NotFoundException khi doanh nghiệp chưa được duyệt (PENDING_REVIEW)', async () => {
      await expect(getDetailUseCase.execute('comp-3')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('trả về 404 NotFoundException khi doanh nghiệp bị từ chối (REJECTED)', async () => {
      await expect(getDetailUseCase.execute('comp-4')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
