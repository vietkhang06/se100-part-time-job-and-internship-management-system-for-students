import type {
  ApiErrorResponse,
  ConfirmCampusVerificationRequestDto,
  ConfirmCampusVerificationResponseDto,
  CreateCvRequestDto,
  CvDetailResponseDto,
  CvListResponseDto,
  CvResponseDto,
  DeleteCvResponseDto,
  FileAssetDto,
  RequestCampusVerificationRequestDto,
  RequestCampusVerificationResponseDto,
  SetDefaultCvResponseDto,
  StudentProfileResponseDto,
  UpdateCvRequestDto,
  UpdateStudentProfileRequestDto,
} from '@campusjob/contracts';
import { ApiClientError, getAccessToken, refreshSession } from './api-client';
import { request } from './m05-request';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

async function parseErrorResponse(
  response: Response,
  endpoint: string,
): Promise<ApiErrorResponse> {
  try {
    return (await response.json()) as ApiErrorResponse;
  } catch {
    const defaultMessage =
      response.status === 413
        ? 'Kích thước tệp vượt quá giới hạn 10MB cho phép.'
        : response.statusText || 'Yêu cầu thất bại.';
    return {
      statusCode: response.status,
      message: defaultMessage,
      error: response.statusText || 'Error',
      timestamp: new Date().toISOString(),
      path: endpoint,
    };
  }
}

async function fetchWithAuthRetry(
  endpoint: string,
  initFactory: (token: string | null) => RequestInit,
): Promise<Response> {
  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  let response = await fetch(url, initFactory(getAccessToken()));
  if (response.status === 401) {
    await refreshSession();
    response = await fetch(url, initFactory(getAccessToken()));
  }
  return response;
}

export const m02Api = {
  /** UC11: Xem hồ sơ sinh viên đang đăng nhập */
  getProfile: () => request<StudentProfileResponseDto>('/students/profile'),

  /** UC12: Cập nhật hồ sơ sinh viên đang đăng nhập */
  updateProfile: (payload: UpdateStudentProfileRequestDto) =>
    request<StudentProfileResponseDto>('/students/profile', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  /** COND-M02-01 / FR-06: Gửi hoặc gửi lại mã OTP xác thực email trường */
  requestCampusVerification: (payload: RequestCampusVerificationRequestDto) =>
    request<RequestCampusVerificationResponseDto>(
      '/students/campus-verification/request',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    ),

  /** COND-M02-01 / FR-06: Xác nhận mã OTP email trường */
  confirmCampusVerification: (payload: ConfirmCampusVerificationRequestDto) =>
    request<ConfirmCampusVerificationResponseDto>(
      '/students/campus-verification/confirm',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    ),

  /** UC31: Xem danh sách CV của sinh viên đang đăng nhập */
  listCvs: () => request<CvListResponseDto>('/students/cvs'),

  /** UC32: Xem chi tiết nội dung một CV */
  getCvDetail: (cvId: string) =>
    request<CvDetailResponseDto>(`/students/cvs/${cvId}`),

  /** UC33: Tạo CV mới */
  createCv: (payload: CreateCvRequestDto) =>
    request<CvResponseDto>('/students/cvs', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  /** UC34: Cập nhật nội dung CV */
  updateCv: (cvId: string, payload: UpdateCvRequestDto) =>
    request<CvResponseDto>(`/students/cvs/${cvId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  /** UC34: Đặt nhanh một CV làm mặc định */
  setDefaultCv: (cvId: string) =>
    request<SetDefaultCvResponseDto>(`/students/cvs/${cvId}/default`, {
      method: 'PATCH',
    }),

  /** UC35: Xóa CV */
  deleteCv: (cvId: string) =>
    request<DeleteCvResponseDto>(`/students/cvs/${cvId}`, {
      method: 'DELETE',
    }),

  /** UC33b: Tải lên tệp CV (PDF/DOC/DOCX <= 10MB) để lấy FileAssetDto */
  uploadCvFile: async (file: File): Promise<FileAssetDto> => {
    const endpoint = '/students/cvs/upload';
    const response = await fetchWithAuthRetry(endpoint, (token) => {
      const formData = new FormData();
      formData.append('file', file);
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      return {
        method: 'POST',
        headers,
        body: formData,
        credentials: 'include',
      };
    });

    if (!response.ok) {
      const errorData = await parseErrorResponse(response, endpoint);
      throw new ApiClientError(errorData, response.status);
    }

    return (await response.json()) as FileAssetDto;
  },

  /** UC32b: Tải xuống tệp CV đính kèm */
  downloadCvFile: async (
    cvId: string,
    fallbackFileName = 'cv-campusjob.pdf',
  ): Promise<void> => {
    const endpoint = `/students/cvs/${cvId}/download`;
    const response = await fetchWithAuthRetry(endpoint, (token) => {
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      return {
        method: 'GET',
        headers,
        credentials: 'include',
      };
    });

    if (!response.ok) {
      const errorData = await parseErrorResponse(response, endpoint);
      throw new ApiClientError(errorData, response.status);
    }

    const disposition = response.headers.get('Content-Disposition') || '';
    const match = /filename="?([^";]+)"?/i.exec(disposition);
    const resolvedName = match?.[1]
      ? decodeURIComponent(match[1])
      : fallbackFileName;

    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = blobUrl;
    anchor.download = resolvedName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(blobUrl);
  },
};

