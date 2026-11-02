'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Trash2,
  Building2,
  MapPin,
  DollarSign,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';
import { UserRole } from '@campusjob/contracts';
import type { SavedJobItemDto, PaginationMeta } from '@campusjob/contracts';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Pager } from '@/components/m05/pager';
import { useAuth } from '@/lib/auth-context';
import { fetchSavedJobs, unsaveJob } from '@/lib/m03-api';
import { JOB_TYPE_MAP, formatSalary, getM03ErrorMessage } from '@/lib/m03-labels';

export default function CandidateSavedJobsPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [items, setItems] = React.useState<SavedJobItemDto[]>([]);
  const [meta, setMeta] = React.useState<PaginationMeta>({
    page: 1,
    limit: 10,
    totalItems: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  });
  const [unsavingId, setUnsavingId] = React.useState<string | null>(null);

  const loadSavedList = React.useCallback(async (page: number = 1) => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchSavedJobs(page, 10);
      setItems(res.savedJobs || []);
      setMeta({
        page: res.page,
        limit: res.limit,
        totalItems: res.total,
        totalPages: res.totalPages,
        hasNextPage: res.page < res.totalPages,
        hasPrevPage: res.page > 1,
      });
    } catch (err: any) {
      setError(getM03ErrorMessage(err, 'Không thể tải danh sách việc làm đã lưu.'));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (!authLoading) {
      if (user && user.role !== UserRole.STUDENT) {
        router.push('/');
        return;
      }
      void loadSavedList(1);
    }
  }, [user, authLoading, router, loadSavedList]);

  const handleUnsave = async (jobId: string) => {
    try {
      setUnsavingId(jobId);
      await unsaveJob(jobId);
      setItems((prev) => prev.filter((item) => item.jobId !== jobId));
      setMeta((prev) => ({
        ...prev,
        totalItems: Math.max(0, prev.totalItems - 1),
      }));
    } catch (err) {
      alert(getM03ErrorMessage(err, 'Không thể bỏ lưu tin tuyển dụng.'));
    } finally {
      setUnsavingId(null);
    }
  };

  if (authLoading) {
    return (
      <div className="py-16 flex justify-center">
        <Spinner className="w-8 h-8 text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Việc làm đã lưu"
        description="Danh sách các cơ hội nghề nghiệp bạn đã lưu để theo dõi và ứng tuyển sau."
      />

      {loading && (
        <div className="py-16 flex flex-col items-center justify-center gap-3">
          <Spinner className="w-8 h-8 text-primary" />
          <p className="text-sm text-muted-foreground">Đang tải danh sách việc làm đã lưu...</p>
        </div>
      )}

      {error && !loading && (
        <ErrorState
          title="Không thể tải dữ liệu"
          message={error}
          onRetry={() => loadSavedList(meta.page)}
        />
      )}

      {!loading && !error && items.length === 0 && (
        <EmptyState
          title="Chưa lưu tin tuyển dụng nào"
          description="Bạn chưa lưu tin tuyển dụng nào. Hãy duyệt danh sách việc làm và bấm nút 'Lưu tin' để theo dõi tại đây!"
          actionLabel="Khám phá việc làm ngay"
          onAction={() => router.push('/jobs')}
        />
      )}

      {!loading && !error && items.length > 0 && (
        <div className="space-y-4">
          <div className="text-xs text-muted-foreground">
            Bạn đang lưu <strong className="text-foreground">{meta.totalItems}</strong> tin tuyển dụng
          </div>

          <div className="space-y-3">
            {items.map((item) => {
              const savedAtFormatted = new Date(item.createdAt).toLocaleDateString('vi-VN');

              if (!item.isAvailable || !item.job) {
                // Non-available entry: Show minimal data and clear notice without leaking private fields
                const displayTitle = item.job?.title || 'Tin tuyển dụng';
                const displayCompany = item.job?.companyName || 'Doanh nghiệp';

                return (
                  <Card key={item.id} className="border-border bg-muted/20 opacity-90">
                    <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="destructive" className="gap-1 text-[11px]">
                            <AlertTriangle className="w-3 h-3" />
                            <span>Không còn khả dụng</span>
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            Đã lưu ngày {savedAtFormatted}
                          </span>
                        </div>

                        <h4 className="font-semibold text-base text-foreground/70">
                          {displayTitle}
                        </h4>

                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Building2 className="w-3.5 h-3.5" />
                          <span>{displayCompany}</span>
                        </div>

                        <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 p-2 rounded border border-amber-200 dark:border-amber-900">
                          Tin tuyển dụng này hiện không còn khả dụng trên hệ thống (đã đóng, hết hạn nhận hồ sơ hoặc đang trong quy trình kiểm duyệt).
                        </p>
                      </div>

                      <div className="shrink-0 flex items-center justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:bg-destructive/10 gap-1.5"
                          onClick={() => handleUnsave(item.jobId)}
                          disabled={unsavingId === item.jobId}
                          aria-label={`Bỏ lưu ${displayTitle}`}
                        >
                          <Trash2 className="w-4 h-4" />
                          <span>Bỏ lưu</span>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              }

              // Available entry
              const jobData = item.job;
              const salaryText = formatSalary(
                jobData.salaryMin,
                jobData.salaryMax,
                jobData.isSalaryNegotiable,
              );

              return (
                <Card key={item.id} className="border-border hover:border-primary/40 transition-colors">
                  <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5 text-primary" />
                          {jobData.companyName}
                        </span>
                        {jobData.branchCity && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {jobData.branchCity}
                          </span>
                        )}
                        <span>· Đã lưu ngày {savedAtFormatted}</span>
                      </div>

                      <Link
                        href={`/jobs/${item.jobId}`}
                        className="group block"
                      >
                        <h4 className="font-semibold text-base text-foreground group-hover:text-primary transition-colors">
                          {jobData.title}
                        </h4>
                      </Link>

                      <div className="flex flex-wrap items-center gap-3 text-xs">
                        {jobData.type && (
                          <Badge variant="secondary" className="font-normal text-[11px]">
                            {JOB_TYPE_MAP[jobData.type] || jobData.type}
                          </Badge>
                        )}
                        <span className="font-semibold text-primary inline-flex items-center gap-1">
                          <DollarSign className="w-3 h-3" />
                          {salaryText}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 justify-end pt-2 sm:pt-0">
                      <Link href={`/jobs/${item.jobId}`}>
                        <Button variant="outline" size="sm" className="gap-1.5">
                          <ExternalLink className="w-4 h-4" />
                          <span>Xem tin</span>
                        </Button>
                      </Link>

                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:bg-destructive/10 gap-1.5"
                        onClick={() => handleUnsave(item.jobId)}
                        disabled={unsavingId === item.jobId}
                        aria-label={`Bỏ lưu ${jobData.title}`}
                      >
                        <Trash2 className="w-4 h-4" />
                        <span className="hidden sm:inline">Bỏ lưu</span>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Pager
            meta={meta}
            isLoading={loading}
            onPage={(newPage) => loadSavedList(newPage)}
          />
        </div>
      )}
    </div>
  );
}
