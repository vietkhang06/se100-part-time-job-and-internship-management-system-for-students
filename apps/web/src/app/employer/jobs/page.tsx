'use client';

import * as React from 'react';
import {
  Briefcase,
  Plus,
  Eye,
  Bookmark,
  Edit,
  Send,
  Pause,
  Play,
  XCircle,
  AlertTriangle,
  ShieldAlert,
} from 'lucide-react';
import { JobStatus, JobType } from '@campusjob/contracts';
import type {
  JobPostingDto,
  CompanyBranchDto,
  CreateJobPostingRequestDto,
  UpdateJobPostingRequestDto,
} from '@campusjob/contracts';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Dialog } from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { EmptyState } from '@/components/ui/empty-state';
import {
  fetchEmployerJobs,
  fetchEmployerBranches,
  createEmployerJob,
  updateEmployerJob,
  submitEmployerJob,
  pauseEmployerJob,
  resumeEmployerJob,
  closeEmployerJob,
} from '@/lib/m03-api';
import {
  JOB_STATUS_MAP,
  JOB_TYPE_MAP,
  formatSalary,
  getM03ErrorMessage,
} from '@/lib/m03-labels';

export default function EmployerJobsPage() {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [jobs, setJobs] = React.useState<JobPostingDto[]>([]);
  const [branches, setBranches] = React.useState<CompanyBranchDto[]>([]);

  // Action loading state
  const [actionInProgress, setActionInProgress] = React.useState<string | null>(null);

  // Create / Edit modal
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [editingJob, setEditingJob] = React.useState<JobPostingDto | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  // Form Fields (All FR-08 fields)
  const [title, setTitle] = React.useState('');
  const [branchId, setBranchId] = React.useState('');
  const [industry, setIndustry] = React.useState('');
  const [type, setType] = React.useState<JobType>(JobType.PART_TIME);
  const [schedule, setSchedule] = React.useState('Linh hoạt theo lịch học');
  const [quantity, setQuantity] = React.useState(1);
  const [salaryMin, setSalaryMin] = React.useState('');
  const [salaryMax, setSalaryMax] = React.useState('');
  const [isSalaryNegotiable, setIsSalaryNegotiable] = React.useState(false);
  const [deadline, setDeadline] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [benefits, setBenefits] = React.useState('');
  const [skills, setSkills] = React.useState('');

  const loadData = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [jobsRes, branchesRes] = await Promise.all([
        fetchEmployerJobs(),
        fetchEmployerBranches().catch(() => ({ data: [] })),
      ]);
      setJobs(jobsRes.jobs || []);
      setBranches(branchesRes.data || []);
    } catch (err) {
      setError(getM03ErrorMessage(err, 'Không thể tải danh sách tin tuyển dụng.'));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadData();
  }, [loadData]);

  const openCreateModal = () => {
    setEditingJob(null);
    setTitle('');
    setBranchId(branches[0]?.id || '');
    setIndustry('');
    setType(JobType.PART_TIME);
    setSchedule('Linh hoạt theo lịch học');
    setQuantity(1);
    setSalaryMin('');
    setSalaryMax('');
    setIsSalaryNegotiable(false);
    setDeadline('');
    setDescription('');
    setBenefits('');
    setSkills('');
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (job: JobPostingDto) => {
    setEditingJob(job);
    setTitle(job.title);
    setBranchId(job.branchId);
    setIndustry(job.industry);
    setType(job.type);
    setSchedule(job.schedule || 'Linh hoạt theo lịch học');
    setQuantity(job.quantity || 1);
    setSalaryMin(job.salaryMin != null ? String(job.salaryMin) : '');
    setSalaryMax(job.salaryMax != null ? String(job.salaryMax) : '');
    setIsSalaryNegotiable(Boolean(job.isSalaryNegotiable));
    setDeadline(job.deadline ? new Date(job.deadline).toISOString().split('T')[0] : '');
    setDescription(job.description);
    setBenefits(job.benefits || '');
    setSkills(job.skills?.join(', ') || '');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setFormError('Vui lòng nhập tiêu đề tin tuyển dụng.');
      return;
    }
    if (!branchId) {
      setFormError('Vui lòng chọn chi nhánh làm việc.');
      return;
    }
    if (!industry.trim()) {
      setFormError('Vui lòng nhập ngành nghề.');
      return;
    }
    if (!description.trim()) {
      setFormError('Vui lòng nhập mô tả công việc.');
      return;
    }

    const min = salaryMin.trim() ? Number(salaryMin) : undefined;
    const max = salaryMax.trim() ? Number(salaryMax) : undefined;
    if (min != null && max != null && min > max) {
      setFormError('Mức lương tối thiểu không được lớn hơn mức lương tối đa.');
      return;
    }

    if (!deadline.trim()) {
      setFormError('Vui lòng chọn hạn nộp hồ sơ.');
      return;
    }

    const deadlineDate = new Date(deadline);
    if (deadlineDate.getTime() <= Date.now()) {
      setFormError('Hạn nộp hồ sơ phải là thời điểm trong tương lai.');
      return;
    }

    const skillsArray = skills
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    try {
      setSubmitting(true);
      setFormError(null);

      if (editingJob) {
        const updatePayload: UpdateJobPostingRequestDto = {
          title: title.trim(),
          branchId,
          industry: industry.trim(),
          type,
          schedule: schedule.trim() || undefined,
          quantity: Number(quantity) || 1,
          salaryMin: min,
          salaryMax: max,
          isSalaryNegotiable,
          deadline: new Date(deadline).toISOString(),
          description: description.trim(),
          benefits: benefits.trim() || undefined,
          skills: skillsArray,
        };
        await updateEmployerJob(editingJob.id, updatePayload);
        setSuccess(`Cập nhật tin tuyển dụng "${title}" thành công.`);
      } else {
        const createPayload: CreateJobPostingRequestDto = {
          title: title.trim(),
          branchId,
          industry: industry.trim(),
          type,
          schedule: schedule.trim() || undefined,
          quantity: Number(quantity) || 1,
          salaryMin: min,
          salaryMax: max,
          isSalaryNegotiable,
          deadline: new Date(deadline).toISOString(),
          description: description.trim(),
          benefits: benefits.trim() || undefined,
          skills: skillsArray,
        };
        await createEmployerJob(createPayload);
        setSuccess(`Tạo mới tin tuyển dụng "${title}" thành công (Trạng thái: PENDING_APPROVAL).`);
      }

      setIsModalOpen(false);
      void loadData();
    } catch (err: any) {
      setFormError(getM03ErrorMessage(err, 'Lưu tin tuyển dụng thất bại.'));
    } finally {
      setSubmitting(false);
    }
  };

  // State transitions: submit, pause, resume, close
  const handleAction = async (
    jobId: string,
    action: 'submit' | 'pause' | 'resume' | 'close',
  ) => {
    try {
      setActionInProgress(`${action}-${jobId}`);
      setError(null);

      if (action === 'submit') {
        await submitEmployerJob(jobId);
        setSuccess('Đã gửi tin tuyển dụng vào hàng đợi xét duyệt (PENDING_APPROVAL).');
      } else if (action === 'pause') {
        await pauseEmployerJob(jobId);
        setSuccess('Đã tạm dừng tin tuyển dụng.');
      } else if (action === 'resume') {
        await resumeEmployerJob(jobId);
        setSuccess('Đã mở lại tin tuyển dụng.');
      } else if (action === 'close') {
        await closeEmployerJob(jobId);
        setSuccess('Đã đóng tin tuyển dụng.');
      }

      void loadData();
    } catch (err) {
      setError(getM03ErrorMessage(err, 'Thao tác trên tin tuyển dụng thất bại.'));
    } finally {
      setActionInProgress(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quản lý tin tuyển dụng"
        description="Đăng tin mới, theo dõi trạng thái kiểm duyệt, số liệu lượt xem/lưu và chuyển đổi trạng thái tin tuyển dụng."
        action={
          <Button variant="primary" onClick={openCreateModal} className="gap-2">
            <Plus className="w-4 h-4" />
            <span>Tạo tin tuyển dụng</span>
          </Button>
        }
      />

      {error && <Alert variant="destructive">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      {loading && (
        <div className="py-16 flex flex-col items-center justify-center gap-3">
          <Spinner className="w-8 h-8 text-primary" />
          <p className="text-sm text-muted-foreground">Đang tải danh sách tin tuyển dụng...</p>
        </div>
      )}

      {!loading && jobs.length === 0 && (
        <EmptyState
          title="Chưa có tin tuyển dụng nào"
          description="Doanh nghiệp của bạn chưa đăng tin tuyển dụng nào. Hãy tạo tin tuyển dụng đầu tiên để tìm kiếm ứng viên tiềm năng!"
          actionLabel="Tạo tin tuyển dụng ngay"
          onAction={openCreateModal}
        />
      )}

      {!loading && jobs.length > 0 && (
        <div className="space-y-4">
          <div className="text-xs text-muted-foreground">
            Tổng cộng: <strong className="text-foreground">{jobs.length}</strong> tin tuyển dụng
          </div>

          <div className="space-y-4">
            {jobs.map((job) => {
              const statusMeta = JOB_STATUS_MAP[job.status] || {
                label: job.status,
                variant: 'outline' as const,
              };

              const salaryText = formatSalary(
                job.salaryMin,
                job.salaryMax,
                job.isSalaryNegotiable,
              );

              const deadlineFormatted = job.deadline
                ? new Date(job.deadline).toLocaleDateString('vi-VN')
                : null;

              const isActionLoading = (act: string) => actionInProgress === `${act}-${job.id}`;

              const branchObj = branches.find((b) => b.id === job.branchId);

              return (
                <Card key={job.id} className="border-border hover:shadow-sm transition-shadow">
                  <CardContent className="p-5 space-y-4">
                    {/* Header: Title, Status & Metrics */}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="space-y-1.5 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-lg text-foreground line-clamp-1">
                            {job.title}
                          </h3>
                          <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>

                          {job.hiddenByModeration && (
                            <Badge variant="destructive" className="gap-1 text-[11px]">
                              <ShieldAlert className="w-3 h-3" />
                              <span>Bị ẩn bởi kiểm duyệt</span>
                            </Badge>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1 font-medium text-foreground">
                            <Briefcase className="w-3.5 h-3.5 text-primary" />
                            {JOB_TYPE_MAP[job.type] || job.type}
                          </span>
                          {branchObj && (
                            <span>Chi nhánh: {branchObj.branchName}</span>
                          )}
                          <span>Lương: <strong className="text-primary">{salaryText}</strong></span>
                          {deadlineFormatted && <span>Hạn: {deadlineFormatted}</span>}
                        </div>
                      </div>

                      {/* Metrics: ViewCount & SaveCount (Employer only) */}
                      <div className="flex items-center gap-3 bg-secondary/30 p-2.5 rounded-lg border border-border text-xs shrink-0">
                        <div className="flex items-center gap-1.5 text-foreground" title="Lượt xem thực tế từ ứng viên (đã dedup theo ngày)">
                          <Eye className="w-4 h-4 text-primary" />
                          <span><strong>{job.viewCount ?? 0}</strong> lượt xem</span>
                        </div>
                        <span className="text-border">|</span>
                        <div className="flex items-center gap-1.5 text-foreground" title="Số lượng sinh viên đã lưu tin này">
                          <Bookmark className="w-4 h-4 text-amber-600" />
                          <span><strong>{job.saveCount ?? 0}</strong> đã lưu</span>
                        </div>
                      </div>
                    </div>

                    {/* Rejection notice */}
                    {job.rejectionReason && (
                      <div className="p-3 bg-destructive/10 rounded-lg border border-destructive/20 text-xs text-destructive flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                        <div>
                          <strong>Lý do từ chối trước đó: </strong>
                          {job.rejectionReason}
                          <p className="mt-1 text-muted-foreground">
                            Bạn có thể bấm &quot;Chỉnh sửa&quot; để cập nhật lại thông tin và nộp duyệt lại.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Moderation hidden notice */}
                    {job.hiddenByModeration && (
                      <div className="p-3 bg-destructive/10 rounded-lg border border-destructive/20 text-xs text-destructive flex items-start gap-2">
                        <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                        <div>
                          <strong>Tin tuyển dụng đang bị tạm ẩn bởi ban quản trị kiểm duyệt nội dung.</strong>
                          <p className="text-muted-foreground mt-0.5">
                            Thao tác [Mở lại tin] đã bị vô hiệu hóa. Vui lòng chỉnh sửa nội dung vi phạm hoặc liên hệ ban quản trị để được hỗ trợ.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Action Bar (State-aware) */}
                    <div className="pt-3 border-t border-border flex flex-wrap items-center justify-end gap-2">
                      {/* Edit Button (Available unless closed) */}
                      {job.status !== JobStatus.CLOSED && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditModal(job)}
                          className="gap-1.5 text-xs"
                        >
                          <Edit className="w-3.5 h-3.5" />
                          <span>Chỉnh sửa</span>
                        </Button>
                      )}

                      {/* Resubmit action if rejected / pending */}
                      {job.rejectionReason && job.status === JobStatus.PENDING_APPROVAL && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleAction(job.id, 'submit')}
                          disabled={isActionLoading('submit')}
                          className="gap-1.5 text-xs"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>{isActionLoading('submit') ? 'Đang gửi...' : 'Nộp duyệt lại'}</span>
                        </Button>
                      )}

                      {/* Pause action (Available for OPEN) */}
                      {job.status === JobStatus.OPEN && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAction(job.id, 'pause')}
                          disabled={isActionLoading('pause')}
                          className="gap-1.5 text-xs"
                        >
                          <Pause className="w-3.5 h-3.5" />
                          <span>{isActionLoading('pause') ? 'Đang xử lý...' : 'Tạm dừng'}</span>
                        </Button>
                      )}

                      {/* Resume action (Available for PAUSED) */}
                      {job.status === JobStatus.PAUSED && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleAction(job.id, 'resume')}
                          disabled={job.hiddenByModeration || isActionLoading('resume')}
                          title={
                            job.hiddenByModeration
                              ? 'Không thể mở lại tin đang bị tạm ẩn bởi ban quản trị'
                              : 'Mở lại tin tuyển dụng'
                          }
                          className="gap-1.5 text-xs"
                        >
                          <Play className="w-3.5 h-3.5" />
                          <span>{isActionLoading('resume') ? 'Đang xử lý...' : 'Mở lại tin'}</span>
                        </Button>
                      )}

                      {/* Close action (Available for OPEN and PAUSED) */}
                      {(job.status === JobStatus.OPEN || job.status === JobStatus.PAUSED) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAction(job.id, 'close')}
                          disabled={isActionLoading('close')}
                          className="text-destructive hover:bg-destructive/10 gap-1.5 text-xs"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>{isActionLoading('close') ? 'Đang đóng...' : 'Đóng tin'}</span>
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Create / Edit Job Modal */}
      <Dialog
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingJob ? 'Chỉnh sửa tin tuyển dụng' : 'Tạo mới tin tuyển dụng'}
        description="Điền đầy đủ thông tin vị trí tuyển dụng theo biểu mẫu chuẩn FR-08."
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        <form onSubmit={handleSubmitForm} className="space-y-4 py-2">
          {formError && <Alert variant="destructive">{formError}</Alert>}

          <Input
            label="Chức danh tuyển dụng (*)"
            placeholder="VD: Thực tập sinh NodeJS Backend Developer"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Chi nhánh làm việc (*)"
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              required
            >
              {branches.length === 0 ? (
                <option value="">(Chưa có chi nhánh - Vui lòng tạo chi nhánh trước)</option>
              ) : (
                branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.branchName} ({b.city})
                  </option>
                ))
              )}
            </Select>

            <Input
              label="Ngành nghề (*)"
              placeholder="VD: Công nghệ thông tin"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Select
              label="Hình thức làm việc (*)"
              value={type}
              onChange={(e) => setType(e.target.value as JobType)}
            >
              <option value={JobType.PART_TIME}>{JOB_TYPE_MAP[JobType.PART_TIME]}</option>
              <option value={JobType.INTERNSHIP}>{JOB_TYPE_MAP[JobType.INTERNSHIP]}</option>
              <option value={JobType.FULL_TIME}>{JOB_TYPE_MAP[JobType.FULL_TIME]}</option>
            </Select>

            <Input
              label="Lịch làm việc"
              placeholder="VD: Linh hoạt theo lịch học"
              value={schedule}
              onChange={(e) => setSchedule(e.target.value)}
            />

            <Input
              label="Số lượng tuyển"
              type="number"
              min="1"
              value={String(quantity)}
              onChange={(e) => setQuantity(Number(e.target.value) || 1)}
            />
          </div>

          {/* Salary Settings */}
          <div className="p-3 bg-secondary/30 rounded-lg border border-border space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">Mức lương</span>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isSalaryNegotiable"
                  checked={isSalaryNegotiable}
                  onChange={(e) => setIsSalaryNegotiable(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5"
                />
                <label htmlFor="isSalaryNegotiable" className="text-xs text-muted-foreground cursor-pointer">
                  Lương thỏa thuận
                </label>
              </div>
            </div>

            {!isSalaryNegotiable && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Lương tối thiểu (VND)"
                  type="number"
                  placeholder="VD: 5000000"
                  value={salaryMin}
                  onChange={(e) => setSalaryMin(e.target.value)}
                />
                <Input
                  label="Lương tối đa (VND)"
                  type="number"
                  placeholder="VD: 10000000"
                  value={salaryMax}
                  onChange={(e) => setSalaryMax(e.target.value)}
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Hạn nộp hồ sơ (*)"
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              required
            />
            <Input
              label="Kỹ năng yêu cầu (ngăn cách bởi dấu phẩy)"
              placeholder="VD: JavaScript, React, TypeScript, Git"
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
            />
          </div>

          <Textarea
            label="Mô tả công việc (*)"
            placeholder="Nêu rõ các trách nhiệm chính, nhiệm vụ thường ngày..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            required
          />

          <Textarea
            label="Quyền lợi & Đãi ngộ"
            placeholder="Chế độ phụ cấp, đào tạo thực tế, cơ hội lên chính thức..."
            value={benefits}
            onChange={(e) => setBenefits(e.target.value)}
            rows={3}
          />

          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsModalOpen(false)}
            >
              Hủy
            </Button>
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? 'Đang lưu...' : editingJob ? 'Lưu thay đổi' : 'Tạo tin tuyển dụng'}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
