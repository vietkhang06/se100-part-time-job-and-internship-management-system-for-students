import type { CvListResponseDto, CvSnapshotDto, JobPostingListResponseDto, PublicJobPostingListResponseDto } from '@campusjob/contracts';
import { request } from './m05-request';

export type ApplicationStatus = 'SUBMITTED' | 'REVIEWING' | 'INTERVIEW_SCHEDULED' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN';

export interface ApplicationHistory {
  id: string;
  actorId: string;
  fromStatus: ApplicationStatus | null;
  toStatus: ApplicationStatus;
  reason: string | null;
  createdAt: string;
}

export interface ApplicationItem {
  id: string;
  studentId: string;
  jobId: string;
  cvId: string;
  cvSnapshot: CvSnapshotDto;
  coverLetter: string | null;
  status: ApplicationStatus;
  rejectionReason: string | null;
  createdAt: string;
  history?: ApplicationHistory[];
  matchingScore?: { state: 'UNAVAILABLE'; reason: 'SKILLS_MISSING' | 'FORMULA_UNAPPROVED' } | { state: 'AVAILABLE'; value: number; formulaVersion: string };
}

export interface CandidatePage {
  data: ApplicationItem[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

export interface ChangeRequest {
  id: string;
  interviewId: string;
  proposedAt: string;
  message: string | null;
  decision: 'PENDING' | 'APPROVED' | 'REJECTED';
}

export interface InterviewView {
  interview: {
    id: string;
    applicationId: string;
    scheduledAt: string;
    mode: 'ONSITE' | 'ONLINE';
    locationOrLink: string;
    message: string | null;
    confirmedAt: string | null;
    result: 'ACCEPTED' | 'REJECTED' | null;
  };
  application: Pick<ApplicationItem, 'id' | 'studentId' | 'jobId' | 'status' | 'cvSnapshot'>;
  changeRequest: ChangeRequest | null;
}

export const applicationStatusLabels: Record<ApplicationStatus, string> = {
  SUBMITTED: 'Đã nộp',
  REVIEWING: 'Đang xem xét',
  INTERVIEW_SCHEDULED: 'Đã hẹn phỏng vấn',
  ACCEPTED: 'Trúng tuyển',
  REJECTED: 'Không trúng tuyển',
  WITHDRAWN: 'Đã rút',
};

export const formatDateTime = (value: string) => new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh',
}).format(new Date(value));

export const m04Api = {
  mine: () => request<ApplicationItem[]>('/applications/me'),
  mineDetail: (id: string) => request<ApplicationItem>(`/applications/me/${id}`),
  withdraw: (id: string) => request<ApplicationItem>(`/applications/me/${id}/withdraw`, { method: 'PATCH' }),
  studentInterviews: () => request<InterviewView[]>('/interviews/me'),
  confirmInterview: (id: string) => request(`/interviews/${id}/confirm`, { method: 'POST' }),
  requestReschedule: (id: string, proposedAt: string, message: string) => request(`/interviews/${id}/change-request`, {
    method: 'POST', body: JSON.stringify({ proposedAt, message: message || undefined }),
  }),
  employerJobs: () => request<JobPostingListResponseDto>('/employer/jobs?limit=100'),
  candidates: (jobId: string, page = 1, sort: 'asc' | 'desc' = 'desc') =>
    request<CandidatePage>(`/employer/jobs/${jobId}/applications?page=${page}&pageSize=20&sort=${sort}`),
  candidate: (id: string) => request<ApplicationItem>(`/employer/applications/${id}`),
  markViewed: (id: string) => request(`/employer/applications/${id}/viewed`, { method: 'PATCH' }),
  reject: (id: string, reason: string) => request(`/employer/applications/${id}/reject`, {
    method: 'PATCH', body: JSON.stringify({ reason }),
  }),
  invite: (id: string, input: { scheduledAt: string; mode: 'ONSITE' | 'ONLINE'; locationOrLink: string; message?: string }) =>
    request(`/employer/applications/${id}/interviews`, { method: 'POST', body: JSON.stringify(input) }),
  employerInterviews: (jobId: string) => request<InterviewView[]>(`/employer/jobs/${jobId}/interviews`),
  decideReschedule: (id: string, decision: 'APPROVED' | 'REJECTED') => request(`/employer/interviews/${id}/change-request`, {
    method: 'PATCH', body: JSON.stringify({ decision }),
  }),
  result: (id: string, result: 'ACCEPTED' | 'REJECTED', reason?: string) => request(`/employer/interviews/${id}/result`, {
    method: 'PATCH', body: JSON.stringify({ result, reason }),
  }),
  publicJobs: () => request<PublicJobPostingListResponseDto>('/jobs?limit=50'),
  cvs: () => request<CvListResponseDto>('/students/cvs'),
  apply: (jobId: string, cvId: string, coverLetter: string) => request(`/jobs/${jobId}/apply`, {
    method: 'POST', body: JSON.stringify({ cvId, coverLetter: coverLetter || undefined }),
  }),
};
