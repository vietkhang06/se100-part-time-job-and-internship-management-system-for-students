import {
  CertificationItemDto,
  CvErrorCode,
  EducationItemDto,
  ExperienceItemDto,
  JobSeekingStatus,
  ProjectItemDto,
  StudentProfileErrorCode,
} from '@campusjob/contracts';
import { ApiClientError } from './api-client';

export const PROFILE_LIMITS = {
  UNIVERSITY_MIN: 2,
  UNIVERSITY_MAX: 150,
  MAJOR_MIN: 2,
  MAJOR_MAX: 100,
  GRADUATION_YEAR_MIN: 2000,
  GRADUATION_YEAR_MAX: 2035,
  BIO_MAX: 500,
  MAX_SKILLS: 20,
  SKILL_MAX_LENGTH: 50,
} as const;

export const CV_LIMITS = {
  TITLE_MIN: 2,
  TITLE_MAX: 100,
  SUMMARY_MAX: 1000,
  FILE_URL_MAX: 500,
  MAX_SKILLS: 30,
  SKILL_MAX_LENGTH: 50,
  MAX_SUB_ITEMS: 10,
  MAX_FILE_SIZE_BYTES: 10 * 1024 * 1024, // 10MB
  ALLOWED_EXTENSIONS: ['.pdf', '.doc', '.docx'] as const,
} as const;

export const CAMPUS_VERIFICATION_LIMITS = {
  OTP_LENGTH: 6,
  COOLDOWN_SECONDS: 60,
  EMAIL_MAX: 254,
} as const;

const CAMPUS_EMAIL_FORMAT_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CAMPUS_DOMAIN_LABEL_REGEX = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export function validateCampusEmail(rawEmail: string): string | undefined {
  const email = rawEmail.trim().toLowerCase();
  if (!email) {
    return 'Vui lòng nhập địa chỉ email trường đại học.';
  }
  if (email.length > CAMPUS_VERIFICATION_LIMITS.EMAIL_MAX || !CAMPUS_EMAIL_FORMAT_REGEX.test(email)) {
    return 'Địa chỉ email trường không đúng định dạng.';
  }
  const parts = email.split('@');
  if (parts.length !== 2) {
    return 'Địa chỉ email trường không đúng định dạng.';
  }
  const [localPart, domain] = parts;
  if (!localPart || localPart.length > 64) {
    return 'Địa chỉ email trường không đúng định dạng.';
  }
  const labels = domain.split('.');
  if (labels.length < 2 || !labels.every((label) => CAMPUS_DOMAIN_LABEL_REGEX.test(label))) {
    return 'Tên miền email trường không hợp lệ.';
  }
  if (!domain.endsWith('.edu.vn') || domain.length <= '.edu.vn'.length) {
    return 'Chỉ chấp nhận email sinh viên thuộc tên miền trường đại học (.edu.vn).';
  }
  return undefined;
}

export function validateCampusOtp(rawOtp: string): string | undefined {
  const otp = rawOtp.trim();
  if (!otp) {
    return 'Vui lòng nhập mã OTP gồm 6 chữ số.';
  }
  if (!/^\d{6}$/.test(otp)) {
    return 'Mã OTP phải gồm đúng 6 chữ số.';
  }
  return undefined;
}

export const YEAR_MONTH_REGEX = /^\d{4}-\d{2}$/;

export function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function normalizeSkillList(skills: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of skills) {
    const trimmed = typeof raw === 'string' ? raw.trim() : '';
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }

  return result;
}

export function validateSkillAddition(
  currentSkills: readonly string[],
  rawInput: string,
  maxSkills: number,
  maxSkillLength: number = PROFILE_LIMITS.SKILL_MAX_LENGTH,
): { nextSkills: string[]; error?: string } {
  const candidates = rawInput
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (candidates.length === 0) {
    return { nextSkills: [...currentSkills], error: 'Vui lòng nhập tên kỹ năng trước khi thêm.' };
  }

  for (const candidate of candidates) {
    if (candidate.length > maxSkillLength) {
      return {
        nextSkills: [...currentSkills],
        error: `Mỗi kỹ năng không được vượt quá ${maxSkillLength} ký tự ("${candidate.slice(0, 20)}...").`,
      };
    }
  }

  const merged = normalizeSkillList([...currentSkills, ...candidates]);

  if (merged.length === currentSkills.length) {
    return {
      nextSkills: [...currentSkills],
      error: 'Kỹ năng này đã có trong danh sách.',
    };
  }

  if (merged.length > maxSkills) {
    return {
      nextSkills: [...currentSkills],
      error: `Danh sách kỹ năng tối đa ${maxSkills} mục.`,
    };
  }

  return { nextSkills: merged };
}

export interface StudentProfileFormValues {
  university: string;
  major: string;
  graduationYear: string;
  jobSeekingStatus: JobSeekingStatus;
  bio: string;
  skills: string[];
}

export function validateStudentProfileForm(
  form: StudentProfileFormValues,
): Record<string, string> {
  const errors: Record<string, string> = {};

  const university = form.university.trim();
  if (
    university &&
    (university.length < PROFILE_LIMITS.UNIVERSITY_MIN ||
      university.length > PROFILE_LIMITS.UNIVERSITY_MAX)
  ) {
    errors.university = 'Tên trường đại học phải từ 2 đến 150 ký tự.';
  }

  const major = form.major.trim();
  if (
    major &&
    (major.length < PROFILE_LIMITS.MAJOR_MIN || major.length > PROFILE_LIMITS.MAJOR_MAX)
  ) {
    errors.major = 'Chuyên ngành đào tạo phải từ 2 đến 100 ký tự.';
  }

  const gradYearStr = form.graduationYear.trim();
  if (gradYearStr) {
    const gradYear = Number(gradYearStr);
    if (
      !Number.isInteger(gradYear) ||
      gradYear < PROFILE_LIMITS.GRADUATION_YEAR_MIN ||
      gradYear > PROFILE_LIMITS.GRADUATION_YEAR_MAX
    ) {
      errors.graduationYear = 'Năm tốt nghiệp phải là số nguyên trong khoảng 2000 đến 2035.';
    }
  }

  const validStatuses = Object.values(JobSeekingStatus);
  if (!validStatuses.includes(form.jobSeekingStatus)) {
    errors.jobSeekingStatus = 'Trạng thái tìm việc không hợp lệ.';
  }

  if (form.bio.length > PROFILE_LIMITS.BIO_MAX) {
    errors.bio = 'Tiểu sử giới thiệu không được vượt quá 500 ký tự.';
  }

  if (form.skills.length > PROFILE_LIMITS.MAX_SKILLS) {
    errors.skills = `Danh sách kỹ năng tối đa ${PROFILE_LIMITS.MAX_SKILLS} mục.`;
  } else if (form.skills.some((s) => !s.trim() || s.trim().length > PROFILE_LIMITS.SKILL_MAX_LENGTH)) {
    errors.skills = `Mỗi kỹ năng phải từ 1 đến ${PROFILE_LIMITS.SKILL_MAX_LENGTH} ký tự.`;
  }

  return errors;
}

export interface FileLike {
  name: string;
  size: number;
  type?: string;
}

export function validateCvUploadFile(file: FileLike | null | undefined): string | undefined {
  if (!file) {
    return 'Vui lòng chọn tệp tài liệu CV để tải lên.';
  }

  const rawName = file.name || '';
  if (
    rawName.includes('..') ||
    rawName.includes('/') ||
    rawName.includes('\\') ||
    rawName.includes('\0')
  ) {
    return 'Tên tệp không hợp lệ hoặc chứa ký tự đường dẫn bị cấm.';
  }

  const lowerName = rawName.toLowerCase();
  const hasAllowedExt = CV_LIMITS.ALLOWED_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
  if (!hasAllowedExt) {
    return 'Định dạng tệp không được hỗ trợ. Hệ thống chỉ chấp nhận tệp PDF hoặc Word (.pdf, .doc, .docx).';
  }

  if (file.size <= 0) {
    return 'Tệp tải lên đang rỗng (0 byte). Vui lòng chọn tệp hợp lệ.';
  }

  if (file.size > CV_LIMITS.MAX_FILE_SIZE_BYTES) {
    return 'Kích thước tệp vượt quá giới hạn 10MB cho phép (HTTP 413). Vui lòng chọn tệp nhỏ hơn 10MB.';
  }

  return undefined;
}

export interface CvFormValues {
  title: string;
  summary: string;
  isDefault: boolean;
  fileUrl?: string;
  fileAssetId?: string | null;
  skills: string[];
  educations: EducationItemDto[];
  experiences: ExperienceItemDto[];
  projects: ProjectItemDto[];
  certifications: CertificationItemDto[];
}

export function validateCvForm(form: CvFormValues): Record<string, string> {
  const errors: Record<string, string> = {};

  const title = form.title.trim();
  if (!title) {
    errors.title = 'Tiêu đề CV không được để trống.';
  } else if (title.length < CV_LIMITS.TITLE_MIN || title.length > CV_LIMITS.TITLE_MAX) {
    errors.title = 'Tiêu đề CV phải từ 2 đến 100 ký tự.';
  }

  if (form.summary.length > CV_LIMITS.SUMMARY_MAX) {
    errors.summary = 'Tóm tắt mục tiêu nghề nghiệp không được vượt quá 1000 ký tự.';
  }

  const fileUrl = form.fileUrl?.trim() || '';
  if (fileUrl) {
    if (fileUrl.length > CV_LIMITS.FILE_URL_MAX || !isValidHttpUrl(fileUrl)) {
      errors.fileUrl = 'Đường dẫn tệp CV phải là URL hợp lệ và không quá 500 ký tự.';
    }
  }

  if (form.skills.length > CV_LIMITS.MAX_SKILLS) {
    errors.skills = `Danh sách kỹ năng tối đa ${CV_LIMITS.MAX_SKILLS} mục.`;
  } else if (form.skills.some((s) => !s.trim() || s.trim().length > CV_LIMITS.SKILL_MAX_LENGTH)) {
    errors.skills = `Mỗi kỹ năng không được vượt quá ${CV_LIMITS.SKILL_MAX_LENGTH} ký tự.`;
  }

  if (form.educations.length > CV_LIMITS.MAX_SUB_ITEMS) {
    errors.educations = 'Danh sách học vấn tối đa 10 mục.';
  } else {
    for (let i = 0; i < form.educations.length; i++) {
      const edu = form.educations[i];
      const idx = i + 1;
      if (!edu.school?.trim() || edu.school.trim().length < 2 || edu.school.trim().length > 150) {
        errors.educations = `Học vấn #${idx}: Tên trường học phải từ 2 đến 150 ký tự.`;
        break;
      }
      if (!edu.major?.trim() || edu.major.trim().length < 2 || edu.major.trim().length > 100) {
        errors.educations = `Học vấn #${idx}: Chuyên ngành đào tạo phải từ 2 đến 100 ký tự.`;
        break;
      }
      if (!edu.startDate?.trim() || !YEAR_MONTH_REGEX.test(edu.startDate.trim())) {
        errors.educations = `Học vấn #${idx}: Thời gian bắt đầu học phải theo định dạng YYYY-MM (ví dụ 2021-09).`;
        break;
      }
      if (edu.endDate?.trim() && !YEAR_MONTH_REGEX.test(edu.endDate.trim())) {
        errors.educations = `Học vấn #${idx}: Thời gian kết thúc học phải theo định dạng YYYY-MM.`;
        break;
      }
      if (edu.gpa && edu.gpa.length > 20) {
        errors.educations = `Học vấn #${idx}: Điểm GPA không được vượt quá 20 ký tự.`;
        break;
      }
      if (edu.description && edu.description.length > 500) {
        errors.educations = `Học vấn #${idx}: Mô tả học vấn không được vượt quá 500 ký tự.`;
        break;
      }
    }
  }

  if (form.experiences.length > CV_LIMITS.MAX_SUB_ITEMS) {
    errors.experiences = 'Danh sách kinh nghiệm tối đa 10 mục.';
  } else {
    for (let i = 0; i < form.experiences.length; i++) {
      const exp = form.experiences[i];
      const idx = i + 1;
      if (!exp.company?.trim() || exp.company.trim().length < 2 || exp.company.trim().length > 150) {
        errors.experiences = `Kinh nghiệm #${idx}: Tên công ty phải từ 2 đến 150 ký tự.`;
        break;
      }
      if (
        !exp.position?.trim() ||
        exp.position.trim().length < 2 ||
        exp.position.trim().length > 100
      ) {
        errors.experiences = `Kinh nghiệm #${idx}: Vị trí làm việc phải từ 2 đến 100 ký tự.`;
        break;
      }
      if (!exp.startDate?.trim() || !YEAR_MONTH_REGEX.test(exp.startDate.trim())) {
        errors.experiences = `Kinh nghiệm #${idx}: Thời gian bắt đầu làm việc phải theo định dạng YYYY-MM.`;
        break;
      }
      if (exp.endDate?.trim() && !YEAR_MONTH_REGEX.test(exp.endDate.trim())) {
        errors.experiences = `Kinh nghiệm #${idx}: Thời gian kết thúc làm việc phải theo định dạng YYYY-MM.`;
        break;
      }
      if (exp.description && exp.description.length > 1000) {
        errors.experiences = `Kinh nghiệm #${idx}: Mô tả kinh nghiệm tối đa 1000 ký tự.`;
        break;
      }
    }
  }

  if (form.projects.length > CV_LIMITS.MAX_SUB_ITEMS) {
    errors.projects = 'Danh sách dự án tối đa 10 mục.';
  } else {
    for (let i = 0; i < form.projects.length; i++) {
      const proj = form.projects[i];
      const idx = i + 1;
      if (!proj.name?.trim() || proj.name.trim().length < 2 || proj.name.trim().length > 150) {
        errors.projects = `Dự án #${idx}: Tên dự án phải từ 2 đến 150 ký tự.`;
        break;
      }
      if (proj.role && proj.role.length > 100) {
        errors.projects = `Dự án #${idx}: Vai trò trong dự án tối đa 100 ký tự.`;
        break;
      }
      if (proj.startDate?.trim() && !YEAR_MONTH_REGEX.test(proj.startDate.trim())) {
        errors.projects = `Dự án #${idx}: Thời gian bắt đầu dự án phải theo định dạng YYYY-MM.`;
        break;
      }
      if (proj.endDate?.trim() && !YEAR_MONTH_REGEX.test(proj.endDate.trim())) {
        errors.projects = `Dự án #${idx}: Thời gian kết thúc dự án phải theo định dạng YYYY-MM.`;
        break;
      }
      if (proj.url?.trim() && (proj.url.trim().length > 500 || !isValidHttpUrl(proj.url.trim()))) {
        errors.projects = `Dự án #${idx}: Đường dẫn dự án phải là URL hợp lệ và không quá 500 ký tự.`;
        break;
      }
      if (proj.description && proj.description.length > 1000) {
        errors.projects = `Dự án #${idx}: Mô tả dự án tối đa 1000 ký tự.`;
        break;
      }
    }
  }

  if (form.certifications.length > CV_LIMITS.MAX_SUB_ITEMS) {
    errors.certifications = 'Danh sách chứng chỉ tối đa 10 mục.';
  } else {
    for (let i = 0; i < form.certifications.length; i++) {
      const cert = form.certifications[i];
      const idx = i + 1;
      if (!cert.name?.trim() || cert.name.trim().length < 2 || cert.name.trim().length > 150) {
        errors.certifications = `Chứng chỉ #${idx}: Tên chứng chỉ phải từ 2 đến 150 ký tự.`;
        break;
      }
      if (
        !cert.issuer?.trim() ||
        cert.issuer.trim().length < 2 ||
        cert.issuer.trim().length > 150
      ) {
        errors.certifications = `Chứng chỉ #${idx}: Đơn vị cấp chứng chỉ phải từ 2 đến 150 ký tự.`;
        break;
      }
      if (cert.issueDate?.trim() && !YEAR_MONTH_REGEX.test(cert.issueDate.trim())) {
        errors.certifications = `Chứng chỉ #${idx}: Thời gian cấp chứng chỉ phải theo định dạng YYYY-MM.`;
        break;
      }
      if (cert.url?.trim() && (cert.url.trim().length > 500 || !isValidHttpUrl(cert.url.trim()))) {
        errors.certifications = `Chứng chỉ #${idx}: Đường dẫn chứng chỉ phải là URL hợp lệ và không quá 500 ký tự.`;
        break;
      }
    }
  }

  return errors;
}

export function formatM02ErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiClientError) {
    const code = error.errorResponse?.code;
    const rawMsg = error.message || '';

    if (error.status === 401 || code === CvErrorCode.UNAUTHORIZED) {
      return 'Phiên đăng nhập đã hết hạn hoặc bạn chưa đăng nhập (401). Vui lòng đăng nhập lại.';
    }

    if (error.status === 403) {
      if (code === 'FILE_ASSET_FORBIDDEN') {
        return 'Bạn không có quyền sử dụng hoặc truy cập tệp tài liệu này (403).';
      }
      return 'Tài khoản của bạn không có quyền thực hiện thao tác này (403 - Yêu cầu vai trò Sinh viên).';
    }

    if (
      error.status === 413 ||
      /file too large|exceeds|vượt quá.*10\s*mb/i.test(rawMsg)
    ) {
      return 'Kích thước tệp vượt quá giới hạn 10MB cho phép (413). Vui lòng chọn tệp nhỏ hơn 10MB.';
    }

    if (error.status === 429 || code === StudentProfileErrorCode.CAMPUS_OTP_RATE_LIMITED || code === StudentProfileErrorCode.CAMPUS_OTP_MAX_ATTEMPTS) {
      return rawMsg || 'Bạn thao tác quá nhanh hoặc vượt quá số lần thử cho phép (429). Vui lòng đợi trước khi thử lại.';
    }

    if (error.status === 503 || code === StudentProfileErrorCode.CAMPUS_EMAIL_DELIVERY_FAILED) {
      return rawMsg || 'Không thể gửi email xác thực lúc này (503). Vui lòng thử lại sau.';
    }

    if (code === StudentProfileErrorCode.CAMPUS_EMAIL_ALREADY_IN_USE) {
      return rawMsg || 'Email trường này đã được liên kết với một tài khoản sinh viên khác (409).';
    }

    if (
      error.status === 409 ||
      code === CvErrorCode.CV_IN_USE_CANNOT_DELETE ||
      code === 'CV_LINKED_TO_ACTIVE_APPLICATION'
    ) {
      return 'Không thể xóa CV đang được sử dụng trong hồ sơ ứng tuyển đang hoạt động (409).';
    }

    if (code === CvErrorCode.CANNOT_UNSET_ONLY_DEFAULT_CV) {
      return 'Hệ thống yêu cầu luôn có một CV mặc định. Vui lòng đặt một CV khác làm mặc định thay thế.';
    }

    if (code === CvErrorCode.CV_LIMIT_EXCEEDED) {
      return 'Mỗi sinh viên chỉ được tạo tối đa 10 CV. Vui lòng xóa bớt CV không sử dụng.';
    }

    if (error.status === 404 || code === CvErrorCode.CV_NOT_FOUND) {
      return rawMsg && rawMsg !== 'Not Found'
        ? rawMsg
        : 'Không tìm thấy dữ liệu yêu cầu hoặc bạn không có quyền truy cập (404).';
    }

    if (
      error.status === 400 ||
      code === CvErrorCode.VALIDATION_ERROR ||
      code === StudentProfileErrorCode.VALIDATION_ERROR
    ) {
      return rawMsg || fallback;
    }

    return rawMsg || fallback;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

