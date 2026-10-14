import { NotificationEventType } from '@campusjob/contracts';

export interface NotificationContent {
  title: string;
  body: string;
  /** true → ngoài thông báo trong ứng dụng còn gửi email. */
  sendEmail: boolean;
}

type Payload = Record<string, unknown>;

function str(payload: Payload, key: string, fallback: string): string {
  const v = payload[key];
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : fallback;
}

function withReason(base: string, payload: Payload): string {
  const reason = payload['reason'];
  return typeof reason === 'string' && reason.trim() !== ''
    ? `${base} Lý do: ${reason.trim()}`
    : base;
}

/**
 * Nội dung hiển thị cho từng loại sự kiện (C-20 DRAFT).
 * Payload là dữ liệu tối thiểu do module phát sinh sự kiện cung cấp; thiếu trường thì dùng giá trị mặc định.
 */
export function buildNotificationContent(
  eventType: NotificationEventType,
  payload: Payload,
): NotificationContent {
  const job = str(payload, 'jobTitle', 'tin tuyển dụng');
  const company = str(payload, 'companyName', 'doanh nghiệp');

  switch (eventType) {
    case NotificationEventType.JOB_SUBMITTED_FOR_REVIEW:
      return {
        title: 'Có tin tuyển dụng chờ kiểm duyệt',
        body: `Tin "${job}" của ${company} đang chờ kiểm duyệt.`,
        sendEmail: false,
      };
    case NotificationEventType.JOB_APPROVED:
      return {
        title: 'Tin tuyển dụng đã được duyệt',
        body: `Tin "${job}" đã được duyệt và hiển thị công khai.`,
        sendEmail: true,
      };
    case NotificationEventType.JOB_REJECTED:
      return {
        title: 'Tin tuyển dụng bị từ chối',
        body: withReason(`Tin "${job}" không được duyệt.`, payload),
        sendEmail: true,
      };
    case NotificationEventType.JOB_HIDDEN:
      return {
        title: 'Tin tuyển dụng đã bị ẩn',
        body: withReason(`Tin "${job}" đã bị ẩn khỏi danh sách công khai.`, payload),
        sendEmail: true,
      };
    case NotificationEventType.COMPANY_VERIFICATION_RESULT:
      return {
        title: 'Kết quả xác minh doanh nghiệp',
        body: withReason(
          `Hồ sơ doanh nghiệp ${company} có kết quả: ${str(payload, 'result', 'đã được xử lý')}.`,
          payload,
        ),
        sendEmail: true,
      };
    case NotificationEventType.APPLICATION_SUBMITTED:
      return {
        title: 'Có hồ sơ ứng tuyển mới',
        body: `${str(payload, 'studentName', 'Một sinh viên')} vừa ứng tuyển vào "${job}".`,
        sendEmail: false,
      };
    case NotificationEventType.APPLICATION_STATUS_CHANGED:
      return {
        title: 'Hồ sơ ứng tuyển có cập nhật',
        body: `Hồ sơ ứng tuyển "${job}" chuyển sang trạng thái: ${str(payload, 'status', 'mới')}.`,
        sendEmail: true,
      };
    case NotificationEventType.INTERVIEW_INVITED:
      return {
        title: 'Bạn có lời mời phỏng vấn',
        body: `${company} mời bạn phỏng vấn cho "${job}"${
          typeof payload['scheduledAt'] === 'string' ? ` vào ${payload['scheduledAt']}` : ''
        }.`,
        sendEmail: true,
      };
    case NotificationEventType.INTERVIEW_CONFIRMED:
      return {
        title: 'Ứng viên đã xác nhận lịch phỏng vấn',
        body: `Ứng viên đã xác nhận lịch phỏng vấn cho "${job}".`,
        sendEmail: false,
      };
    case NotificationEventType.INTERVIEW_RESCHEDULE_REQUESTED:
      return {
        title: 'Ứng viên đề nghị đổi lịch phỏng vấn',
        body: withReason(`Ứng viên đề nghị đổi lịch phỏng vấn cho "${job}".`, payload),
        sendEmail: true,
      };
    case NotificationEventType.INTERVIEW_RESCHEDULE_RESOLVED:
      return {
        title: 'Đề nghị đổi lịch phỏng vấn đã được phản hồi',
        body: `Doanh nghiệp đã phản hồi đề nghị đổi lịch phỏng vấn cho "${job}": ${str(
          payload,
          'result',
          'đã xử lý',
        )}.`,
        sendEmail: true,
      };
    case NotificationEventType.REPORT_RECEIVED:
      return {
        title: 'Đã nhận báo cáo vi phạm',
        body: 'Báo cáo của bạn đã được ghi nhận và đang chờ thẩm tra.',
        sendEmail: false,
      };
    case NotificationEventType.REPORT_RESOLVED:
      return {
        title: 'Báo cáo vi phạm đã được xử lý',
        body: withReason('Báo cáo của bạn đã được xử lý xong.', payload),
        sendEmail: true,
      };
    case NotificationEventType.SANCTION_APPLIED:
      return {
        title: 'Tài khoản bị áp dụng chế tài',
        body: withReason(
          `Biện pháp áp dụng: ${str(payload, 'sanctionType', 'chế tài')}.`,
          payload,
        ),
        sendEmail: true,
      };
    default: {
      const _exhaustive: never = eventType;
      return _exhaustive;
    }
  }
}
