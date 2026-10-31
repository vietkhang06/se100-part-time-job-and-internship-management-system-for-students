import * as React from 'react';
import Link from 'next/link';
import { MapPin, Globe, CheckCircle2, Briefcase } from 'lucide-react';
import type { PublicCompanyDto } from '@campusjob/contracts';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

export interface CompanyCardProps {
  company: PublicCompanyDto;
}

export function CompanyCard({ company }: CompanyCardProps) {
  return (
    <Card className="hover:border-primary/50 hover:shadow-md transition-all duration-200 flex flex-col justify-between h-full">
      <CardContent className="p-5 flex flex-col justify-between h-full gap-4">
        <div>
          {/* Header row: Name & Verified badge */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-lg shrink-0">
                {company.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={company.logoUrl}
                    alt={company.name}
                    className="w-full h-full object-cover rounded-lg"
                  />
                ) : (
                  company.name.charAt(0).toUpperCase()
                )}
              </div>
              <div>
                <Link
                  href={`/companies/${company.id}`}
                  className="font-semibold text-base text-foreground hover:text-primary transition-colors line-clamp-1"
                >
                  {company.name}
                </Link>
                {company.industry && (
                  <p className="text-xs text-muted-foreground">{company.industry}</p>
                )}
              </div>
            </div>

            <Badge variant="success" className="gap-1 shrink-0 text-xs">
              <CheckCircle2 className="w-3 h-3" />
              <span>Đã xác thực</span>
            </Badge>
          </div>

          {/* Description */}
          {company.description && (
            <p className="mt-3 text-xs text-muted-foreground line-clamp-3 leading-relaxed">
              {company.description}
            </p>
          )}

          {/* Metadata */}
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
            {company.address && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="w-3 h-3 shrink-0" />
                <span className="truncate max-w-[200px]">{company.address}</span>
              </span>
            )}
            {company.website && (
              <a
                href={company.website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 hover:text-primary transition-colors"
              >
                <Globe className="w-3 h-3 shrink-0" />
                <span className="truncate max-w-[150px]">{company.website.replace(/^https?:\/\//, '')}</span>
              </a>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Briefcase className="w-3.5 h-3.5" />
            Xem các vị trí tuyển dụng
          </span>
          <Link
            href={`/companies/${company.id}`}
            className="font-medium text-primary hover:underline"
          >
            Chi tiết &rarr;
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
