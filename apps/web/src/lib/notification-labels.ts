import { NotificationEventType } from '@campusjob/contracts';

export interface NotificationEventMeta {
  eventType: NotificationEventType;
  title: string;
  description: string;
  category: 'APPLICATION' | 'INTERVIEW' | 'JOB' | 'TRUST' | 'SYSTEM';
  emailCapable: boolean;
  audience: string;
}

/**
 * Danh mục chuẩn hóa 15 loại sự kiện thông báo theo NOTIFICATION_EVENT_MATRIX.md (C-20 / R-M05-02).
 * 11 loại có gửi email (cho phép người dùng cấu hình bật/tắt).
 * 4 loại chỉ nhận thông báo trong ứng dụng (in-app only, không gửi email).
 */
export const NOTIFICATION_EVENT_METAS: NotificationEventMeta[] = [
  // Ứng tuyển
  {
    eventType: NotificationEventType.APPLICATION_STATUS_CHANGED,
    title: 'Thay đổi trạng thái hồ sơ ứng tuyển',
    description: 'Nhận thông báo khi nhà tuyển dụng xem hồ sơ, cập nhật trạng thái duyệt hoặc khi bạn rút đơn.',
    category: 'APPLICATION',
    emailCapable: true,
    audience: 'Sinh viên & Nhà tuyển dụng',
  },
  {
    eventType: NotificationEventType.APPLICATION_SUBMITTED,
    title: 'Nộp hồ sơ ứng tuyển mới',
    description: 'Thông báo xác nhận hồ sơ ứng tuyển đã được gửi thành công đến nhà tuyển dụng.',
    category: 'APPLICATION',
    emailCapable: false,
    audience: 'Nhà tuyển dụng',
  },

  // Phỏng vấn
  {
    eventType: NotificationEventType.INTERVIEW_INVITED,
    title: 'Lời mời phỏng vấn',
    description: 'Nhận thông báo và email khi nhà tuyển dụng gửi lịch hẹn phỏng vấn trực tiếp hoặc trực tuyến.',
    category: 'INTERVIEW',
    emailCapable: true,
    audience: 'Sinh viên',
  },
  {
    eventType: NotificationEventType.INTERVIEW_RESCHEDULE_RESOLVED,
    title: 'Kết quả yêu cầu đổi lịch phỏng vấn',
    description: 'Nhận thông báo khi nhà tuyển dụng phản hồi chấp thuận hoặc từ chối đề xuất đổi lịch phỏng vấn.',
    category: 'INTERVIEW',
    emailCapable: true,
    audience: 'Sinh viên',
  },
  {
    eventType: NotificationEventType.INTERVIEW_RESULT_RECORDED,
    title: 'Kết quả phỏng vấn',
    description: 'Nhận thông báo khi nhà tuyển dụng ghi nhận kết quả trúng tuyển hoặc không trúng tuyển.',
    category: 'INTERVIEW',
    emailCapable: true,
    audience: 'Sinh viên',
  },
  {
    eventType: NotificationEventType.INTERVIEW_RESCHEDULE_REQUESTED,
    title: 'Yêu cầu đổi lịch phỏng vấn từ ứng viên',
    description: 'Thông báo khi ứng viên đề xuất thay đổi thời gian hoặc hình thức buổi phỏng vấn.',
    category: 'INTERVIEW',
    emailCapable: true,
    audience: 'Nhà tuyển dụng',
  },
  {
    eventType: NotificationEventType.INTERVIEW_CONFIRMED,
    title: 'Xác nhận tham gia phỏng vấn',
    description: 'Thông báo khi ứng viên xác nhận tham gia buổi phỏng vấn theo lịch đã gửi.',
    category: 'INTERVIEW',
    emailCapable: false,
    audience: 'Nhà tuyển dụng',
  },

  // Tin tuyển dụng & Doanh nghiệp
  {
    eventType: NotificationEventType.JOB_APPROVED,
    title: 'Tin tuyển dụng được phê duyệt',
    description: 'Nhận thông báo khi tin tuyển dụng vượt qua khâu kiểm duyệt và được công khai.',
    category: 'JOB',
    emailCapable: true,
    audience: 'Nhà tuyển dụng',
  },
  {
    eventType: NotificationEventType.JOB_REJECTED,
    title: 'Tin tuyển dụng bị từ chối',
    description: 'Nhận thông báo khi tin tuyển dụng bị từ chối phê duyệt kèm lý do chỉnh sửa.',
    category: 'JOB',
    emailCapable: true,
    audience: 'Nhà tuyển dụng',
  },
  {
    eventType: NotificationEventType.JOB_HIDDEN,
    title: 'Tin tuyển dụng bị tạm ẩn',
    description: 'Nhận thông báo khi tin tuyển dụng bị tạm ẩn do vi phạm tiêu chuẩn hoặc hết hạn.',
    category: 'JOB',
    emailCapable: true,
    audience: 'Nhà tuyển dụng',
  },
  {
    eventType: NotificationEventType.COMPANY_VERIFICATION_RESULT,
    title: 'Kết quả xác minh doanh nghiệp',
    description: 'Nhận thông báo khi hồ sơ pháp lý doanh nghiệp được phê duyệt hoặc yêu cầu bổ sung.',
    category: 'JOB',
    emailCapable: true,
    audience: 'Nhà tuyển dụng',
  },
  {
    eventType: NotificationEventType.JOB_SUBMITTED_FOR_REVIEW,
    title: 'Tin tuyển dụng chờ kiểm duyệt',
    description: 'Thông báo điều phối hàng đợi kiểm duyệt tin tuyển dụng cho kiểm duyệt viên.',
    category: 'JOB',
    emailCapable: false,
    audience: 'Kiểm duyệt viên',
  },

  // Báo cáo & Chế tài (Trust)
  {
    eventType: NotificationEventType.REPORT_RESOLVED,
    title: 'Kết quả xử lý báo cáo vi phạm',
    description: 'Nhận thông báo khi báo cáo vi phạm do bạn gửi đã được kiểm duyệt viên và ban quản trị giải quyết.',
    category: 'TRUST',
    emailCapable: true,
    audience: 'Người gửi báo cáo',
  },
  {
    eventType: NotificationEventType.SANCTION_APPLIED,
    title: 'Quyết định áp dụng chế tài',
    description: 'Thông báo chính thức khi tài khoản bị áp dụng cảnh cáo, tạm khóa quyền hoặc hạn chế theo quy định.',
    category: 'TRUST',
    emailCapable: true,
    audience: 'Đối tượng bị chế tài',
  },
  {
    eventType: NotificationEventType.REPORT_RECEIVED,
    title: 'Tiếp nhận báo cáo vi phạm',
    description: 'Thông báo xác nhận hệ thống đã tiếp nhận báo cáo vi phạm và đưa vào hàng đợi thẩm tra.',
    category: 'TRUST',
    emailCapable: false,
    audience: 'Người gửi báo cáo',
  },
];

export const NOTIFICATION_CATEGORY_LABEL: Record<string, string> = {
  APPLICATION: 'Hồ sơ ứng tuyển',
  INTERVIEW: 'Lịch phỏng vấn',
  JOB: 'Tin tuyển dụng & Doanh nghiệp',
  TRUST: 'Báo cáo & Chế tài',
  SYSTEM: 'Hệ thống',
};
