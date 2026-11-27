import { CvErrorCode, JobSeekingStatus, StudentProfileErrorCode } from '@campusjob/contracts';
import { ApiClientError } from './api-client';
import {
  formatM02ErrorMessage,
  normalizeSkillList,
  validateCampusEmail,
  validateCampusOtp,
  validateCvForm,
  validateCvUploadFile,
  validateSkillAddition,
  validateStudentProfileForm,
} from './m02-validation';

describe('M02 Validation & Error Formatting (S7-M02-01)', () => {
  describe('normalizeSkillList & validateSkillAddition', () => {
    it('deduplicates skills case-insensitively while preserving display casing', () => {
      expect(normalizeSkillList([' TypeScript ', 'typescript', 'NestJS', ''])).toEqual([
        'TypeScript',
        'NestJS',
      ]);
    });

    it('adds comma-separated skills and rejects duplicates or skills exceeding max length', () => {
      const added = validateSkillAddition(['TypeScript'], 'NestJS, PostgreSQL', 20);
      expect(added.error).toBeUndefined();
      expect(added.nextSkills).toEqual(['TypeScript', 'NestJS', 'PostgreSQL']);

      const duplicate = validateSkillAddition(['TypeScript'], 'typescript', 20);
      expect(duplicate.error).toContain('đã có trong danh sách');

      const tooLong = validateSkillAddition([], 'A'.repeat(51), 20);
      expect(tooLong.error).toContain('không được vượt quá 50 ký tự');

      const overMax = validateSkillAddition(['S1', 'S2'], 'S3', 2);
      expect(overMax.error).toContain('tối đa 2 mục');
    });
  });

  describe('validateStudentProfileForm', () => {
    it('passes valid student profile values including empty optional fields', () => {
      const errors = validateStudentProfileForm({
        university: 'Đại học Công nghệ Thông tin - ĐHQG TP.HCM',
        major: 'Kỹ thuật Phần mềm',
        graduationYear: '2026',
        jobSeekingStatus: JobSeekingStatus.ACTIVELY_LOOKING,
        bio: 'Sinh viên năm cuối định hướng Backend.',
        skills: ['TypeScript', 'NestJS'],
      });
      expect(errors).toEqual({});
    });

    it('rejects invalid university, major, graduationYear, bio and skills count', () => {
      const errors = validateStudentProfileForm({
        university: 'A',
        major: 'B',
        graduationYear: '2050',
        jobSeekingStatus: JobSeekingStatus.ACTIVELY_LOOKING,
        bio: 'X'.repeat(501),
        skills: Array.from({ length: 21 }, (_, i) => `Skill-${i}`),
      });

      expect(errors.university).toContain('2 đến 150 ký tự');
      expect(errors.major).toContain('2 đến 100 ký tự');
      expect(errors.graduationYear).toContain('2000 đến 2035');
      expect(errors.bio).toContain('500 ký tự');
      expect(errors.skills).toContain('tối đa 20 mục');
    });
  });

  describe('validateCvUploadFile', () => {
    it('accepts valid PDF/DOC/DOCX files under 10MB', () => {
      expect(
        validateCvUploadFile({
          name: 'cv-ngoc-huyen.pdf',
          size: 512 * 1024,
          type: 'application/pdf',
        }),
      ).toBeUndefined();
    });

    it('rejects files larger than 10MB (413), empty files, unsupported extensions, and path traversal', () => {
      expect(
        validateCvUploadFile({
          name: 'large-cv.pdf',
          size: 10 * 1024 * 1024 + 1,
        }),
      ).toContain('10MB');

      expect(
        validateCvUploadFile({
          name: 'empty.pdf',
          size: 0,
        }),
      ).toContain('0 byte');

      expect(
        validateCvUploadFile({
          name: 'avatar.png',
          size: 1024,
        }),
      ).toContain('PDF hoặc Word');

      expect(
        validateCvUploadFile({
          name: '../../etc/passwd.pdf',
          size: 1024,
        }),
      ).toContain('ký tự đường dẫn bị cấm');
    });
  });

  describe('validateCvForm', () => {
    it('accepts a valid CV with educations, experiences, projects, and certifications', () => {
      const errors = validateCvForm({
        title: 'CV Backend Developer (NestJS)',
        summary: 'Mục tiêu phát triển hệ thống phân tán.',
        isDefault: true,
        skills: ['TypeScript', 'NestJS', 'PostgreSQL'],
        educations: [
          {
            school: 'ĐH Công nghệ Thông tin',
            major: 'Kỹ thuật Phần mềm',
            startDate: '2022-09',
            endDate: '2026-06',
            gpa: '3.6/4.0',
          },
        ],
        experiences: [
          {
            company: 'Công ty Công nghệ Campus',
            position: 'Thực tập sinh Backend',
            startDate: '2025-06',
            endDate: '2025-09',
          },
        ],
        projects: [
          {
            name: 'CampusJob Platform',
            role: 'Backend Developer',
            startDate: '2025-09',
            url: 'https://github.com/vietkhang06/campusjob',
          },
        ],
        certifications: [
          {
            name: 'AWS Certified Cloud Practitioner',
            issuer: 'Amazon Web Services',
            issueDate: '2025-05',
          },
        ],
      });

      expect(errors).toEqual({});
    });

    it('rejects invalid title and malformed YYYY-MM dates in sub-items', () => {
      const errors = validateCvForm({
        title: 'A',
        summary: '',
        isDefault: false,
        skills: [],
        educations: [
          {
            school: 'ĐH Công nghệ Thông tin',
            major: 'Kỹ thuật Phần mềm',
            startDate: '09/2022',
          },
        ],
        experiences: [],
        projects: [],
        certifications: [],
      });

      expect(errors.title).toContain('2 đến 100 ký tự');
      expect(errors.educations).toContain('YYYY-MM');
    });
  });

  describe('formatM02ErrorMessage', () => {
    const makeError = (status: number, message: string | string[], code?: string) =>
      new ApiClientError(
        {
          statusCode: status,
          message,
          error: 'Error',
          code,
          timestamp: new Date().toISOString(),
          path: '/api/v1/students/cvs',
        },
        status,
      );

    it('formats 401, 403, 409, 413 and validation errors clearly in Vietnamese', () => {
      expect(formatM02ErrorMessage(makeError(401, 'Unauthorized'), 'Fallback')).toContain('401');
      expect(formatM02ErrorMessage(makeError(403, 'Forbidden'), 'Fallback')).toContain('403');
      expect(formatM02ErrorMessage(makeError(413, 'Payload Too Large'), 'Fallback')).toContain(
        '10MB',
      );
      expect(
        formatM02ErrorMessage(
          makeError(409, 'Conflict', CvErrorCode.CV_IN_USE_CANNOT_DELETE),
          'Fallback',
        ),
      ).toContain('409');
      expect(
        formatM02ErrorMessage(
          makeError(400, ['Tiêu đề CV phải từ 2 đến 100 ký tự.'], CvErrorCode.VALIDATION_ERROR),
          'Fallback',
        ),
      ).toContain('Tiêu đề CV phải từ 2 đến 100 ký tự.');
      expect(
        formatM02ErrorMessage(
          makeError(429, 'Vui lòng đợi 45 giây.', StudentProfileErrorCode.CAMPUS_OTP_RATE_LIMITED),
          'Fallback',
        ),
      ).toContain('45 giây');
      expect(
        formatM02ErrorMessage(
          makeError(409, 'Email trường này đã được liên kết.', StudentProfileErrorCode.CAMPUS_EMAIL_ALREADY_IN_USE),
          'Fallback',
        ),
      ).toContain('đã được liên kết');
    });
  });

  describe('validateCampusEmail & validateCampusOtp (COND-M02-01)', () => {
    it('accepts valid .edu.vn emails and 6-digit numeric OTPs', () => {
      expect(validateCampusEmail('21520001@gm.uit.edu.vn')).toBeUndefined();
      expect(validateCampusOtp('123456')).toBeUndefined();
    });

    it('rejects non-edu.vn domains, domain spoofing, and invalid OTP formats', () => {
      expect(validateCampusEmail('student@gmail.com')).toContain('.edu.vn');
      expect(validateCampusEmail('student@uit.edu.vn.fake.com')).toContain('.edu.vn');
      expect(validateCampusOtp('12345')).toContain('6 chữ số');
      expect(validateCampusOtp('12ab56')).toContain('6 chữ số');
    });
  });
});

