import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { JobType } from '@campusjob/contracts';
import { CreateJobPostingDto } from './create-job-posting.dto';
import { UpdateJobPostingDto } from './update-job-posting.dto';

describe('F3 & FR-08: Job Posting DTO Validation Tests', () => {
  function toCreateDto(plain: Record<string, any>): CreateJobPostingDto {
    return plainToInstance(CreateJobPostingDto, plain);
  }

  function toUpdateDto(plain: Record<string, any>): UpdateJobPostingDto {
    return plainToInstance(UpdateJobPostingDto, plain);
  }

  const validPayload = {
    branchId: 'branch-uuid-1',
    title: 'Thực tập sinh Lập trình Web Fullstack',
    description: 'Tham gia phát triển hệ thống quản lý tin tuyển dụng với NestJS và React.',
    industry: 'Công nghệ thông tin',
    type: JobType.INTERNSHIP,
    skills: ['TypeScript', 'NestJS', 'React', 'PostgreSQL'],
    quantity: 3,
    salary: '5.000.000 - 8.000.000 VND',
    salaryMin: 5000000,
    salaryMax: 8000000,
    isSalaryNegotiable: false,
    schedule: 'Thứ 2 đến Thứ 6 (Linh hoạt theo lịch học)',
    benefits: 'Hỗ trợ dấu thực tập, phụ cấp ăn trưa và gửi xe.',
    deadline: new Date(Date.now() + 30 * 86400000).toISOString(),
  };

  describe('CreateJobPostingDto (FR-08 field by field validation)', () => {
    it('chấp nhận payload hợp lệ với đầy đủ các trường schema FR-08', async () => {
      const dto = toCreateDto(validPayload);
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('FR-08 branch: từ chối nếu branchId rỗng hoặc không phải chuỗi', async () => {
      const dtoMissing = toCreateDto({ ...validPayload, branchId: undefined });
      const errorsMissing = await validate(dtoMissing);
      expect(errorsMissing.some((e) => e.property === 'branchId')).toBe(true);

      const dtoEmpty = toCreateDto({ ...validPayload, branchId: '' });
      const errorsEmpty = await validate(dtoEmpty);
      expect(errorsEmpty.some((e) => e.property === 'branchId')).toBe(true);
    });

    it('FR-08 title: từ chối nếu title rỗng, quá ngắn (<3) hoặc vượt quá 255 ký tự', async () => {
      const dtoShort = toCreateDto({ ...validPayload, title: 'AB' });
      const errorsShort = await validate(dtoShort);
      expect(errorsShort.some((e) => e.property === 'title')).toBe(true);

      const dtoLong = toCreateDto({ ...validPayload, title: 'A'.repeat(256) });
      const errorsLong = await validate(dtoLong);
      expect(errorsLong.some((e) => e.property === 'title')).toBe(true);

      const dtoMissing = toCreateDto({ ...validPayload, title: undefined });
      const errorsMissing = await validate(dtoMissing);
      expect(errorsMissing.some((e) => e.property === 'title')).toBe(true);
    });

    it('FR-08 description: từ chối nếu description rỗng hoặc quá ngắn (<10)', async () => {
      const dtoShort = toCreateDto({ ...validPayload, description: 'Ngắn' });
      const errorsShort = await validate(dtoShort);
      expect(errorsShort.some((e) => e.property === 'description')).toBe(true);

      const dtoMissing = toCreateDto({ ...validPayload, description: undefined });
      const errorsMissing = await validate(dtoMissing);
      expect(errorsMissing.some((e) => e.property === 'description')).toBe(true);
    });

    it('FR-08 industry: từ chối nếu industry rỗng', async () => {
      const dtoMissing = toCreateDto({ ...validPayload, industry: undefined });
      const errorsMissing = await validate(dtoMissing);
      expect(errorsMissing.some((e) => e.property === 'industry')).toBe(true);

      const dtoEmpty = toCreateDto({ ...validPayload, industry: '' });
      const errorsEmpty = await validate(dtoEmpty);
      expect(errorsEmpty.some((e) => e.property === 'industry')).toBe(true);
    });

    it('FR-08 type: từ chối nếu type không thuộc JobType enum (PART_TIME, INTERNSHIP, FULL_TIME)', async () => {
      const dtoInvalid = toCreateDto({ ...validPayload, type: 'FREELANCE' });
      const errorsInvalid = await validate(dtoInvalid);
      expect(errorsInvalid.some((e) => e.property === 'type')).toBe(true);

      const dtoMissing = toCreateDto({ ...validPayload, type: undefined });
      const errorsMissing = await validate(dtoMissing);
      expect(errorsMissing.some((e) => e.property === 'type')).toBe(true);
    });

    it('FR-08 skills: từ chối nếu skills không phải danh sách hoặc chứa phần tử không phải chuỗi', async () => {
      const dtoInvalid = toCreateDto({ ...validPayload, skills: 'TypeScript' as any });
      const errorsInvalid = await validate(dtoInvalid);
      expect(errorsInvalid.some((e) => e.property === 'skills')).toBe(true);

      const dtoNonString = toCreateDto({ ...validPayload, skills: [123, 456] as any });
      const errorsNonString = await validate(dtoNonString);
      expect(errorsNonString.some((e) => e.property === 'skills')).toBe(true);
    });

    it('FR-08 quantity: từ chối nếu quantity không phải số nguyên hoặc nhỏ hơn 1', async () => {
      const dtoZero = toCreateDto({ ...validPayload, quantity: 0 });
      const errorsZero = await validate(dtoZero);
      expect(errorsZero.some((e) => e.property === 'quantity')).toBe(true);

      const dtoNegative = toCreateDto({ ...validPayload, quantity: -2 });
      const errorsNegative = await validate(dtoNegative);
      expect(errorsNegative.some((e) => e.property === 'quantity')).toBe(true);

      const dtoFloat = toCreateDto({ ...validPayload, quantity: 1.5 });
      const errorsFloat = await validate(dtoFloat);
      expect(errorsFloat.some((e) => e.property === 'quantity')).toBe(true);
    });

    it('FR-08 salary: chấp nhận salary text hợp lệ hoặc null/undefined', async () => {
      const dtoNull = toCreateDto({ ...validPayload, salary: null });
      const errorsNull = await validate(dtoNull);
      expect(errorsNull.length).toBe(0);

      const dtoUndefined = toCreateDto({ ...validPayload, salary: undefined });
      const errorsUndefined = await validate(dtoUndefined);
      expect(errorsUndefined.length).toBe(0);
    });

    it('FR-08 salaryMin/Max: từ chối nếu âm hoặc không phải số', async () => {
      const dtoNegativeMin = toCreateDto({ ...validPayload, salaryMin: -1000 });
      const errorsNegativeMin = await validate(dtoNegativeMin);
      expect(errorsNegativeMin.some((e) => e.property === 'salaryMin')).toBe(true);

      const dtoNegativeMax = toCreateDto({ ...validPayload, salaryMax: -5000 });
      const errorsNegativeMax = await validate(dtoNegativeMax);
      expect(errorsNegativeMax.some((e) => e.property === 'salaryMax')).toBe(true);
    });

    it('FR-08 schedule: chấp nhận schedule chuỗi hoặc optional', async () => {
      const dtoNull = toCreateDto({ ...validPayload, schedule: null });
      const errorsNull = await validate(dtoNull);
      expect(errorsNull.length).toBe(0);
    });

    it('FR-08 benefits: chấp nhận benefits chuỗi hoặc optional', async () => {
      const dtoNull = toCreateDto({ ...validPayload, benefits: null });
      const errorsNull = await validate(dtoNull);
      expect(errorsNull.length).toBe(0);
    });

    it('FR-08 deadline: từ chối nếu deadline rỗng hoặc không phải định dạng ISO-8601', async () => {
      const dtoInvalid = toCreateDto({ ...validPayload, deadline: 'not-a-date' });
      const errorsInvalid = await validate(dtoInvalid);
      expect(errorsInvalid.some((e) => e.property === 'deadline')).toBe(true);

      const dtoMissing = toCreateDto({ ...validPayload, deadline: undefined });
      const errorsMissing = await validate(dtoMissing);
      expect(errorsMissing.some((e) => e.property === 'deadline')).toBe(true);
    });
  });

  describe('UpdateJobPostingDto (FR-08 optional update validation)', () => {
    it('chấp nhận payload cập nhật rỗng (mọi trường đều optional)', async () => {
      const dto = toUpdateDto({});
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('từ chối nếu các trường cung cấp vi phạm ràng buộc định dạng', async () => {
      const dtoInvalid = toUpdateDto({
        title: 'X', // quá ngắn
        quantity: -1, // âm
        type: 'INVALID_TYPE' as any,
        deadline: '2026-99-99',
      });
      const errors = await validate(dtoInvalid);
      expect(errors.some((e) => e.property === 'title')).toBe(true);
      expect(errors.some((e) => e.property === 'quantity')).toBe(true);
      expect(errors.some((e) => e.property === 'type')).toBe(true);
      expect(errors.some((e) => e.property === 'deadline')).toBe(true);
    });
  });
});
