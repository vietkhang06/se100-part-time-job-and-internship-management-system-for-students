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
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { ApiClientError } from '@/lib/api-client';
import { ApplicationItem, applicationStatusLabels, formatDateTime, m04Api } from '@/lib/m04-api';

type Action = { kind: 'reject' | 'invite'; item: ApplicationItem } | null;

export default function EmployerApplicationsPage() {
  const [jobs, setJobs] = useState<JobPostingDto[]>([]);
  const [jobId, setJobId] = useState('');
  const [items, setItems] = useState<ApplicationItem[]>([]);
  const [detail, setDetail] = useState<ApplicationItem | null>(null);
  const [action, setAction] = useState<Action>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [mode, setMode] = useState<'ONLINE' | 'ONSITE'>('ONLINE');
  const [location, setLocation] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    void m04Api.employerJobs().then((result) => {
      setJobs(result.jobs); setJobId(result.jobs[0]?.id || '');
    }).catch((e) => setError(e instanceof ApiClientError ? e.message : 'Không thể tải tin tuyển dụng.'))
      .finally(() => setLoading(false));
  }, []);

  const load = useCallback(async () => {
    if (!jobId) { setItems([]); return; }
    setLoading(true); setError(null);
    try { setItems((await m04Api.candidates(jobId)).data); }
    catch (e) { setError(e instanceof ApiClientError ? e.message : 'Không thể tải ứng viên.'); }
    finally { setLoading(false); }
  }, [jobId]);
  useEffect(() => { void load(); }, [load]);

  const openDetail = async (item: ApplicationItem) => {
    setBusy(true); setError(null);
    try {
      const current = item.status === 'SUBMITTED' ? await m04Api.markViewed(item.id) : null;
      const loaded = await m04Api.candidate(item.id);
      setDetail({ ...loaded, status: current ? 'REVIEWING' : loaded.status });
      if (current) await load();
    } catch (e) { setError(e instanceof ApiClientError ? e.message : 'Không thể tải hồ sơ.'); }
    finally { setBusy(false); }
  };

  const submitAction = async (event: React.FormEvent) => {
    event.preventDefault(); if (!action) return;
    setBusy(true); setError(null);
    try {
      if (action.kind === 'reject') await m04Api.reject(action.item.id, reason);
      else await m04Api.invite(action.item.id, {
        scheduledAt: new Date(scheduledAt).toISOString(), mode, locationOrLink: location, message: message || undefined,
      });
      setAction(null); setReason(''); setScheduledAt(''); setLocation(''); setMessage(''); await load();
    } catch (e) { setError(e instanceof ApiClientError ? e.message : 'Không thể hoàn tất thao tác.'); }
    finally { setBusy(false); }
  };

  return <div className="space-y-6">
    <PageHeader title="Danh sách hồ sơ ứng tuyển" description="Dữ liệu CV snapshot được lấy trực tiếp từ API theo từng tin thuộc doanh nghiệp." />
    <Select label="Tin tuyển dụng" value={jobId} onChange={(e) => setJobId(e.target.value)} options={jobs.map((job) => ({ value: job.id, label: job.title }))} />
    {error && <ErrorState message={error} onRetry={load} />}
    {loading ? <div className="flex justify-center py-12"><Spinner /></div> : !error && !jobId ?
      <EmptyState title="Chưa có tin tuyển dụng" description="Tạo tin trước khi quản lý hồ sơ." /> :
      !error && items.length === 0 ? <EmptyState title="Chưa có hồ sơ ứng tuyển" description="Ứng viên của tin đã chọn sẽ xuất hiện tại đây." /> :
      !error && <div className="grid gap-4 md:grid-cols-2">{items.map((item) => <Card key={item.id} className="space-y-4">
        <CardHeader className="pb-0"><div className="flex items-start justify-between gap-3"><CardTitle>{item.cvSnapshot.fullName}</CardTitle><Badge variant="secondary">{applicationStatusLabels[item.status]}</Badge></div></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>{item.cvSnapshot.title} · {formatDateTime(item.createdAt)}</p>
          <div className="flex flex-wrap gap-1">{item.cvSnapshot.skills.slice(0, 6).map((skill) => <Badge key={skill} variant="outline">{skill}</Badge>)}</div>
          <p className="text-muted-foreground">Điểm phù hợp: {item.matchingScore?.state === 'AVAILABLE' ? `${item.matchingScore.value}` : 'Chưa khả dụng — công thức chưa được duyệt'}</p>
          <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" isLoading={busy} onClick={() => openDetail(item)}>Xem CV</Button>
            {item.status === 'REVIEWING' && <><Button size="sm" onClick={() => setAction({ kind: 'invite', item })}>Mời phỏng vấn</Button><Button size="sm" variant="ghost" onClick={() => setAction({ kind: 'reject', item })}>Từ chối</Button></>}
          </div>
        </CardContent>
      </Card>)}</div>}
    <Dialog isOpen={detail !== null} onClose={() => setDetail(null)} title="CV snapshot ứng viên" className="max-w-3xl">
      {detail && <div className="max-h-[70vh] space-y-4 overflow-y-auto"><h3 className="font-semibold">{detail.cvSnapshot.fullName}</h3><p className="text-sm">{detail.cvSnapshot.email} · {detail.cvSnapshot.phone || 'Không có số điện thoại'}</p><p className="whitespace-pre-wrap text-sm">{detail.cvSnapshot.summary || 'Không có phần giới thiệu.'}</p>{detail.coverLetter && <Alert title="Thư giới thiệu">{detail.coverLetter}</Alert>}</div>}
    </Dialog>
    <Dialog isOpen={action !== null} onClose={() => setAction(null)} title={action?.kind === 'reject' ? 'Từ chối hồ sơ' : 'Mời phỏng vấn'}>
      <form onSubmit={submitAction} className="space-y-4">
        {action?.kind === 'reject' ? <label className="block text-sm font-medium">Lý do<Textarea required value={reason} onChange={(e) => setReason(e.target.value)} /></label> : <>
          <label className="block text-sm font-medium">Thời gian (UTC+7)<Input required type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} /></label>
          <Select label="Hình thức" value={mode} onChange={(e) => setMode(e.target.value as 'ONLINE' | 'ONSITE')} options={[{ value: 'ONLINE', label: 'Trực tuyến' }, { value: 'ONSITE', label: 'Trực tiếp' }]} />
          <label className="block text-sm font-medium">{mode === 'ONLINE' ? 'Liên kết' : 'Địa điểm'}<Input required value={location} onChange={(e) => setLocation(e.target.value)} /></label>
          <label className="block text-sm font-medium">Lời nhắn<Textarea value={message} onChange={(e) => setMessage(e.target.value)} /></label>
        </>}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setAction(null)}>Hủy</Button><Button type="submit" isLoading={busy}>Xác nhận</Button></div>
      </form>
    </Dialog>
  </div>;
}
