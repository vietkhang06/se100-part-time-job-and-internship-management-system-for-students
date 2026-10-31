import * as React from 'react';
import Link from 'next/link';
import { Bookmark, MapPin, Building2, Clock, DollarSign, CheckCircle2 } from 'lucide-react';
import type { PublicJobPostingDto } from '@campusjob/contracts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { JOB_TYPE_MAP, formatSalary } from '@/lib/m03-labels';

export interface JobCardProps {
  job: PublicJobPostingDto;
  isSaved?: boolean;
  onToggleSave?: (jobId: string) => void;
  isSaving?: boolean;
  isStudent?: boolean;
}

export function JobCard({
  job,
  isSaved = false,
  onToggleSave,
  isSaving = false,
  isStudent = false,
}: JobCardProps) {
  const salaryText = formatSalary(
    job.salaryMin,
    job.salaryMax,
    job.isSalaryNegotiable,
  );

  const deadlineFormatted = job.deadline
    ? new Date(job.deadline).toLocaleDateString('vi-VN')
    : null;

  return (
    <Card className="hover:border-primary/50 hover:shadow-md transition-all duration-200 flex flex-col justify-between h-full">
      <CardContent className="p-5 flex flex-col justify-between h-full gap-4">
        <div>
          {/* Top row: Company & Save button */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground truncate">
              <Building2 className="w-3.5 h-3.5 shrink-0" />
              <span className="font-medium text-foreground truncate">
                {job.companyName || 'Doanh nghiệp'}
              </span>
              <span title="Doanh nghiệp đã được xác thực">
                <CheckCircle2
                  className="w-3.5 h-3.5 text-emerald-600 shrink-0"
                  aria-label="Đã xác thực"
                />
              </span>
            </div>

            {isStudent ? (
              <Button
                variant={isSaved ? 'primary' : 'outline'}
                size="sm"
                className="h-8 px-2.5 shrink-0 gap-1 text-xs"
                onClick={() => onToggleSave?.(job.id)}
                disabled={isSaving}
                aria-label={isSaved ? 'Bỏ lưu tin' : 'Lưu tin tuyển dụng'}
              >
                <Bookmark className={`w-3.5 h-3.5 ${isSaved ? 'fill-current' : ''}`} />
                <span className="hidden sm:inline">{isSaved ? 'Đã lưu' : 'Lưu tin'}</span>
              </Button>
            ) : (
              <Link href="/login" title="Đăng nhập với tài khoản sinh viên để lưu tin">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2.5 shrink-0 gap-1 text-xs text-muted-foreground"
                  aria-label="Đăng nhập để lưu tin"
                >
                  <Bookmark className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Lưu tin</span>
                </Button>
              </Link>
            )}
          </div>

          {/* Job Title */}
          <Link
            href={`/jobs/${job.id}`}
            className="group block mt-2"
          >
            <h3 className="font-semibold text-base text-foreground group-hover:text-primary transition-colors line-clamp-2">
              {job.title}
            </h3>
          </Link>

          {/* Key metadata pills */}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {job.branchCity && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="w-3 h-3 shrink-0" />
                {job.branchCity}
              </span>
            )}
            <span className="inline-flex items-center gap-1 font-semibold text-primary">
              <DollarSign className="w-3 h-3 shrink-0" />
              {salaryText}
            </span>
            {deadlineFormatted && (
              <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400">
                <Clock className="w-3 h-3 shrink-0" />
                Hạn: {deadlineFormatted}
              </span>
            )}
          </div>

          {/* Badges: Type & Arrangement */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Badge variant="secondary" className="text-[11px] font-normal">
              {JOB_TYPE_MAP[job.type] || job.type}
            </Badge>
            {job.schedule && (
              <Badge variant="outline" className="text-[11px] font-normal">
                {job.schedule}
              </Badge>
            )}
            {job.industry && (
              <Badge variant="outline" className="text-[11px] font-normal">
                {job.industry}
              </Badge>
            )}
          </div>

          {/* Required Skills tags */}
          {job.skills && job.skills.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1">
              {job.skills.slice(0, 4).map((skill: string, idx: number) => (
                <span
                  key={idx}
                  className="bg-secondary/60 text-secondary-foreground text-[10px] px-1.5 py-0.5 rounded"
                >
                  {skill}
                </span>
              ))}
              {job.skills.length > 4 && (
                <span className="text-[10px] text-muted-foreground px-1 py-0.5">
                  +{job.skills.length - 4}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Card Footer: Detail Link */}
        <div className="pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
          <span>{job.branchName || 'Chi nhánh'}</span>
          <Link
            href={`/jobs/${job.id}`}
            className="font-medium text-primary hover:underline"
          >
            Xem chi tiết &rarr;
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
