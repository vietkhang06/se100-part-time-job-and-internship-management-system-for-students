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

export interface ApiErrorResponse {
  statusCode: number;
  message: string | string[];
  error: string;
  code?: AuthErrorCode | StudentProfileErrorCode | (string & {});
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

