import Link from 'next/link';
import { AppHeader } from '@/components/layout/app-header';
import { PageContainer } from '@/components/layout/page-container';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-primary/5 via-background to-background py-20 sm:py-28">
          <PageContainer className="text-center">
            <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary mb-6">
              Nền tảng việc làm sinh viên chuẩn mực
            </span>
            <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-6xl max-w-4xl mx-auto">
              Cơ hội việc làm thêm và thực tập minh bạch cho <span className="text-primary">Sinh viên</span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Kết nối trực tiếp sinh viên với các doanh nghiệp uy tín, bảo đảm bởi xác thực email trường, CV snapshot chống gian lận và quy trình tuyển dụng chuẩn hóa.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/jobs"
                className="rounded-md bg-primary px-6 py-3 text-base font-semibold text-primary-foreground hover:bg-primary-hover shadow-md transition-colors"
              >
                Khám phá việc làm
              </Link>
              <Link
                href="/register"
                className="rounded-md border border-border bg-card px-6 py-3 text-base font-semibold text-foreground hover:bg-secondary transition-colors"
              >
                Dành cho doanh nghiệp
              </Link>
            </div>
          </PageContainer>
        </section>

        {/* Core Pillars */}
        <section className="py-16 bg-card/30">
          <PageContainer>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <Card>
                <CardHeader>
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold mb-2">
                    01
                  </div>
                  <CardTitle>Xác thực trường đại học</CardTitle>
                  <CardDescription>
                    Xác minh sinh viên chính quy qua email trường (.edu.vn), giúp nhà tuyển dụng yên tâm tuyệt đối về nguồn nhân lực.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold mb-2">
                    02
                  </div>
                  <CardTitle>CV Snapshot an toàn</CardTitle>
                  <CardDescription>
                    Lưu giữ bản chụp CV tại thời điểm nộp đơn, đảm bảo tính pháp lý và trung thực cho cả ứng viên và nhà tuyển dụng.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold mb-2">
                    03
                  </div>
                  <CardTitle>Kiểm duyệt nghiêm ngặt</CardTitle>
                  <CardDescription>
                    Mọi tin tuyển dụng và doanh nghiệp mới đều qua bước thẩm định bởi kiểm duyệt viên, loại bỏ hoàn toàn tin giả, đa cấp.
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          </PageContainer>
        </section>
      </main>

      <footer className="border-t border-border bg-card py-8 text-center text-sm text-muted-foreground">
        <PageContainer>
          <p>CampusJob — Nền tảng quản lý việc làm thêm & thực tập cho sinh viên &copy; 2026</p>
        </PageContainer>
      </footer>
    </div>
  );
}
