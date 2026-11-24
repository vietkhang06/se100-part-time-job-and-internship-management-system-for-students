'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type {
  CompanyBranchDto, CompanyBranchListResponseDto, CreateJobPostingRequestDto,
  JobPostingDto, JobPostingListResponseDto, JobPostingResponseDto,
} from '@campusjob/contracts';
import { JobType } from '@campusjob/contracts';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

type JobForm = {
  branchId: string; title: string; description: string; industry: string;
  type: JobType; skills: string; quantity: string; salary: string;
  schedule: string; benefits: string; deadline: string;
};
const emptyForm: JobForm = {
  branchId: '', title: '', description: '', industry: '', type: JobType.PART_TIME,
  skills: '', quantity: '1', salary: '', schedule: '', benefits: '', deadline: '',
};
const statuses: Record<string, string> = {
  PENDING_APPROVAL: 'Chờ duyệt', OPEN: 'Đang tuyển', PAUSED: 'Tạm dừng', CLOSED: 'Đã đóng',
};

export default function EmployerJobsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [jobs, setJobs] = useState<JobPostingDto[]>([]);
  const [branches, setBranches] = useState<CompanyBranchDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<JobForm>(emptyForm);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [jobResult, branchResult] = await Promise.all([
        apiClient<JobPostingListResponseDto>('/employer/jobs?limit=100'),
        apiClient<CompanyBranchListResponseDto>('/companies/branches'),
      ]);
      setJobs(jobResult.jobs);
      setBranches(branchResult.data);
      setError('');
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được tin tuyển dụng và chi nhánh.');
      return false;
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (!authLoading && isAuthenticated) void load();
    else if (!authLoading) setLoading(false);
  }, [authLoading, isAuthenticated, load]);

  function field(key: Exclude<keyof JobForm, 'type' | 'branchId' | 'description' | 'skills' | 'benefits' | 'schedule'>, label: string, type = 'text') {
    return <Input key={key} label={label} type={type} min={type === 'number' ? 1 : undefined}
      value={form[key]} disabled={busy} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} />;
  }

  function edit(job: JobPostingDto) {
    setForm({ branchId: job.branchId, title: job.title, description: job.description,
      industry: job.industry, type: job.type, skills: job.skills.join(', '),
      quantity: String(job.quantity), salary: job.salary ?? '', schedule: job.schedule ?? '',
      benefits: job.benefits ?? '', deadline: job.deadline.slice(0, 10) });
    setEditingId(job.id); setOpen(true); setError(''); setNotice('');
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setNotice('');
    const quantity = Number(form.quantity);
    if (!form.branchId || !form.title.trim() || form.description.trim().length < 10 ||
      !form.industry.trim() || !Number.isInteger(quantity) || quantity < 1 || !form.deadline) {
      setError('Chọn chi nhánh, nhập tiêu đề, ngành nghề, mô tả tối thiểu 10 ký tự, số lượng và hạn nộp.'); return;
    }
    const deadline = new Date(`${form.deadline}T23:59:59`);
    if (Number.isNaN(deadline.getTime()) || deadline.getTime() <= Date.now()) {
      setError('Hạn nộp hồ sơ phải là ngày trong tương lai.'); return;
    }
    const payload: CreateJobPostingRequestDto = {
      branchId: form.branchId, title: form.title.trim(), description: form.description.trim(),
      industry: form.industry.trim(), type: form.type,
      skills: form.skills.split(',').map((skill) => skill.trim()).filter(Boolean), quantity,
      salary: form.salary.trim() || null, schedule: form.schedule.trim() || null,
      benefits: form.benefits.trim() || null, deadline: deadline.toISOString(),
    };
    setBusy(true);
    try {
      await apiClient<JobPostingResponseDto>(editingId ? `/employer/jobs/${editingId}` : '/employer/jobs', {
        method: editingId ? 'PATCH' : 'POST', body: JSON.stringify(payload),
      });
      setOpen(false); setEditingId(null); setForm(emptyForm);
      if (await load()) setNotice('Đã lưu tin tuyển dụng. Tin cần được kiểm duyệt trước khi công khai.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Không lưu được tin tuyển dụng.'); }
    finally { setBusy(false); }
  }

  async function action(job: JobPostingDto, operation: 'submit' | 'pause' | 'resume' | 'close') {
    if (operation === 'close' && !window.confirm(`Đóng tin “${job.title}”?`)) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await apiClient(`/employer/jobs/${job.id}/${operation}`, { method: operation === 'submit' ? 'POST' : 'PATCH' });
      if (await load()) setNotice(operation === 'submit' ? 'Đã gửi tin để kiểm duyệt.' : 'Đã cập nhật trạng thái tin.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Không cập nhật được trạng thái tin.'); }
    finally { setBusy(false); }
  }

  return <div className="space-y-6">
    <PageHeader title="Quản lý tin tuyển dụng" description="Tạo tin, gửi kiểm duyệt và theo dõi trạng thái tuyển dụng."
      action={<Button disabled={authLoading || !isAuthenticated || loading || branches.length === 0} onClick={() => {
        setForm({ ...emptyForm, branchId: branches[0]?.id ?? '' }); setEditingId(null); setOpen(true); setError('');
      }}>Tạo tin tuyển dụng</Button>} />
    {error && <p role="alert" className="text-destructive">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {!authLoading && !isAuthenticated && <p role="alert">Vui lòng đăng nhập bằng tài khoản nhà tuyển dụng.</p>}
    {!loading && isAuthenticated && branches.length === 0 && !error &&
      <p>Bạn cần tạo chi nhánh trước khi đăng tin. <Link className="text-primary underline" href="/employer/branches">Đi đến Chi nhánh</Link>.</p>}
    {open && <form onSubmit={save} className="space-y-4 rounded-lg border p-5 max-w-2xl">
      <h2 className="text-lg font-semibold">{editingId ? 'Sửa tin tuyển dụng' : 'Tạo tin tuyển dụng'}</h2>
      <Select label="Chi nhánh làm việc" value={form.branchId} disabled={busy} onChange={(event) => setForm((current) => ({ ...current, branchId: event.target.value }))}
        options={branches.map((branch) => ({ label: `${branch.branchName} — ${branch.city}`, value: branch.id }))} />
      {field('title', 'Tiêu đề')}
      <Textarea label="Mô tả công việc" value={form.description} disabled={busy} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
      {field('industry', 'Ngành nghề')}
      <Select label="Loại hình" value={form.type} disabled={busy} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as JobType }))}
        options={[{ value: JobType.PART_TIME, label: 'Bán thời gian' }, { value: JobType.INTERNSHIP, label: 'Thực tập' }, { value: JobType.FULL_TIME, label: 'Toàn thời gian' }]} />
      <Input label="Kỹ năng (phân cách bằng dấu phẩy)" value={form.skills} disabled={busy} onChange={(event) => setForm((current) => ({ ...current, skills: event.target.value }))} />
      {field('quantity', 'Số lượng tuyển', 'number')}{field('salary', 'Mức lương / trợ cấp')}
      <Textarea label="Lịch làm việc" value={form.schedule} disabled={busy} onChange={(event) => setForm((current) => ({ ...current, schedule: event.target.value }))} />
      <Textarea label="Quyền lợi" value={form.benefits} disabled={busy} onChange={(event) => setForm((current) => ({ ...current, benefits: event.target.value }))} />
      {field('deadline', 'Hạn nộp hồ sơ', 'date')}
      <div className="flex gap-3"><Button type="submit" disabled={busy}>Lưu tin</Button>
        <Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>Hủy</Button></div>
    </form>}
    {loading ? <p role="status">Đang tải tin tuyển dụng...</p> : !error && jobs.length === 0 ?
      <EmptyState title="Chưa có tin tuyển dụng nào" description="Tạo chi nhánh, sau đó đăng tin tuyển dụng đầu tiên." /> :
      <ul className="space-y-4">{jobs.map((job) => <li key={job.id} className="rounded-lg border p-5 space-y-2">
        <h2 className="font-semibold text-lg">{job.title}</h2>
        <p>{statuses[job.status] ?? job.status} · {job.industry} · Hạn nộp {new Date(job.deadline).toLocaleDateString('vi-VN')}</p>
        {job.rejectionReason && <p className="text-destructive">Lý do từ chối: {job.rejectionReason}</p>}
        <div className="flex flex-wrap gap-2">
          {job.status !== 'CLOSED' && <Button variant="outline" disabled={busy} onClick={() => edit(job)}>Sửa</Button>}
          {job.status === 'PENDING_APPROVAL' && <Button variant="outline" disabled={busy} onClick={() => void action(job, 'submit')}>Gửi kiểm duyệt</Button>}
          {job.status === 'OPEN' && <Button variant="outline" disabled={busy} onClick={() => void action(job, 'pause')}>Tạm dừng</Button>}
          {job.status === 'PAUSED' && <Button variant="outline" disabled={busy} onClick={() => void action(job, 'resume')}>Mở lại</Button>}
          {job.status !== 'CLOSED' && <Button variant="outline" disabled={busy} onClick={() => void action(job, 'close')}>Đóng tin</Button>}
        </div>
      </li>)}</ul>}
  </div>;
}
