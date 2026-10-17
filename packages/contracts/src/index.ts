
export enum UserRole {
  STUDENT = 'STUDENT',
  EMPLOYER = 'EMPLOYER',
  MODERATOR = 'MODERATOR',
  ADMIN = 'ADMIN',
}

export enum UserStatus {
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  LOCKED = 'LOCKED',
}

export enum AuthErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  ROLE_DISALLOWED = 'ROLE_DISALLOWED',
  WEAK_PASSWORD = 'WEAK_PASSWORD',
  EMAIL_ALREADY_EXISTS = 'EMAIL_ALREADY_EXISTS',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  ACCOUNT_PENDING_VERIFICATION = 'ACCOUNT_PENDING_VERIFICATION',
  ACCOUNT_SUSPENDED = 'ACCOUNT_SUSPENDED',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  REFRESH_TOKEN_MISSING = 'REFRESH_TOKEN_MISSING',
  REFRESH_TOKEN_INVALID = 'REFRESH_TOKEN_INVALID',
  REFRESH_TOKEN_EXPIRED = 'REFRESH_TOKEN_EXPIRED',
  REFRESH_TOKEN_REUSED = 'REFRESH_TOKEN_REUSED',
  SESSION_REVOKED = 'SESSION_REVOKED',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
}

export enum StudentProfileErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_JOB_SEEKING_STATUS = 'INVALID_JOB_SEEKING_STATUS',
  STUDENT_PROFILE_NOT_FOUND = 'STUDENT_PROFILE_NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
}

export enum CvErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  CV_NOT_FOUND = 'CV_NOT_FOUND',
  CV_LIMIT_EXCEEDED = 'CV_LIMIT_EXCEEDED',
  CV_IN_USE_CANNOT_DELETE = 'CV_IN_USE_CANNOT_DELETE',
  CANNOT_UNSET_ONLY_DEFAULT_CV = 'CANNOT_UNSET_ONLY_DEFAULT_CV',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
}

export interface ApiErrorResponse {
  statusCode: number;
  message: string | string[];
  error: string;
  code?: AuthErrorCode | StudentProfileErrorCode | CvErrorCode | (string & {});
  timestamp: string;
  path: string;
  correlationId?: string;
}

export interface AuthErrorResponse extends ApiErrorResponse {
  code?: AuthErrorCode;
}

export interface StudentProfileErrorResponse extends ApiErrorResponse {
  code?: StudentProfileErrorCode;
}

export interface CvErrorResponse extends ApiErrorResponse {
  code?: CvErrorCode;
}

export interface AuthUserDto {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  status: UserStatus;
  emailVerified: boolean;
}

/**
 * AuthContext — Ngữ cảnh xác thực và định danh người dùng liên phân hệ (Contract C-01)
 *
 * Phản ánh chính xác đối tượng principal do JwtStrategy gắn vào request (req.user).
 * Đại diện cho ngữ cảnh xác thực được truyền và tiêu thụ xuyên suốt các module.
 */
export interface AuthContext {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  status: UserStatus;
  phone?: string | null;
  emailVerified: boolean;
  sessionId?: string;
}

export interface HealthResponseDto {
  status: 'ok' | 'error';
  timestamp: string;
  uptime: number;
  environment: string;
  version: string;
  database: {
    status: 'up' | 'down';
    latencyMs?: number;
  };
}

export interface PaginationMeta {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface RegisterRequestDto {
  email: string;
  password: string;
  fullName: string;
  role: UserRole.STUDENT | UserRole.EMPLOYER;
  phone?: string;
}

export interface RegisterResponseDto {
  message: string;
  user: AuthUserDto;
}

export interface VerifyEmailRequestDto {
  token: string;
}

export interface VerifyEmailResponseDto {
  message: string;
  email: string;
}

export interface ResendVerificationRequestDto {
  email: string;
}

export interface ResendVerificationResponseDto {
  message: string;
}

export interface ForgotPasswordRequestDto {
  email: string;
}

export interface ForgotPasswordResponseDto {
  message: string;
}

export interface ResetPasswordRequestDto {
  token: string;
  newPassword: string;
}

export interface ResetPasswordResponseDto {
  message: string;
}

export interface ChangePasswordRequestDto {
  currentPassword: string;
  newPassword: string;
}

export interface ChangePasswordResponseDto {
  message: string;
}

export interface LoginRequestDto {
  email: string;
  password: string;
}

export interface LoginResponseDto {
  accessToken: string;
  user: AuthUserDto;
}

export interface RefreshResponseDto {
  accessToken: string;
  user: AuthUserDto;
}

export interface LogoutResponseDto {
  ok: boolean;
  message: string;
}

export interface MeResponseDto {
  user: AuthUserDto;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  sessionId?: string;
}

// ============================================================================
// M05 · Notification (C-20 — DRAFT, chờ Lead/Owner M03-M04 chốt payload)
// ============================================================================

export enum NotificationEventType {
  JOB_SUBMITTED_FOR_REVIEW = 'JOB_SUBMITTED_FOR_REVIEW',
  JOB_APPROVED = 'JOB_APPROVED',
  JOB_REJECTED = 'JOB_REJECTED',
  JOB_HIDDEN = 'JOB_HIDDEN',
  COMPANY_VERIFICATION_RESULT = 'COMPANY_VERIFICATION_RESULT',
  APPLICATION_SUBMITTED = 'APPLICATION_SUBMITTED',
  APPLICATION_STATUS_CHANGED = 'APPLICATION_STATUS_CHANGED',
  INTERVIEW_INVITED = 'INTERVIEW_INVITED',
  INTERVIEW_CONFIRMED = 'INTERVIEW_CONFIRMED',
  INTERVIEW_RESCHEDULE_REQUESTED = 'INTERVIEW_RESCHEDULE_REQUESTED',
  INTERVIEW_RESCHEDULE_RESOLVED = 'INTERVIEW_RESCHEDULE_RESOLVED',
  REPORT_RECEIVED = 'REPORT_RECEIVED',
  REPORT_RESOLVED = 'REPORT_RESOLVED',
  SANCTION_APPLIED = 'SANCTION_APPLIED',
}

export enum NotificationEmailStatus {
  NOT_REQUIRED = 'NOT_REQUIRED',
  PENDING = 'PENDING',
  SENT = 'SENT',
  FAILED = 'FAILED',
}

export interface NotificationDto {
  id: string;
  eventType: string;
  title: string;
  body: string;
  payload: Record<string, unknown> | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface UnreadCountResponseDto {
  unreadCount: number;
}

export interface MarkAllReadResponseDto {
  updatedCount: number;
}

// ==========================================
// M02: STUDENT PROFILE & CV CONTRACTS
// ==========================================

export enum JobSeekingStatus {
  ACTIVELY_LOOKING = 'ACTIVELY_LOOKING',
  OPEN_FOR_OPPORTUNITIES = 'OPEN_FOR_OPPORTUNITIES',
  NOT_LOOKING = 'NOT_LOOKING',
}

export interface StudentProfileDto {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  phone?: string | null;
  avatarUrl?: string | null;
  university?: string | null;
  major?: string | null;
  graduationYear?: number | null;
  jobSeekingStatus: JobSeekingStatus;
  bio?: string | null;
  skills: string[];
  isCampusVerified: boolean;
  campusEmail?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateStudentProfileRequestDto {
  university?: string;
  major?: string;
  graduationYear?: number;
  jobSeekingStatus?: JobSeekingStatus;
  bio?: string;
  skills?: string[];
}

export interface StudentProfileResponseDto {
  message?: string;
  profile: StudentProfileDto;
}

// ==========================================
// M02: CV & RESUME CONTRACTS (UC31–UC35)
// ==========================================

export interface EducationItemDto {
  id?: string;
  school: string;
  major: string;
  startDate: string; // YYYY-MM
  endDate?: string | null; // YYYY-MM
  isCurrent?: boolean;
  gpa?: string | null;
  description?: string | null;
}

export interface ExperienceItemDto {
  id?: string;
  company: string;
  position: string;
  startDate: string; // YYYY-MM
  endDate?: string | null; // YYYY-MM
  isCurrent?: boolean;
  description?: string | null;
}

export interface ProjectItemDto {
  id?: string;
  name: string;
  role?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  url?: string | null;
  description?: string | null;
}

export interface CertificationItemDto {
  id?: string;
  name: string;
  issuer: string;
  issueDate?: string | null;
  url?: string | null;
}

export interface CvDto {
  id: string;
  studentId: string;
  userId: string;
  title: string;
  summary?: string | null;
  isDefault: boolean;
  fileUrl?: string | null;
  educations: EducationItemDto[];
  experiences: ExperienceItemDto[];
  skills: string[];
  projects: ProjectItemDto[];
  certifications: CertificationItemDto[];
  createdAt: string;
  updatedAt: string;
}

export interface CvListItemDto {
  id: string;
  title: string;
  isDefault: boolean;
  fileUrl?: string | null;
  skills: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateCvRequestDto {
  title: string;
  summary?: string;
  isDefault?: boolean;
  fileUrl?: string;
  skills?: string[];
  educations?: EducationItemDto[];
  experiences?: ExperienceItemDto[];
  projects?: ProjectItemDto[];
  certifications?: CertificationItemDto[];
}

export interface UpdateCvRequestDto {
  title?: string;
  summary?: string;
  isDefault?: boolean;
  fileUrl?: string | null;
  skills?: string[];
  educations?: EducationItemDto[];
  experiences?: ExperienceItemDto[];
  projects?: ProjectItemDto[];
  certifications?: CertificationItemDto[];
}

export interface CvResponseDto {
  message?: string;
  cv: CvDto;
}

export interface CvListResponseDto {
  data: CvListItemDto[];
  total: number;
}

export interface CvDetailResponseDto {
  cv: CvDto;
}

export interface SetDefaultCvResponseDto {
  message: string;
  cvId: string;
  isDefault: boolean;
}

export interface DeleteCvResponseDto {
  message: string;
  deletedCvId: string;
}

/**
 * Contract C-03: M02 (CV) → M04 (Application)
 * Lưu bản chụp CV tại thời điểm nộp đơn để bảo toàn tính bất biến
 */
export interface CvSnapshotDto {
  snapshotId: string;
  originalCvId: string;
  studentId: string;
  fullName: string;
  email: string;
  phone?: string | null;
  title: string;
  summary?: string | null;
  educations: EducationItemDto[];
  experiences: ExperienceItemDto[];
  skills: string[];
  projects: ProjectItemDto[];
  certifications: CertificationItemDto[];
  fileUrl?: string | null;
  capturedAt: string;
}

// ============================================================================
// M05 · Moderation (C-16)
// ============================================================================
export enum ModerationTargetType {
  JOB = 'JOB',
  REPORT = 'REPORT',
  REVIEW = 'REVIEW',
}

export enum ModerationStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  HIDDEN = 'HIDDEN',
  RESTORED = 'RESTORED',
  SUBSTANTIATED = 'SUBSTANTIATED',
  DISMISSED = 'DISMISSED',
}

export enum ModerationDecisionType {
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
  HIDE = 'HIDE',
  RESTORE = 'RESTORE',
  SUBSTANTIATE = 'SUBSTANTIATE',
  DISMISS = 'DISMISS',
}

export interface ModerationDecisionDto {
  id: string;
  decision: ModerationDecisionType;
  reason: string | null;
  proposedAction: string | null;
  reviewerId: string;
  createdAt: string;
  /** false = quyết định đã lưu nhưng module sở hữu đối tượng chưa áp dụng xong. */
  targetSynced: boolean;
}

export interface ModerationItemDto {
  id: string;
  targetType: ModerationTargetType;
  targetId: string;
  round: number;
  status: ModerationStatus;
  summary: string | null;
  submitterId: string | null;
  assigneeId: string | null;
  assignedAt: string | null;
  enqueuedAt: string;
  decidedAt: string | null;
}

export interface ModerationItemDetailDto extends ModerationItemDto {
  decisions: ModerationDecisionDto[];
}
