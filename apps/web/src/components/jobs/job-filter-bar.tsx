import * as React from 'react';
import { Search, RotateCcw, Filter } from 'lucide-react';
import { JobType } from '@campusjob/contracts';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { JOB_TYPE_MAP } from '@/lib/m03-labels';
import type { PublicJobFilterParams } from '@/lib/m03-api';

export interface JobFilterBarProps {
  filters: PublicJobFilterParams;
  onFilterChange: (newFilters: PublicJobFilterParams) => void;
  onReset: () => void;
  isLoading?: boolean;
}

export function JobFilterBar({
  filters,
  onFilterChange,
  onReset,
  isLoading = false,
}: JobFilterBarProps) {
  const [localKeyword, setLocalKeyword] = React.useState(filters.keyword || '');
  const [showAdvanced, setShowAdvanced] = React.useState(false);

  React.useEffect(() => {
    setLocalKeyword(filters.keyword || '');
  }, [filters.keyword]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onFilterChange({
      ...filters,
      keyword: localKeyword.trim() || undefined,
      page: 1,
    });
  };

  const handleSelectChange = (key: keyof PublicJobFilterParams, val: string) => {
    onFilterChange({
      ...filters,
      [key]: val ? val : undefined,
      page: 1,
    });
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4 shadow-sm space-y-4">
      {/* Primary search row */}
      <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Input
            placeholder="Tìm theo chức danh, từ khóa, công ty..."
            value={localKeyword}
            onChange={(e) => setLocalKeyword(e.target.value)}
            className="w-full"
            aria-label="Từ khóa tìm kiếm"
          />
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="submit"
            variant="primary"
            disabled={isLoading}
            className="gap-2 shrink-0"
          >
            <Search className="w-4 h-4" />
            <span>Tìm kiếm</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            className="gap-2 shrink-0"
            onClick={() => setShowAdvanced(!showAdvanced)}
            aria-expanded={showAdvanced}
            aria-label="Bộ lọc nâng cao"
          >
            <Filter className="w-4 h-4" />
            <span className="hidden sm:inline">Bộ lọc</span>
          </Button>

          {(filters.keyword ||
            filters.industry ||
            filters.city ||
            filters.type ||
            filters.salaryMin ||
            filters.salaryMax ||
            filters.schedule) && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onReset}
              title="Đặt lại bộ lọc"
              aria-label="Đặt lại bộ lọc"
              className="text-muted-foreground hover:text-foreground shrink-0"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
          )}
        </div>
      </form>

      {/* Advanced filters collapsible */}
      {showAdvanced && (
        <div className="pt-3 border-t border-border grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 animate-in fade-in-50 duration-150">
          <Select
            label="Hình thức làm việc"
            value={filters.type || ''}
            onChange={(e) => handleSelectChange('type', e.target.value)}
            aria-label="Hình thức làm việc"
          >
            <option value="">Tất cả hình thức</option>
            <option value={JobType.PART_TIME}>{JOB_TYPE_MAP[JobType.PART_TIME]}</option>
            <option value={JobType.INTERNSHIP}>{JOB_TYPE_MAP[JobType.INTERNSHIP]}</option>
            <option value={JobType.FULL_TIME}>{JOB_TYPE_MAP[JobType.FULL_TIME]}</option>
          </Select>

          <Select
            label="Địa điểm / Thành phố"
            value={filters.city || ''}
            onChange={(e) => handleSelectChange('city', e.target.value)}
            aria-label="Thành phố"
          >
            <option value="">Tất cả địa điểm</option>
            <option value="Hà Nội">Hà Nội</option>
            <option value="TP. Hồ Chí Minh">TP. Hồ Chí Minh</option>
            <option value="Đà Nẵng">Đà Nẵng</option>
            <option value="Cần Thơ">Cần Thơ</option>
            <option value="Hải Phòng">Hải Phòng</option>
            <option value="Bình Dương">Bình Dương</option>
          </Select>

          <Select
            label="Ngành nghề"
            value={filters.industry || ''}
            onChange={(e) => handleSelectChange('industry', e.target.value)}
            aria-label="Ngành nghề"
          >
            <option value="">Tất cả ngành nghề</option>
            <option value="Công nghệ thông tin">Công nghệ thông tin</option>
            <option value="Marketing / Truyền thông">Marketing / Truyền thông</option>
            <option value="Bán hàng / Dịch vụ">Bán hàng / Dịch vụ</option>
            <option value="Giáo dục / Đào tạo">Giáo dục / Đào tạo</option>
            <option value="Tài chính / Kế toán">Tài chính / Kế toán</option>
            <option value="Thiết kế / Sáng tạo">Thiết kế / Sáng tạo</option>
          </Select>

          <Select
            label="Lịch làm việc"
            value={filters.schedule || ''}
            onChange={(e) => handleSelectChange('schedule', e.target.value)}
            aria-label="Lịch làm việc"
          >
            <option value="">Mọi khung giờ</option>
            <option value="Ca sáng">Ca sáng</option>
            <option value="Ca chiều">Ca chiều</option>
            <option value="Ca tối">Ca tối</option>
            <option value="Cuối tuần">Cuối tuần</option>
            <option value="Linh hoạt">Linh hoạt theo lịch học</option>
          </Select>
        </div>
      )}
    </div>
  );
}
