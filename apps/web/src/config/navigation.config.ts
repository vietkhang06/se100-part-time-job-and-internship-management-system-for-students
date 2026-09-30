export interface NavItem {
  title: string;
  href: string;
  iconName?: string;
}

export const CANDIDATE_NAV_ITEMS: NavItem[] = [
  { title: 'Tổng quan', href: '/candidate' },
  { title: 'Hồ sơ cá nhân', href: '/candidate/profile' },
  { title: 'Quản lý CV', href: '/candidate/cvs' },
  { title: 'Lịch sử ứng tuyển', href: '/candidate/applications' },
  { title: 'Lịch phỏng vấn', href: '/candidate/interviews' },
];

export const EMPLOYER_NAV_ITEMS: NavItem[] = [
  { title: 'Bảng điều khiển', href: '/employer' },
  { title: 'Hồ sơ công ty', href: '/employer/company' },
  { title: 'Chi nhánh', href: '/employer/branches' },
  { title: 'Tin tuyển dụng', href: '/employer/jobs' },
  { title: 'Hồ sơ ứng tuyển', href: '/employer/applications' },
  { title: 'Lịch phỏng vấn', href: '/employer/interviews' },
];

export const MODERATOR_NAV_ITEMS: NavItem[] = [
  { title: 'Trung tâm kiểm duyệt', href: '/moderator/moderation' },
];

export const ADMIN_NAV_ITEMS: NavItem[] = [
  { title: 'Tổng quan hệ thống', href: '/admin' },
  { title: 'Quản lý người dùng', href: '/admin/users' },
  { title: 'Quản lý doanh nghiệp', href: '/admin/companies' },
  { title: 'Báo cáo & Audit', href: '/admin/reports' },
  { title: 'Thống kê & Phân tích', href: '/admin/analytics' },
];

export const PUBLIC_NAV_ITEMS: NavItem[] = [
  { title: 'Tìm việc làm', href: '/jobs' },
  { title: 'Doanh nghiệp', href: '/companies' },
];
