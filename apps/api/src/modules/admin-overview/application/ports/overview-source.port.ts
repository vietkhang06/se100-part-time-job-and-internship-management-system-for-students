import { Injectable } from '@nestjs/common';
import { OverviewGroupKey } from '@campusjob/contracts';

export interface OverviewBreakdownItem {
  key: string;
  label: string;
  count: number;
}

export interface OverviewSourceResult {
  total: number;
  /** Chiều phân tách của breakdown (ví dụ "Theo vai trò", "Theo trạng thái"). */
  breakdownLabel: string;
  breakdown: OverviewBreakdownItem[];
}

/**
 * Nguồn số liệu của một nhóm trong tổng quan hệ thống (UC54). Mỗi module sở hữu dữ liệu tự cài đặt
 * nguồn của mình và đăng ký vào OverviewSourceRegistry. Quy ước: `total` phải bằng tổng các `count` trong `breakdown`,
 * và các con số phải tính từ dữ liệu thật tại thời điểm gọi (không cache, không hardcode).
 */
export interface IOverviewSource {
  readonly key: OverviewGroupKey;
  collect(): Promise<OverviewSourceResult>;
}

@Injectable()
export class OverviewSourceRegistry {
  private readonly sources = new Map<OverviewGroupKey, IOverviewSource>();

  register(source: IOverviewSource): void {
    this.sources.set(source.key, source);
  }

  get(key: OverviewGroupKey): IOverviewSource | undefined {
    return this.sources.get(key);
  }
}
