'use client';

import * as React from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { UserRole } from '@campusjob/contracts';
import type { PublicJobPostingDto, PaginationMeta } from '@campusjob/contracts';
import { AppHeader } from '@/components/layout/app-header';
import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { Spinner } from '@/components/ui/spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Pager } from '@/components/m05/pager';
import { JobCard } from '@/components/jobs/job-card';
import { JobFilterBar } from '@/components/jobs/job-filter-bar';
import { useAuth } from '@/lib/auth-context';
import {
  fetchPublicJobs,
  fetchSavedJobIds,
  saveJob,
  unsaveJob,
  type PublicJobFilterParams,
} from '@/lib/m03-api';
import { getM03ErrorMessage } from '@/lib/m03-labels';

function JobsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const isStudent = user?.role === UserRole.STUDENT;

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [jobs, setJobs] = React.useState<PublicJobPostingDto[]>([]);
  const [meta, setMeta] = React.useState<PaginationMeta>({
    page: 1,
    limit: 10,
    totalItems: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  });

  const [savedJobIds, setSavedJobIds] = React.useState<Set<string>>(new Set());
  const [savingJobId, setSavingJobId] = React.useState<string | null>(null);

  // Extract filters from searchParams
  const filters: PublicJobFilterParams = React.useMemo(() => {
    return {
      keyword: searchParams.get('keyword') || undefined,
      industry: searchParams.get('industry') || undefined,
      city: searchParams.get('city') || undefined,
      type: searchParams.get('type') || undefined,
      salaryMin: searchParams.get('salaryMin') ? Number(searchParams.get('salaryMin')) : undefined,
      salaryMax: searchParams.get('salaryMax') ? Number(searchParams.get('salaryMax')) : undefined,
      schedule: searchParams.get('schedule') || undefined,
      page: searchParams.get('page') ? Number(searchParams.get('page')) : 1,
      limit: 10,
    };
  }, [searchParams]);

  const updateUrl = React.useCallback(
    (newFilters: PublicJobFilterParams) => {
      const sp = new URLSearchParams();
      if (newFilters.keyword) sp.set('keyword', newFilters.keyword);
      if (newFilters.industry) sp.set('industry', newFilters.industry);
      if (newFilters.city) sp.set('city', newFilters.city);
      if (newFilters.type) sp.set('type', newFilters.type);
      if (newFilters.salaryMin != null) sp.set('salaryMin', String(newFilters.salaryMin));
      if (newFilters.salaryMax != null) sp.set('salaryMax', String(newFilters.salaryMax));
      if (newFilters.schedule) sp.set('schedule', newFilters.schedule);
      if (newFilters.page && newFilters.page > 1) sp.set('page', String(newFilters.page));

      const qs = sp.toString();
      router.push(`/jobs${qs ? `?${qs}` : ''}`);
    },
    [router],
  );

  const loadJobs = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchPublicJobs(filters);
      setJobs(res.jobs || []);
      setMeta({
        page: res.page,
        limit: res.limit,
        totalItems: res.total,
        totalPages: res.totalPages,
        hasNextPage: res.page < res.totalPages,
        hasPrevPage: res.page > 1,
      });
    } catch (err: any) {
      setError(getM03ErrorMessage(err, 'Không thể tải danh sách việc làm. Vui lòng thử lại.'));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const loadSavedIds = React.useCallback(async () => {
    if (!isStudent) return;
    try {
      const ids = await fetchSavedJobIds();
      setSavedJobIds(new Set(ids));
    } catch {
      // Ignored for non-students
    }
  }, [isStudent]);

  React.useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  React.useEffect(() => {
    void loadSavedIds();
  }, [loadSavedIds]);

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

  const handleResetFilters = () => {
    router.push('/jobs');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tìm kiếm việc làm & thực tập"
        description="Khám phá các vị trí part-time và thực tập được kiểm duyệt chặt chẽ dành riêng cho sinh viên."
      />

      <JobFilterBar
        filters={filters}
        onFilterChange={updateUrl}
        onReset={handleResetFilters}
        isLoading={loading}
      />

      {loading && (
        <div className="py-16 flex flex-col items-center justify-center gap-3">
          <Spinner className="w-8 h-8 text-primary" />
          <p className="text-sm text-muted-foreground">Đang tải danh sách việc làm công khai...</p>
        </div>
      )}

      {error && !loading && (
        <ErrorState
          title="Không thể tải dữ liệu"
          message={error}
          onRetry={loadJobs}
        />
      )}

      {!loading && !error && jobs.length === 0 && (
        <EmptyState
          title="Chưa có tin tuyển dụng nào phù hợp"
          description="Hiện tại không có tin tuyển dụng nào khớp với tiêu chí tìm kiếm của bạn. Hãy thử thay đổi từ khóa hoặc bộ lọc."
          actionLabel="Xóa bộ lọc"
          onAction={handleResetFilters}
        />
      )}

      {!loading && !error && jobs.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Tìm thấy <strong className="text-foreground">{meta.totalItems}</strong> tin tuyển dụng phù hợp
            </span>
          </div>

          {/* Responsive Job Cards Grid: 1 col on mobile (360px), 2 on tablet (768px), 3 on desktop (1440px) */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
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

          <Pager
            meta={meta}
            isLoading={loading}
            onPage={(newPage) => updateUrl({ ...filters, page: newPage })}
          />
        </div>
      )}
    </div>
  );
}

export default function JobsPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <AppHeader />
      <PageContainer className="flex-1 py-8">
        <React.Suspense
          fallback={
            <div className="py-16 flex justify-center">
              <Spinner className="w-8 h-8 text-primary" />
            </div>
          }
        >
          <JobsContent />
        </React.Suspense>
      </PageContainer>
    </div>
  );
}
