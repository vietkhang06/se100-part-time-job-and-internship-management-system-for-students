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
import { Spinner } from '@/components/ui/spinner';
import { ApiClientError } from '@/lib/api-client';
import { ApplicationItem, applicationStatusLabels, formatDateTime, m04Api } from '@/lib/m04-api';

export default function CandidateApplicationsPage() {
  const [items, setItems] = useState<ApplicationItem[]>([]);
  const [detail, setDetail] = useState<ApplicationItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setItems(await m04Api.mine()); }
    catch (e) { setError(e instanceof ApiClientError ? e.message : 'Không thể tải hồ sơ ứng tuyển.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const openDetail = async (id: string) => {
    setBusyId(id); setError(null);
    try { setDetail(await m04Api.mineDetail(id)); }
    catch (e) { setError(e instanceof ApiClientError ? e.message : 'Không thể tải chi tiết hồ sơ.'); }
    finally { setBusyId(null); }
  };

  const withdraw = async (id: string) => {
    setBusyId(id); setError(null);
    try {
      await m04Api.withdraw(id);
      setNotice('Đã rút hồ sơ ứng tuyển.');
      setDetail(null);
      await load();
    } catch (e) { setError(e instanceof ApiClientError ? e.message : 'Không thể rút hồ sơ.'); }
    finally { setBusyId(null); }
  };

  return <div className="space-y-6">
    <PageHeader title="Lịch sử ứng tuyển" description="Theo dõi trạng thái, CV snapshot và lịch sử xử lý hồ sơ." />
    {notice && <Alert variant="success">{notice}</Alert>}
    {error && !loading && <ErrorState message={error} onRetry={load} />}
    {loading ? <div className="flex justify-center py-12"><Spinner /></div> : !error && items.length === 0 ?
      <EmptyState title="Chưa có hồ sơ ứng tuyển" description="Hồ sơ đã nộp sẽ xuất hiện tại đây." /> :
      !error && <div className="grid gap-4 md:grid-cols-2">
        {items.map((item) => <Card key={item.id} className="space-y-4">
          <CardHeader className="pb-0"><div className="flex items-start justify-between gap-3">
            <div><CardTitle>{item.cvSnapshot.title}</CardTitle><p className="mt-2 text-sm text-muted-foreground">Nộp {formatDateTime(item.createdAt)}</p></div>
            <Badge variant={item.status === 'ACCEPTED' ? 'success' : item.status === 'REJECTED' ? 'destructive' : 'secondary'}>{applicationStatusLabels[item.status]}</Badge>
          </div></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm"><span className="font-medium">Mã tin:</span> {item.jobId}</p>
            {item.rejectionReason && <p className="text-sm text-destructive">Lý do: {item.rejectionReason}</p>}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" isLoading={busyId === item.id} onClick={() => openDetail(item.id)}>Xem chi tiết</Button>
              {['SUBMITTED', 'REVIEWING'].includes(item.status) && <Button variant="ghost" size="sm" isLoading={busyId === item.id} onClick={() => withdraw(item.id)}>Rút hồ sơ</Button>}
            </div>
          </CardContent>
        </Card>)}
      </div>}
    <Dialog isOpen={detail !== null} onClose={() => setDetail(null)} title="Chi tiết hồ sơ ứng tuyển" className="max-w-3xl">
      {detail && <div className="max-h-[70vh] space-y-5 overflow-y-auto pr-1">
        <section><h3 className="font-semibold">CV snapshot tại thời điểm nộp</h3>
          <p className="mt-2 text-sm">{detail.cvSnapshot.fullName} · {detail.cvSnapshot.email}</p>
          <p className="mt-1 text-sm text-muted-foreground">{detail.cvSnapshot.summary || 'Không có phần giới thiệu.'}</p>
          <div className="mt-2 flex flex-wrap gap-2">{detail.cvSnapshot.skills.map((skill) => <Badge key={skill} variant="outline">{skill}</Badge>)}</div>
        </section>
        {detail.coverLetter && <section><h3 className="font-semibold">Thư giới thiệu</h3><p className="mt-2 whitespace-pre-wrap text-sm">{detail.coverLetter}</p></section>}
        <section><h3 className="font-semibold">Lịch sử trạng thái</h3><ol className="mt-2 space-y-2">
          {detail.history?.map((history) => <li key={history.id} className="rounded-lg border p-3 text-sm">
            <div className="font-medium">{applicationStatusLabels[history.toStatus]}</div>
            <div className="text-muted-foreground">{formatDateTime(history.createdAt)}{history.reason ? ` · ${history.reason}` : ''}</div>
          </li>)}
        </ol></section>
      </div>}
    </Dialog>
  </div>;
}
