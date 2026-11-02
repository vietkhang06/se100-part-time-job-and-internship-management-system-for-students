import {
  JobStatus,
  JobType,
  CompanyVerificationStatus,
  CompanyErrorCode,
  JobErrorCode,
} from '@campusjob/contracts';

export const JOB_STATUS_MAP: Record<
  JobStatus,
  { label: string; variant: 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline' }
> = {
  [JobStatus.PENDING_APPROVAL]: { label: 'Chờ duyệt', variant: 'warning' },
  [JobStatus.OPEN]: { label: 'Đang mở', variant: 'success' },
  [JobStatus.PAUSED]: { label: 'Tạm dừng', variant: 'secondary' },
  [JobStatus.CLOSED]: { label: 'Đã đóng', variant: 'outline' },
};

export const JOB_TYPE_MAP: Record<JobType, string> = {
  [JobType.FULL_TIME]: 'Toàn thời gian',
  [JobType.PART_TIME]: 'Bán thời gian (Part-time)',
  [JobType.INTERNSHIP]: 'Thực tập sinh (Internship)',
};

export const COMPANY_VERIFICATION_MAP: Record<
  CompanyVerificationStatus,
  { label: string; variant: 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline' }
> = {
  [CompanyVerificationStatus.UNVERIFIED]: { label: 'Chưa xác thực', variant: 'outline' },
  [CompanyVerificationStatus.PENDING_REVIEW]: { label: 'Chờ xác thực', variant: 'warning' },
  [CompanyVerificationStatus.VERIFIED]: { label: 'Đã xác thực', variant: 'success' },
  [CompanyVerificationStatus.REJECTED]: { label: 'Bị từ chối', variant: 'destructive' },
};

export function getM03ErrorMessage(error: any, fallback: string = 'Đã có lỗi xảy ra. Vui lòng thử lại.'): string {
  if (!error) return fallback;

  // Handle ApiClientError or standard fetch error
  const code = error.errorResponse?.code || error.code;
  const message = error.message || error.errorResponse?.message;

  if (code) {
    switch (code) {
      // Company error codes
      case CompanyErrorCode.TAX_ID_ALREADY_EXISTS:
        return 'Mã số thuế này đã được đăng ký bởi một doanh nghiệp khác trên hệ thống.';
      case CompanyErrorCode.BRANCH_IN_USE_CANNOT_DELETE:
        return 'Không thể xóa chi nhánh này do đang có tin tuyển dụng gắn với địa điểm này.';
      case CompanyErrorCode.BRANCH_NOT_FOUND:
        return 'Chi nhánh không tồn tại hoặc đã bị xóa.';
      case CompanyErrorCode.COMPANY_NOT_FOUND:
        return 'Không tìm thấy thông tin doanh nghiệp.';
      case CompanyErrorCode.EMPLOYER_HAS_NO_COMPANY:
        return 'Tài khoản chưa được liên kết với hồ sơ doanh nghiệp nào.';
      case CompanyErrorCode.FORBIDDEN:
        return 'Bạn không có quyền thực hiện thao tác này trên doanh nghiệp.';
      case CompanyErrorCode.REJECTION_REASON_REQUIRED:
        return 'Vui lòng cung cấp lý do từ chối yêu cầu xác thực.';
      case CompanyErrorCode.DOCUMENTS_REQUIRED:
        return 'Vui lòng đính kèm tài liệu giấy phép kinh doanh hợp lệ.';
      case CompanyErrorCode.INVALID_COORDINATES:
        return 'Tọa độ địa lý không hợp lệ (Vĩ độ -90..90, Kinh độ -180..180).';

      // Job error codes
      case JobErrorCode.JOB_NOT_FOUND:
        return 'Tin tuyển dụng không tồn tại hoặc đã bị gỡ bỏ.';
      case JobErrorCode.JOB_NOT_OWNED:
        return 'Bạn không có quyền quản lý tin tuyển dụng này.';
      case JobErrorCode.JOB_INVALID_STATE_TRANSITION:
        return 'Thao tác chuyển trạng thái tin tuyển dụng không hợp lệ.';
      case JobErrorCode.JOB_HIDDEN_BY_MODERATION:
        return 'Tin tuyển dụng đang bị tạm ẩn bởi ban quản trị kiểm duyệt nội dung. Không thể mở lại.';
      case JobErrorCode.JOB_COMPANY_NOT_ACTIVE:
        return 'Doanh nghiệp chưa được xác thực (chỉ doanh nghiệp ĐÃ XÁC THỰC mới có thể mở tin công khai).';
      case JobErrorCode.JOB_BRANCH_NOT_OWNED:
        return 'Chi nhánh được chọn không thuộc doanh nghiệp của bạn.';
      case JobErrorCode.JOB_EXPIRED_CANNOT_ACTIVATE:
        return 'Tin tuyển dụng đã quá hạn nộp hồ sơ, không thể kích hoạt lại.';
    }
  }

  if (typeof message === 'string' && message.trim().length > 0) {
    return message;
  }
  if (Array.isArray(message) && message.length > 0) {
    return message.join(', ');
  }

  return fallback;
}

export function formatSalary(
  salaryMin?: number | null,
  salaryMax?: number | null,
  isSalaryNegotiable?: boolean | null,
  currency: string = 'VND',
): string {
  if (isSalaryNegotiable) {
    return 'Thỏa thuận';
  }
  if (!salaryMin && !salaryMax) {
    return 'Thỏa thuận';
  }
  const formatNum = (num: number) => {
    if (num >= 1_000_000) {
      const mil = num / 1_000_000;
      return `${mil % 1 === 0 ? mil : mil.toFixed(1)} tr`;
    }
    return num.toLocaleString('vi-VN');
  };

  if (salaryMin && salaryMax) {
    return `${formatNum(salaryMin)} - ${formatNum(salaryMax)} ${currency}`;
  }
  if (salaryMin) {
    return `Từ ${formatNum(salaryMin)} ${currency}`;
  }
  if (salaryMax) {
    return `Lên đến ${formatNum(salaryMax)} ${currency}`;
  }
  return 'Thỏa thuận';
}
