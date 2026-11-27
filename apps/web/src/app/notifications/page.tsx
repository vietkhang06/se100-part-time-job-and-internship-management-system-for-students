'use client';
import { useState } from 'react';
import Link from 'next/link';
import type { NotificationDto, PaginatedResponse } from '@campusjob/contracts';
import { RoleGate } from '@/components/m05/role-gate';
import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { AppHeader } from '@/components/layout/app-header';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';
import { useResource } from '@/lib/use-resource';

function Inbox() {
  const [page,setPage]=useState(1), [message,setMessage]=useState('');
  const {data,error,reload}=useResource<PaginatedResponse<NotificationDto>>('/notifications?page='+page);
  async function mark(path:string) {
    try {await apiClient('/notifications/'+path,{method:'PATCH'}); setMessage(''); reload();}
    catch(err) {setMessage(err instanceof Error ? err.message : 'Không thể cập nhật.');}
  }
  return <><PageHeader title="Thông báo" action={<div className="flex items-center gap-2"><Link href="/candidate/settings"><Button variant="outline">Cài đặt thông báo</Button></Link><Button variant="outline" onClick={()=>mark('read-all')}>Đánh dấu tất cả đã đọc</Button></div>}/>
    <p role="status">{error || message || (!data?'Đang tải…':data.data.length===0?'Bạn chưa có thông báo.':'')}</p>
    {data?.data.map(n=><article key={n.id} className="mb-3 space-y-2 rounded-xl border bg-card p-5"><h2 className="font-semibold">{n.title}</h2><p>{n.body}</p><p className="text-sm text-muted-foreground">{new Date(n.createdAt).toLocaleString('vi-VN')}</p>
    {!n.isRead && <Button variant="outline" onClick={()=>mark(n.id+'/read')}>Đánh dấu đã đọc</Button>}</article>)}
    {data && data.meta.totalPages>1 && <div className="flex gap-2"><Button disabled={page===1} onClick={()=>setPage(page-1)}>Trước</Button><Button disabled={page>=data.meta.totalPages} onClick={()=>setPage(page+1)}>Sau</Button></div>}</>;
}
export default function Notifications() {
  return <><AppHeader/><PageContainer><RoleGate header={null} roles={['STUDENT','EMPLOYER','ADMIN','MODERATOR']}><Inbox/></RoleGate></PageContainer></>;
}
