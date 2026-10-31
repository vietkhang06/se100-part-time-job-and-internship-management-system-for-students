'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  MapPin,
  Globe,
  CheckCircle2,
  ArrowLeft,
  Briefcase,
  Users,
} from 'lucide-react';
import { UserRole } from '@campusjob/contracts';
import type { PublicCompanyDetailDto, PublicJobPostingDto } from '@campusjob/contracts';
import { AppHeader } from '@/components/layout/app-header';
import { PageContainer } from '@/components/layout/page-container';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { JobCard } from '@/components/jobs/job-card';
import { useAuth } from '@/lib/auth-context';
import {
  fetchPublicCompanyDetail,
  fetchSavedJobIds,
  saveJob,
  unsaveJob,
} from '@/lib/m03-api';
import { getM03ErrorMessage } from '@/lib/m03-labels';

export default function CompanyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const isStudent = user?.role === UserRole.STUDENT;

  const companyId = typeof params?.id === 'string' ? params.id : '';

  const [loading, setLoading] = React.useState(true);
  const [notFound, setNotFound] = React.useState(false);
  const [_errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [company, setCompany] = React.useState<PublicCompanyDetailDto | null>(null);
  const [savedJobIds, setSavedJobIds] = React.useState<Set<string>>(new Set());
  const [savingJobId, setSavingJobId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!companyId) return;

    let cancelled = false;

    async function loadData() {
      try {
        setLoading(true);
        setNotFound(false);
        setErrorMessage(null);

        const res = await fetchPublicCompanyDetail(companyId);
        if (!cancelled) {
          setCompany(res.company as PublicCompanyDetailDto);
        }

        if (isStudent && !cancelled) {
          const ids = await fetchSavedJobIds();
          setSavedJobIds(new Set(ids));
        }
      } catch (err: any) {
        if (!cancelled) {
          if (err.status === 404 || err.errorResponse?.statusCode === 404) {
            setNotFound(true);
          } else {
            setErrorMessage(getM03ErrorMessage(err, 'Không thể tải thông tin doanh nghiệp.'));
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
  }, [companyId, isStudent]);

  const handleToggleSave = async (jobId: string) => {
    if (!isStudent) {
      router.push('/login');
      return;
    }
    const isCurrentlySaved = savedJobIds.has(jobId);
    setSavingJobId(jobId);
    try {
      if (isCurrentlySaved) {
        await unsaveJob(jobId);
        setSavedJobIds((prev) => {
          const next = new Set(prev);
          next.delete(jobId);
          return next;
        });
      } else {
        await saveJob(jobId);
        setSavedJobIds((prev) => {
          const next = new Set(prev);
          next.add(jobId);
          return next;
        });
      }
    } catch (err) {
      alert(getM03ErrorMessage(err, 'Không thể cập nhật trạng thái lưu tin.'));
    } finally {
      setSavingJobId(null);
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

  if (notFound || !company) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <AppHeader />
        <PageContainer className="flex-1 py-12 max-w-2xl">
          <EmptyState
            title="Doanh nghiệp không tồn tại hoặc chưa được kích hoạt"
            description="Thông tin doanh nghiệp này không tìm thấy trên hệ thống hoặc chưa hoàn tất quy trình xác thực công khai."
            actionLabel="Quay lại danh sách doanh nghiệp"
            onAction={() => router.push('/companies')}
          />
        </PageContainer>
      </div>
    );
  }

  const branches = company.branches || [];
  const jobs: PublicJobPostingDto[] = company.activeJobs || [];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <AppHeader />

      <PageContainer className="flex-1 py-8 space-y-8 max-w-5xl">
        {/* Back Link */}
        <div>
          <Link
            href="/companies"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Quay lại danh sách doanh nghiệp</span>
          </Link>
        </div>

        {/* Hero Card */}
        <Card className="border-border shadow-sm">
          <CardContent className="p-6 md:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row items-start gap-5">
              <div className="w-20 h-20 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-3xl shrink-0">
                {company.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={company.logoUrl}
                    alt={company.name}
                    className="w-full h-full object-cover rounded-xl"
                  />
                ) : (
                  company.name.charAt(0).toUpperCase()
                )}
              </div>

              <div className="flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
                    {company.name}
                  </h1>
                  <Badge variant="success" className="gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Đã xác thực</span>
                  </Badge>
                </div>

                {company.industry && (
                  <p className="text-sm font-medium text-muted-foreground">
                    Ngành nghề: {company.industry}
                  </p>
                )}

                <div className="flex flex-wrap gap-4 text-xs text-muted-foreground pt-2">
                  {company.companySize && (
                    <span className="inline-flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-primary" />
                      Quy mô: {company.companySize}
                    </span>
                  )}
                  {company.address && (
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-primary" />
                      {company.address}
                    </span>
                  )}
                  {company.website && (
                    <a
                      href={company.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-primary hover:underline"
                    >
                      <Globe className="w-3.5 h-3.5" />
                      {company.website.replace(/^https?:\/\//, '')}
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Description */}
            {company.description && (
              <div className="pt-4 border-t border-border">
                <h3 className="text-sm font-semibold text-foreground mb-2">Giới thiệu doanh nghiệp</h3>
                <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-line">
                  {company.description}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Branches Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary" />
              Chi nhánh & Địa điểm làm việc ({branches.length})
            </h2>
          </div>

          {branches.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                Chưa có thông tin chi nhánh công khai.
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {branches.map((b) => (
                <Card key={b.id} className="border-border">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-semibold text-sm text-foreground">{b.branchName}</h4>
                      {b.isHeadquarter && (
                        <Badge variant="secondary" className="text-[10px]">
                          Trụ sở chính
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{b.addressLine}</p>
                    <p className="text-xs font-medium text-foreground">
                      {b.district ? `${b.district}, ` : ''}
                      {b.city}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* Open Jobs Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-primary" />
              Vị trí đang tuyển dụng ({jobs.length})
            </h2>
          </div>

          {jobs.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-sm text-muted-foreground">
                Doanh nghiệp hiện chưa có tin tuyển dụng nào đang mở.
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {jobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  isSaved={savedJobIds.has(job.id)}
                  onToggleSave={handleToggleSave}
                  isSaving={savingJobId === job.id}
                  isStudent={isStudent}
                />
              ))}
            </div>
          )}
        </section>
      </PageContainer>
    </div>
  );
}
