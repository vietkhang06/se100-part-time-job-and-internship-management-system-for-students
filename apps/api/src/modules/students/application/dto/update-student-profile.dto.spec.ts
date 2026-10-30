import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { JobSeekingStatus } from '@campusjob/contracts';
import { UpdateStudentProfileDto } from './update-student-profile.dto';

describe('UpdateStudentProfileDto (S2-M02-01 Contract & Validation Test)', () => {
  function toDto(plain: Record<string, unknown>): UpdateStudentProfileDto {
    return plainToInstance(UpdateStudentProfileDto, plain);
  }

  describe('Tiêu chí: Dữ liệu hợp lệ mới lưu', () => {
    it('chấp nhận payload hợp lệ với đầy đủ các trường trong scope', async () => {
      const dto = toDto({
        university: 'Đại học Công nghệ Thông tin - ĐHQG TP.HCM',
        major: 'Kỹ thuật Phần mềm',
        graduationYear: 2025,
        jobSeekingStatus: JobSeekingStatus.ACTIVELY_LOOKING,
        bio: 'Sinh viên năm cuối mong muốn tìm vị trí thực tập backend.',
        skills: ['TypeScript', 'NestJS', 'PostgreSQL'],
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('chấp nhận payload rỗng (cho phép cập nhật từng phần - partial update)', async () => {
      const dto = toDto({});
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('từ chối khi tên trường đại học quá ngắn (< 2 ký tự) hoặc quá dài (> 150 ký tự)', async () => {
      const tooShort = toDto({ university: 'A' });
      const errorsShort = await validate(tooShort);
      expect(errorsShort.some((e) => e.property === 'university')).toBe(true);

      const tooLong = toDto({ university: 'A'.repeat(151) });
      const errorsLong = await validate(tooLong);
      expect(errorsLong.some((e) => e.property === 'university')).toBe(true);
    });

    it('từ chối khi chuyên ngành quá dài (> 100 ký tự)', async () => {
      const dto = toDto({ major: 'M'.repeat(101) });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'major')).toBe(true);
    });

    it('từ chối khi năm tốt nghiệp không phải số nguyên hoặc ngoài khoảng 2000 - 2035', async () => {
      const belowMin = toDto({ graduationYear: 1999 });
      const errorsBelow = await validate(belowMin);
      expect(errorsBelow.some((e) => e.property === 'graduationYear')).toBe(true);

      const aboveMax = toDto({ graduationYear: 2036 });
      const errorsAbove = await validate(aboveMax);
      expect(errorsAbove.some((e) => e.property === 'graduationYear')).toBe(true);

      const notInt = toDto({ graduationYear: 2025.5 });
      const errorsNotInt = await validate(notInt);
      expect(errorsNotInt.some((e) => e.property === 'graduationYear')).toBe(true);
    });

    it('từ chối khi tiểu sử vượt quá 500 ký tự', async () => {
      const dto = toDto({ bio: 'B'.repeat(501) });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'bio')).toBe(true);
    });

    it('từ chối khi danh sách kỹ năng vượt quá 20 mục', async () => {
      const dto = toDto({
        skills: Array.from({ length: 21 }, (_, i) => `Skill ${i}`),
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'skills')).toBe(true);
    });

    it('từ chối khi có kỹ năng vượt quá 50 ký tự', async () => {
      const dto = toDto({
        skills: ['Valid Skill', 'S'.repeat(51)],
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'skills')).toBe(true);
    });
  });

  describe('Tiêu chí: Trạng thái tìm việc đúng danh mục', () => {
    it.each([
      JobSeekingStatus.ACTIVELY_LOOKING,
      JobSeekingStatus.OPEN_FOR_OPPORTUNITIES,
      JobSeekingStatus.NOT_LOOKING,
    ])('chấp nhận trạng thái tìm việc hợp lệ: %s', async (status) => {
      const dto = toDto({ jobSeekingStatus: status });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('từ chối trạng thái tìm việc không có trong danh mục quy định', async () => {
      const dto = toDto({ jobSeekingStatus: 'BUSY_STUDYING' });
      const errors = await validate(dto);

      expect(errors.some((e) => e.property === 'jobSeekingStatus')).toBe(true);
      const statusError = errors.find((e) => e.property === 'jobSeekingStatus');
      expect(statusError?.constraints?.isEnum).toContain(
        'Trạng thái tìm việc không hợp lệ',
      );
    });
  });
});
