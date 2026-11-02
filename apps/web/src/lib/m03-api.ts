import {
  PublicJobPostingListResponseDto,
  PublicJobPostingResponseDto,
  PublicCompanyListResponseDto,
  PublicCompanyResponseDto,
  SavedJobListResponseDto,
  SavedJobIdsResponseDto,
  SaveJobResponseDto,
  CompanyProfileResponseDto,
  CompanyBranchListResponseDto,
  CompanyBranchResponseDto,
  DeleteCompanyBranchResponseDto,
  JobPostingListResponseDto,
  JobPostingResponseDto,
  CreateCompanyRequestDto,
  UpdateCompanyProfileRequestDto,
  CreateCompanyBranchRequestDto,
  UpdateCompanyBranchRequestDto,
  CreateJobPostingRequestDto,
  UpdateJobPostingRequestDto,
  FileAssetDto,
  DocumentType,
} from '@campusjob/contracts';
import { apiClient, getAccessToken, ApiClientError } from '@/lib/api-client';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

// ==========================================
// PUBLIC JOBS & SAVED JOBS (S7-M03-01)
// ==========================================

export interface PublicJobFilterParams {
  keyword?: string;
  industry?: string;
  city?: string;
  type?: string;
  salaryMin?: number;
  salaryMax?: number;
  schedule?: string;
  page?: number;
  limit?: number;
}

export async function fetchPublicJobs(
  params: PublicJobFilterParams = {},
): Promise<PublicJobPostingListResponseDto> {
  const query = new URLSearchParams();
  if (params.keyword?.trim()) query.set('keyword', params.keyword.trim());
  if (params.industry?.trim()) query.set('industry', params.industry.trim());
  if (params.city?.trim()) query.set('city', params.city.trim());
  if (params.type?.trim()) query.set('type', params.type.trim());
  if (params.salaryMin != null && !isNaN(params.salaryMin)) query.set('salaryMin', String(params.salaryMin));
  if (params.salaryMax != null && !isNaN(params.salaryMax)) query.set('salaryMax', String(params.salaryMax));
  if (params.schedule?.trim()) query.set('schedule', params.schedule.trim());
  if (params.page != null) query.set('page', String(params.page));
  if (params.limit != null) query.set('limit', String(params.limit));

  const qs = query.toString();
  return apiClient<PublicJobPostingListResponseDto>(`/jobs${qs ? `?${qs}` : ''}`);
}

export async function fetchPublicJobDetail(id: string): Promise<PublicJobPostingResponseDto> {
  return apiClient<PublicJobPostingResponseDto>(`/jobs/${encodeURIComponent(id)}`);
}

export async function saveJob(id: string): Promise<SaveJobResponseDto> {
  return apiClient<SaveJobResponseDto>(`/jobs/${encodeURIComponent(id)}/save`, {
    method: 'POST',
  });
}

export async function unsaveJob(id: string): Promise<SaveJobResponseDto> {
  return apiClient<SaveJobResponseDto>(`/jobs/${encodeURIComponent(id)}/save`, {
    method: 'DELETE',
  });
}

export async function fetchSavedJobs(page: number = 1, limit: number = 10): Promise<SavedJobListResponseDto> {
  return apiClient<SavedJobListResponseDto>(`/student/saved-jobs?page=${page}&limit=${limit}`);
}

export async function fetchSavedJobIds(): Promise<string[]> {
  try {
    const res = await apiClient<SavedJobIdsResponseDto>('/student/saved-jobs/ids');
    return res.jobIds || [];
  } catch {
    return [];
  }
}

// ==========================================
// PUBLIC COMPANIES (S7-M03-01)
// ==========================================

export interface PublicCompanyFilterParams {
  keyword?: string;
  industry?: string;
  city?: string;
  page?: number;
  limit?: number;
}

export async function fetchPublicCompanies(
  params: PublicCompanyFilterParams = {},
): Promise<PublicCompanyListResponseDto> {
  const query = new URLSearchParams();
  if (params.keyword?.trim()) query.set('keyword', params.keyword.trim());
  if (params.industry?.trim()) query.set('industry', params.industry.trim());
  if (params.city?.trim()) query.set('city', params.city.trim());
  if (params.page != null) query.set('page', String(params.page));
  if (params.limit != null) query.set('limit', String(params.limit));

  const qs = query.toString();
  return apiClient<PublicCompanyListResponseDto>(`/companies${qs ? `?${qs}` : ''}`);
}

export async function fetchPublicCompanyDetail(id: string): Promise<PublicCompanyResponseDto> {
  return apiClient<PublicCompanyResponseDto>(`/companies/${encodeURIComponent(id)}`);
}

// ==========================================
// EMPLOYER COMPANY MANAGEMENT (S7-M03-02)
// ==========================================

export async function fetchEmployerCompany(): Promise<CompanyProfileResponseDto> {
  return apiClient<CompanyProfileResponseDto>('/companies/me');
}

export async function createEmployerCompany(
  data: CreateCompanyRequestDto,
): Promise<CompanyProfileResponseDto> {
  return apiClient<CompanyProfileResponseDto>('/companies', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateEmployerCompany(
  data: UpdateCompanyProfileRequestDto,
): Promise<CompanyProfileResponseDto> {
  return apiClient<CompanyProfileResponseDto>('/companies/profile', {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function resubmitCompanyVerification(data: {
  documents: Array<{ fileAssetId: string; documentType?: DocumentType }>;
}): Promise<CompanyProfileResponseDto> {
  return apiClient<CompanyProfileResponseDto>('/companies/resubmit-verification', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function fetchCompanyVerificationHistory(): Promise<{ data: any[] }> {
  return apiClient<{ data: any[] }>('/companies/verification-history');
}

export async function uploadCompanyDocument(file: File): Promise<FileAssetDto> {
  const formData = new FormData();
  formData.append('file', file);

  const headers: Record<string, string> = {};
  const token = getAccessToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `${API_BASE_URL}/companies/upload-document`;
  const response = await fetch(url, {
    method: 'POST',
    body: formData,
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    let errorData: any;
    try {
      errorData = await response.json();
    } catch {
      errorData = {
        statusCode: response.status,
        message: response.statusText,
      };
    }
    throw new ApiClientError(errorData, response.status);
  }

  return response.json();
}

// ==========================================
// EMPLOYER BRANCH MANAGEMENT (S7-M03-02)
// ==========================================

export async function fetchEmployerBranches(): Promise<CompanyBranchListResponseDto> {
  return apiClient<CompanyBranchListResponseDto>('/companies/branches');
}

export async function createEmployerBranch(
  data: CreateCompanyBranchRequestDto,
): Promise<CompanyBranchResponseDto> {
  return apiClient<CompanyBranchResponseDto>('/companies/branches', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateEmployerBranch(
  id: string,
  data: UpdateCompanyBranchRequestDto,
): Promise<CompanyBranchResponseDto> {
  return apiClient<CompanyBranchResponseDto>(`/companies/branches/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteEmployerBranch(id: string): Promise<DeleteCompanyBranchResponseDto> {
  return apiClient<DeleteCompanyBranchResponseDto>(`/companies/branches/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

// ==========================================
// EMPLOYER JOB MANAGEMENT (S7-M03-02)
// ==========================================

export async function fetchEmployerJobs(): Promise<JobPostingListResponseDto> {
  return apiClient<JobPostingListResponseDto>('/employer/jobs');
}

export async function fetchEmployerJobDetail(id: string): Promise<JobPostingResponseDto> {
  return apiClient<JobPostingResponseDto>(`/employer/jobs/${encodeURIComponent(id)}`);
}

export async function createEmployerJob(
  data: CreateJobPostingRequestDto,
): Promise<JobPostingResponseDto> {
  return apiClient<JobPostingResponseDto>('/employer/jobs', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateEmployerJob(
  id: string,
  data: UpdateJobPostingRequestDto,
): Promise<JobPostingResponseDto> {
  return apiClient<JobPostingResponseDto>(`/employer/jobs/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function submitEmployerJob(id: string): Promise<JobPostingResponseDto> {
  return apiClient<JobPostingResponseDto>(`/employer/jobs/${encodeURIComponent(id)}/submit`, {
    method: 'POST',
  });
}

export async function pauseEmployerJob(id: string): Promise<JobPostingResponseDto> {
  return apiClient<JobPostingResponseDto>(`/employer/jobs/${encodeURIComponent(id)}/pause`, {
    method: 'PATCH',
  });
}

export async function resumeEmployerJob(id: string): Promise<JobPostingResponseDto> {
  return apiClient<JobPostingResponseDto>(`/employer/jobs/${encodeURIComponent(id)}/resume`, {
    method: 'PATCH',
  });
}

export async function closeEmployerJob(id: string): Promise<JobPostingResponseDto> {
  return apiClient<JobPostingResponseDto>(`/employer/jobs/${encodeURIComponent(id)}/close`, {
    method: 'PATCH',
  });
}
