'use client';

/**
 * CandidateCvsPage – Quản lý CV sinh viên (UC31–UC35 / OOAD CV01–CV05)
 *
 * Vertical Slice S2-M02-04:
 *  - UC31: Xem danh sách CV và xác định CV mặc định
 *  - UC32: Xem chi tiết nội dung CV để xem trước hoặc in
 *  - UC33: Tạo CV mới (mục tiêu, học vấn, kinh nghiệm, kỹ năng)
 *  - UC34: Cập nhật CV / Đặt nhanh làm CV mặc định
 *  - UC35: Xóa CV (kiểm tra điều kiện không xóa CV đang ứng tuyển)
 */

import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { apiClient, ApiClientError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import type {
  CvListItemDto,
  CvListResponseDto,
  CvDetailResponseDto,
  CreateCvRequestDto,
  UpdateCvRequestDto,
  CvDto,
  ExperienceItemDto,
} from '@campusjob/contracts';

export default function CandidateCvsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [cvs, setCvs] = useState<CvListItemDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Modal Create CV
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: '',
    summary: '',
    skills: '',
    school: '',
    major: '',
    startDate: '',
    endDate: '',
    company: '',
    position: '',
    expStartDate: '',
    isDefault: false,
  });

  // Modal View CV Detail (UC32)
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedCv, setSelectedCv] = useState<CvDto | null>(null);

  // Modal Edit CV (UC34) - Bám sát 100% các trường của form Tạo CV
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editExperiences, setEditExperiences] = useState<ExperienceItemDto[]>([]);
  const [editForm, setEditForm] = useState({
    title: '',
    summary: '',
    skills: '',
    school: '',
    major: '',
    startDate: '',
    endDate: '',
    isDefault: false,
  });

  // Modal Delete Confirm (UC35)
  const [deleteTarget, setDeleteTarget] = useState<CvListItemDto | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Load danh sách CV (UC31)
  const loadCvs = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient<CvListResponseDto>('/students/cvs');
      setCvs(res.data);
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : 'Không thể tải danh sách CV. Vui lòng thử lại.',
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCvs();
  }, []);

  // Xử lý tạo CV mới (UC33)
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.title.trim()) {
      setError('Tiêu đề CV không được để trống.');
      return;
    }

    try {
      setCreating(false);
      setError(null);
      const skillsArray = createForm.skills
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const payload: CreateCvRequestDto = {
        title: createForm.title.trim(),
        summary: createForm.summary.trim() || undefined,
        isDefault: createForm.isDefault,
        skills: skillsArray.length > 0 ? skillsArray : undefined,
        educations: createForm.school.trim()
          ? [
              {
                school: createForm.school.trim(),
                major: createForm.major.trim() || 'Chuyên ngành chính',
                startDate: createForm.startDate.trim() || '2021-09',
                endDate: createForm.endDate.trim() || undefined,
              },
            ]
          : undefined,
        experiences: createForm.company.trim()
          ? [
              {
                company: createForm.company.trim(),
                position: createForm.position.trim() || 'Thực tập sinh',
                startDate: createForm.expStartDate.trim() || '2024-06',
              },
            ]
          : undefined,
      };

      await apiClient('/students/cvs', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setIsCreateOpen(false);
      setCreateForm({
        title: '',
        summary: '',
        skills: '',
        school: '',
        major: '',
        startDate: '',
        endDate: '',
        company: '',
        position: '',
        expStartDate: '',
        isDefault: false,
      });
      setSuccessMessage('Tạo CV mới thành công.');
      await loadCvs();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : 'Không thể tạo CV. Vui lòng kiểm tra lại thông tin.',
      );
    } finally {
      setCreating(false);
    }
  };

  // Xem chi tiết CV (UC32)
  const handleOpenDetail = async (cvId: string) => {
    try {
      setIsDetailOpen(true);
      setDetailLoading(true);
      const res = await apiClient<CvDetailResponseDto>(`/students/cvs/${cvId}`);
      setSelectedCv(res.cv);
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : 'Không thể tải chi tiết CV.',
      );
      setIsDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  // Đặt làm CV mặc định (UC34)
  const handleSetDefault = async (cvId: string) => {
    try {
      setError(null);
      await apiClient(`/students/cvs/${cvId}/default`, {
        method: 'PATCH',
      });
      setSuccessMessage('Đã đổi CV mặc định thành công.');
      await loadCvs();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : 'Không thể đặt làm CV mặc định.',
      );
    }
  };

  // Mở modal sửa CV (UC34)
  const handleOpenEdit = async (cvId: string) => {
    try {
      setEditId(cvId);
      const res = await apiClient<CvDetailResponseDto>(`/students/cvs/${cvId}`);
      const edu = res.cv.educations?.[0];
      setEditExperiences(res.cv.experiences || []);
      setEditForm({
        title: res.cv.title || '',
        summary: res.cv.summary || '',
        skills: res.cv.skills ? res.cv.skills.join(', ') : '',
        school: edu?.school || '',
        major: edu?.major || '',
        startDate: edu?.startDate || '',
        endDate: edu?.endDate || '',
        isDefault: res.cv.isDefault ?? false,
      });
      setIsEditOpen(true);
    } catch {
      setError('Không thể mở thông tin chỉnh sửa CV.');
    }
  };

  // Xử lý cập nhật CV (UC34)
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editId) return;

    try {
      setEditing(true);
      setError(null);
      const skillsArray = editForm.skills
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const educations = editForm.school.trim()
        ? [
            {
              school: editForm.school.trim(),
              major: editForm.major.trim() || 'Chuyên ngành chính',
              startDate: editForm.startDate.trim() || '2021-09',
              endDate: editForm.endDate.trim() || undefined,
            },
          ]
        : [];

      const payload: UpdateCvRequestDto = {
        title: editForm.title.trim(),
        summary: editForm.summary.trim() || undefined,
        skills: skillsArray,
        educations,
        isDefault: editForm.isDefault,
        experiences: editExperiences.length > 0 ? editExperiences : undefined,
      };

      await apiClient(`/students/cvs/${editId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });

      setIsEditOpen(false);
      setSuccessMessage('Cập nhật thông tin CV thành công.');
      await loadCvs();
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : 'Không thể cập nhật CV.',
      );
    } finally {
      setEditing(false);
    }
  };

  // Xóa CV (UC35)
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;

    try {
      setDeleting(true);
      setError(null);
      await apiClient(`/students/cvs/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      setDeleteTarget(null);
      setSuccessMessage('Đã xóa CV thành công.');
      await loadCvs();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : 'Không thể xóa CV này. Vui lòng kiểm tra lại.',
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-6 no-print">
        <PageHeader
          title="Quản lý CV"
          description="Tạo và quản lý các phiên bản CV để sẵn sàng nộp hồ sơ ứng tuyển."
          action={
            <Button variant="primary" onClick={() => setIsCreateOpen(true)}>
              + Tạo CV mới
            </Button>
          }
        />

      {error && (
        <Alert variant="destructive">
          <p>{error}</p>
        </Alert>
      )}

      {successMessage && (
        <Alert variant="success">
          <p>{successMessage}</p>
        </Alert>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : cvs.length === 0 ? (
        <EmptyState
          title="Bạn chưa có CV nào"
          description="Hãy tạo CV mới để bắt đầu ứng tuyển vào các cơ hội thực tập và việc làm phù hợp."
          actionLabel="Tạo CV đầu tiên"
          onAction={() => setIsCreateOpen(true)}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cvs.map((cv) => (
            <Card
              key={cv.id}
              className={`flex flex-col justify-between transition-all ${
                cv.isDefault
                  ? 'border-primary ring-1 ring-primary/30 shadow-md bg-card'
                  : 'hover:border-border/80'
              }`}
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base line-clamp-2">
                    {cv.title}
                  </CardTitle>
                  {cv.isDefault && (
                    <Badge variant="success" className="shrink-0">
                      Mặc định
                    </Badge>
                  )}
                </div>
                <CardDescription className="text-xs">
                  Cập nhật: {new Date(cv.updatedAt).toLocaleDateString('vi-VN')}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4 flex-1">
                {cv.skills && cv.skills.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {cv.skills.slice(0, 5).map((skill, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-muted text-muted-foreground"
                      >
                        {skill}
                      </span>
                    ))}
                    {cv.skills.length > 5 && (
                      <span className="text-xs text-muted-foreground self-center">
                        +{cv.skills.length - 5}
                      </span>
                    )}
                  </div>
                )}
              </CardContent>

              <CardFooter className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenDetail(cv.id)}
                  >
                    Xem
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenEdit(cv.id)}
                  >
                    Sửa
                  </Button>
                </div>

                <div className="flex items-center gap-1.5">
                  {!cv.isDefault && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSetDefault(cv.id)}
                    >
                      Đặt mặc định
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:bg-destructive/10"
                    onClick={() => setDeleteTarget(cv)}
                  >
                    Xóa
                  </Button>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
      </div>

      {/* MODAL TẠO CV MỚI (UC33) */}
      <Dialog
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Tạo CV mới"
        description="Điền thông tin kỹ năng, học vấn và mục tiêu nghề nghiệp của bạn."
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Tiêu đề CV <span className="text-destructive">*</span>
            </label>
            <Input
              required
              placeholder="VD: CV Lập trình viên Backend NestJS"
              value={createForm.title}
              onChange={(e) =>
                setCreateForm({ ...createForm, title: e.target.value })
              }
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Tóm tắt mục tiêu nghề nghiệp
            </label>
            <Textarea
              rows={3}
              placeholder="Giới thiệu bản thân và định hướng nghề nghiệp..."
              value={createForm.summary}
              onChange={(e) =>
                setCreateForm({ ...createForm, summary: e.target.value })
              }
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Kỹ năng (phân tách bằng dấu phẩy)
            </label>
            <Input
              placeholder="VD: TypeScript, React, NestJS, PostgreSQL"
              value={createForm.skills}
              onChange={(e) =>
                setCreateForm({ ...createForm, skills: e.target.value })
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Trường học</label>
              <Input
                placeholder="VD: ĐH Công nghệ Thông tin"
                value={createForm.school}
                onChange={(e) =>
                  setCreateForm({ ...createForm, school: e.target.value })
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Chuyên ngành</label>
              <Input
                placeholder="VD: Kỹ thuật Phần mềm"
                value={createForm.major}
                onChange={(e) =>
                  setCreateForm({ ...createForm, major: e.target.value })
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Bắt đầu học (YYYY-MM)</label>
              <Input
                placeholder="2021-09"
                value={createForm.startDate}
                onChange={(e) =>
                  setCreateForm({ ...createForm, startDate: e.target.value })
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Tốt nghiệp (YYYY-MM)</label>
              <Input
                placeholder="2025-06"
                value={createForm.endDate}
                onChange={(e) =>
                  setCreateForm({ ...createForm, endDate: e.target.value })
                }
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="isDefaultCheckbox"
              className="rounded border-border text-primary focus:ring-primary h-4 w-4"
              checked={createForm.isDefault}
              onChange={(e) =>
                setCreateForm({ ...createForm, isDefault: e.target.checked })
              }
            />
            <label htmlFor="isDefaultCheckbox" className="text-sm">
              Đặt làm CV mặc định
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCreateOpen(false)}
            >
              Hủy
            </Button>
            <Button type="submit" variant="primary" disabled={creating}>
              {creating ? 'Đang tạo...' : 'Tạo CV'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* MODAL XEM CHI TIẾT CV (UC32) */}
      <Dialog
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        title="Xem trước hồ sơ CV"
        description="Định dạng hồ sơ CV chuẩn dành cho xem trước và in ấn (khổ A4)."
        className="max-w-3xl"
      >
        {detailLoading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : selectedCv ? (
          <div className="space-y-4">
            <div className="max-h-[70vh] overflow-y-auto pr-1">
              {/* TÀI LIỆU CV IN CHUẨN A4 */}
              <div
                id="cv-printable-document"
                className="bg-card text-card-foreground p-6 sm:p-8 rounded-lg border border-border print:border-none print:p-0 print:m-0 print:bg-white print:text-gray-900 font-sans"
              >
                {/* Header CV: Tên ứng viên, Chức danh & Liên hệ */}
                <div className="border-b-2 border-gray-800 pb-5 mb-6">
                  <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2">
                    <div>
                      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground uppercase">
                        {user?.fullName || 'Sinh viên CampusJob'}
                      </h1>
                      <h2 className="text-base sm:text-lg font-semibold text-primary mt-1">
                        {selectedCv.title}
                      </h2>
                    </div>
                    {selectedCv.isDefault && (
                      <span className="no-print self-start sm:self-auto px-2.5 py-1 text-xs font-medium rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                        CV Mặc định
                      </span>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm text-muted-foreground">
                    {user?.email && (
                      <span className="flex items-center gap-1.5">
                        <span className="font-medium text-foreground">Email:</span> {user.email}
                      </span>
                    )}
                    <span className="flex items-center gap-1.5">
                      <span className="font-medium text-foreground">Cập nhật:</span>{' '}
                      {new Date(selectedCv.updatedAt).toLocaleDateString('vi-VN')}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="font-medium text-foreground">Nền tảng:</span> Hồ sơ ứng viên CampusJob
                    </span>
                  </div>
                </div>

                <div className="space-y-6">
                  {/* 1. MỤC TIÊU NGHỀ NGHIỆP */}
                  {selectedCv.summary && (
                    <section>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-1 mb-2">
                        Mục tiêu nghề nghiệp
                      </h3>
                      <p className="text-sm text-foreground leading-relaxed whitespace-pre-line bg-muted/30 p-3 rounded-md print:bg-transparent print:p-0">
                        {selectedCv.summary}
                      </p>
                    </section>
                  )}

                  {/* 2. KỸ NĂNG CHUYÊN MÔN */}
                  {selectedCv.skills.length > 0 && (
                    <section>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-1 mb-2.5">
                        Kỹ năng chuyên môn
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {selectedCv.skills.map((skill, idx) => (
                          <span
                            key={idx}
                            className="px-2.5 py-1 text-xs font-medium rounded bg-muted text-foreground border border-border print:bg-white print:border-gray-300"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* 3. HỌC VẤN */}
                  {selectedCv.educations.length > 0 && (
                    <section>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-1 mb-3">
                        Học vấn & Bằng cấp
                      </h3>
                      <div className="space-y-3">
                        {selectedCv.educations.map((edu, idx) => (
                          <div key={idx} className="text-sm border-l-2 border-primary/60 pl-3">
                            <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between font-semibold text-foreground">
                              <span>{edu.school}</span>
                              <span className="text-xs font-normal text-muted-foreground sm:text-right">
                                {edu.startDate} — {edu.endDate || 'Hiện tại'}
                              </span>
                            </div>
                            <div className="text-muted-foreground text-xs sm:text-sm mt-0.5">
                              Chuyên ngành: <span className="font-medium text-foreground">{edu.major}</span>
                              {edu.gpa && <span className="ml-2 text-muted-foreground">(GPA: {edu.gpa})</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* 4. KINH NGHIỆM LÀM VIỆC */}
                  {selectedCv.experiences.length > 0 && (
                    <section>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-1 mb-3">
                        Kinh nghiệm làm việc & Thực tập
                      </h3>
                      <div className="space-y-3.5">
                        {selectedCv.experiences.map((exp, idx) => (
                          <div key={idx} className="text-sm border-l-2 border-primary/60 pl-3">
                            <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between font-semibold text-foreground">
                              <span>{exp.position}</span>
                              <span className="text-xs font-normal text-muted-foreground sm:text-right">
                                {exp.startDate} — {exp.endDate || 'Hiện tại'}
                              </span>
                            </div>
                            <div className="text-primary font-medium text-xs sm:text-sm mt-0.5">
                              {exp.company}
                            </div>
                            {exp.description && (
                              <p className="text-xs sm:text-sm text-foreground mt-1 leading-relaxed whitespace-pre-line">
                                {exp.description}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* 5. DỰ ÁN TIÊU BIỂU */}
                  {selectedCv.projects && selectedCv.projects.length > 0 && (
                    <section>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-1 mb-3">
                        Dự án tiêu biểu
                      </h3>
                      <div className="space-y-3">
                        {selectedCv.projects.map((proj, idx) => (
                          <div key={idx} className="text-sm border-l-2 border-primary/60 pl-3">
                            <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between font-semibold text-foreground">
                              <span>{proj.name}</span>
                              {(proj.startDate || proj.endDate) && (
                                <span className="text-xs font-normal text-muted-foreground sm:text-right">
                                  {proj.startDate || ''} {proj.endDate ? `— ${proj.endDate}` : ''}
                                </span>
                              )}
                            </div>
                            {proj.role && (
                              <div className="text-xs text-muted-foreground font-medium">Vai trò: {proj.role}</div>
                            )}
                            {proj.description && (
                              <p className="text-xs sm:text-sm text-foreground mt-1 leading-relaxed">
                                {proj.description}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* 6. CHỨNG CHỈ */}
                  {selectedCv.certifications && selectedCv.certifications.length > 0 && (
                    <section>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-1 mb-3">
                        Chứng chỉ & Giải thưởng
                      </h3>
                      <div className="space-y-2">
                        {selectedCv.certifications.map((cert, idx) => (
                          <div key={idx} className="text-sm border-l-2 border-primary/60 pl-3">
                            <div className="font-semibold text-foreground">{cert.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {cert.issuer} {cert.issueDate && `• ${cert.issueDate}`}
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-border no-print">
              <Button variant="outline" onClick={() => window.print()}>
                In CV (A4)
              </Button>
              <Button variant="primary" onClick={() => setIsDetailOpen(false)}>
                Đóng
              </Button>
            </div>
          </div>
        ) : null}
      </Dialog>

      {/* MODAL SỬA CV (UC34) */}
      <Dialog
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title="Chỉnh sửa CV"
        description="Cập nhật thông tin kỹ năng, học vấn và mục tiêu nghề nghiệp của bạn."
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Tiêu đề CV <span className="text-destructive">*</span>
            </label>
            <Input
              required
              placeholder="VD: CV Lập trình viên Backend NestJS"
              value={editForm.title}
              onChange={(e) =>
                setEditForm({ ...editForm, title: e.target.value })
              }
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Tóm tắt mục tiêu nghề nghiệp
            </label>
            <Textarea
              rows={3}
              placeholder="Giới thiệu bản thân và định hướng nghề nghiệp..."
              value={editForm.summary}
              onChange={(e) =>
                setEditForm({ ...editForm, summary: e.target.value })
              }
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Kỹ năng (phân tách bằng dấu phẩy)
            </label>
            <Input
              placeholder="VD: TypeScript, React, NestJS, PostgreSQL"
              value={editForm.skills}
              onChange={(e) =>
                setEditForm({ ...editForm, skills: e.target.value })
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Trường học</label>
              <Input
                placeholder="VD: ĐH Công nghệ Thông tin"
                value={editForm.school}
                onChange={(e) =>
                  setEditForm({ ...editForm, school: e.target.value })
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Chuyên ngành</label>
              <Input
                placeholder="VD: Kỹ thuật Phần mềm"
                value={editForm.major}
                onChange={(e) =>
                  setEditForm({ ...editForm, major: e.target.value })
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Bắt đầu học (YYYY-MM)</label>
              <Input
                placeholder="2021-09"
                value={editForm.startDate}
                onChange={(e) =>
                  setEditForm({ ...editForm, startDate: e.target.value })
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Tốt nghiệp (YYYY-MM)</label>
              <Input
                placeholder="2025-06"
                value={editForm.endDate}
                onChange={(e) =>
                  setEditForm({ ...editForm, endDate: e.target.value })
                }
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="editIsDefaultCheckbox"
              className="rounded border-border text-primary focus:ring-primary h-4 w-4"
              checked={editForm.isDefault}
              onChange={(e) =>
                setEditForm({ ...editForm, isDefault: e.target.checked })
              }
            />
            <label htmlFor="editIsDefaultCheckbox" className="text-sm">
              Đặt làm CV mặc định
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsEditOpen(false)}
            >
              Hủy
            </Button>
            <Button type="submit" variant="primary" disabled={editing}>
              {editing ? 'Đang lưu...' : 'Lưu thay đổi'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* DIALOG XÁC NHẬN XÓA CV (UC35) */}
      <Dialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Xác nhận xóa CV"
        description={`Bạn có chắc chắn muốn xóa "${deleteTarget?.title}" không? Thao tác này không thể hoàn tác.`}
      >
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => setDeleteTarget(null)}>
            Hủy
          </Button>
          <Button
            variant="destructive"
            onClick={handleDeleteConfirm}
            disabled={deleting}
          >
            {deleting ? 'Đang xóa...' : 'Xóa CV'}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
