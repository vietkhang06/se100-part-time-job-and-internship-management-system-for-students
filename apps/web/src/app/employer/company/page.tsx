'use client';

import * as React from 'react';
import {
  Upload,
  FileText,
  Save,
  RotateCcw,
  Edit,
  History,
  XCircle,
} from 'lucide-react';
import { CompanyVerificationStatus, DocumentType } from '@campusjob/contracts';
import type { CompanyDto } from '@campusjob/contracts';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/spinner';
import { Dialog } from '@/components/ui/dialog';
import {
  fetchEmployerCompany,
  createEmployerCompany,
  updateEmployerCompany,
  uploadCompanyDocument,
  resubmitCompanyVerification,
  fetchCompanyVerificationHistory,
} from '@/lib/m03-api';
import {
  COMPANY_VERIFICATION_MAP,
  getM03ErrorMessage,
} from '@/lib/m03-labels';

export default function EmployerCompanyPage() {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [company, setCompany] = React.useState<CompanyDto | null>(null);
  const [hasNoCompany, setHasNoCompany] = React.useState(false);
  const [isEditing, setIsEditing] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  // Verification history
  const [history, setHistory] = React.useState<any[]>([]);

  // Document Upload
  const [uploadedDoc, setUploadedDoc] = React.useState<{ id: string; name: string } | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<string | null>(null);

  // Resubmit modal
  const [isResubmitOpen, setIsResubmitOpen] = React.useState(false);

  // Form State
  const [formData, setFormData] = React.useState({
    name: '',
    legalName: '',
    representativeName: '',
    taxId: '',
    website: '',
    industry: '',
    companySize: '',
    description: '',
    email: '',
    phone: '',
    address: '',
    logoUrl: '',
  });

  const loadProfile = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchEmployerCompany();
      setCompany(res.company);
      setHasNoCompany(false);
      setFormData({
        name: res.company.name || '',
        legalName: res.company.legalName || '',
        representativeName: res.company.representativeName || '',
        taxId: res.company.taxId || '',
        website: res.company.website || '',
        industry: res.company.industry || '',
        companySize: res.company.companySize || '',
        description: res.company.description || '',
        email: res.company.email || '',
        phone: res.company.phone || '',
        address: res.company.address || '',
        logoUrl: res.company.logoUrl || '',
      });

      // Load history
      try {
        const hRes = await fetchCompanyVerificationHistory();
        setHistory(hRes.data || []);
      } catch {
        // history optional
      }
    } catch (err: any) {
      if (err.status === 404 || err.errorResponse?.statusCode === 404) {
        setHasNoCompany(true);
        setCompany(null);
      } else {
        setError(getM03ErrorMessage(err, 'Không thể tải thông tin doanh nghiệp.'));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('Dung lượng tệp vượt quá giới hạn 10MB.');
      return;
    }

    // Validate format (PDF, PNG, JPG, JPEG)
    const allowed = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    if (!allowed.includes(file.type) && !file.name.match(/\.(pdf|png|jpe?g)$/i)) {
      setUploadError('Chỉ chấp nhận tài liệu định dạng PDF hoặc ảnh PNG/JPG.');
      return;
    }

    try {
      setUploading(true);
      setUploadError(null);
      const asset = await uploadCompanyDocument(file);
      setUploadedDoc({ id: asset.id, name: file.name });
    } catch (err) {
      setUploadError(getM03ErrorMessage(err, 'Tải lên tài liệu thất bại.'));
    } finally {
      setUploading(false);
    }
  };

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('Vui lòng nhập tên thương hiệu doanh nghiệp.');
      return;
    }
    if (!formData.taxId.trim()) {
      setError('Vui lòng nhập mã số thuế doanh nghiệp.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await createEmployerCompany({
        name: formData.name.trim(),
        legalName: formData.legalName.trim() || undefined,
        representativeName: formData.representativeName.trim() || undefined,
        taxId: formData.taxId.trim(),
        website: formData.website.trim() || undefined,
        industry: formData.industry.trim() || undefined,
        companySize: formData.companySize.trim() || undefined,
        description: formData.description.trim() || undefined,
        email: formData.email.trim() || undefined,
        phone: formData.phone.trim() || undefined,
        address: formData.address.trim() || undefined,
        logoUrl: formData.logoUrl.trim() || undefined,
        documents: uploadedDoc
          ? [
              {
                fileAssetId: uploadedDoc.id,
                documentType: DocumentType.BUSINESS_LICENSE,
              },
            ]
          : undefined,
      });

      setSuccess('Khởi tạo hồ sơ doanh nghiệp thành công! Hồ sơ đang chờ phê duyệt.');
      void loadProfile();
    } catch (err: any) {
      setError(getM03ErrorMessage(err, 'Khởi tạo hồ sơ thất bại.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setError(null);
      await updateEmployerCompany({
        name: formData.name.trim() || undefined,
        legalName: formData.legalName.trim() || undefined,
        representativeName: formData.representativeName.trim() || undefined,
        website: formData.website.trim() || undefined,
        industry: formData.industry.trim() || undefined,
        companySize: formData.companySize.trim() || undefined,
        description: formData.description.trim() || undefined,
        email: formData.email.trim() || undefined,
        phone: formData.phone.trim() || undefined,
        address: formData.address.trim() || undefined,
        logoUrl: formData.logoUrl.trim() || undefined,
      });

      setSuccess('Cập nhật hồ sơ doanh nghiệp thành công.');
      setIsEditing(false);
      void loadProfile();
    } catch (err) {
      setError(getM03ErrorMessage(err, 'Cập nhật thông tin thất bại.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleResubmit = async () => {
    if (!uploadedDoc) {
      setUploadError('Vui lòng tải lên tài liệu xác thực hợp lệ trước khi gửi lại.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await resubmitCompanyVerification({
        documents: [
          {
            fileAssetId: uploadedDoc.id,
            documentType: DocumentType.BUSINESS_LICENSE,
          },
        ],
      });

      setIsResubmitOpen(false);
      setUploadedDoc(null);
      setSuccess('Đã gửi lại yêu cầu xác thực. Vui lòng chờ ban quản trị phê duyệt.');
      void loadProfile();
    } catch (err) {
      setError(getM03ErrorMessage(err, 'Gửi lại yêu cầu xác thực thất bại.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="py-16 flex flex-col items-center justify-center gap-3">
        <Spinner className="w-8 h-8 text-primary" />
        <p className="text-sm text-muted-foreground">Đang tải hồ sơ doanh nghiệp...</p>
      </div>
    );
  }

  // 1. Has No Company Yet -> Create Form
  if (hasNoCompany) {
    return (
      <div className="space-y-6 max-w-4xl">
        <PageHeader
          title="Khởi tạo hồ sơ doanh nghiệp"
          description="Doanh nghiệp của bạn chưa được thiết lập trên hệ thống. Vui lòng điền thông tin và đính kèm giấy phép kinh doanh để bắt đầu đăng tin tuyển dụng."
        />

        {error && <Alert variant="destructive">{error}</Alert>}
        {success && <Alert variant="success">{success}</Alert>}

        <Card>
          <CardHeader>
            <CardTitle>Thông tin pháp lý & Nhận diện doanh nghiệp</CardTitle>
            <CardDescription>
              Các trường có dấu (*) là bắt buộc để quản trị viên đối soát thông tin với cơ sở dữ liệu quốc gia.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateCompany} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Tên thương hiệu doanh nghiệp (*)"
                  placeholder="VD: FPT Software"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
                <Input
                  label="Mã số thuế doanh nghiệp (*) (Duy nhất)"
                  placeholder="VD: 0101248141"
                  value={formData.taxId}
                  onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                  required
                />
                <Input
                  label="Tên pháp lý đầy đủ trên giấy phép"
                  placeholder="VD: Công ty Cổ phần Phần mềm FPT"
                  value={formData.legalName}
                  onChange={(e) => setFormData({ ...formData, legalName: e.target.value })}
                />
                <Input
                  label="Người đại diện pháp luật"
                  placeholder="VD: Nguyễn Văn A"
                  value={formData.representativeName}
                  onChange={(e) => setFormData({ ...formData, representativeName: e.target.value })}
                />
                <Input
                  label="Ngành nghề hoạt động chính"
                  placeholder="VD: Công nghệ thông tin / Dịch vụ phần mềm"
                  value={formData.industry}
                  onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                />
                <Input
                  label="Quy mô công ty"
                  placeholder="VD: 50-100 nhân viên"
                  value={formData.companySize}
                  onChange={(e) => setFormData({ ...formData, companySize: e.target.value })}
                />
                <Input
                  label="Email liên hệ chính thức"
                  type="email"
                  placeholder="contact@company.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
                <Input
                  label="Số điện thoại liên hệ"
                  placeholder="028 7300 8888"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
                <Input
                  label="Website chính thức"
                  placeholder="https://company.com"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                />
                <Input
                  label="Địa chỉ trụ sở chính"
                  placeholder="Số 10, Đường ABC, Quận 1, TP. Hồ Chí Minh"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>

              <Textarea
                label="Giới thiệu về doanh nghiệp"
                placeholder="Mô tả tóm tắt văn hóa doanh nghiệp, lĩnh vực hoạt động, cơ hội phát triển cho sinh viên..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={4}
              />

              {/* Legal Document Upload */}
              <div className="space-y-2 p-4 rounded-lg border border-dashed border-border bg-card">
                <label className="text-xs font-semibold text-foreground flex items-center gap-2">
                  <Upload className="w-4 h-4 text-primary" />
                  Đính kèm giấy phép kinh doanh / Quyết định thành lập (PDF, PNG, JPG tối đa 10MB)
                </label>
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={handleFileUpload}
                  disabled={uploading}
                  className="text-xs text-muted-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-primary-foreground hover:file:opacity-90"
                />
                {uploading && <p className="text-xs text-primary animate-pulse">Đang tải lên và quét tính toàn vẹn...</p>}
                {uploadedDoc && (
                  <p className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5" />
                    Đã đính kèm: {uploadedDoc.name}
                  </p>
                )}
                {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <Button type="submit" variant="primary" disabled={submitting}>
                  {submitting ? 'Đang gửi hồ sơ...' : 'Gửi hồ sơ đăng ký doanh nghiệp'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 2. Existing Company Profile
  const statusMeta = company
    ? COMPANY_VERIFICATION_MAP[company.verificationStatus]
    : { label: 'Chưa rõ', variant: 'outline' as const };

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title="Hồ sơ doanh nghiệp"
        description="Quản lý thông tin pháp lý, thương hiệu và trạng thái xác thực của tổ chức tuyển dụng."
        action={
          !isEditing ? (
            <Button variant="outline" onClick={() => setIsEditing(true)} className="gap-2">
              <Edit className="w-4 h-4" />
              <span>Chỉnh sửa hồ sơ</span>
            </Button>
          ) : (
            <Button variant="outline" onClick={() => setIsEditing(false)} className="gap-2">
              <XCircle className="w-4 h-4" />
              <span>Hủy chỉnh sửa</span>
            </Button>
          )
        }
      />

      {error && <Alert variant="destructive">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      {/* Verification Status Banner */}
      {company && (
        <Card className="border-border">
          <CardContent className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase">
                  Trạng thái xác thực:
                </span>
                <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
              </div>

              {company.verificationStatus === CompanyVerificationStatus.PENDING_REVIEW && (
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Hồ sơ đang chờ ban quản trị phê duyệt. Trong thời gian này, bạn vẫn có thể cập nhật thông tin và tạo chi nhánh.
                </p>
              )}

              {company.verificationStatus === CompanyVerificationStatus.VERIFIED && (
                <p className="text-xs text-emerald-700 dark:text-emerald-400">
                  Doanh nghiệp đã được xác thực chính thức. Các tin tuyển dụng của bạn đủ điều kiện xuất hiện công khai trên sàn việc làm.
                </p>
              )}

              {company.verificationStatus === CompanyVerificationStatus.REJECTED && (
                <div className="space-y-2 pt-1">
                  <p className="text-xs text-destructive font-medium">
                    Hồ sơ xác thực đã bị từ chối:{' '}
                    {(company as any).rejectionReason ||
                      history.find((h) => h.status === CompanyVerificationStatus.REJECTED && h.rejectionReason)?.rejectionReason ||
                      'Vui lòng kiểm tra lại tài liệu pháp lý.'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Bạn có thể cập nhật lại tài liệu giấy phép kinh doanh và gửi lại yêu cầu xác thực.
                  </p>
                </div>
              )}
            </div>

            {company.verificationStatus === CompanyVerificationStatus.REJECTED && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsResubmitOpen(true)}
                className="shrink-0 gap-1.5"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Gửi lại yêu cầu xác thực</span>
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Profile Details or Edit Form */}
      <Card>
        <CardHeader>
          <CardTitle>Thông tin doanh nghiệp</CardTitle>
          <CardDescription>
            {isEditing
              ? 'Chỉnh sửa thông tin giới thiệu và thông tin liên hệ.'
              : 'Thông tin hiển thị công khai tới sinh viên và ứng viên.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isEditing ? (
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Tên doanh nghiệp"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
                <Input
                  label="Mã số thuế"
                  value={formData.taxId}
                  disabled
                  title="Mã số thuế không thể thay đổi sau khi tạo"
                />
                <Input
                  label="Tên pháp lý đầy đủ"
                  value={formData.legalName}
                  onChange={(e) => setFormData({ ...formData, legalName: e.target.value })}
                />
                <Input
                  label="Người đại diện pháp luật"
                  value={formData.representativeName}
                  onChange={(e) => setFormData({ ...formData, representativeName: e.target.value })}
                />
                <Input
                  label="Ngành nghề hoạt động"
                  value={formData.industry}
                  onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                />
                <Input
                  label="Quy mô công ty"
                  value={formData.companySize}
                  onChange={(e) => setFormData({ ...formData, companySize: e.target.value })}
                />
                <Input
                  label="Email liên hệ"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
                <Input
                  label="Số điện thoại"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
                <Input
                  label="Website chính thức"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                />
                <Input
                  label="Địa chỉ trụ sở"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>

              <Textarea
                label="Mô tả / Giới thiệu công ty"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={4}
              />

              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditing(false)}
                >
                  Hủy
                </Button>
                <Button type="submit" variant="primary" disabled={submitting}>
                  <Save className="w-4 h-4 mr-2" />
                  {submitting ? 'Đang lưu...' : 'Lưu thay đổi'}
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <span className="text-xs text-muted-foreground block">Tên doanh nghiệp</span>
                  <span className="font-semibold text-foreground">{company?.name}</span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">Mã số thuế</span>
                  <span className="font-medium text-foreground">{company?.taxId}</span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">Tên pháp lý</span>
                  <span className="text-foreground">{company?.legalName || 'Chưa cập nhật'}</span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">Đại diện pháp luật</span>
                  <span className="text-foreground">{company?.representativeName || 'Chưa cập nhật'}</span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">Ngành nghề</span>
                  <span className="text-foreground">{company?.industry || 'Chưa cập nhật'}</span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">Quy mô</span>
                  <span className="text-foreground">{company?.companySize || 'Chưa cập nhật'}</span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">Website</span>
                  <span className="text-foreground">
                    {company?.website ? (
                      <a href={company.website} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                        {company.website}
                      </a>
                    ) : (
                      'Chưa cập nhật'
                    )}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">Email</span>
                  <span className="text-foreground">{company?.email || 'Chưa cập nhật'}</span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">Số điện thoại</span>
                  <span className="text-foreground">{company?.phone || 'Chưa cập nhật'}</span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">Địa chỉ</span>
                  <span className="text-foreground">{company?.address || 'Chưa cập nhật'}</span>
                </div>
              </div>

              {company?.description && (
                <div className="pt-3 border-t border-border">
                  <span className="text-xs text-muted-foreground block mb-1">Giới thiệu</span>
                  <p className="text-muted-foreground whitespace-pre-line leading-relaxed">
                    {company.description}
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Verification History Log */}
      {history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <History className="w-4 h-4 text-primary" />
              Lịch sử xét duyệt hồ sơ xác thực ({history.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {history.map((h, idx) => (
                <div
                  key={h.id || idx}
                  className="p-3 rounded-lg border border-border bg-card/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          h.status === 'VERIFIED'
                            ? 'success'
                            : h.status === 'REJECTED'
                            ? 'destructive'
                            : 'warning'
                        }
                      >
                        {h.status === 'VERIFIED'
                          ? 'Đã duyệt'
                          : h.status === 'REJECTED'
                          ? 'Từ chối'
                          : 'Đang xem xét'}
                      </Badge>
                      <span className="text-muted-foreground">
                        {new Date(h.createdAt || h.submittedAt).toLocaleString('vi-VN')}
                      </span>
                    </div>
                    {h.rejectionReason && (
                      <p className="text-destructive">Lý do: {h.rejectionReason}</p>
                    )}
                  </div>
                  {h.documents && h.documents.length > 0 && (
                    <span className="text-muted-foreground">
                      {h.documents.length} tài liệu đính kèm
                    </span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resubmit Verification Dialog */}
      <Dialog
        isOpen={isResubmitOpen}
        onClose={() => setIsResubmitOpen(false)}
        title="Gửi lại yêu cầu xác thực doanh nghiệp"
        description="Tải lên tài liệu giấy phép kinh doanh mới để ban quản trị tiến hành kiểm định lại hồ sơ của bạn."
      >
        <div className="space-y-4">
          <div className="space-y-2 p-4 rounded-lg border border-dashed border-border bg-card">
            <label className="text-xs font-semibold text-foreground flex items-center gap-2">
              <Upload className="w-4 h-4 text-primary" />
              Chọn tệp giấy phép / quyết định thành lập (PDF, PNG, JPG &le; 10MB)
            </label>
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={handleFileUpload}
              disabled={uploading}
              className="text-xs text-muted-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-primary-foreground hover:file:opacity-90"
            />
            {uploading && <p className="text-xs text-primary animate-pulse">Đang tải lên...</p>}
            {uploadedDoc && (
              <p className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                <FileText className="w-3.5 h-3.5" />
                Đã đính kèm: {uploadedDoc.name}
              </p>
            )}
            {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button variant="outline" onClick={() => setIsResubmitOpen(false)}>
              Hủy
            </Button>
            <Button
              variant="primary"
              onClick={handleResubmit}
              disabled={submitting || !uploadedDoc}
            >
              {submitting ? 'Đang gửi...' : 'Xác nhận nộp lại'}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
