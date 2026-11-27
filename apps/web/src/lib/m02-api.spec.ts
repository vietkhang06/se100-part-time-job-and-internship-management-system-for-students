import { JobSeekingStatus } from '@campusjob/contracts';
import { ApiClientError, getAccessToken, setAccessToken } from './api-client';
import { m02Api } from './m02-api';

describe('m02Api Client & 401 Refresh Resilience (S7-M02-01)', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    setAccessToken('initial-access-token');
  });

  afterEach(() => {
    global.fetch = originalFetch;
    setAccessToken(null);
    jest.restoreAllMocks();
  });

  it('automatically refreshes session on 401 after browser reload (F5) and retries getProfile', async () => {
    // Simulate F5 reload where in-memory token was cleared
    setAccessToken(null);

    const mockFetch = jest
      .fn()
      // 1st call: GET /students/profile -> 401 Unauthorized
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({
          statusCode: 401,
          message: 'Unauthorized',
          error: 'Unauthorized',
          timestamp: new Date().toISOString(),
          path: '/api/v1/students/profile',
        }),
      })
      // 2nd call: POST /auth/refresh -> 200 OK with new accessToken
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          accessToken: 'refreshed-access-token',
          user: {
            id: 'student-1',
            email: 'student@example.com',
            fullName: 'Nguyễn Văn A',
            role: 'STUDENT',
            status: 'ACTIVE',
          },
        }),
      })
      // 3rd call: retried GET /students/profile with refreshed token -> 200 OK
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          profile: {
            id: 'profile-1',
            userId: 'student-1',
            fullName: 'Nguyễn Văn A',
            email: 'student@example.com',
            university: 'ĐH Công nghệ Thông tin',
            major: 'Kỹ thuật Phần mềm',
            graduationYear: 2026,
            jobSeekingStatus: JobSeekingStatus.ACTIVELY_LOOKING,
            skills: ['TypeScript', 'NestJS'],
            isCampusVerified: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        }),
      });

    global.fetch = mockFetch as unknown as typeof fetch;

    const result = await m02Api.getProfile();
    expect(result.profile.university).toBe('ĐH Công nghệ Thông tin');
    expect(getAccessToken()).toBe('refreshed-access-token');
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('sends multipart FormData in uploadCvFile without forcing application/json and handles 413 Payload Too Large', async () => {
    const mockFetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          id: '1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed',
          ownerUserId: 'student-1',
          originalName: 'cv.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 120400,
          checksumSha256: 'abc123',
          storageKey: 'uuid.pdf',
          status: 'PENDING_UPLOAD',
          uploadedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 413,
        statusText: 'Payload Too Large',
        json: async () => {
          throw new Error('Non-JSON 413 response from proxy');
        },
      });

    global.fetch = mockFetch as unknown as typeof fetch;

    const fakeFile = new Blob(['%PDF-1.4 sample'], {
      type: 'application/pdf',
    }) as unknown as File;

    const asset = await m02Api.uploadCvFile(fakeFile);
    expect(asset.id).toBe('1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed');

    const [, firstReqInit] = mockFetch.mock.calls[0];
    expect(firstReqInit.headers['Authorization']).toBe('Bearer initial-access-token');
    expect(firstReqInit.headers['Content-Type']).toBeUndefined();

    await expect(m02Api.uploadCvFile(fakeFile)).rejects.toThrow(ApiClientError);
  });

  it('calls campus verification request and confirm endpoints correctly', async () => {
    const mockFetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          message: 'Đã gửi mã OTP',
          campusEmail: '21520001@gm.uit.edu.vn',
          expiresAt: new Date().toISOString(),
          resendCooldownSeconds: 60,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          message: 'Xác thực thành công',
          campusVerifiedAt: new Date().toISOString(),
          profile: {
            id: 'profile-1',
            userId: 'student-1',
            fullName: 'Nguyễn Văn A',
            email: 'student@example.com',
            jobSeekingStatus: JobSeekingStatus.ACTIVELY_LOOKING,
            skills: [],
            isCampusVerified: true,
            campusEmail: '21520001@gm.uit.edu.vn',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        }),
      });

    global.fetch = mockFetch as unknown as typeof fetch;

    const reqRes = await m02Api.requestCampusVerification({
      campusEmail: '21520001@gm.uit.edu.vn',
    });
    expect(reqRes.resendCooldownSeconds).toBe(60);

    const confirmRes = await m02Api.confirmCampusVerification({
      campusEmail: '21520001@gm.uit.edu.vn',
      otp: '123456',
    });
    expect(confirmRes.profile.isCampusVerified).toBe(true);
    expect(confirmRes.profile.campusEmail).toBe('21520001@gm.uit.edu.vn');
  });
});

