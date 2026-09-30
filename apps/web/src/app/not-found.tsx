import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 text-center">
      <div className="rounded-full bg-secondary p-4 mb-4">
        <span className="text-3xl font-bold text-primary">404</span>
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl mb-2">
        Trang không tìm thấy
      </h1>
      <p className="max-w-md text-sm text-muted-foreground mb-6">
        Đường dẫn bạn yêu cầu không tồn tại hoặc đã được di chuyển.
      </p>
      <Link
        href="/"
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover transition-colors"
      >
        Quay lại trang chủ
      </Link>
    </div>
  );
}
