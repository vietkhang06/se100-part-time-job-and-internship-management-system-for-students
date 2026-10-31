# S3-M05-01 — Regression Suite cho nhóm Trust (M05). Chạy từ thư mục gốc repo:  .\scripts\m05-regression.ps1
# Cần Postgres đang chạy (pnpm infra:up). Không cần Mailpit: email được thay bằng bộ gửi giả trong test.
$ErrorActionPreference = 'Stop'

function Run-Step($title, [scriptblock]$command) {
  Write-Host "`n== $title" -ForegroundColor Cyan
  & $command
  if ($LASTEXITCODE -ne 0) {
    Write-Host "FAILED: $title" -ForegroundColor Red
    exit $LASTEXITCODE
  }
}

Run-Step 'M05 unit tests (notifications, moderation, reports, reviews, sanctions)' {
  pnpm --filter '@campusjob/api' test modules/notifications modules/moderation modules/reports modules/reviews modules/sanctions
}

Run-Step 'M05 trust integration e2e' {
  pnpm --filter '@campusjob/api' test:e2e m05-trust-integration
}

Write-Host "`nM05 regression suite passed." -ForegroundColor Green
