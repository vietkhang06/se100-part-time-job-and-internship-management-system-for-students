'use client';
import {useState} from 'react';
import type {SavedJobListResponseDto} from '@campusjob/contracts';
import {PageHeader} from '@/components/layout/page-header';
import {Button} from '@/components/ui/button';
import {useResource} from '@/lib/use-resource';
import {apiClient} from '@/lib/api-client';
export default function SavedJobs() {
  const [page,setPage]=useState(1),[message,setMessage]=useState('');
  const {data,error,reload}=useResource<SavedJobListResponseDto>('/saved-jobs?page='+page);
  async function remove(id:string) {
    try {await apiClient('/saved-jobs/'+id,{method:'DELETE'});setMessage('Đã bỏ lưu.');
      if(page>1 && data?.savedJobs.length===1)setPage(page-1);else reload();}
    catch(err){setMessage(err instanceof Error ? err.message : 'Không thể bỏ lưu.');}
  }
  return <section><PageHeader title="Tin đã lưu"/><p role="status">{error||message||(!data?'Đang tải…':data.total===0?'Bạn chưa lưu tin tuyển dụng nào.':'')}</p>
    {data?.savedJobs.map(item=><article className="my-3 space-y-2 rounded-xl border bg-card p-5" key={item.id}><h2 className="font-bold">{item.job?.title || 'Tin không còn công khai'}</h2><p>{item.job?.companyName} · {item.isAvailable?'Đang tuyển':'Đã ngừng tuyển'}</p><Button variant="outline" onClick={()=>remove(item.jobId)}>Bỏ lưu</Button></article>)}
    {data && data.totalPages>1 && <div className="flex gap-2"><Button disabled={page===1} onClick={()=>setPage(page-1)}>Trước</Button><Button disabled={page>=data.totalPages} onClick={()=>setPage(page+1)}>Sau</Button></div>}</section>;
}
