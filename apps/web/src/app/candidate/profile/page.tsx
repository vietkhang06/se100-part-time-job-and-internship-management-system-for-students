'use client';

/**
 * CandidateProfilePage – UC11 (Xem hồ sơ) + UC12 (Cập nhật hồ sơ sinh viên)
 * Task S7-M02-01:
 *  - Kết nối API thật GET / PATCH /api/v1/students/profile qua m02Api (hỗ trợ tự động refresh token khi F5).
 *  - Tích hợp SkillEditor chuẩn hóa (tối đa 20 kỹ năng, mỗi kỹ năng <= 50 ký tự, cho phép xóa hết kỹ năng).
 *  - Validation phía client và server nhất quán theo STUDENT_PROFILE_API_CONTRACT (C-03, C-04, C-05).
 *  - Không thêm bất kỳ trường nào ngoài schema/contract đã chốt.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { ErrorState } from '@/components/ui/error-state';
import { SkillEditor } from '@/components/students/skill-editor';
import { useAuth } from '@/lib/auth-context';
import { m02Api } from '@/lib/m02-api';
import {
  formatM02ErrorMessage,
  PROFILE_LIMITS,
  StudentProfileFormValues,
  validateStudentProfileForm,
} from '@/lib/m02-validation';
import {
  JobSeekingStatus,
  StudentProfileDto,
  UpdateStudentProfileRequestDto,
} from '@campusjob/contracts';

const JOB_SEEKING_OPTIONS = [
  { value: JobSeekingStatus.ACTIVELY_LOOKING, label: 'Đang tích cực tìm việc / thực tập' },
  { value: JobSeekingStatus.OPEN_FOR_OPPORTUNITIES, label: 'Sẵn sàng nếu có cơ hội phù hợp' },
  { value: JobSeekingStatus.NOT_LOOKING, label: 'Hiện tạm thời chưa tìm việc' },
];

export default function CandidateProfilePage() {
  const { user, isLoading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [profile, setProfile] = useState<StudentProfileDto | null>(null);

  const [form, setForm] = useState<StudentProfileFormValues>({
    university: '',
    major: '',
    graduationYear: '',
    jobSeekingStatus: JobSeekingStatus.ACTIVELY_LOOKING,
    bio: '',
    skills: [],
  });

  const applyProfileToForm = useCallback((data: StudentProfileDto) => {
    setProfile(data);
    setForm({
      university: data.university ?? '',
      major: data.major ?? '',
      graduationYear: data.graduationYear?.toString() ?? '',
      jobSeekingStatus: data.jobSeekingStatus ?? JobSeekingStatus.ACTIVELY_LOOKING,
      bio: data.bio ?? '',
      skills: Array.isArray(data.skills) ? [...data.skills] : [],
    });
  }, []);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await m02Api.getProfile();
      applyProfileToForm(res.profile);
    } catch (err) {
      setLoadError(
        formatM02ErrorMessage(err, 'Không thể tải hồ sơ sinh viên. Vui lòng thử lại.'),
      );
    } finally {
      setLoading(false);
    }
  }, [applyProfileToForm]);

  useEffect(() => {
    if (authLoading) return;
    void loadProfile();
  }, [authLoading, loadProfile]);

  function handleFieldChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
    if (successMessage) setSuccessMessage(null);
  }

  function handleSkillsChange(nextSkills: string[]) {
    setForm((prev) => ({ ...prev, skills: nextSkills }));
    if (fieldErrors.skills) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next.skills;
        return next;
      });
    }
    if (successMessage) setSuccessMessage(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    setSuccessMessage(null);

    const validationErrors = validateStudentProfileForm(form);
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      setSubmitError('Vui lòng kiểm tra lại các trường thông tin chưa hợp lệ.');
      return;
    }

    setFieldErrors({});
    setSaving(true);

    const payload: UpdateStudentProfileRequestDto = {
      jobSeekingStatus: form.jobSeekingStatus,
      bio: form.bio.trim(),
      skills: form.skills,
    };

    if (form.university.trim()) {
      payload.university = form.university.trim();
    }
    if (form.major.trim()) {
      payload.major = form.major.trim();
    }
    if (form.graduationYear.trim()) {
      payload.graduationYear = Number(form.graduationYear.trim());
    }

    try {
      const res = await m02Api.updateProfile(payload);
      applyProfileToForm(res.profile);
      setSuccessMessage(res.message || 'Hồ sơ sinh viên của bạn đã được cập nhật thành công.');
    } catch (err) {
      setSubmitError(
        formatM02ErrorMessage(err, 'Cập nhật hồ sơ thất bại. Vui lòng kiểm tra lại thông tin.'),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Hồ sơ cá nhân"
        description="Quản lý thông tin học vấn, kỹ năng chuyên môn và trạng thái tìm việc của bạn."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loading || saving}
              onClick={() => void loadProfile()}
            >
              Làm mới dữ liệu
            </Button>
            <Link href="/candidate/cvs">
              <Button type="button" variant="secondary" size="sm">
                Quản lý CV →
              </Button>
            </Link>
          </div>
        }
      />

      {authLoading || loading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner />
        </div>
      ) : loadError ? (
        <div className="space-y-4">
          <ErrorState message={loadError} onRetry={() => void loadProfile()} />
          {!user && (
            <div className="flex justify-center">
              <Link href="/login">
                <Button variant="primary">Đi tới trang Đăng nhập</Button>
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* CỘT TRÁI: THÔNG TIN ĐỊNH DANH TÀI KHOẢN (READ-ONLY TỪ CONTRACT) */}
          <div className="space-y-6 lg:col-span-1">
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">
                      {profile?.fullName || user?.fullName || 'Sinh viên CampusJob'}
                    </CardTitle>
                    <CardDescription className="break-all mt-1">
                      {profile?.email || user?.email}
                    </CardDescription>
                  </div>
                  <Badge variant="secondary">Tài khoản Sinh viên</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1 border-t border-border pt-3">
                  <span className="text-muted-foreground">Số điện thoại:</span>
                  <span className="font-medium text-foreground">
                    {profile?.phone || 'Chưa cập nhật'}
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1 border-t border-border pt-3">
                  <span className="text-muted-foreground">Trạng thái hiện tại:</span>
                  <span className="font-medium text-primary">
                    {
                      JOB_SEEKING_OPTIONS.find(
                        (opt) => opt.value === (profile?.jobSeekingStatus ?? form.jobSeekingStatus),
                      )?.label
                    }
                  </span>
                </div>
                {profile?.updatedAt && (
                  <div className="flex flex-col sm:flex-row sm:justify-between gap-1 border-t border-border pt-3 text-xs text-muted-foreground">
                    <span>Cập nhật lần cuối:</span>
                    <span>
                      {new Date(profile.updatedAt).toLocaleString('vi-VN')}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            <Alert variant="info" title="Đồng bộ với CV Snapshot (Contract C-03)">
              Họ tên, email, số điện thoại và danh sách kỹ năng chuẩn hóa trên hồ sơ giúp nhà tuyển
              dụng đánh giá chính xác năng lực của bạn khi nộp hồ sơ ứng tuyển.
            </Alert>
          </div>

          {/* CỘT PHẢI: FORM CẬP NHẬT HỒ SƠ & SKILL EDITOR (UC12) */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Thông tin học vấn, kỹ năng & tìm việc</CardTitle>
              <CardDescription>
                Dữ liệu được kiểm thực đồng nhất giữa trình duyệt và máy chủ theo hợp đồng M02.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-5" onSubmit={handleSubmit} noValidate>
                {submitError && (
                  <Alert variant="destructive" title="Không thể lưu hồ sơ">
                    {submitError}
                  </Alert>
                )}

                {successMessage && (
                  <Alert variant="success" title="Cập nhật thành công">
                    {successMessage}
                  </Alert>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Trường đại học (2 – 150 ký tự)"
                    name="university"
                    placeholder="VD: Đại học Công nghệ Thông tin - ĐHQG TP.HCM"
                    maxLength={PROFILE_LIMITS.UNIVERSITY_MAX}
                    value={form.university}
                    error={fieldErrors.university}
                    onChange={handleFieldChange}
                  />

                  <Input
                    label="Chuyên ngành đào tạo (2 – 100 ký tự)"
                    name="major"
                    placeholder="VD: Kỹ thuật Phần mềm"
                    maxLength={PROFILE_LIMITS.MAJOR_MAX}
                    value={form.major}
                    error={fieldErrors.major}
                    onChange={handleFieldChange}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Năm tốt nghiệp dự kiến (2000 – 2035)"
                    name="graduationYear"
                    type="number"
                    placeholder="2026"
                    min={PROFILE_LIMITS.GRADUATION_YEAR_MIN}
                    max={PROFILE_LIMITS.GRADUATION_YEAR_MAX}
                    value={form.graduationYear}
                    error={fieldErrors.graduationYear}
                    onChange={handleFieldChange}
                  />

                  <Select
                    label="Trạng thái tìm việc"
                    name="jobSeekingStatus"
                    value={form.jobSeekingStatus}
                    error={fieldErrors.jobSeekingStatus}
                    onChange={handleFieldChange}
                    options={JOB_SEEKING_OPTIONS}
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="profile-bio"
                      className="text-xs font-semibold text-foreground/80"
                    >
                      Giới thiệu bản thân
                    </label>
                    <span className="text-xs text-muted-foreground">
                      {form.bio.length}/{PROFILE_LIMITS.BIO_MAX} ký tự
                    </span>
                  </div>
                  <Textarea
                    id="profile-bio"
                    name="bio"
                    placeholder="Sinh viên năm cuối đam mê phát triển hệ thống web backend, tìm kiếm cơ hội thực tập..."
                    rows={4}
                    maxLength={PROFILE_LIMITS.BIO_MAX}
                    value={form.bio}
                    error={fieldErrors.bio}
                    onChange={handleFieldChange}
                  />
                </div>

                <SkillEditor
                  label="Kỹ năng chuyên môn (Chuẩn hóa theo danh mục hệ thống)"
                  inputId="profile-skill-input"
                  skills={form.skills}
                  onChange={handleSkillsChange}
                  maxSkills={PROFILE_LIMITS.MAX_SKILLS}
                  maxSkillLength={PROFILE_LIMITS.SKILL_MAX_LENGTH}
                  error={fieldErrors.skills}
                  disabled={saving}
                  helperText="Tối đa 20 kỹ năng, mỗi kỹ năng tối đa 50 ký tự. Có thể nhập nhiều kỹ năng cách nhau bằng dấu phẩy."
                />

                <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={saving}
                    onClick={() => profile && applyProfileToForm(profile)}
                  >
                    Khôi phục
                  </Button>
                  <Button type="submit" variant="primary" isLoading={saving}>
                    {saving ? 'Đang lưu...' : 'Cập nhật hồ sơ'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
