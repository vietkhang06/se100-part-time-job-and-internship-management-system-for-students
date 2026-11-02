'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  Building2,
  MapPin,
  Bookmark,
  CheckCircle2,
  ArrowLeft,
  Share2,
} from 'lucide-react';
import { UserRole } from '@campusjob/contracts';
import type { PublicJobPostingDto } from '@campusjob/contracts';
import { AppHeader } from '@/components/layout/app-header';
import { PageContainer } from '@/components/layout/page-container';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { useAuth } from '@/lib/auth-context';
import {
  fetchPublicJobDetail,
  fetchSavedJobIds,
  saveJob,
  unsaveJob,
} from '@/lib/m03-api';
import { JOB_TYPE_MAP, formatSalary, getM03ErrorMessage } from '@/lib/m03-labels';

export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const isStudent = user?.role === UserRole.STUDENT;

  const jobId = typeof params?.id === 'string' ? params.id : '';

  const [loading, setLoading] = React.useState(true);
  const [notFound, setNotFound] = React.useState(false);
  const [_errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [job, setJob] = React.useState<PublicJobPostingDto | null>(null);
  const [isSaved, setIsSaved] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!jobId) return;

    let cancelled = false;

    async function loadData() {
      try {
        setLoading(true);
        setNotFound(false);
        setErrorMessage(null);

        const res = await fetchPublicJobDetail(jobId);
        if (!cancelled) {
          setJob(res.job);
        }

        if (isStudent && !cancelled) {
          const ids = await fetchSavedJobIds();
          setIsSaved(ids.includes(jobId));
        }
      } catch (err: any) {
        if (!cancelled) {
          if (err.status === 404 || err.errorResponse?.statusCode === 404) {
            setNotFound(true);
          } else {
            setErrorMessage(getM03ErrorMessage(err, 'Không thể tải thông tin tin tuyển dụng.'));
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadData();

    return () => {
      cancelled = true;
    };
  }, [jobId, isStudent]);

  const handleToggleSave = async () => {
    if (!isStudent) {
      router.push('/login');
      return;
    }
    try {
      setSaving(true);
      if (isSaved) {
        await unsaveJob(jobId);
        setIsSaved(false);
      } else {
        await saveJob(jobId);
        setIsSaved(true);
      }
    } catch (err) {
      alert(getM03ErrorMessage(err, 'Không thể cập nhật trạng thái lưu tin.'));
    } finally {
      setSaving(false);
    }
  };

  const handleShare = () => {
    if (typeof window !== 'undefined') {
      void navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <AppHeader />
        <PageContainer className="flex-1 py-16 flex items-center justify-center">
          <Spinner className="w-8 h-8 text-primary" />
        </PageContainer>
      </div>
    );
  }

  if (notFound || !job) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <AppHeader />
        <PageContainer className="flex-1 py-12 max-w-2xl">
          <EmptyState
            title="Tin tuyển dụng không tồn tại hoặc đã ngừng công khai"
            description="Vị trí tuyển dụng này có thể đã hết hạn nhận hồ sơ, tạm dừng tuyển hoặc không đủ điều kiện hiển thị công khai trên hệ thống."
            actionLabel="Quay lại danh sách việc làm"
            onAction={() => router.push('/jobs')}
          />
        </PageContainer>
      </div>
    );
  }

  const salaryFormatted = formatSalary(
    job.salaryMin,
    job.salaryMax,
    job.isSalaryNegotiable,
  );

  const deadlineFormatted = job.deadline
    ? new Date(job.deadline).toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : null;

  const publishedFormatted = job.createdAt
    ? new Date(job.createdAt).toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : null;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <AppHeader />

      <PageContainer className="flex-1 py-8 space-y-6 max-w-5xl">
        {/* Breadcrumb / Back button */}
        <div>
          <Link
            href="/jobs"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Quay lại tìm kiếm việc làm</span>
          </Link>
        </div>

        {/* Top Hero Card */}
        <Card className="border-border shadow-sm">
          <CardContent className="p-6 md:p-8 space-y-6">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Building2 className="w-4 h-4 text-primary" />
                  <Link
                    href={job.companyId ? `/companies/${job.companyId}` : '#'}
                    className="font-medium hover:underline text-foreground"
                  >
                    {job.companyName || 'Doanh nghiệp'}
                  </Link>
                  <span title="Doanh nghiệp đã được xác thực">
                    <CheckCircle2
                      className="w-4 h-4 text-emerald-600"
                      aria-label="Đã xác thực"
                    />
                  </span>
                </div>

                <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
                  {job.title}
                </h1>

                {/* Badges */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Badge variant="secondary">
                    {JOB_TYPE_MAP[job.type] || job.type}
                  </Badge>
                  {job.schedule && (
                    <Badge variant="outline">{job.schedule}</Badge>
                  )}
                  {job.industry && (
                    <Badge variant="outline">{job.industry}</Badge>
                  )}
                  {job.branchCity && (
                    <Badge variant="outline" className="gap-1">
                      <MapPin className="w-3 h-3" />
                      {job.branchCity}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 shrink-0 pt-2 md:pt-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleShare}
                  className="gap-1.5"
                  title="Sao chép đường dẫn chia sẻ"
                >
                  <Share2 className="w-4 h-4" />
                  <span>{copied ? 'Đã sao chép!' : 'Chia sẻ'}</span>
                </Button>

                {isStudent ? (
                  <Button
                    variant={isSaved ? 'primary' : 'outline'}
                    size="sm"
                    onClick={handleToggleSave}
                    disabled={saving}
                    className="gap-1.5"
                  >
                    <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
                    <span>{isSaved ? 'Đã lưu' : 'Lưu tin'}</span>
                  </Button>
                ) : (
                  <Link href="/login" title="Đăng nhập tài khoản sinh viên để lưu tin">
                    <Button variant="outline" size="sm" className="gap-1.5">
                      <Bookmark className="w-4 h-4" />
                      <span>Lưu tin</span>
                    </Button>
                  </Link>
                )}
              </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-lg bg-secondary/30 border border-border text-sm">
              <div>
                <span className="text-xs text-muted-foreground block">Mức lương</span>
                <span className="font-semibold text-primary">{salaryFormatted}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Địa điểm</span>
                <span className="font-medium text-foreground">
                  {job.branchCity || 'Toàn quốc'}
                </span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Hạn nộp</span>
                <span className="font-medium text-amber-700 dark:text-amber-400">
                  {deadlineFormatted || 'Không giới hạn'}
                </span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Ngày đăng</span>
                <span className="font-medium text-foreground">
                  {publishedFormatted || 'Mới cập nhật'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Content Details Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Column: Description, Benefits */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Mô tả công việc</CardTitle>
              </CardHeader>
              <CardContent className="prose dark:prose-invert max-w-none text-sm text-foreground/90 whitespace-pre-line leading-relaxed">
                {job.description}
              </CardContent>
            </Card>

            {job.benefits && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Quyền lợi được hưởng</CardTitle>
                </CardHeader>
                <CardContent className="prose dark:prose-invert max-w-none text-sm text-foreground/90 whitespace-pre-line leading-relaxed">
                  {job.benefits}
                </CardContent>
              </Card>
            )}

            {/* Required Skills */}
            {job.skills && job.skills.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Kỹ năng yêu cầu</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {job.skills.map((skill: string, idx: number) => (
                      <span
                        key={idx}
                        className="bg-secondary text-secondary-foreground text-xs font-medium px-3 py-1 rounded-md"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar Column: Branch & Company Info */}
          <div className="space-y-6">
            {/* Branch info */}
            {job.branchName && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-primary" />
                    Địa điểm làm việc
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs space-y-2 text-muted-foreground">
                  <p className="font-semibold text-foreground">{job.branchName}</p>
                  <p>{job.branchCity}</p>
                </CardContent>
              </Card>
            )}

            {/* Company info preview */}
            {job.companyName && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-primary" />
                    Doanh nghiệp tuyển dụng
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs space-y-3">
                  <div className="font-semibold text-sm text-foreground">
                    {job.companyName}
                  </div>
                  {job.companyId && (
                    <Link
                      href={`/companies/${job.companyId}`}
                      className="inline-block font-medium text-primary hover:underline pt-2"
                    >
                      Xem trang doanh nghiệp &rarr;
                    </Link>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Application prompt card */}
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-5 space-y-3 text-center">
                <h4 className="font-semibold text-sm text-foreground">
                  Sẵn sàng ứng tuyển?
                </h4>
                <p className="text-xs text-muted-foreground">
                  Nộp hồ sơ trực tuyến để được nhà tuyển dụng liên hệ và phản hồi sớm nhất.
                </p>
                {isStudent ? (
                  <Button variant="primary" className="w-full">
                    Ứng tuyển ngay
                  </Button>
                ) : (
                  <Link href="/login" className="block w-full">
                    <Button variant="primary" className="w-full">
                      Đăng nhập để ứng tuyển
                    </Button>
                  </Link>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </PageContainer>
    </div>
  );
}
