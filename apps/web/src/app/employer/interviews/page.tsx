'use client';

import { useCallback, useEffect, useState } from 'react';
import type { JobPostingDto } from '@campusjob/contracts';
import { PageHeader } from '@/components/layout/page-header';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Select } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { ApiClientError } from '@/lib/api-client';
import { formatDateTime, InterviewView, m04Api } from '@/lib/m04-api';

export default function EmployerInterviewsPage() {
  const [jobs, setJobs] = useState<JobPostingDto[]>([]);
  const [jobId, setJobId] = useState('');
  const [items, setItems] = useState<InterviewView[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resultTarget, setResultTarget] = useState<InterviewView | null>(null);
  const [result, setResult] = useState<'ACCEPTED' | 'REJECTED'>('ACCEPTED');
  const [reason, setReason] = useState('');

  useEffect(() => {
    void m04Api.employerJobs().then(({ jobs: data }) => { setJobs(data); setJobId(data[0]?.id || ''); })
      .catch((e) => setError(e instanceof ApiClientError ? e.message : 'Không thể tải tin tuyển dụng.'))
      .finally(() => setLoading(false));
  }, []);
  const load = useCallback(async () => {
    if (!jobId) { setItems([]); return; }
    setLoading(true); setError(null);
    try { setItems(await m04Api.employerInterviews(jobId)); }
    catch (e) { setError(e instanceof ApiClientError ? e.message : 'Không thể tải lịch phỏng vấn.'); }
    finally { setLoading(false); }
  }, [jobId]);
  useEffect(() => { void load(); }, [load]);

  const run = async (id: string, action: () => Promise<unknown>) => {
    setBusyId(id); setError(null);
    try { await action(); await load(); }
    catch (e) { setError(e instanceof ApiClientError ? e.message : 'Thao tác không thành công.'); }
    finally { setBusyId(null); }
  };

  const submitResult = async (event: React.FormEvent) => {
    event.preventDefault(); if (!resultTarget) return;
    await run(resultTarget.interview.id, () => m04Api.result(resultTarget.interview.id, result, reason || undefined));
    setResultTarget(null); setReason(''); setResult('ACCEPTED');
  };

  return <div className="space-y-6">
    <PageHeader title="Lịch phỏng vấn ứng viên" description="Quản lý đổi lịch và kết quả qua dữ liệu API thật." />
    <Select label="Tin tuyển dụng" value={jobId} onChange={(e) => setJobId(e.target.value)} options={jobs.map((job) => ({ value: job.id, label: job.title }))} />
    {error && <ErrorState message={error} onRetry={load} />}
    {loading ? <div className="flex justify-center py-12"><Spinner /></div> : !error && items.length === 0 ?
      <EmptyState title="Chưa có lịch phỏng vấn" description="Mời ứng viên từ trang hồ sơ ứng tuyển trước." /> :
      !error && <div className="grid gap-4 md:grid-cols-2">{items.map((item) => {
        const interview = item.interview;
        const happened = new Date(interview.scheduledAt) <= new Date();
        return <Card key={interview.id} className="space-y-4"><CardHeader className="pb-0"><div className="flex items-start justify-between gap-3">
          <CardTitle>{item.application.cvSnapshot.fullName}</CardTitle><Badge variant={interview.result === 'ACCEPTED' ? 'success' : interview.result === 'REJECTED' ? 'destructive' : 'secondary'}>{interview.result || 'Đã lên lịch'}</Badge>
        </div></CardHeader><CardContent className="space-y-3 text-sm">
          <p><strong>{formatDateTime(interview.scheduledAt)}</strong> · {interview.mode === 'ONLINE' ? 'Trực tuyến' : 'Trực tiếp'}</p>
          <p className="break-all text-muted-foreground">{interview.locationOrLink}</p>
          <p>{interview.confirmedAt ? `Ứng viên xác nhận ${formatDateTime(interview.confirmedAt)}` : 'Ứng viên chưa xác nhận'}</p>
          {item.changeRequest && <Alert variant={item.changeRequest.decision === 'PENDING' ? 'warning' : 'info'}>Yêu cầu đổi sang {formatDateTime(item.changeRequest.proposedAt)} · {item.changeRequest.decision}</Alert>}
          <div className="flex flex-wrap gap-2">
            {item.changeRequest?.decision === 'PENDING' && <><Button size="sm" isLoading={busyId === interview.id} onClick={() => run(interview.id, () => m04Api.decideReschedule(interview.id, 'APPROVED'))}>Duyệt đổi lịch</Button><Button variant="outline" size="sm" onClick={() => run(interview.id, () => m04Api.decideReschedule(interview.id, 'REJECTED'))}>Từ chối đổi lịch</Button></>}
            {happened && !interview.result && <Button size="sm" onClick={() => setResultTarget(item)}>Ghi kết quả</Button>}
          </div>
        </CardContent></Card>;
      })}</div>}
    <Dialog isOpen={resultTarget !== null} onClose={() => setResultTarget(null)} title="Ghi kết quả tuyển dụng">
      <form onSubmit={submitResult} className="space-y-4">
        <Select label="Kết quả" value={result} onChange={(e) => setResult(e.target.value as 'ACCEPTED' | 'REJECTED')} options={[{ value: 'ACCEPTED', label: 'Trúng tuyển' }, { value: 'REJECTED', label: 'Không trúng tuyển' }]} />
        {result === 'REJECTED' && <label className="block text-sm font-medium">Lý do<Textarea required value={reason} onChange={(e) => setReason(e.target.value)} /></label>}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setResultTarget(null)}>Hủy</Button><Button type="submit" isLoading={busyId === resultTarget?.interview.id}>Lưu kết quả</Button></div>
      </form>
    </Dialog>
  </div>;
}
