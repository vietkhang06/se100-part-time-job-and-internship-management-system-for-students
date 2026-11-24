'use client';

/**
 * CandidateCvsPage – Quản lý CV sinh viên (UC31–UC35 / OOAD CV01–CV05)
 *
 * Task S7-M02-01:
 *  - Kết nối 100% với API thật qua m02Api (tự động refresh phiên khi F5).
 *  - Hỗ trợ đầy đủ: Danh sách CV (UC31), Xem chi tiết & In A4 (UC32), Tạo CV (UC33),
 *    Sửa CV (UC34), Đặt mặc định (UC34), Xóa CV (UC35), Upload tệp PDF/DOC/DOCX (UC33b)
 *    và Tải xuống tệp CV đính kèm (UC32b).
 *  - Tích hợp SkillEditor (tối đa 30 kỹ năng) và trình chỉnh sửa mục con (Học vấn, Kinh nghiệm,
 *    Dự án, Chứng chỉ) đúng 100% theo Contract C-03, không tự chèn dữ liệu giả.
 *  - Xử lý rõ ràng các trạng thái loading/error/empty/success và các mã lỗi 401/403/409/413/validation.
 *  - Responsive tại 360px, 768px và 1440px.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
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
import { ErrorState } from '@/components/ui/error-state';
import { SkillEditor } from '@/components/students/skill-editor';
import { useAuth } from '@/lib/auth-context';
import { m02Api } from '@/lib/m02-api';
import {
  CV_LIMITS,
  CvFormValues,
  formatM02ErrorMessage,
  validateCvForm,
  validateCvUploadFile,
} from '@/lib/m02-validation';
import type {
  CertificationItemDto,
  CreateCvRequestDto,
  CvDto,
  CvListItemDto,
  EducationItemDto,
  ExperienceItemDto,
  FileAssetDto,
  ProjectItemDto,
  UpdateCvRequestDto,
} from '@campusjob/contracts';

const EMPTY_CV_FORM: CvFormValues = {
  title: '',
  summary: '',
  isDefault: false,
  fileUrl: '',
  fileAssetId: null,
  skills: [],
  educations: [],
  experiences: [],
  projects: [],
  certifications: [],
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function CandidateCvsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [cvs, setCvs] = useState<CvListItemDto[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Modal Create / Edit CV
  const [editorMode, setEditorMode] = useState<'create' | 'edit' | null>(null);
  const [editingCvId, setEditingCvId] = useState<string | null>(null);
  const [editorLoading, setEditorLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<CvFormValues>(EMPTY_CV_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  // Upload FileAsset state inside Create/Edit modal
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedAsset, setUploadedAsset] = useState<FileAssetDto | null>(null);

  // Modal View CV Detail (UC32)
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedCv, setSelectedCv] = useState<CvDto | null>(null);

  // Modal Delete Confirm (UC35)
  const [deleteTarget, setDeleteTarget] = useState<CvListItemDto | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadCvs = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await m02Api.listCvs();
      setCvs(res.data);
    } catch (err) {
      setLoadError(
        formatM02ErrorMessage(err, 'Không thể tải danh sách CV. Vui lòng thử lại.'),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    void loadCvs();
  }, [authLoading, loadCvs]);

  const openCreateModal = () => {
    setActionError(null);
    setSuccessMessage(null);
    setEditorMode('create');
    setEditingCvId(null);
    setForm({
      ...EMPTY_CV_FORM,
      isDefault: cvs.length === 0,
    });
    setFieldErrors({});
    setFormError(null);
    setUploadError(null);
    setUploadedAsset(null);
  };

  const openEditModal = async (cvId: string) => {
    setActionError(null);
    setSuccessMessage(null);
    setEditorMode('edit');
    setEditingCvId(cvId);
    setEditorLoading(true);
    setFieldErrors({});
    setFormError(null);
    setUploadError(null);
    setUploadedAsset(null);

    try {
      const res = await m02Api.getCvDetail(cvId);
      const cv = res.cv;
      setForm({
        title: cv.title || '',
        summary: cv.summary || '',
        isDefault: cv.isDefault ?? false,
        fileUrl: cv.fileUrl || '',
        fileAssetId: cv.fileAssetId ?? null,
        skills: Array.isArray(cv.skills) ? [...cv.skills] : [],
        educations: Array.isArray(cv.educations)
          ? cv.educations.map((e) => ({ ...e }))
          : [],
        experiences: Array.isArray(cv.experiences)
          ? cv.experiences.map((e) => ({ ...e }))
          : [],
        projects: Array.isArray(cv.projects)
          ? cv.projects.map((p) => ({ ...p }))
          : [],
        certifications: Array.isArray(cv.certifications)
          ? cv.certifications.map((c) => ({ ...c }))
          : [],
      });
    } catch (err) {
      setEditorMode(null);
      setEditingCvId(null);
      setActionError(
        formatM02ErrorMessage(err, 'Không thể mở thông tin chỉnh sửa CV.'),
      );
    } finally {
      setEditorLoading(false);
    }
  };

  const closeEditorModal = () => {
    if (submitting || uploadingFile) return;
    setEditorMode(null);
    setEditingCvId(null);
    setFormError(null);
    setUploadError(null);
  };

  // Xử lý chọn và upload tệp PDF/DOC/DOCX lên POST /students/cvs/upload
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    const clientFileError = validateCvUploadFile(file);
    if (clientFileError) {
      setUploadError(clientFileError);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setUploadingFile(true);
    try {
      const asset = await m02Api.uploadCvFile(file);
      setUploadedAsset(asset);
      setForm((prev) => ({
        ...prev,
        fileAssetId: asset.id,
      }));
    } catch (err) {
      setUploadError(
        formatM02ErrorMessage(
          err,
          'Không thể tải tệp CV lên máy chủ. Vui lòng kiểm tra định dạng PDF/DOCX và dung lượng <= 10MB.',
        ),
      );
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveAttachment = () => {
    setUploadedAsset(null);
    setUploadError(null);
    setForm((prev) => ({
      ...prev,
      fileAssetId: null,
      fileUrl: '',
    }));
  };

  // Lưu CV (Create hoặc Update)
  const handleEditorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const validationErrors = validateCvForm(form);
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      setFormError('Vui lòng kiểm tra và sửa các thông tin chưa hợp lệ bên dưới.');
      return;
    }

    setFieldErrors({});
    setSubmitting(true);

    const cleanedEducations: EducationItemDto[] = form.educations.map((edu) => ({
      ...(edu.id ? { id: edu.id } : {}),
      school: edu.school.trim(),
      major: edu.major.trim(),
      startDate: edu.startDate.trim(),
      ...(edu.endDate?.trim() ? { endDate: edu.endDate.trim() } : {}),
      ...(typeof edu.isCurrent === 'boolean' ? { isCurrent: edu.isCurrent } : {}),
      ...(edu.gpa?.trim() ? { gpa: edu.gpa.trim() } : {}),
      ...(edu.description?.trim() ? { description: edu.description.trim() } : {}),
    }));

    const cleanedExperiences: ExperienceItemDto[] = form.experiences.map((exp) => ({
      ...(exp.id ? { id: exp.id } : {}),
      company: exp.company.trim(),
      position: exp.position.trim(),
      startDate: exp.startDate.trim(),
      ...(exp.endDate?.trim() ? { endDate: exp.endDate.trim() } : {}),
      ...(typeof exp.isCurrent === 'boolean' ? { isCurrent: exp.isCurrent } : {}),
      ...(exp.description?.trim() ? { description: exp.description.trim() } : {}),
    }));

    const cleanedProjects: ProjectItemDto[] = form.projects.map((proj) => ({
      ...(proj.id ? { id: proj.id } : {}),
      name: proj.name.trim(),
      ...(proj.role?.trim() ? { role: proj.role.trim() } : {}),
      ...(proj.startDate?.trim() ? { startDate: proj.startDate.trim() } : {}),
      ...(proj.endDate?.trim() ? { endDate: proj.endDate.trim() } : {}),
      ...(proj.url?.trim() ? { url: proj.url.trim() } : {}),
      ...(proj.description?.trim() ? { description: proj.description.trim() } : {}),
    }));

    const cleanedCertifications: CertificationItemDto[] = form.certifications.map((cert) => ({
      ...(cert.id ? { id: cert.id } : {}),
      name: cert.name.trim(),
      issuer: cert.issuer.trim(),
      ...(cert.issueDate?.trim() ? { issueDate: cert.issueDate.trim() } : {}),
      ...(cert.url?.trim() ? { url: cert.url.trim() } : {}),
    }));

    try {
      if (editorMode === 'create') {
        const createPayload: CreateCvRequestDto = {
          title: form.title.trim(),
          summary: form.summary.trim() || undefined,
          isDefault: form.isDefault,
          fileUrl: form.fileUrl?.trim() || undefined,
          fileAssetId: form.fileAssetId || undefined,
          skills: form.skills,
          educations: cleanedEducations,
          experiences: cleanedExperiences,
          projects: cleanedProjects,
          certifications: cleanedCertifications,
        };
        await m02Api.createCv(createPayload);
        setSuccessMessage('Tạo CV mới thành công.');
      } else if (editorMode === 'edit' && editingCvId) {
        const updatePayload: UpdateCvRequestDto = {
          title: form.title.trim(),
          summary: form.summary.trim(),
          isDefault: form.isDefault,
          fileUrl: form.fileUrl?.trim() ? form.fileUrl.trim() : null,
          fileAssetId: form.fileAssetId ?? null,
          skills: form.skills,
          educations: cleanedEducations,
          experiences: cleanedExperiences,
          projects: cleanedProjects,
          certifications: cleanedCertifications,
        };
        await m02Api.updateCv(editingCvId, updatePayload);
        setSuccessMessage('Cập nhật thông tin CV thành công.');
      }

      setEditorMode(null);
      setEditingCvId(null);
      await loadCvs();
    } catch (err) {
      setFormError(
        formatM02ErrorMessage(
          err,
          editorMode === 'create'
            ? 'Không thể tạo CV mới. Vui lòng kiểm tra lại thông tin.'
            : 'Không thể cập nhật CV. Vui lòng kiểm tra lại thông tin.',
        ),
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Xem chi tiết CV (UC32)
  const handleOpenDetail = async (cvId: string) => {
    setActionError(null);
    setIsDetailOpen(true);
    setDetailLoading(true);
    try {
      const res = await m02Api.getCvDetail(cvId);
      setSelectedCv(res.cv);
    } catch (err) {
      setActionError(
        formatM02ErrorMessage(err, 'Không thể tải chi tiết CV.'),
      );
      setIsDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  // Đặt làm CV mặc định (UC34)
  const handleSetDefault = async (cvId: string) => {
    setBusyId(cvId);
    setActionError(null);
    setSuccessMessage(null);
    try {
      const res = await m02Api.setDefaultCv(cvId);
      setSuccessMessage(res.message || 'Đã đặt làm CV mặc định thành công.');
      await loadCvs();
    } catch (err) {
      setActionError(
        formatM02ErrorMessage(err, 'Không thể đặt làm CV mặc định.'),
      );
    } finally {
      setBusyId(null);
    }
  };

  // Tải xuống tệp CV (UC32b)
  const handleDownloadFile = async (cvId: string, title: string) => {
    setBusyId(cvId);
    setActionError(null);
    try {
      const safeSlug = title
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/gi, '-')
        .replace(/^-|-$/g, '');
      await m02Api.downloadCvFile(cvId, `${safeSlug || 'cv'}.pdf`);
    } catch (err) {
      setActionError(
        formatM02ErrorMessage(err, 'Không thể tải xuống tệp đính kèm của CV này.'),
      );
    } finally {
      setBusyId(null);
    }
  };

  // Xóa CV (UC35)
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setActionError(null);
    setSuccessMessage(null);
    try {
      const res = await m02Api.deleteCv(deleteTarget.id);
      setDeleteTarget(null);
      setSuccessMessage(res.message || 'Đã xóa CV thành công.');
      await loadCvs();
    } catch (err) {
      setDeleteTarget(null);
      setActionError(
        formatM02ErrorMessage(
          err,
          'Không thể xóa CV này. Vui lòng kiểm tra xem CV có đang dùng trong đơn ứng tuyển hay không.',
        ),
      );
    } finally {
      setDeleting(false);
    }
  };

  // Helpers chỉnh sửa danh sách mục con
  const addEducation = () => {
    if (form.educations.length >= CV_LIMITS.MAX_SUB_ITEMS) return;
    setForm((prev) => ({
      ...prev,
      educations: [
        ...prev.educations,
        { school: '', major: '', startDate: '', endDate: '', gpa: '', description: '' },
      ],
    }));
  };

  const updateEducation = (idx: number, patch: Partial<EducationItemDto>) => {
    setForm((prev) => ({
      ...prev,
      educations: prev.educations.map((item, i) => (i === idx ? { ...item, ...patch } : item)),
    }));
  };

  const removeEducation = (idx: number) => {
    setForm((prev) => ({
      ...prev,
      educations: prev.educations.filter((_, i) => i !== idx),
    }));
  };

  const addExperience = () => {
    if (form.experiences.length >= CV_LIMITS.MAX_SUB_ITEMS) return;
    setForm((prev) => ({
      ...prev,
      experiences: [
        ...prev.experiences,
        { company: '', position: '', startDate: '', endDate: '', description: '' },
      ],
    }));
  };

  const updateExperience = (idx: number, patch: Partial<ExperienceItemDto>) => {
    setForm((prev) => ({
      ...prev,
      experiences: prev.experiences.map((item, i) => (i === idx ? { ...item, ...patch } : item)),
    }));
  };

  const removeExperience = (idx: number) => {
    setForm((prev) => ({
      ...prev,
      experiences: prev.experiences.filter((_, i) => i !== idx),
    }));
  };

  const addProject = () => {
    if (form.projects.length >= CV_LIMITS.MAX_SUB_ITEMS) return;
    setForm((prev) => ({
      ...prev,
      projects: [
        ...prev.projects,
        { name: '', role: '', startDate: '', endDate: '', url: '', description: '' },
      ],
    }));
  };

  const updateProject = (idx: number, patch: Partial<ProjectItemDto>) => {
    setForm((prev) => ({
      ...prev,
      projects: prev.projects.map((item, i) => (i === idx ? { ...item, ...patch } : item)),
    }));
  };

  const removeProject = (idx: number) => {
    setForm((prev) => ({
      ...prev,
      projects: prev.projects.filter((_, i) => i !== idx),
    }));
  };

  const addCertification = () => {
    if (form.certifications.length >= CV_LIMITS.MAX_SUB_ITEMS) return;
    setForm((prev) => ({
      ...prev,
      certifications: [
        ...prev.certifications,
        { name: '', issuer: '', issueDate: '', url: '' },
      ],
    }));
  };

  const updateCertification = (idx: number, patch: Partial<CertificationItemDto>) => {
    setForm((prev) => ({
      ...prev,
      certifications: prev.certifications.map((item, i) =>
        i === idx ? { ...item, ...patch } : item,
      ),
    }));
  };

  const removeCertification = (idx: number) => {
    setForm((prev) => ({
      ...prev,
      certifications: prev.certifications.filter((_, i) => i !== idx),
    }));
  };

  return (
    <div className="space-y-6">
      <div className="space-y-6 no-print">
        <PageHeader
          title="Quản lý CV"
          description="Tạo, tải lên tệp PDF/DOCX và quản lý các phiên bản CV để sẵn sàng nộp hồ sơ ứng tuyển."
          action={
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={loading}
                onClick={() => void loadCvs()}
              >
                Làm mới
              </Button>
              <Button
                type="button"
                variant="primary"
                disabled={cvs.length >= 10}
                onClick={openCreateModal}
              >
                + Tạo CV mới
              </Button>
            </div>
          }
        />

        {actionError && (
          <Alert variant="destructive" title="Không thể thực hiện thao tác">
            {actionError}
          </Alert>
        )}

        {successMessage && (
          <Alert variant="success" title="Thành công">
            {successMessage}
          </Alert>
        )}

        {authLoading || loading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : loadError ? (
          <div className="space-y-4">
            <ErrorState message={loadError} onRetry={() => void loadCvs()} />
            {!user && (
              <div className="flex justify-center">
                <Link href="/login">
                  <Button variant="primary">Đi tới trang Đăng nhập</Button>
                </Link>
              </div>
            )}
          </div>
        ) : cvs.length === 0 ? (
          <EmptyState
            title="Bạn chưa có CV nào"
            description="Hãy tạo CV đầu tiên và đính kèm tệp PDF để bắt đầu ứng tuyển vào các cơ hội thực tập và việc làm bán thời gian."
            actionLabel="Tạo CV đầu tiên"
            onAction={openCreateModal}
          />
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>
                Đang hiển thị <strong className="text-foreground">{cvs.length}</strong>/10 CV cho phép
              </span>
              <span>
                Khi ứng tuyển, hệ thống sẽ tạo bản chụp bất biến (CV Snapshot - C-03) từ CV bạn chọn.
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {cvs.map((cv) => {
                const hasAttachment = Boolean(cv.fileAssetId || cv.fileUrl);
                return (
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
                        <CardTitle className="text-base line-clamp-2 break-words">
                          {cv.title}
                        </CardTitle>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          {cv.isDefault && <Badge variant="success">Mặc định</Badge>}
                          {hasAttachment && (
                            <Badge variant="outline" className="text-[11px]">
                              Đính kèm PDF/DOCX
                            </Badge>
                          )}
                        </div>
                      </div>
                      <CardDescription className="text-xs">
                        Cập nhật: {new Date(cv.updatedAt).toLocaleDateString('vi-VN')}
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-4 flex-1">
                      {cv.skills && cv.skills.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {cv.skills.slice(0, 6).map((skill, index) => (
                            <span
                              key={`${skill}-${index}`}
                              className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-muted text-muted-foreground break-all"
                            >
                              {skill}
                            </span>
                          ))}
                          {cv.skills.length > 6 && (
                            <span className="text-xs text-muted-foreground self-center">
                              +{cv.skills.length - 6}
                            </span>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs italic text-muted-foreground">
                          Chưa khai báo kỹ năng trên CV này.
                        </p>
                      )}
                    </CardContent>

                    <CardFooter className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void handleOpenDetail(cv.id)}
                        >
                          Xem
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void openEditModal(cv.id)}
                        >
                          Sửa
                        </Button>
                        {cv.fileAssetId && (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            isLoading={busyId === cv.id}
                            onClick={() => void handleDownloadFile(cv.id, cv.title)}
                          >
                            Tải PDF
                          </Button>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        {!cv.isDefault && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            isLoading={busyId === cv.id}
                            onClick={() => void handleSetDefault(cv.id)}
                          >
                            Đặt mặc định
                          </Button>
                        )}
                        <Button
                          type="button"
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
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* MODAL TẠO / SỬA CV (UC33 & UC34) */}
      <Dialog
        isOpen={editorMode !== null}
        onClose={closeEditorModal}
        title={editorMode === 'create' ? 'Tạo CV mới' : 'Chỉnh sửa CV'}
        description="Điền thông tin mục tiêu nghề nghiệp, kỹ năng, học vấn, kinh nghiệm và tải lên tệp CV (PDF/DOCX <= 10MB)."
        className="max-w-3xl"
      >
        {editorLoading ? (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        ) : (
          <form
            onSubmit={handleEditorSubmit}
            className="max-h-[75vh] overflow-y-auto pr-1 space-y-5"
            noValidate
          >
            {formError && (
              <Alert variant="destructive" title="Dữ liệu chưa hợp lệ">
                {formError}
              </Alert>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Input
                  label="Tiêu đề CV * (2 – 100 ký tự)"
                  required
                  maxLength={CV_LIMITS.TITLE_MAX}
                  placeholder="VD: CV Lập trình viên Backend NestJS"
                  value={form.title}
                  error={fieldErrors.title}
                  onChange={(e) => {
                    setForm((prev) => ({ ...prev, title: e.target.value }));
                    if (fieldErrors.title) {
                      setFieldErrors((prev) => {
                        const next = { ...prev };
                        delete next.title;
                        return next;
                      });
                    }
                  }}
                />
              </div>

              <div className="sm:col-span-2 space-y-1">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="cv-summary-input"
                    className="text-xs font-semibold text-foreground/80"
                  >
                    Tóm tắt mục tiêu nghề nghiệp
                  </label>
                  <span className="text-xs text-muted-foreground">
                    {form.summary.length}/{CV_LIMITS.SUMMARY_MAX} ký tự
                  </span>
                </div>
                <Textarea
                  id="cv-summary-input"
                  rows={3}
                  maxLength={CV_LIMITS.SUMMARY_MAX}
                  placeholder="Giới thiệu bản thân, thế mạnh và định hướng nghề nghiệp..."
                  value={form.summary}
                  error={fieldErrors.summary}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, summary: e.target.value }))
                  }
                />
              </div>
            </div>

            {/* KHU VỰC TẢI LÊN TỆP CV (PDF/DOC/DOCX <= 10MB) */}
            <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                    Tệp CV đính kèm (PDF / DOC / DOCX · Tối đa 10MB)
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Tệp được kiểm tra chữ ký nhị phân (magic bytes) và lưu trữ an toàn qua FileAsset (Contract C-04/C-05).
                  </p>
                </div>
                {form.fileAssetId && (
                  <Badge variant="success">Đã liên kết tệp</Badge>
                )}
              </div>

              {uploadError && (
                <Alert variant="destructive" title="Không thể tải tệp lên">
                  {uploadError}
                </Alert>
              )}

              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <input
                  ref={fileInputRef}
                  id="cv-file-upload-input"
                  type="file"
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={handleFileSelect}
                  disabled={uploadingFile || submitting}
                  className="block w-full text-xs text-muted-foreground file:mr-3 file:rounded-md file:border file:border-border file:bg-background file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-foreground hover:file:bg-muted"
                />
                {uploadingFile && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                    <Spinner className="w-4 h-4" />
                    <span>Đang tải tệp lên...</span>
                  </div>
                )}
              </div>

              {(uploadedAsset || form.fileAssetId) && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2 text-xs">
                  <div className="space-y-0.5 break-all">
                    <div className="font-medium text-foreground">
                      {uploadedAsset?.originalName || 'Tệp CV đã đính kèm trên hệ thống'}
                    </div>
                    <div className="text-muted-foreground">
                      Mã FileAsset: <code>{form.fileAssetId}</code>
                      {uploadedAsset?.sizeBytes
                        ? ` · Dung lượng: ${formatFileSize(uploadedAsset.sizeBytes)}`
                        : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {editingCvId && form.fileAssetId && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void handleDownloadFile(editingCvId, form.title || 'cv')}
                      >
                        Tải tệp hiện tại
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={handleRemoveAttachment}
                    >
                      Gỡ tệp
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* SKILL EDITOR */}
            <SkillEditor
              label="Kỹ năng trên CV (Tối đa 30 kỹ năng)"
              inputId="cv-skill-input"
              skills={form.skills}
              onChange={(nextSkills) =>
                setForm((prev) => ({ ...prev, skills: nextSkills }))
              }
              maxSkills={CV_LIMITS.MAX_SKILLS}
              maxSkillLength={CV_LIMITS.SKILL_MAX_LENGTH}
              error={fieldErrors.skills}
              disabled={submitting}
            />

            {/* DANH SÁCH HỌC VẤN (EDUCATIONS) */}
            <div className="space-y-3 border-t border-border pt-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    Học vấn ({form.educations.length}/{CV_LIMITS.MAX_SUB_ITEMS})
                  </h3>
                  {fieldErrors.educations && (
                    <p className="text-xs text-destructive mt-0.5">{fieldErrors.educations}</p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={form.educations.length >= CV_LIMITS.MAX_SUB_ITEMS}
                  onClick={addEducation}
                >
                  + Thêm học vấn
                </Button>
              </div>

              {form.educations.map((edu, idx) => (
                <div
                  key={edu.id || `edu-${idx}`}
                  className="rounded-lg border border-border bg-muted/10 p-3 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground">
                      Mục học vấn #{idx + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeEducation(idx)}
                      className="text-xs text-destructive hover:underline"
                    >
                      Xóa mục này
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input
                      label="Trường học * (2 – 150 ký tự)"
                      placeholder="VD: ĐH Công nghệ Thông tin - ĐHQG TP.HCM"
                      value={edu.school}
                      onChange={(e) => updateEducation(idx, { school: e.target.value })}
                    />
                    <Input
                      label="Chuyên ngành * (2 – 100 ký tự)"
                      placeholder="VD: Kỹ thuật Phần mềm"
                      value={edu.major}
                      onChange={(e) => updateEducation(idx, { major: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Input
                      label="Bắt đầu * (YYYY-MM)"
                      placeholder="2022-09"
                      value={edu.startDate}
                      onChange={(e) => updateEducation(idx, { startDate: e.target.value })}
                    />
                    <Input
                      label="Kết thúc (YYYY-MM)"
                      placeholder="2026-06"
                      value={edu.endDate || ''}
                      onChange={(e) => updateEducation(idx, { endDate: e.target.value })}
                    />
                    <Input
                      label="GPA (Tùy chọn)"
                      placeholder="3.52/4.0"
                      value={edu.gpa || ''}
                      onChange={(e) => updateEducation(idx, { gpa: e.target.value })}
                    />
                  </div>

                  <Textarea
                    label="Mô tả quá trình học tập (Tùy chọn, tối đa 500 ký tự)"
                    rows={2}
                    placeholder="Thành tích học tập, học bổng, đồ án môn học..."
                    value={edu.description || ''}
                    onChange={(e) => updateEducation(idx, { description: e.target.value })}
                  />
                </div>
              ))}
            </div>

            {/* DANH SÁCH KINH NGHIỆM (EXPERIENCES) */}
            <div className="space-y-3 border-t border-border pt-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    Kinh nghiệm làm việc ({form.experiences.length}/{CV_LIMITS.MAX_SUB_ITEMS})
                  </h3>
                  {fieldErrors.experiences && (
                    <p className="text-xs text-destructive mt-0.5">{fieldErrors.experiences}</p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={form.experiences.length >= CV_LIMITS.MAX_SUB_ITEMS}
                  onClick={addExperience}
                >
                  + Thêm kinh nghiệm
                </Button>
              </div>

              {form.experiences.map((exp, idx) => (
                <div
                  key={exp.id || `exp-${idx}`}
                  className="rounded-lg border border-border bg-muted/10 p-3 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground">
                      Mục kinh nghiệm #{idx + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeExperience(idx)}
                      className="text-xs text-destructive hover:underline"
                    >
                      Xóa mục này
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input
                      label="Công ty / Tổ chức * (2 – 150 ký tự)"
                      placeholder="VD: Công ty Cổ phần Công nghệ ABC"
                      value={exp.company}
                      onChange={(e) => updateExperience(idx, { company: e.target.value })}
                    />
                    <Input
                      label="Vị trí công việc * (2 – 100 ký tự)"
                      placeholder="VD: Thực tập sinh Backend"
                      value={exp.position}
                      onChange={(e) => updateExperience(idx, { position: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input
                      label="Bắt đầu * (YYYY-MM)"
                      placeholder="2025-06"
                      value={exp.startDate}
                      onChange={(e) => updateExperience(idx, { startDate: e.target.value })}
                    />
                    <Input
                      label="Kết thúc (YYYY-MM)"
                      placeholder="2025-09"
                      value={exp.endDate || ''}
                      onChange={(e) => updateExperience(idx, { endDate: e.target.value })}
                    />
                  </div>

                  <Textarea
                    label="Mô tả công việc (Tùy chọn, tối đa 1000 ký tự)"
                    rows={2}
                    placeholder="Xây dựng REST API, viết unit test..."
                    value={exp.description || ''}
                    onChange={(e) => updateExperience(idx, { description: e.target.value })}
                  />
                </div>
              ))}
            </div>

            {/* DANH SÁCH DỰ ÁN (PROJECTS) */}
            <div className="space-y-3 border-t border-border pt-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    Dự án tiêu biểu ({form.projects.length}/{CV_LIMITS.MAX_SUB_ITEMS})
                  </h3>
                  {fieldErrors.projects && (
                    <p className="text-xs text-destructive mt-0.5">{fieldErrors.projects}</p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={form.projects.length >= CV_LIMITS.MAX_SUB_ITEMS}
                  onClick={addProject}
                >
                  + Thêm dự án
                </Button>
              </div>

              {form.projects.map((proj, idx) => (
                <div
                  key={proj.id || `proj-${idx}`}
                  className="rounded-lg border border-border bg-muted/10 p-3 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground">
                      Dự án #{idx + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeProject(idx)}
                      className="text-xs text-destructive hover:underline"
                    >
                      Xóa mục này
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input
                      label="Tên dự án * (2 – 150 ký tự)"
                      placeholder="VD: Hệ thống CampusJob"
                      value={proj.name}
                      onChange={(e) => updateProject(idx, { name: e.target.value })}
                    />
                    <Input
                      label="Vai trò (Tùy chọn)"
                      placeholder="VD: Backend Developer"
                      value={proj.role || ''}
                      onChange={(e) => updateProject(idx, { role: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Input
                      label="Bắt đầu (YYYY-MM)"
                      placeholder="2025-09"
                      value={proj.startDate || ''}
                      onChange={(e) => updateProject(idx, { startDate: e.target.value })}
                    />
                    <Input
                      label="Kết thúc (YYYY-MM)"
                      placeholder="2025-12"
                      value={proj.endDate || ''}
                      onChange={(e) => updateProject(idx, { endDate: e.target.value })}
                    />
                    <Input
                      label="URL dự án (http/https)"
                      placeholder="https://github.com/..."
                      value={proj.url || ''}
                      onChange={(e) => updateProject(idx, { url: e.target.value })}
                    />
                  </div>

                  <Textarea
                    label="Mô tả dự án (Tùy chọn, tối đa 1000 ký tự)"
                    rows={2}
                    placeholder="Mô tả kiến trúc, công nghệ sử dụng và kết quả đạt được..."
                    value={proj.description || ''}
                    onChange={(e) => updateProject(idx, { description: e.target.value })}
                  />
                </div>
              ))}
            </div>

            {/* DANH SÁCH CHỨNG CHỈ (CERTIFICATIONS) */}
            <div className="space-y-3 border-t border-border pt-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    Chứng chỉ ({form.certifications.length}/{CV_LIMITS.MAX_SUB_ITEMS})
                  </h3>
                  {fieldErrors.certifications && (
                    <p className="text-xs text-destructive mt-0.5">{fieldErrors.certifications}</p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={form.certifications.length >= CV_LIMITS.MAX_SUB_ITEMS}
                  onClick={addCertification}
                >
                  + Thêm chứng chỉ
                </Button>
              </div>

              {form.certifications.map((cert, idx) => (
                <div
                  key={cert.id || `cert-${idx}`}
                  className="rounded-lg border border-border bg-muted/10 p-3 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground">
                      Chứng chỉ #{idx + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeCertification(idx)}
                      className="text-xs text-destructive hover:underline"
                    >
                      Xóa mục này
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input
                      label="Tên chứng chỉ * (2 – 150 ký tự)"
                      placeholder="VD: IELTS 7.5 / AWS Cloud Practitioner"
                      value={cert.name}
                      onChange={(e) => updateCertification(idx, { name: e.target.value })}
                    />
                    <Input
                      label="Đơn vị cấp * (2 – 150 ký tự)"
                      placeholder="VD: IDP / Amazon Web Services"
                      value={cert.issuer}
                      onChange={(e) => updateCertification(idx, { issuer: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input
                      label="Ngày cấp (YYYY-MM)"
                      placeholder="2025-05"
                      value={cert.issueDate || ''}
                      onChange={(e) => updateCertification(idx, { issueDate: e.target.value })}
                    />
                    <Input
                      label="URL xác thực (http/https)"
                      placeholder="https://..."
                      value={cert.url || ''}
                      onChange={(e) => updateCertification(idx, { url: e.target.value })}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* CỜ ĐẶT MẶC ĐỊNH */}
            <div className="flex items-center gap-2 border-t border-border pt-4">
              <input
                type="checkbox"
                id="cv-is-default-checkbox"
                className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                checked={form.isDefault}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, isDefault: e.target.checked }))
                }
              />
              <label htmlFor="cv-is-default-checkbox" className="text-sm">
                Đặt làm CV mặc định khi ứng tuyển
              </label>
            </div>

            {formError && (
              <Alert variant="destructive" title="Không thể lưu CV">
                {formError}
              </Alert>
            )}

            <div className="flex flex-wrap justify-end gap-2 pt-3 border-t border-border">
              <Button
                type="button"
                variant="outline"
                disabled={submitting || uploadingFile}
                onClick={closeEditorModal}
              >
                Hủy
              </Button>
              <Button
                type="submit"
                variant="primary"
                isLoading={submitting}
                disabled={uploadingFile}
              >
                {editorMode === 'create' ? 'Tạo CV' : 'Lưu thay đổi'}
              </Button>
            </div>
          </form>
        )}
      </Dialog>

      {/* MODAL XEM CHI TIẾT CV (UC32) */}
      <Dialog
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        title="Xem trước hồ sơ CV"
        description="Định dạng hồ sơ CV chuẩn dành cho xem trước, tải tệp đính kèm và in ấn (khổ A4)."
        className="max-w-3xl"
      >
        {detailLoading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : selectedCv ? (
          <div className="space-y-4">
            <div className="max-h-[70vh] overflow-y-auto pr-1">
              <div
                id="cv-printable-document"
                className="bg-card text-card-foreground p-4 sm:p-8 rounded-lg border border-border print:border-none print:p-0 print:m-0 print:bg-white print:text-gray-900 font-sans"
              >
                <div className="border-b-2 border-gray-800 pb-5 mb-6">
                  <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2">
                    <div>
                      <h1 className="text-xl sm:text-3xl font-bold tracking-tight text-foreground uppercase">
                        {user?.fullName || 'Sinh viên CampusJob'}
                      </h1>
                      <h2 className="text-base sm:text-lg font-semibold text-primary mt-1 break-words">
                        {selectedCv.title}
                      </h2>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 no-print">
                      {selectedCv.isDefault && (
                        <Badge variant="success">CV Mặc định</Badge>
                      )}
                      {selectedCv.fileAssetId && (
                        <Badge variant="outline">Có tệp PDF/DOCX</Badge>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm text-muted-foreground">
                    {user?.email && (
                      <span className="flex items-center gap-1.5 break-all">
                        <span className="font-medium text-foreground">Email:</span> {user.email}
                      </span>
                    )}
                    <span className="flex items-center gap-1.5">
                      <span className="font-medium text-foreground">Cập nhật:</span>{' '}
                      {new Date(selectedCv.updatedAt).toLocaleDateString('vi-VN')}
                    </span>
                  </div>
                </div>

                <div className="space-y-6">
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

                  {selectedCv.skills.length > 0 && (
                    <section>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-1 mb-2.5">
                        Kỹ năng chuyên môn
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {selectedCv.skills.map((skill, idx) => (
                          <span
                            key={`${skill}-${idx}`}
                            className="px-2.5 py-1 text-xs font-medium rounded bg-muted text-foreground border border-border print:bg-white print:border-gray-300"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </section>
                  )}

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
                              Chuyên ngành:{' '}
                              <span className="font-medium text-foreground">{edu.major}</span>
                              {edu.gpa && (
                                <span className="ml-2 text-muted-foreground">(GPA: {edu.gpa})</span>
                              )}
                            </div>
                            {edu.description && (
                              <p className="text-xs sm:text-sm text-foreground mt-1 leading-relaxed whitespace-pre-line">
                                {edu.description}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

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
                              <div className="text-xs text-muted-foreground font-medium">
                                Vai trò: {proj.role}
                              </div>
                            )}
                            {proj.url && (
                              <div className="text-xs mt-0.5 break-all">
                                <span className="text-muted-foreground">Liên kết: </span>
                                <a
                                  href={proj.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary underline hover:opacity-80"
                                >
                                  {proj.url}
                                </a>
                              </div>
                            )}
                            {proj.description && (
                              <p className="text-xs sm:text-sm text-foreground mt-1 leading-relaxed whitespace-pre-line">
                                {proj.description}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {selectedCv.certifications && selectedCv.certifications.length > 0 && (
                    <section>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-1 mb-3">
                        Chứng chỉ & Giải thưởng
                      </h3>
                      <div className="space-y-2.5">
                        {selectedCv.certifications.map((cert, idx) => (
                          <div key={idx} className="text-sm border-l-2 border-primary/60 pl-3">
                            <div className="font-semibold text-foreground">{cert.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {cert.issuer} {cert.issueDate && `• ${cert.issueDate}`}
                            </div>
                            {cert.url && (
                              <div className="text-xs mt-0.5 break-all">
                                <span className="text-muted-foreground">Link xác thực: </span>
                                <a
                                  href={cert.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary underline hover:opacity-80"
                                >
                                  {cert.url}
                                </a>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-2 pt-4 border-t border-border no-print">
              {selectedCv.fileAssetId && (
                <Button
                  type="button"
                  variant="secondary"
                  isLoading={busyId === selectedCv.id}
                  onClick={() => void handleDownloadFile(selectedCv.id, selectedCv.title)}
                >
                  Tải tệp CV đính kèm
                </Button>
              )}
              <Button type="button" variant="outline" onClick={() => window.print()}>
                In CV (A4)
              </Button>
              <Button type="button" variant="primary" onClick={() => setIsDetailOpen(false)}>
                Đóng
              </Button>
            </div>
          </div>
        ) : null}
      </Dialog>

      {/* DIALOG XÁC NHẬN XÓA CV (UC35) */}
      <Dialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Xác nhận xóa CV"
        description={`Bạn có chắc chắn muốn xóa "${deleteTarget?.title}" không? Nếu CV đang được sử dụng trong đơn ứng tuyển đang hoạt động, hệ thống sẽ từ chối xóa để bảo vệ hồ sơ ứng tuyển.`}
      >
        <div className="flex flex-wrap justify-end gap-2 pt-4">
          <Button
            type="button"
            variant="outline"
            disabled={deleting}
            onClick={() => setDeleteTarget(null)}
          >
            Hủy
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => void handleDeleteConfirm()}
            isLoading={deleting}
          >
            {deleting ? 'Đang xóa...' : 'Xóa CV'}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
