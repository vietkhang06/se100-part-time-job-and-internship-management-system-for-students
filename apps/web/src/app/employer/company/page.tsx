'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { CompanyDto, CompanyProfileResponseDto, CreateCompanyRequestDto } from '@campusjob/contracts';
import { apiClient, ApiClientError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

type CompanyForm = Pick<CreateCompanyRequestDto, 'name' | 'taxId' | 'legalName' | 'representativeName' | 'website' | 'industry' | 'companySize' | 'email' | 'phone' | 'address' | 'description'>;
const emptyForm: CompanyForm = { name: '', taxId: '', legalName: '', representativeName: '', website: '', industry: '', companySize: '', email: '', phone: '', address: '', description: '' };
const labels: Record<string, string> = { UNVERIFIED: 'Chưa xác thực', PENDING_REVIEW: 'Đang chờ duyệt', VERIFIED: 'Đã xác thực', REJECTED: 'Bị từ chối' };

export default function EmployerCompanyPage() {
  const { isLoading: authLoading } = useAuth();
  const [company, setCompany] = useState<CompanyDto | null>(null);
  const [form, setForm] = useState<CompanyForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const result = await apiClient<CompanyProfileResponseDto>('/companies/profile');
      setCompany(result.company);
      setForm({ name: result.company.name, taxId: result.company.taxId,
        legalName: result.company.legalName ?? '', representativeName: result.company.representativeName ?? '',
        website: result.company.website ?? '', industry: result.company.industry ?? '',
        companySize: result.company.companySize ?? '', email: result.company.email ?? '',
        phone: result.company.phone ?? '', address: result.company.address ?? '',
        description: result.company.description ?? '' });
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 404) { setCompany(null); setForm(emptyForm); }
      else setError(err instanceof Error ? err.message : 'Không tải được hồ sơ doanh nghiệp.');
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { if (!authLoading) void load(); }, [authLoading, load]);

  function field(key: keyof CompanyForm, label: string, type = 'text') {
    return <Input key={key} label={label} type={type} value={form[key] ?? ''}
      disabled={saving || (key === 'taxId' && !!company)}
      onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} />;
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setNotice('');
    if (!form.name.trim() || (!company && !form.taxId.trim())) { setError('Vui lòng nhập tên công ty và mã số thuế.'); return; }
    setSaving(true);
    try {
      const { taxId, ...raw } = form;
      const editable = Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, value?.trim() || null]));
      const result = await apiClient<CompanyProfileResponseDto>(company ? '/companies/profile' : '/companies', {
        method: company ? 'PATCH' : 'POST', body: JSON.stringify(company ? editable : { ...editable, taxId }),
      });
      setCompany(result.company); setNotice('Đã lưu hồ sơ doanh nghiệp.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Không lưu được hồ sơ.'); }
    finally { setSaving(false); }
  }

  return <div className="space-y-6">
    <PageHeader title="Hồ sơ công ty" description="Quản lý thông tin pháp lý và liên hệ của doanh nghiệp." />
    {loading ? <p role="status">Đang tải hồ sơ...</p> : <Card><CardHeader><CardTitle>{company ? 'Thông tin doanh nghiệp' : 'Tạo hồ sơ doanh nghiệp'}</CardTitle></CardHeader>
      <CardContent><form onSubmit={save} className="space-y-4 max-w-2xl">
        {company && <p role="status">Trạng thái xác thực: {labels[company.verificationStatus] ?? company.verificationStatus}</p>}
        {field('name', 'Tên công ty')}{field('taxId', 'Mã số thuế')}
        {field('legalName', 'Tên pháp lý')}{field('representativeName', 'Người đại diện')}
        {field('website', 'Website', 'url')}{field('industry', 'Lĩnh vực hoạt động')}
        {field('companySize', 'Quy mô')}{field('email', 'Email liên hệ', 'email')}
        {field('phone', 'Số điện thoại')}{field('address', 'Địa chỉ trụ sở')}
        <Textarea label="Giới thiệu công ty" value={form.description ?? ''} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
        {error && <p role="alert" className="text-destructive">{error}</p>}{notice && <p role="status">{notice}</p>}
        <Button type="submit" disabled={saving}>{saving ? 'Đang lưu...' : company ? 'Lưu thay đổi' : 'Tạo hồ sơ'}</Button>
      </form></CardContent></Card>}
  </div>;
}
