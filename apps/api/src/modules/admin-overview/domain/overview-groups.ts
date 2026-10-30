import { OverviewGroupKey } from '@campusjob/contracts';

export interface OverviewGroupDefinition {
  key: OverviewGroupKey;
  label: string;
  /** Module sở hữu dữ liệu, dùng trong thông báo khi chưa có nguồn. */
  owner: string;
}

/**
 * Năm nhóm số liệu của UC54, theo đúng thứ tự hiển thị. Không thêm nhóm ngoài UC54
 * khi chưa được Owner duyệt.
 */
export const OVERVIEW_GROUPS: readonly OverviewGroupDefinition[] = [
  { key: OverviewGroupKey.USERS, label: 'Người dùng', owner: 'M01 Account' },
  { key: OverviewGroupKey.COMPANIES, label: 'Doanh nghiệp', owner: 'M03 Company' },
  { key: OverviewGroupKey.JOBS, label: 'Tin tuyển dụng', owner: 'M03 Job' },
  { key: OverviewGroupKey.APPLICATIONS, label: 'Hồ sơ ứng tuyển', owner: 'M04 Application' },
  { key: OverviewGroupKey.REPORTS, label: 'Báo cáo vi phạm', owner: 'M05 Report' },
];
