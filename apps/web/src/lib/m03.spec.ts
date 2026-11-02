import {
  JobStatus,
  JobType,
  CompanyVerificationStatus,
  CompanyErrorCode,
  JobErrorCode,
} from '@campusjob/contracts';
import {
  JOB_STATUS_MAP,
  JOB_TYPE_MAP,
  COMPANY_VERIFICATION_MAP,
  getM03ErrorMessage,
  formatSalary,
} from './m03-labels';

describe('M03 UI helpers and labels', () => {
  describe('Status and Type mappings', () => {
    it('maps all JobStatus enum values to Vietnamese labels', () => {
      expect(JOB_STATUS_MAP[JobStatus.PENDING_APPROVAL].label).toBe('Chờ duyệt');
      expect(JOB_STATUS_MAP[JobStatus.OPEN].label).toBe('Đang mở');
      expect(JOB_STATUS_MAP[JobStatus.PAUSED].label).toBe('Tạm dừng');
      expect(JOB_STATUS_MAP[JobStatus.CLOSED].label).toBe('Đã đóng');
    });

    it('maps all JobType enum values', () => {
      expect(JOB_TYPE_MAP[JobType.FULL_TIME]).toContain('Toàn thời gian');
      expect(JOB_TYPE_MAP[JobType.PART_TIME]).toContain('Bán thời gian');
      expect(JOB_TYPE_MAP[JobType.INTERNSHIP]).toContain('Thực tập sinh');
    });

    it('maps all CompanyVerificationStatus values', () => {
      expect(COMPANY_VERIFICATION_MAP[CompanyVerificationStatus.UNVERIFIED].label).toBe('Chưa xác thực');
      expect(COMPANY_VERIFICATION_MAP[CompanyVerificationStatus.PENDING_REVIEW].label).toBe('Chờ xác thực');
      expect(COMPANY_VERIFICATION_MAP[CompanyVerificationStatus.VERIFIED].label).toBe('Đã xác thực');
      expect(COMPANY_VERIFICATION_MAP[CompanyVerificationStatus.REJECTED].label).toBe('Bị từ chối');
    });
  });

  describe('formatSalary', () => {
    it('returns "Thỏa thuận" when isSalaryNegotiable is true or both salaries are empty', () => {
      expect(formatSalary(10000000, 20000000, true)).toBe('Thỏa thuận');
      expect(formatSalary(null, null, false)).toBe('Thỏa thuận');
      expect(formatSalary(undefined, undefined, undefined)).toBe('Thỏa thuận');
    });

    it('formats min and max salary ranges with million shorthand', () => {
      expect(formatSalary(5000000, 10000000)).toBe('5 tr - 10 tr VND');
      expect(formatSalary(5500000, 12000000)).toBe('5.5 tr - 12 tr VND');
    });

    it('formats min-only and max-only salaries', () => {
      expect(formatSalary(7000000, null)).toBe('Từ 7 tr VND');
      expect(formatSalary(null, 15000000)).toBe('Lên đến 15 tr VND');
    });
  });

  describe('getM03ErrorMessage', () => {
    it('returns Vietnamese message for CompanyErrorCode', () => {
      const err = { errorResponse: { code: CompanyErrorCode.TAX_ID_ALREADY_EXISTS } };
      expect(getM03ErrorMessage(err)).toBe('Mã số thuế này đã được đăng ký bởi một doanh nghiệp khác trên hệ thống.');

      const errBranch = { code: CompanyErrorCode.BRANCH_IN_USE_CANNOT_DELETE };
      expect(getM03ErrorMessage(errBranch)).toBe('Không thể xóa chi nhánh này do đang có tin tuyển dụng gắn với địa điểm này.');
    });

    it('returns Vietnamese message for JobErrorCode', () => {
      const errHidden = { errorResponse: { code: JobErrorCode.JOB_HIDDEN_BY_MODERATION } };
      expect(getM03ErrorMessage(errHidden)).toContain('tạm ẩn bởi ban quản trị kiểm duyệt nội dung');

      const errUnverified = { code: JobErrorCode.JOB_COMPANY_NOT_ACTIVE };
      expect(getM03ErrorMessage(errUnverified)).toContain('chưa được xác thực');
    });

    it('falls back to custom fallback or generic message when no code matches', () => {
      expect(getM03ErrorMessage(null, 'Lỗi kết nối')).toBe('Lỗi kết nối');
      expect(getM03ErrorMessage({}, 'Lỗi mặc định')).toBe('Lỗi mặc định');
      expect(getM03ErrorMessage({ message: 'Lỗi từ server' })).toBe('Lỗi từ server');
    });
  });

  describe('Branch coordinate validation logic', () => {
    const validateCoordinates = (
      latStr: string,
      lngStr: string,
    ): { lat?: number; lng?: number; error?: string } => {
      let lat: number | undefined = undefined;
      let lng: number | undefined = undefined;

      if (latStr.trim()) {
        const val = Number(latStr);
        if (Number.isNaN(val) || val < -90 || val > 90) {
          return { error: 'Vĩ độ phải nằm trong khoảng từ -90 đến 90.' };
        }
        lat = val;
      }

      if (lngStr.trim()) {
        const val = Number(lngStr);
        if (Number.isNaN(val) || val < -180 || val > 180) {
          return { error: 'Kinh độ phải nằm trong khoảng từ -180 đến 180.' };
        }
        lng = val;
      }

      if ((lat !== undefined && lng === undefined) || (lat === undefined && lng !== undefined)) {
        return { error: 'Vui lòng cung cấp cả vĩ độ và kinh độ, hoặc để trống cả hai.' };
      }

      return { lat, lng };
    };

    it('accepts valid coordinates within boundaries', () => {
      const res = validateCoordinates('10.762622', '106.660172');
      expect(res.error).toBeUndefined();
      expect(res.lat).toBe(10.762622);
      expect(res.lng).toBe(106.660172);
    });

    it('accepts empty coordinates', () => {
      const res = validateCoordinates('', '');
      expect(res.error).toBeUndefined();
      expect(res.lat).toBeUndefined();
      expect(res.lng).toBeUndefined();
    });

    it('rejects latitude out of range -90..90', () => {
      const res = validateCoordinates('95.5', '106.0');
      expect(res.error).toContain('Vĩ độ');
    });

    it('rejects longitude out of range -180..180', () => {
      const res = validateCoordinates('10.0', '185.0');
      expect(res.error).toContain('Kinh độ');
    });

    it('rejects partial coordinates', () => {
      const res = validateCoordinates('10.0', '');
      expect(res.error).toContain('Vui lòng cung cấp cả vĩ độ và kinh độ');
    });
  });
});
