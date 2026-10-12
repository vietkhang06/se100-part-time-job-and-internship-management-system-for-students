'use client';

/**
 * CandidateProfilePage – UC11 (xem) + UC12 (cập nhật hồ sơ sinh viên)
 *
 * Luồng:
 *  1. Mount → gọi GET /students/profile → hiển thị dữ liệu hiện tại.
 *  2. Submit → gọi PATCH /students/profile với các trường đã thay đổi.
 *  3. Ownership: userId KHÔNG được gửi từ FE; backend tự lấy từ JWT.
 */

import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/spinner';
import { apiClient, ApiClientError } from '@/lib/api-client';
import type { StudentProfileResponseDto, UpdateStudentProfileRequestDto } from '@campusjob/contracts';
import { JobSeekingStatus } from '@campusjob/contracts';

const JOB_SEEKING_OPTIONS = [
  { value: JobSeekingStatus.ACTIVELY_LOOKING, label: 'Đang tích cực tìm việc' },
  { value: JobSeekingStatus.OPEN_FOR_OPPORTUNITIES, label: 'Sẵn sàng nếu có cơ hội phù hợp' },
  { value: JobSeekingStatus.NOT_LOOKING, label: 'Hiện không tìm việc' },
];

type FormState = {
  university: string;
  major: string;
  graduationYear: string;
  jobSeekingStatus: JobSeekingStatus;
  bio: string;
  skills: string; // comma-separated input
};

export default function CandidateProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState<FormState>({
    university: '',
    major: '',
    graduationYear: '',
    jobSeekingStatus: JobSeekingStatus.ACTIVELY_LOOKING,
    bio: '',
    skills: '',
  });

  // UC11 – Load profile on mount
  useEffect(() => {
    setLoading(true);
    apiClient<StudentProfileResponseDto>('/students/profile')
      .then(({ profile }) => {
        setForm({
          university: profile.university ?? '',
          major: profile.major ?? '',
          graduationYear: profile.graduationYear?.toString() ?? '',
          jobSeekingStatus: profile.jobSeekingStatus,
          bio: profile.bio ?? '',
          skills: (profile.skills ?? []).join(', '),
        });
      })
      .catch((err) => {
        setError(
          err instanceof ApiClientError
            ? err.message
            : 'Không thể tải hồ sơ. Vui lòng thử lại.',
        );
      })
      .finally(() => setLoading(false));
  }, []);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  // UC12 – Submit PATCH
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    // Build payload – chỉ gửi trường có giá trị
    const payload: UpdateStudentProfileRequestDto = {};
    if (form.university.trim()) payload.university = form.university.trim();
    if (form.major.trim()) payload.major = form.major.trim();
    if (form.graduationYear) payload.graduationYear = Number(form.graduationYear);
    if (form.jobSeekingStatus) payload.jobSeekingStatus = form.jobSeekingStatus;
    if (form.bio.trim()) payload.bio = form.bio.trim();
    if (form.skills.trim()) {
      payload.skills = form.skills
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }

    try {
      await apiClient<StudentProfileResponseDto>('/students/profile', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      setSuccess(true);
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : 'Cập nhật thất bại. Vui lòng thử lại.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Hồ sơ cá nhân"
        description="Quản lý thông tin học vấn và trạng thái tìm việc của bạn."
      />

      <Alert variant="info" title="Xác thực email trường (.edu.vn)">
        Xác thực email trường giúp hồ sơ của bạn nhận được huy hiệu Sinh viên chính quy,
        tăng 3× tỷ lệ nhà tuyển dụng phản hồi.
      </Alert>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner />
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Thông tin học vấn & tìm việc</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4 max-w-xl" onSubmit={handleSubmit}>
              {error && (
                <Alert variant="destructive" title="Lỗi">
                  {error}
                </Alert>
              )}
              {success && (
                <Alert variant="success" title="Thành công">
                  Hồ sơ của bạn đã được cập nhật.
                </Alert>
              )}

              <Input
                label="Trường đại học"
                name="university"
                placeholder="Đại học Công nghệ Thông tin - ĐHQG TP.HCM"
                value={form.university}
                onChange={handleChange}
              />

              <Input
                label="Chuyên ngành"
                name="major"
                placeholder="Kỹ thuật Phần mềm"
                value={form.major}
                onChange={handleChange}
              />

              <Input
                label="Năm tốt nghiệp dự kiến"
                name="graduationYear"
                type="number"
                placeholder="2025"
                min={2000}
                max={2035}
                value={form.graduationYear}
                onChange={handleChange}
              />

              <Select
                label="Trạng thái tìm việc"
                name="jobSeekingStatus"
                value={form.jobSeekingStatus}
                onChange={handleChange}
                options={JOB_SEEKING_OPTIONS}
              />

              <Textarea
                label="Giới thiệu bản thân"
                name="bio"
                placeholder="Sinh viên năm cuối đam mê phát triển hệ thống web backend..."
                rows={4}
                maxLength={500}
                value={form.bio}
                onChange={handleChange}
              />

              <Input
                label="Kỹ năng (phân cách bằng dấu phẩy)"
                name="skills"
                placeholder="TypeScript, NestJS, React, PostgreSQL"
                value={form.skills}
                onChange={handleChange}
              />

              <Button type="submit" variant="primary" disabled={saving}>
                {saving ? 'Đang lưu...' : 'Cập nhật hồ sơ'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
