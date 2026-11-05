'use client';

import { useEffect, useMemo, useState } from 'react';
import type { CvListItemDto, PublicJobPostingDto } from '@campusjob/contracts';
import { AppHeader } from '@/components/layout/app-header';
import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { ApiClientError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { formatDateTime, m04Api } from '@/lib/m04-api';

export default function JobsPage() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<PublicJobPostingDto[]>([]);
  const [cvs, setCvs] = useState<CvListItemDto[]>([]);
  const [query, setQuery] = useState('');
  const [target, setTarget] = useState<PublicJobPostingDto | null>(null);
  const [cvId, setCvId] = useState('');
  const [coverLetter, setCoverLetter] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setError(null);
    try { setJobs((await m04Api.publicJobs()).jobs); }
    catch (e) { setError(e instanceof ApiClientError ? e.message : 'Không thể tải tin tuyển dụng.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    const value = query.trim().toLocaleLowerCase('vi');
    if (!value) return jobs;
    return jobs.filter((job) => [job.title, job.companyName, job.industry, ...job.skills]
      .some((field) => field?.toLocaleLowerCase('vi').includes(value)));
  }, [jobs, query]);

  const openApply = async (job: PublicJobPostingDto) => {
    setError(null);
    if (user?.role !== 'STUDENT') { setError('Đăng nhập bằng tài khoản sinh viên để ứng tuyển.'); return; }
    try {
      const data = (await m04Api.cvs()).data;
      setCvs(data); setCvId(data.find((cv) => cv.isDefault)?.id || data[0]?.id || ''); setTarget(job);
    } catch (e) { setError(e instanceof ApiClientError ? e.message : 'Không thể tải danh sách CV.'); }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); if (!target || !cvId) return;
    setSubmitting(true); setError(null);
    try {
      await m04Api.apply(target.id, cvId, coverLetter);
      setNotice(`Đã nộp hồ sơ vào ${target.title}.`); setTarget(null); setCoverLetter('');
    } catch (e) { setError(e instanceof ApiClientError ? e.message : 'Không thể nộp hồ sơ.'); }
    finally { setSubmitting(false); }
  };

  return <div className="min-h-screen flex flex-col"><AppHeader /><PageContainer className="flex-1 space-y-6">
    <PageHeader title="Tìm kiếm việc làm & thực tập" description="Chọn CV thật và nộp hồ sơ trực tiếp vào tin đang tuyển." />
    {notice && <Alert variant="success">{notice}</Alert>}
    {error && <Alert variant="destructive">{error}</Alert>}
    <Input aria-label="Tìm việc" placeholder="Tìm theo chức danh, công ty, kỹ năng..." className="max-w-md" value={query} onChange={(e) => setQuery(e.target.value)} />
    {loading ? <div className="flex justify-center py-12"><Spinner /></div> : filtered.length === 0 ?
      <EmptyState title="Chưa có tin tuyển dụng phù hợp" description="Thử một từ khóa khác." /> :
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{filtered.map((job) => <Card key={job.id} className="flex flex-col gap-4">
        <CardHeader className="pb-0"><CardTitle>{job.title}</CardTitle><p className="text-sm text-muted-foreground">{job.companyName || 'Doanh nghiệp CampusJob'} · {job.branchCity || 'Việt Nam'}</p></CardHeader>
        <CardContent className="flex flex-1 flex-col gap-3 text-sm"><div className="flex flex-wrap gap-1">{job.skills.map((skill) => <Badge key={skill} variant="outline">{skill}</Badge>)}</div>
          <p className="text-muted-foreground">Hạn nộp {formatDateTime(job.deadline)}</p><Button className="mt-auto" onClick={() => openApply(job)}>Ứng tuyển</Button>
        </CardContent>
      </Card>)}</div>}
    <Dialog isOpen={target !== null} onClose={() => setTarget(null)} title={`Ứng tuyển ${target?.title || ''}`} description="CV được lưu thành snapshot tại thời điểm nộp.">
      <form onSubmit={submit} className="space-y-4">
        {cvs.length === 0 ? <ErrorState message="Bạn cần tạo CV trước khi ứng tuyển." /> : <>
          <Select label="CV" required value={cvId} onChange={(e) => setCvId(e.target.value)} options={cvs.map((cv) => ({ value: cv.id, label: `${cv.title}${cv.isDefault ? ' (mặc định)' : ''}` }))} />
          <label className="block text-sm font-medium">Thư giới thiệu<Textarea value={coverLetter} onChange={(e) => setCoverLetter(e.target.value)} /></label>
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setTarget(null)}>Hủy</Button><Button type="submit" isLoading={submitting}>Nộp hồ sơ</Button></div>
        </>}
      </form>
    </Dialog>
  </PageContainer></div>;
}
