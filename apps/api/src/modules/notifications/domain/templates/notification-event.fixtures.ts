import { NotificationEventType as E } from '@campusjob/contracts';

/**
 * Fixture của ma trận C-20 (S3-M05-05). Mỗi eventType đúng MỘT fixture.
 * - IMPLEMENTED: đã có producer thật trong source (payload và người nhận lấy từ code đó).
 * - DRAFT: chưa có producer; contract chưa được module sở hữu chốt, không implement bằng suy luận.
 * Fixture chỉ là dữ liệu mẫu để test/đối soát, không phải code nghiệp vụ.
 */
export type FixtureStatus = 'IMPLEMENTED' | 'DRAFT';
export type RecipientRule =
  | 'REPORTER'
  | 'REPORT_TARGET'
  | 'JOB_SUBMITTER'
  | 'MODERATOR_GROUP'
  | 'COMPANY_OWNER'
  | 'JOB_MANAGERS'
  | 'APPLICATION_STUDENT';

export interface NotificationEventFixture {
  eventType: E;
  status: FixtureStatus;
  producer: 'M03' | 'M04' | 'M05';
  actor: string;
  entity: string;
  recipient: RecipientRule;
  sendEmail: boolean;
  /** Trường bắt buộc phải có trong payload. */
  requiredPayload: string[];
  payload: Record<string, unknown>;
  /** Mẫu dedupeKey. Khóa là UNIQUE toàn bảng → gửi nhiều người nhận thì phải có :<recipientId>. */
  dedupeKeyTemplate: string;
  blockers: string[];
}

export const NOTIFICATION_EVENT_FIXTURES: NotificationEventFixture[] = [
  {
    eventType: E.JOB_SUBMITTED_FOR_REVIEW,
    status: 'DRAFT',
    producer: 'M03',
    actor: 'Employer (gửi tin chờ duyệt)',
    entity: 'Job + ModerationItem',
    recipient: 'MODERATOR_GROUP',
    sendEmail: false,
    requiredPayload: ['jobId', 'jobTitle', 'companyName', 'moderationItemId'],
    payload: { jobId: 'job-1', jobTitle: 'Thực tập Backend', companyName: 'Công ty A', moderationItemId: 'mi-1' },
    dedupeKeyTemplate: 'JOB_SUBMITTED_FOR_REVIEW:<moderationItemId>:<recipientId>',
    blockers: [
      'M03 đưa tin vào hàng đợi kiểm duyệt (ModerationQueueAdapter) nhưng chưa phát thông báo cho Moderator',
      'Cần M01 cung cấp danh sách Moderator theo role',
    ],
  },
  {
    eventType: E.JOB_APPROVED,
    status: 'IMPLEMENTED',
    producer: 'M05',
    actor: 'Moderator (quyết định APPROVE)',
    entity: 'Job + ModerationDecision',
    recipient: 'JOB_SUBMITTER',
    sendEmail: true,
    requiredPayload: ['jobId', 'moderationItemId'],
    payload: { jobId: 'job-1', jobTitle: 'Thực tập Backend', moderationItemId: 'mi-1' },
    dedupeKeyTemplate: 'JOB_APPROVED:<jobId>:<decisionId>',
    blockers: [],
  },
  {
    eventType: E.JOB_REJECTED,
    status: 'IMPLEMENTED',
    producer: 'M05',
    actor: 'Moderator (quyết định REJECT)',
    entity: 'Job + ModerationDecision',
    recipient: 'JOB_SUBMITTER',
    sendEmail: true,
    requiredPayload: ['jobId', 'moderationItemId', 'reason'],
    payload: { jobId: 'job-1', jobTitle: 'Thực tập Backend', moderationItemId: 'mi-1', reason: 'Thiếu mô tả công việc' },
    dedupeKeyTemplate: 'JOB_REJECTED:<jobId>:<decisionId>',
    blockers: [],
  },
  {
    eventType: E.JOB_HIDDEN,
    status: 'IMPLEMENTED',
    producer: 'M05',
    actor: 'Moderator (quyết định HIDE)',
    entity: 'Job + ModerationDecision',
    recipient: 'JOB_SUBMITTER',
    sendEmail: true,
    requiredPayload: ['jobId', 'moderationItemId', 'reason'],
    payload: { jobId: 'job-1', jobTitle: 'Thực tập Backend', moderationItemId: 'mi-1', reason: 'Nội dung không phù hợp' },
    dedupeKeyTemplate: 'JOB_HIDDEN:<jobId>:<decisionId>',
    blockers: [],
  },
  {
    eventType: E.COMPANY_VERIFICATION_RESULT,
    status: 'DRAFT',
    producer: 'M03',
    actor: 'Chưa chốt (M03 chưa nêu ai xác minh doanh nghiệp)',
    entity: 'Company',
    recipient: 'COMPANY_OWNER',
    sendEmail: true,
    requiredPayload: ['companyId', 'companyName', 'result'],
    payload: { companyId: 'co-1', companyName: 'Công ty A', result: 'REJECTED', reason: 'Giấy phép không hợp lệ' },
    dedupeKeyTemplate: 'COMPANY_VERIFICATION_RESULT:<companyId>:<decisionId>',
    blockers: [
      'VerifyCompanyUseCase (M03) chưa gọi publish khi có kết quả xác minh',
      'M03 chốt giá trị `result` (đề xuất APPROVED | REJECTED), actor và bắt buộc `reason` khi REJECTED',
    ],
  },
  {
    eventType: E.APPLICATION_SUBMITTED,
    status: 'IMPLEMENTED',
    producer: 'M04',
    actor: 'Student (nộp hồ sơ)',
    entity: 'Application',
    recipient: 'JOB_MANAGERS',
    sendEmail: false,
    requiredPayload: ['jobId', 'jobTitle', 'companyId', 'companyName', 'studentName'],
    payload: {
      jobId: 'job-1',
      jobTitle: 'Thực tập Backend',
      companyId: 'co-1',
      companyName: 'Công ty A',
      studentName: 'Nguyễn Văn A',
    },
    dedupeKeyTemplate: 'APPLICATION_SUBMITTED:<applicationId>:<recipientId>:once',
    blockers: [],
  },
  {
    eventType: E.APPLICATION_STATUS_CHANGED,
    status: 'IMPLEMENTED',
    producer: 'M04',
    actor: 'Employer đổi trạng thái; Student rút hồ sơ',
    entity: 'Application',
    recipient: 'APPLICATION_STUDENT',
    sendEmail: true,
    requiredPayload: ['jobId', 'jobTitle', 'fromStatus', 'status'],
    payload: {
      jobId: 'job-1',
      jobTitle: 'Thực tập Backend',
      fromStatus: 'INTERVIEW_SCHEDULED',
      status: 'ACCEPTED',
    },
    dedupeKeyTemplate: 'APPLICATION_STATUS_CHANGED:<applicationId>:<recipientId>:<status>',
    blockers: [
      'Khi Student rút hồ sơ (WITHDRAW) M04 gửi cho các quản lý của tin chứ không phải cho Student: cần chốt người nhận cho trường hợp này',
    ],
  },
  {
    eventType: E.INTERVIEW_INVITED,
    status: 'IMPLEMENTED',
    producer: 'M04',
    actor: 'Employer (gửi lời mời)',
    entity: 'Interview',
    recipient: 'APPLICATION_STUDENT',
    sendEmail: true,
    requiredPayload: ['jobId', 'jobTitle', 'companyId', 'companyName', 'scheduledAt', 'mode', 'locationOrLink'],
    payload: {
      jobId: 'job-1',
      jobTitle: 'Thực tập Backend',
      companyId: 'co-1',
      companyName: 'Công ty A',
      scheduledAt: '2026-11-05T02:00:00.000Z',
      mode: 'ONLINE',
      locationOrLink: 'Phòng họp trực tuyến của công ty',
    },
    dedupeKeyTemplate: 'INTERVIEW_INVITED:<interviewId>:<recipientId>:<scheduledAt>',
    blockers: [
      'Payload chứa `locationOrLink` (địa điểm hoặc đường dẫn họp): cần M04 xác nhận được phép lưu trong thông báo và gửi qua email',
    ],
  },
  {
    eventType: E.INTERVIEW_CONFIRMED,
    status: 'IMPLEMENTED',
    producer: 'M04',
    actor: 'Student (xác nhận lịch)',
    entity: 'Interview',
    recipient: 'JOB_MANAGERS',
    sendEmail: false,
    requiredPayload: ['jobId', 'jobTitle', 'scheduledAt'],
    payload: { jobId: 'job-1', jobTitle: 'Thực tập Backend', scheduledAt: '2026-11-05T02:00:00.000Z' },
    dedupeKeyTemplate: 'INTERVIEW_CONFIRMED:<interviewId>:<recipientId>:<scheduledAt>',
    blockers: [],
  },
  {
    eventType: E.INTERVIEW_RESCHEDULE_REQUESTED,
    status: 'IMPLEMENTED',
    producer: 'M04',
    actor: 'Student (đề nghị đổi lịch)',
    entity: 'Interview change request',
    recipient: 'JOB_MANAGERS',
    sendEmail: true,
    requiredPayload: ['jobId', 'jobTitle', 'proposedAt'],
    payload: {
      jobId: 'job-1',
      jobTitle: 'Thực tập Backend',
      proposedAt: '2026-11-06T02:00:00.000Z',
      reason: 'Trùng lịch thi',
    },
    dedupeKeyTemplate: 'INTERVIEW_RESCHEDULE_REQUESTED:<changeRequestId>:<recipientId>:<proposedAt>',
    blockers: [],
  },
  {
    eventType: E.INTERVIEW_RESCHEDULE_RESOLVED,
    status: 'IMPLEMENTED',
    producer: 'M04',
    actor: 'Employer (chấp nhận hoặc từ chối đổi lịch)',
    entity: 'Interview change request',
    recipient: 'APPLICATION_STUDENT',
    sendEmail: true,
    requiredPayload: ['jobId', 'jobTitle', 'result', 'proposedAt'],
    payload: {
      jobId: 'job-1',
      jobTitle: 'Thực tập Backend',
      result: 'APPROVED',
      proposedAt: '2026-11-06T02:00:00.000Z',
    },
    dedupeKeyTemplate: 'INTERVIEW_RESCHEDULE_RESOLVED:<changeRequestId>:<recipientId>:<result>',
    blockers: [],
  },
  {
    eventType: E.INTERVIEW_RESULT_RECORDED,
    status: 'IMPLEMENTED',
    producer: 'M04',
    actor: 'Employer (ghi kết quả phỏng vấn)',
    entity: 'Interview',
    recipient: 'APPLICATION_STUDENT',
    sendEmail: true,
    requiredPayload: ['jobId', 'jobTitle', 'result'],
    payload: { jobId: 'job-1', jobTitle: 'Thực tập Backend', result: 'REJECTED', reason: 'Chưa phù hợp vị trí' },
    dedupeKeyTemplate: 'INTERVIEW_RESULT_RECORDED:<interviewId>:<recipientId>:<result>',
    blockers: [
      'Cùng lúc M04 cũng phát APPLICATION_STATUS_CHANGED cho Student: Student nhận hai thông báo (và hai email) cho một kết quả',
    ],
  },
  {
    eventType: E.REPORT_RECEIVED,
    status: 'IMPLEMENTED',
    producer: 'M05',
    actor: 'Student / Employer (gửi báo cáo)',
    entity: 'ViolationReport',
    recipient: 'REPORTER',
    sendEmail: false,
    requiredPayload: ['reportId'],
    payload: { reportId: 'rp-1' },
    dedupeKeyTemplate: 'REPORT_RECEIVED:<reportId>',
    blockers: [],
  },
  {
    eventType: E.REPORT_RESOLVED,
    status: 'IMPLEMENTED',
    producer: 'M05',
    actor: 'Admin (phán quyết cuối)',
    entity: 'ViolationReport',
    recipient: 'REPORTER',
    sendEmail: true,
    requiredPayload: ['reportId', 'outcome'],
    payload: { reportId: 'rp-1', outcome: 'CLOSED_WITHOUT_SANCTION', reason: 'Đã nhắc nhở' },
    dedupeKeyTemplate: 'REPORT_RESOLVED:<reportId>',
    blockers: [],
  },
  {
    eventType: E.SANCTION_APPLIED,
    status: 'IMPLEMENTED',
    producer: 'M05',
    actor: 'Admin (áp chế tài)',
    entity: 'Sanction',
    recipient: 'REPORT_TARGET',
    sendEmail: true,
    requiredPayload: ['sanctionId', 'reportId', 'sanctionTypeCode', 'sanctionType'],
    payload: {
      sanctionId: 'sn-1',
      reportId: 'rp-1',
      sanctionTypeCode: 'WARNING',
      sanctionType: 'Cảnh cáo',
      reason: 'Vi phạm quy chế',
    },
    dedupeKeyTemplate: 'SANCTION_APPLIED:<sanctionId>',
    blockers: ['Đối tượng là doanh nghiệp: cần M03 cho biết user chủ doanh nghiệp để nhận thông báo (TM-H1 đang dùng handler giả)'],
  },
];
