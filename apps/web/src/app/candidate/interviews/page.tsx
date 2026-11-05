'use client';

import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { ApiClientError } from '@/lib/api-client';
import { formatDateTime, InterviewView, m04Api } from '@/lib/m04-api';

export default function CandidateInterviewsPage() {
  const [items, setItems] = useState<InterviewView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reschedule, setReschedule] = useState<InterviewView | null>(null);
  const [proposedAt, setProposedAt] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setItems(await m04Api.studentInterviews()); }
    catch (e) { setError(e instanceof ApiClientError ? e.message : 'Không thể tải lịch phỏng vấn.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const run = async (id: string, action: () => Promise<unknown>) => {
    setBusyId(id); setError(null);
    try { await action(); await load(); }
    catch (e) { setError(e instanceof ApiClientError ? e.message : 'Thao tác không thành công.'); }
    finally { setBusyId(null); }
  };

  const submitReschedule = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!reschedule) return;
    await run(reschedule.interview.id, () => m04Api.requestReschedule(
      reschedule.interview.id, new Date(proposedAt).toISOString(), message,
    ));
    setReschedule(null); setProposedAt(''); setMessage('');
  };

  return <div className="space-y-6">
    <PageHeader title="Lịch phỏng vấn" description="Thời gian hiển thị theo múi giờ Việt Nam (UTC+7)." />
    {error && !loading && <ErrorState message={error} onRetry={load} />}
    {loading ? <div className="flex justify-center py-12"><Spinner /></div> : !error && items.length === 0 ?
      <EmptyState title="Chưa có lịch phỏng vấn" description="Lời mời từ nhà tuyển dụng sẽ xuất hiện tại đây." /> :
      !error && <div className="grid gap-4 md:grid-cols-2">{items.map((item) => {
        const interview = item.interview;
        const canRespond = !interview.result && new Date(interview.scheduledAt) > new Date();
        return <Card key={interview.id} className="space-y-4"><CardHeader className="pb-0">
          <div className="flex items-start justify-between gap-3"><CardTitle>{item.application.cvSnapshot.title}</CardTitle>
            <Badge variant={interview.result === 'ACCEPTED' ? 'success' : interview.result === 'REJECTED' ? 'destructive' : 'secondary'}>{interview.result || (interview.confirmedAt ? 'Đã xác nhận' : 'Chờ xác nhận')}</Badge></div>
        </CardHeader><CardContent className="space-y-3 text-sm">
          <p><strong>{formatDateTime(interview.scheduledAt)}</strong> · {interview.mode === 'ONLINE' ? 'Trực tuyến' : 'Trực tiếp'}</p>
          <p className="break-all text-muted-foreground">{interview.locationOrLink}</p>
          {interview.message && <p>{interview.message}</p>}
          {item.changeRequest && <Alert variant={item.changeRequest.decision === 'REJECTED' ? 'destructive' : 'info'}>Đổi lịch: {formatDateTime(item.changeRequest.proposedAt)} · {item.changeRequest.decision}</Alert>}
          <div className="flex flex-wrap gap-2">
            {canRespond && !interview.confirmedAt && <Button size="sm" isLoading={busyId === interview.id} onClick={() => run(interview.id, () => m04Api.confirmInterview(interview.id))}>Xác nhận tham gia</Button>}
            {canRespond && !item.changeRequest && <Button variant="outline" size="sm" onClick={() => setReschedule(item)}>Yêu cầu đổi lịch</Button>}
          </div>
        </CardContent></Card>;
      })}</div>}
    <Dialog isOpen={reschedule !== null} onClose={() => setReschedule(null)} title="Yêu cầu đổi lịch" description="Chỉ được gửi một yêu cầu cho mỗi lịch phỏng vấn.">
      <form onSubmit={submitReschedule} className="space-y-4">
        <label className="block text-sm font-medium">Thời gian mới (UTC+7)<Input required type="datetime-local" value={proposedAt} onChange={(e) => setProposedAt(e.target.value)} /></label>
        <label className="block text-sm font-medium">Lý do<Textarea value={message} onChange={(e) => setMessage(e.target.value)} /></label>
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setReschedule(null)}>Hủy</Button><Button type="submit" isLoading={busyId === reschedule?.interview.id}>Gửi yêu cầu</Button></div>
      </form>
    </Dialog>
  </div>;
}
