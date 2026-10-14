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

export interface ApiErrorResponse {
  statusCode: number;
  message: string | string[];
  error: string;
  code?: AuthErrorCode | (string & {});
  timestamp: string;
  path: string;
  correlationId?: string;
}

export interface AuthErrorResponse extends ApiErrorResponse {
  code?: AuthErrorCode;
}

export interface AuthUserDto {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  status: UserStatus;
  emailVerified: boolean;
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
