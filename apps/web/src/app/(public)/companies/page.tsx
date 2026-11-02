'use client';

import * as React from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Search, RotateCcw } from 'lucide-react';
import type { PublicCompanyDto, PaginationMeta } from '@campusjob/contracts';
import { AppHeader } from '@/components/layout/app-header';
import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Pager } from '@/components/m05/pager';
import { CompanyCard } from '@/components/companies/company-card';
import { fetchPublicCompanies, type PublicCompanyFilterParams } from '@/lib/m03-api';
import { getM03ErrorMessage } from '@/lib/m03-labels';

function CompaniesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [companies, setCompanies] = React.useState<PublicCompanyDto[]>([]);
  const [meta, setMeta] = React.useState<PaginationMeta>({
    page: 1,
    limit: 10,
    totalItems: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  });

  const [keywordInput, setKeywordInput] = React.useState(
    searchParams.get('keyword') || '',
  );

  const filters: PublicCompanyFilterParams = React.useMemo(() => {
    return {
      keyword: searchParams.get('keyword') || undefined,
      industry: searchParams.get('industry') || undefined,
      city: searchParams.get('city') || undefined,
      page: searchParams.get('page') ? Number(searchParams.get('page')) : 1,
      limit: 9,
    };
  }, [searchParams]);

  React.useEffect(() => {
    setKeywordInput(searchParams.get('keyword') || '');
  }, [searchParams]);

  const updateUrl = React.useCallback(
    (newFilters: PublicCompanyFilterParams) => {
      const sp = new URLSearchParams();
      if (newFilters.keyword) sp.set('keyword', newFilters.keyword);
      if (newFilters.industry) sp.set('industry', newFilters.industry);
      if (newFilters.city) sp.set('city', newFilters.city);
      if (newFilters.page && newFilters.page > 1) sp.set('page', String(newFilters.page));

      const qs = sp.toString();
      router.push(`/companies${qs ? `?${qs}` : ''}`);
    },
    [router],
  );

  const loadCompanies = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchPublicCompanies(filters);
      setCompanies(res.companies || []);
      setMeta({
        page: res.page,
        limit: res.limit,
        totalItems: res.total,
        totalPages: res.totalPages,
        hasNextPage: res.page < res.totalPages,
        hasPrevPage: res.page > 1,
      });
    } catch (err: any) {
      setError(getM03ErrorMessage(err, 'Không thể tải danh sách doanh nghiệp. Vui lòng thử lại.'));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  React.useEffect(() => {
    void loadCompanies();
  }, [loadCompanies]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateUrl({
      ...filters,
      keyword: keywordInput.trim() || undefined,
      page: 1,
    });
  };

  const handleReset = () => {
    router.push('/companies');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Doanh nghiệp tuyển dụng"
        description="Khám phá các doanh nghiệp uy tín đã được xác thực pháp lý và phê duyệt trên nền tảng CampusJob."
      />

      {/* Filter / Search Bar */}
      <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Input
              placeholder="Tìm theo tên doanh nghiệp, ngành nghề..."
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              className="w-full"
              aria-label="Từ khóa tìm kiếm doanh nghiệp"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="submit"
              variant="primary"
              disabled={loading}
              className="gap-2 shrink-0"
            >
              <Search className="w-4 h-4" />
              <span>Tìm kiếm</span>
            </Button>

            {(filters.keyword || filters.industry || filters.city) && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleReset}
                title="Đặt lại bộ lọc"
                className="text-muted-foreground hover:text-foreground shrink-0"
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
            )}
          </div>
        </form>
      </div>

      {loading && (
        <div className="py-16 flex flex-col items-center justify-center gap-3">
          <Spinner className="w-8 h-8 text-primary" />
          <p className="text-sm text-muted-foreground">Đang tải danh sách doanh nghiệp...</p>
        </div>
      )}

      {error && !loading && (
        <ErrorState
          title="Không thể tải dữ liệu"
          message={error}
          onRetry={loadCompanies}
        />
      )}

      {!loading && !error && companies.length === 0 && (
        <EmptyState
          title="Chưa có doanh nghiệp phù hợp"
          description="Không tìm thấy doanh nghiệp nào khớp với từ khóa tìm kiếm của bạn."
          actionLabel="Xem tất cả doanh nghiệp"
          onAction={handleReset}
        />
      )}

      {!loading && !error && companies.length > 0 && (
        <div className="space-y-6">
          <div className="text-xs text-muted-foreground">
            Hiển thị <strong className="text-foreground">{meta.totalItems}</strong> doanh nghiệp đã được xác thực
          </div>

          {/* Responsive grid: 1 col on mobile, 2 col on tablet, 3 col on desktop */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {companies.map((company) => (
              <CompanyCard key={company.id} company={company} />
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

export default function CompaniesPage() {
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
          <CompaniesContent />
        </React.Suspense>
      </PageContainer>
    </div>
  );
}
