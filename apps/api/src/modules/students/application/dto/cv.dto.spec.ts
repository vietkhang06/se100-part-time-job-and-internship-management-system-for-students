import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateCvDto } from './create-cv.dto';
import { UpdateCvDto } from './update-cv.dto';

describe('CV DTO Validation Tests (S2-M02-03 Contract & Rule Matrix)', () => {
  function toCreateDto(plain: Record<string, unknown>): CreateCvDto {
    return plainToInstance(CreateCvDto, plain);
  }

  function toUpdateDto(plain: Record<string, unknown>): UpdateCvDto {
    return plainToInstance(UpdateCvDto, plain);
  }

  describe('CreateCvDto (UC33 / CV03 - Tạo CV mới)', () => {
    it('chấp nhận payload hợp lệ với đầy đủ các trường trong scope', async () => {
      const dto = toCreateDto({
        title: 'CV Lập trình viên Backend (Node.js/NestJS)',
        summary: 'Sinh viên năm cuối mong muốn tìm vị trí thực tập backend developer.',
        isDefault: true,
        fileUrl: 'https://storage.campusjob.vn/cvs/test.pdf',
        skills: ['TypeScript', 'NestJS', 'PostgreSQL', 'Docker'],
        educations: [
          {
            school: 'Đại học Công nghệ Thông tin - ĐHQG TP.HCM',
            major: 'Kỹ thuật Phần mềm',
            startDate: '2021-09',
            endDate: '2025-06',
            isCurrent: true,
            gpa: '3.52/4.0',
            description: 'GPA loại Giỏi',
          },
        ],
        experiences: [
          {
            company: 'Công ty ABC Tech',
            position: 'Backend Intern',
            startDate: '2024-06',
            endDate: '2024-09',
            isCurrent: false,
            description: 'Phát triển API bằng NestJS',
          },
        ],
        projects: [
          {
            name: 'CampusJob Platform',
            role: 'Backend Developer',
            startDate: '2026-09',
            endDate: '2026-10',
            url: 'https://github.com/campusjob/core',
            description: 'Hệ thống tuyển dụng cho sinh viên',
          },
        ],
        certifications: [
          {
            name: 'AWS Cloud Practitioner',
            issuer: 'Amazon Web Services',
            issueDate: '2024-05',
            url: 'https://aws.amazon.com/cert/123',
          },
        ],
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('chấp nhận payload tối thiểu chỉ có tiêu đề bắt buộc', async () => {
      const dto = toCreateDto({
        title: 'CV Tiêu chuẩn',
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    describe('Ràng buộc tiêu đề (title)', () => {
      it('từ chối khi tiêu đề bị thiếu hoặc để trống', async () => {
        const missingTitle = toCreateDto({});
        const errorsMissing = await validate(missingTitle);
        expect(errorsMissing.some((e) => e.property === 'title')).toBe(true);

        const emptyTitle = toCreateDto({ title: '' });
        const errorsEmpty = await validate(emptyTitle);
        expect(errorsEmpty.some((e) => e.property === 'title')).toBe(true);
      });

      it('từ chối khi tiêu đề quá ngắn (< 2 ký tự) hoặc quá dài (> 100 ký tự)', async () => {
        const tooShort = toCreateDto({ title: 'A' });
        const errorsShort = await validate(tooShort);
        expect(errorsShort.some((e) => e.property === 'title')).toBe(true);

        const tooLong = toCreateDto({ title: 'A'.repeat(101) });
        const errorsLong = await validate(tooLong);
        expect(errorsLong.some((e) => e.property === 'title')).toBe(true);
      });
    });

    describe('Ràng buộc tóm tắt (summary)', () => {
      it('từ chối khi tóm tắt vượt quá 1000 ký tự', async () => {
        const dto = toCreateDto({
          title: 'CV Hợp lệ',
          summary: 'S'.repeat(1001),
        });
        const errors = await validate(dto);
        expect(errors.some((e) => e.property === 'summary')).toBe(true);
      });
    });

    describe('Ràng buộc danh sách kỹ năng (skills)', () => {
      it('từ chối khi danh sách kỹ năng vượt quá 30 mục', async () => {
        const dto = toCreateDto({
          title: 'CV Hợp lệ',
          skills: Array.from({ length: 31 }, (_, i) => `Skill ${i}`),
        });
        const errors = await validate(dto);
        expect(errors.some((e) => e.property === 'skills')).toBe(true);
      });

      it('từ chối khi có kỹ năng vượt quá 50 ký tự', async () => {
        const dto = toCreateDto({
          title: 'CV Hợp lệ',
          skills: ['Valid Skill', 'S'.repeat(51)],
        });
        const errors = await validate(dto);
        expect(errors.some((e) => e.property === 'skills')).toBe(true);
      });
    });

    describe('Ràng buộc danh sách học vấn (educations)', () => {
      it('từ chối khi danh sách học vấn vượt quá 10 mục', async () => {
        const dto = toCreateDto({
          title: 'CV Hợp lệ',
          educations: Array.from({ length: 11 }, () => ({
            school: 'Trường ĐH ABC',
            major: 'CNTT',
            startDate: '2020-09',
          })),
        });
        const errors = await validate(dto);
        expect(errors.some((e) => e.property === 'educations')).toBe(true);
      });

      it('từ chối khi ngày bắt đầu học không đúng định dạng YYYY-MM', async () => {
        const dto = toCreateDto({
          title: 'CV Hợp lệ',
          educations: [
            {
              school: 'Trường ĐH ABC',
              major: 'CNTT',
              startDate: '2020/09/01', // Sai định dạng
            },
          ],
        });
        const errors = await validate(dto);
        expect(errors.some((e) => e.property === 'educations')).toBe(true);
      });

      it('từ chối khi tên trường học hoặc chuyên ngành quá ngắn', async () => {
        const dto = toCreateDto({
          title: 'CV Hợp lệ',
          educations: [
            {
              school: 'A', // < 2 ký tự
              major: 'B', // < 2 ký tự
              startDate: '2020-09',
            },
          ],
        });
        const errors = await validate(dto);
        expect(errors.some((e) => e.property === 'educations')).toBe(true);
      });
    });

    describe('Ràng buộc danh sách kinh nghiệm (experiences)', () => {
      it('từ chối khi danh sách kinh nghiệm vượt quá 10 mục', async () => {
        const dto = toCreateDto({
          title: 'CV Hợp lệ',
          experiences: Array.from({ length: 11 }, () => ({
            company: 'Công ty ABC',
            position: 'Developer',
            startDate: '2023-01',
          })),
        });
        const errors = await validate(dto);
        expect(errors.some((e) => e.property === 'experiences')).toBe(true);
      });

      it('từ chối khi ngày bắt đầu làm việc không đúng định dạng YYYY-MM', async () => {
        const dto = toCreateDto({
          title: 'CV Hợp lệ',
          experiences: [
            {
              company: 'Công ty ABC',
              position: 'Developer',
              startDate: 'InvalidDate',
            },
          ],
        });
        const errors = await validate(dto);
        expect(errors.some((e) => e.property === 'experiences')).toBe(true);
      });
    });

    describe('Ràng buộc đường dẫn URL (fileUrl, project url, cert url)', () => {
      it('từ chối khi fileUrl không phải là URL hợp lệ', async () => {
        const dto = toCreateDto({
          title: 'CV Hợp lệ',
          fileUrl: 'not-a-valid-url',
        });
        const errors = await validate(dto);
        expect(errors.some((e) => e.property === 'fileUrl')).toBe(true);
      });

      it('từ chối khi đường dẫn dự án không phải là URL hợp lệ', async () => {
        const dto = toCreateDto({
          title: 'CV Hợp lệ',
          projects: [
            {
              name: 'Dự án A',
              url: 'invalid-url',
            },
          ],
        });
        const errors = await validate(dto);
        expect(errors.some((e) => e.property === 'projects')).toBe(true);
      });
    });
  });

  describe('UpdateCvDto (UC34 / CV04 - Cập nhật CV)', () => {
    it('chấp nhận payload rỗng (cho phép partial update)', async () => {
      const dto = toUpdateDto({});
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('chấp nhận cập nhật chỉ một vài trường riêng lẻ', async () => {
      const dto = toUpdateDto({
        title: 'CV Tiêu đề Mới',
        isDefault: true,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('từ chối khi tiêu đề cập nhật vi phạm độ dài (< 2 ký tự)', async () => {
      const dto = toUpdateDto({
        title: 'X',
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'title')).toBe(true);
    });

    it('từ chối khi isDefault không phải boolean', async () => {
      const dto = toUpdateDto({
        isDefault: 'not-a-boolean',
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'isDefault')).toBe(true);
    });
  });
});
