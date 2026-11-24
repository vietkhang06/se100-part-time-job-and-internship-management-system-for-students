'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { CompanyBranchDto, CompanyBranchListResponseDto, CompanyBranchResponseDto, CreateCompanyBranchRequestDto } from '@campusjob/contracts';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type BranchForm = { branchName: string; addressLine: string; ward: string; district: string; city: string; phone: string; email: string; latitude: string; longitude: string; isHeadquarter: boolean };
const blank: BranchForm = { branchName: '', addressLine: '', ward: '', district: '', city: '', phone: '', email: '', latitude: '', longitude: '', isHeadquarter: false };

export default function EmployerBranchesPage() {
  const { isLoading: authLoading, isAuthenticated } = useAuth();
  const [branches, setBranches] = useState<CompanyBranchDto[]>([]);
  const [form, setForm] = useState<BranchForm>(blank);
  const [editing, setEditing] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async (): Promise<boolean> => {
    setLoading(true); setError('');
    try { const response = await apiClient<CompanyBranchListResponseDto>('/companies/branches'); setBranches(response.data); return true; }
    catch (err) { setError(err instanceof Error ? err.message : 'Không tải được danh sách chi nhánh.'); return false; }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { if (!authLoading && isAuthenticated) void load(); else if (!authLoading) setLoading(false); }, [authLoading, isAuthenticated, load]);

  function edit(branch: CompanyBranchDto) {
    setEditing(branch.id); setOpen(true); setError('');
    setForm({ branchName: branch.branchName, addressLine: branch.addressLine, ward: branch.ward ?? '',
      district: branch.district ?? '', city: branch.city, phone: branch.phone ?? '', email: branch.email ?? '',
      latitude: branch.latitude?.toString() ?? '', longitude: branch.longitude?.toString() ?? '', isHeadquarter: branch.isHeadquarter });
  }
  function field(key: Exclude<keyof BranchForm, 'isHeadquarter'>, label: string, type = 'text') {
    return <Input key={key} label={label} type={type} step={type === 'number' ? 'any' : undefined} value={form[key]} disabled={busy}
      onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} />;
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setNotice('');
    if (!form.branchName.trim() || !form.addressLine.trim() || !form.city.trim()) {
      setError('Tên chi nhánh, địa chỉ và tỉnh/thành phố là bắt buộc.'); return;
    }
    const latitude = form.latitude.trim() ? Number(form.latitude) : null;
    const longitude = form.longitude.trim() ? Number(form.longitude) : null;
    if ((latitude !== null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) ||
        (longitude !== null && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180))) {
      setError('Tọa độ phải nằm trong khoảng vĩ độ ±90 và kinh độ ±180.'); return;
    }
    const payload: CreateCompanyBranchRequestDto = { branchName: form.branchName.trim(), addressLine: form.addressLine.trim(),
      city: form.city.trim(), ward: form.ward.trim() || null, district: form.district.trim() || null,
      phone: form.phone.trim() || null, email: form.email.trim() || null, latitude, longitude,
      isHeadquarter: form.isHeadquarter };
    setBusy(true);
    try {
      await apiClient<CompanyBranchResponseDto>(editing ? `/companies/branches/${editing}` : '/companies/branches', {
        method: editing ? 'PATCH' : 'POST', body: JSON.stringify(payload),
      });
      setOpen(false); setEditing(null); setForm(blank);
      if (await load()) setNotice('Đã lưu chi nhánh.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Không lưu được chi nhánh.'); }
    finally { setBusy(false); }
  }
  async function remove(branch: CompanyBranchDto) {
    if (!window.confirm(`Xóa chi nhánh “${branch.branchName}”?`)) return;
    setBusy(true); setError(''); setNotice('');
    try { await apiClient(`/companies/branches/${branch.id}`, { method: 'DELETE' }); if (await load()) setNotice('Đã xóa chi nhánh.'); }
    catch (err) { setError(err instanceof Error ? err.message : 'Không xóa được chi nhánh.'); }
    finally { setBusy(false); }
  }

  return <div className="space-y-6">
    <PageHeader title="Quản lý chi nhánh & địa điểm" description="Thêm địa chỉ văn phòng để gắn vào tin tuyển dụng."
      action={<Button disabled={authLoading || !isAuthenticated} onClick={() => { setForm(blank); setEditing(null); setOpen(true); setError(''); }}>Thêm chi nhánh</Button>} />
    {error && <p role="alert" className="text-destructive">{error}</p>}{notice && <p role="status">{notice}</p>}
    {open && <form onSubmit={save} className="max-w-2xl space-y-4 rounded-lg border p-5">
      <h2 className="font-semibold">{editing ? 'Sửa chi nhánh' : 'Thêm chi nhánh'}</h2>
      {field('branchName', 'Tên chi nhánh')}{field('addressLine', 'Địa chỉ')}
      {field('ward', 'Phường/Xã')}{field('district', 'Quận/Huyện')}{field('city', 'Tỉnh/Thành phố')}
      {field('phone', 'Số điện thoại')}{field('email', 'Email', 'email')}
      {field('latitude', 'Vĩ độ', 'number')}{field('longitude', 'Kinh độ', 'number')}
      <label className="flex gap-2"><input type="checkbox" checked={form.isHeadquarter} onChange={(event) => setForm((current) => ({ ...current, isHeadquarter: event.target.checked }))} />Trụ sở chính</label>
      <div className="flex gap-3"><Button type="submit" disabled={busy}>{busy ? 'Đang lưu...' : 'Lưu chi nhánh'}</Button>
        <Button type="button" variant="outline" onClick={() => { setOpen(false); setError(''); }}>Hủy</Button></div>
    </form>}
    {!isAuthenticated && !authLoading ? <p role="alert">Vui lòng đăng nhập bằng tài khoản nhà tuyển dụng.</p> : loading ? <p role="status">Đang tải chi nhánh...</p> : error ? null : branches.length === 0 ?
      <EmptyState title="Chưa có chi nhánh nào" description="Thêm văn phòng hoặc cơ sở làm việc để sinh viên biết địa điểm ứng tuyển." /> :
      <ul className="space-y-3">{branches.map((branch) => <li key={branch.id} className="rounded-lg border p-4">
        <h2 className="font-semibold">{branch.branchName}{branch.isHeadquarter ? ' · Trụ sở chính' : ''}</h2>
        <p>{[branch.addressLine, branch.ward, branch.district, branch.city].filter(Boolean).join(', ')}</p>
        <div className="mt-3 flex gap-3"><Button variant="outline" disabled={busy} onClick={() => edit(branch)}>Sửa</Button>
          <Button variant="outline" disabled={busy} onClick={() => void remove(branch)}>Xóa</Button></div>
      </li>)}</ul>}
  </div>;
}
