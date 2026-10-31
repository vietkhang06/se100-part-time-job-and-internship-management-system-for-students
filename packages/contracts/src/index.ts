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


export enum CompanyErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  COMPANY_NOT_FOUND = 'COMPANY_NOT_FOUND',
  EMPLOYER_HAS_NO_COMPANY = 'EMPLOYER_HAS_NO_COMPANY',
  TAX_ID_ALREADY_EXISTS = 'TAX_ID_ALREADY_EXISTS',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  INVALID_VERIFICATION_STATE = 'INVALID_VERIFICATION_STATE',
  DOCUMENTS_REQUIRED = 'DOCUMENTS_REQUIRED',
  REJECTION_REASON_REQUIRED = 'REJECTION_REASON_REQUIRED',
  BRANCH_NOT_FOUND = 'BRANCH_NOT_FOUND',
  BRANCH_IN_USE_CANNOT_DELETE = 'BRANCH_IN_USE_CANNOT_DELETE',
  INVALID_COORDINATES = 'INVALID_COORDINATES',
  CROSS_COMPANY_BRANCH_FORBIDDEN = 'CROSS_COMPANY_BRANCH_FORBIDDEN',
}

export enum JobErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  JOB_NOT_FOUND = 'JOB_NOT_FOUND',
  JOB_NOT_OWNED = 'JOB_NOT_OWNED',
  JOB_INVALID_STATE_TRANSITION = 'JOB_INVALID_STATE_TRANSITION',
  JOB_EXPIRED_CANNOT_ACTIVATE = 'JOB_EXPIRED_CANNOT_ACTIVATE',
  JOB_COMPANY_NOT_ACTIVE = 'JOB_COMPANY_NOT_ACTIVE',
  JOB_REJECTION_REASON_REQUIRED = 'JOB_REJECTION_REASON_REQUIRED',
  JOB_BRANCH_NOT_OWNED = 'JOB_BRANCH_NOT_OWNED',
  JOB_HIDDEN_BY_MODERATION = 'JOB_HIDDEN_BY_MODERATION',
  MODERATION_SERVICE_UNAVAILABLE = 'MODERATION_SERVICE_UNAVAILABLE',
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
  code?: AuthErrorCode | StudentProfileErrorCode | CvErrorCode | CompanyErrorCode | JobErrorCode | (string & {});
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

// =====================================================================// M05 · Notification (C-20 — DRAFT, chờ Lead/Owner M03-M04 chốt payload)
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
  fileAssetId?: string | null;
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
  fileAssetId?: string | null;
  skills: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateCvRequestDto {
  title: string;
  summary?: string;
  isDefault?: boolean;
  fileUrl?: string;
  fileAssetId?: string | null;
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
  fileAssetId?: string | null;
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
  fileAssetId?: string | null;
  capturedAt: string;
}

/**
 * Contract C-03: Port để M04 lấy CV Snapshot từ M02 khi sinh viên nộp hồ sơ ứng tuyển (UC38)
 */
export interface CvSnapshotSource {
  getOwnedSnapshot(studentId: string, cvId: string): Promise<CvSnapshotDto>;
}

// ==========================================
// FILE ASSET CONTRACTS (W2-DB-02 / W2-DO-01)
// ==========================================

export enum FileAssetStatus {
  PENDING_UPLOAD = 'PENDING_UPLOAD',
  PERMANENT = 'PERMANENT',
  PENDING_DELETION = 'PENDING_DELETION',
}

export interface FileAssetDto {
  id: string;
  ownerUserId: string;
  originalName?: string | null;
  mimeType: string;
  sizeBytes: number;
  checksumSha256: string;
  storageKey: string;
  status: FileAssetStatus;
  uploadedAt: string;
  updatedAt: string;
}

// ==========================================
// SKILL CONTRACTS (W2-DB-01)
// ==========================================

export interface SkillDto {
  id: string;
  name: string;
  normalizedName: string;
  createdAt: string;
}

export interface StudentSkillDto {
  id: string;
  studentProfileId: string;
  skillId: string;
  skill: SkillDto;
  createdAt: string;
}

// ==========================================
// COMPANY & VERIFICATION CONTRACTS (W2-DB-03)
// ==========================================

export enum CompanyMemberRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  HR_MANAGER = 'HR_MANAGER',
  RECRUITER = 'RECRUITER',
  MEMBER = 'MEMBER',
}

export enum CompanyMemberStatus {
  ACTIVE = 'ACTIVE',
  INVITED = 'INVITED',
  SUSPENDED = 'SUSPENDED',
}

export enum CompanyVerificationStatus {
  UNVERIFIED = 'UNVERIFIED',
  PENDING_REVIEW = 'PENDING_REVIEW',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
}

export enum DocumentType {
  BUSINESS_LICENSE = 'BUSINESS_LICENSE',
  TAX_REGISTRATION = 'TAX_REGISTRATION',
  OPERATION_PERMIT = 'OPERATION_PERMIT',
  OTHER = 'OTHER',
}

export interface CompanyDto {
  id: string;
  name: string;
  legalName?: string | null;
  representativeName?: string | null;
  taxId: string;
  website?: string | null;
  industry?: string | null;
  companySize?: string | null;
  description?: string | null;
  logoUrl?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  verificationStatus: CompanyVerificationStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CompanyMemberDto {
  id: string;
  companyId: string;
  userId: string;
  role: CompanyMemberRole;
  status: CompanyMemberStatus;
  joinedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface CompanyBranchDto {
  id: string;
  companyId: string;
  branchName: string;
  addressLine: string;
  ward?: string | null;
  district?: string | null;
  city: string;
  country: string;
  phone?: string | null;
  email?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  isHeadquarter: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CompanyVerificationDto {
  id: string;
  companyId: string;
  reviewerId?: string | null;
  status: CompanyVerificationStatus;
  rejectionReason?: string | null;
  submittedAt: string;
  reviewedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  documents?: CompanyVerificationDocumentDto[];
}

export interface CompanyVerificationDocumentDto {
  id: string;
  verificationId: string;
  fileAssetId: string;
  documentType: DocumentType;
  createdAt: string;
  fileAsset?: FileAssetDto | null;
}


export interface VerificationDocumentAttachmentInput {
  fileAssetId: string;
  documentType?: DocumentType;
}

export interface CreateCompanyRequestDto {
  name: string;
  legalName?: string | null;
  representativeName?: string | null;
  taxId: string;
  website?: string | null;
  industry?: string | null;
  companySize?: string | null;
  description?: string | null;
  logoUrl?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  documents?: VerificationDocumentAttachmentInput[];
}

export interface UpdateCompanyProfileRequestDto {
  name?: string;
  legalName?: string | null;
  representativeName?: string | null;
  website?: string | null;
  industry?: string | null;
  companySize?: string | null;
  description?: string | null;
  logoUrl?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  documents?: VerificationDocumentAttachmentInput[];
}

export interface CompanyProfileResponseDto {
  message?: string;
  company: CompanyDto;
}

export interface CompanyResponseDto {
  message?: string;
  company: CompanyDto;
}

export interface UpdateCompanyVerificationStatusRequestDto {
  status: CompanyVerificationStatus;
  rejectionReason?: string | null;
}

export interface CreateCompanyBranchRequestDto {
  branchName: string;
  addressLine: string;
  ward?: string | null;
  district?: string | null;
  city: string;
  country?: string;
  phone?: string | null;
  email?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  isHeadquarter?: boolean;
}

export interface UpdateCompanyBranchRequestDto {
  branchName?: string;
  addressLine?: string;
  ward?: string | null;
  district?: string | null;
  city?: string;
  country?: string;
  phone?: string | null;
  email?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  isHeadquarter?: boolean;
}

export interface CompanyBranchResponseDto {
  message?: string;
  branch: CompanyBranchDto;
}

export interface CompanyBranchListResponseDto {
  message?: string;
  data: CompanyBranchDto[];
  total: number;
}

export interface DeleteCompanyBranchResponseDto {
  message: string;
  deletedBranchId: string;
}

// ============================================================================
// M03 · JOB POSTING CONTRACTS (C-07 / FR-08)
// ============================================================================

export enum JobType {
  PART_TIME = 'PART_TIME',
  INTERNSHIP = 'INTERNSHIP',
  FULL_TIME = 'FULL_TIME',
}

export enum JobStatus {
  PENDING_APPROVAL = 'PENDING_APPROVAL', // Chờ duyệt
  OPEN = 'OPEN',                         // Đang tuyển
  PAUSED = 'PAUSED',                     // Tạm dừng
  CLOSED = 'CLOSED',                     // Đã đóng
}

export interface JobPostingDto {
  id: string;
  companyId: string;
  branchId: string;
  title: string;
  description: string;
  industry: string;
  type: JobType;
  skills: string[];
  quantity: number;
  salary?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  isSalaryNegotiable: boolean;
  schedule?: string | null;
  benefits?: string | null;
  deadline: string;
  status: JobStatus;
  viewCount: number;
  rejectionReason?: string | null;
  rejectedAt?: string | null;
  hiddenByModeration?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SavedJobDto {
  id: string;
  studentId: string;
  jobId: string;
  createdAt: string;
  job?: JobPostingDto | null;
}

export interface CreateJobPostingRequestDto {
  branchId: string;
  title: string;
  description: string;
  industry: string;
  type: JobType;
  skills: string[];
  quantity: number;
  salary?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  isSalaryNegotiable?: boolean;
  schedule?: string | null;
  benefits?: string | null;
  deadline: string;
}

export interface UpdateJobPostingRequestDto {
  branchId?: string;
  title?: string;
  description?: string;
  industry?: string;
  type?: JobType;
  skills?: string[];
  quantity?: number;
  salary?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  isSalaryNegotiable?: boolean;
  schedule?: string | null;
  benefits?: string | null;
  deadline?: string;
}

export interface JobPostingResponseDto {
  job: JobPostingDto;
}

export interface JobPostingListResponseDto {
  jobs: JobPostingDto[];
  total: number;
  page?: number;
  limit?: number;
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

// ============================================================================
// M05 · Violation Report (C-17)
// ============================================================================
export enum ViolationTargetType {
  COMPANY = 'COMPANY',
  STUDENT = 'STUDENT',
  JOB = 'JOB',
  REVIEW = 'REVIEW',
}

export enum ViolationReason {
  FRAUD = 'FRAUD',
  FAKE_INFORMATION = 'FAKE_INFORMATION',
  HARASSMENT = 'HARASSMENT',
  SPAM = 'SPAM',
  INAPPROPRIATE_CONTENT = 'INAPPROPRIATE_CONTENT',
  OTHER = 'OTHER',
}

export enum ViolationReportStatus {
  SUBMITTED = 'SUBMITTED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  SUBSTANTIATED = 'SUBSTANTIATED',
  DISMISSED = 'DISMISSED',
  /** Quản trị viên đã phán quyết cuối (UC59, S2-M05-04). */
  RESOLVED = 'RESOLVED',
}

export interface ViolationEvidenceDto {
  id: string;
  kind: 'URL' | 'FILE';
  url: string | null;
  note: string | null;
}

export interface ViolationReportDto {
  id: string;
  targetType: ViolationTargetType;
  targetId: string;
  targetLabel: string | null;
  reason: ViolationReason;
  description: string;
  status: ViolationReportStatus;
  evidenceCount: number;
  evidence: ViolationEvidenceDto[];
  createdAt: string;
  moderatedAt: string | null;
  resolvedAt: string | null;
}

export interface ViolationReportDetailDto extends ViolationReportDto {
  reporterId: string;
}

// ============================================================================
// M05 · Sanction (C-19)
// ============================================================================
export enum SanctionType {
  /** Cảnh cáo sinh viên. */
  WARNING = 'WARNING',
  /** Khóa quyền ứng tuyển của sinh viên (UC60), có thời hạn. */
  APPLICATION_LOCK = 'APPLICATION_LOCK',
  /** Đình chỉ doanh nghiệp (UC56), đến khi được gỡ. */
  COMPANY_SUSPENSION = 'COMPANY_SUSPENSION',
}

export enum SanctionTargetType {
  STUDENT = 'STUDENT',
  COMPANY = 'COMPANY',
}

export enum SanctionStatus {
  ACTIVE = 'ACTIVE',
  LIFTED = 'LIFTED',
  /** Tính từ thời hạn (endsAt) khi đọc; không lưu trong DB. */
  EXPIRED = 'EXPIRED',
}

export interface SanctionEventDto {
  id: string;
  action: 'APPLIED' | 'LIFTED';
  actorId: string;
  note: string | null;
  createdAt: string;
}

export interface SanctionDto {
  id: string;
  reportId: string;
  targetType: SanctionTargetType;
  targetId: string;
  type: SanctionType;
  status: SanctionStatus;
  reason: string;
  startsAt: string;
  endsAt: string | null;
  imposedBy: string;
  liftedAt: string | null;
  liftReason: string | null;
  createdAt: string;
}

export interface SanctionDetailDto extends SanctionDto {
  events: SanctionEventDto[];
}

export interface ApplicationLockStatusDto {
  locked: boolean;
  until: string | null;
}
// M05 · Review (C-18 — DRAFT)
// ============================================================================
export enum ReviewVisibility {
  VISIBLE = 'VISIBLE',
  HIDDEN = 'HIDDEN',
}

export interface ReviewReplyDto {
  content: string;
  createdAt: string;
}

/** Góc nhìn của sinh viên đã viết đánh giá. */
export interface ReviewDto {
  id: string;
  applicationId: string;
  companyId: string;
  rating: number;
  comment: string | null;
  visibility: ReviewVisibility;
  createdAt: string;
  reply: ReviewReplyDto | null;
}

/** Dữ liệu công khai: người viết ẩn danh, chỉ đánh giá đang hiển thị. */
export interface PublicReviewDto {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  reply: ReviewReplyDto | null;
}

export interface ReviewSummaryDto {
  averageRating: number | null;
  totalReviews: number;
  distribution: Record<'1' | '2' | '3' | '4' | '5', number>;
}

export interface CompanyReviewListDto {
  data: PublicReviewDto[];
  meta: PaginationMeta;
  summary: ReviewSummaryDto;
}

// ============================================================================
// M03 ? PUBLIC DIRECTORY & SEARCH CONTRACTS (C-06, C-07, C-08 / UC15, UC16, UC22, UC23)
//


export interface PublicCompanyDto {
  id: string;
  name: string;
  legalName?: string | null;
  representativeName?: string | null;
  website?: string | null;
  industry?: string | null;
  companySize?: string | null;
  description?: string | null;
  logoUrl?: string | null;
  address?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PublicCompanyBranchDto {
  id: string;
  companyId: string;
  branchName: string;
  addressLine: string;
  ward?: string | null;
  district?: string | null;
  city: string;
  country?: string;
  phone?: string | null;
  isHeadquarter: boolean;
}

export interface PublicJobPostingDto {
  id: string;
  companyId: string;
  branchId: string;
  title: string;
  description: string;
  industry: string;
  type: JobType;
  skills: string[];
  quantity: number;
  salary?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  isSalaryNegotiable: boolean;
  schedule?: string | null;
  benefits?: string | null;
  deadline: string;
  status: JobStatus;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
  companyName?: string;
  companyLogoUrl?: string | null;
  branchCity?: string;
  branchName?: string;
}

export interface PublicCompanyDetailDto extends PublicCompanyDto {
  branches: PublicCompanyBranchDto[];
  activeJobs: PublicJobPostingDto[];
  reviewSummary?: ReviewSummaryDto | null;
}

export interface PublicCompanyResponseDto {
  company: PublicCompanyDetailDto;
}

export interface PublicCompanyListResponseDto {
  companies: PublicCompanyDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PublicJobPostingResponseDto {
  job: PublicJobPostingDto;
}

export interface PublicJobPostingListResponseDto {
  jobs: PublicJobPostingDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ============================================================================
// M03 ? JOB?APPLICATION CONTRACT FOR M04 (C-07 / S2-M03-06)
// ============================================================================

export interface JobApplicationEligibilityDto {
  jobId: string;
  companyId: string;
  companyName: string;
  branchId: string;
  title: string;
  status: JobStatus;
  deadline: string;
  quantity: number;
  acceptingApplications: boolean;
}

// M05 · Admin Overview (UC54)
// ============================================================================
export enum OverviewGroupKey {
  USERS = 'USERS',
  COMPANIES = 'COMPANIES',
  JOBS = 'JOBS',
  APPLICATIONS = 'APPLICATIONS',
  REPORTS = 'REPORTS',
}

export enum OverviewGroupStatus {
  AVAILABLE = 'AVAILABLE',
  /** Chưa có nguồn dữ liệu (module nguồn chưa sẵn sàng) hoặc truy vấn lỗi: không hiển thị số giả. */
  UNAVAILABLE = 'UNAVAILABLE',
}

export interface OverviewBreakdownItemDto {
  key: string;
  label: string;
  count: number;
}

export interface OverviewGroupDto {
  key: OverviewGroupKey;
  label: string;
  status: OverviewGroupStatus;
  /** null khi UNAVAILABLE. */
  total: number | null;
  breakdownLabel: string | null;
  breakdown: OverviewBreakdownItemDto[];
  unavailableReason: string | null;
}

export interface AdminOverviewDto {
  generatedAt: string;
  groups: OverviewGroupDto[];
}
