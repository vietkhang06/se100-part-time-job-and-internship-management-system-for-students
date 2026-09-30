import type { Metadata } from 'next';
import './globals.css';
import { AppProviders } from '@/components/providers/app-providers';

export const metadata: Metadata = {
  title: 'CampusJob — Hệ thống quản lý việc làm thêm & thực tập cho sinh viên',
  description: 'Nền tảng kết nối trực tiếp sinh viên và doanh nghiệp, quản lý CV, phỏng vấn và cơ hội việc làm chuẩn hóa.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className="min-h-screen bg-background text-foreground antialiased">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
