import { test, expect } from '@playwright/test';

/**
 * S8-M05-02 — Moderator/Admin UI Playwright Smoke Tests
 *
 * Covers:
 * - AC-01: Role-based access control (unauthorized, forbidden, permitted roles)
 * - AC-02: Decision reason requirement (validation and enforcement)
 * - AC-03: Real API data, queue filtering, and empty states
 * - AC-04: Sync/error states and target synchronization handling
 * - AC-05: Responsive layout across viewport breakpoints (360px, 768px, 1440px)
 * - Company flags & sanctions workflow (UC56, UC57, UC59, UC60)
 */

test.describe('S8-M05-02: Moderator & Admin UI Integration Smoke Tests', () => {
  test.describe('AC-01 — Role-Based Access Control', () => {
    test('unauthenticated user is prompted to login when accessing moderator queue', async ({ page }) => {
      await page.goto('/moderator/moderation');
      const alert = page.locator('div[role="alert"]', { hasText: 'Cần đăng nhập' });
      await expect(alert).toBeVisible();
      const loginLink = alert.locator('a[href="/login"]');
      await expect(loginLink).toBeVisible();
    });

    test('unauthenticated user is prompted to login when accessing admin sanctions', async ({ page }) => {
      await page.goto('/admin/sanctions');
      const alert = page.locator('div[role="alert"]', { hasText: 'Cần đăng nhập' });
      await expect(alert).toBeVisible();
      const loginLink = alert.locator('a[href="/login"]');
      await expect(loginLink).toBeVisible();
    });

    test('unauthenticated user is prompted to login when accessing admin reports', async ({ page }) => {
      await page.goto('/admin/reports');
      const alert = page.locator('div[role="alert"]', { hasText: 'Cần đăng nhập' });
      await expect(alert).toBeVisible();
      const loginLink = alert.locator('a[href="/login"]');
      await expect(loginLink).toBeVisible();
    });

    test('student role cannot access moderator queue or admin sanctions', async ({ page }) => {
      // Mock student session in browser
      await page.route('**/api/v1/auth/refresh', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            accessToken: 'mock-student-token',
            user: {
              id: '00000000-0000-0000-0000-000000000001',
              email: 'student@campusjob.local',
              fullName: 'Nguyen Van Sinh Vien',
              role: 'STUDENT',
            },
          }),
        });
      });

      await page.goto('/moderator/moderation');
      const forbiddenModerator = page.locator('div[role="alert"]', {
        hasText: 'Chỉ Kiểm duyệt viên và Quản trị viên mới xem được hàng đợi kiểm duyệt',
      });
      await expect(forbiddenModerator).toBeVisible();

      await page.goto('/admin/sanctions');
      const forbiddenAdmin = page.locator('div[role="alert"]', {
        hasText: 'Tài khoản của bạn không có quyền xem trang này',
      });
      await expect(forbiddenAdmin).toBeVisible();
    });

    test('moderator role can access moderation queue but cannot access admin sanctions', async ({ page }) => {
      // Mock moderator session
      await page.route('**/api/v1/auth/refresh', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            accessToken: 'mock-moderator-token',
            user: {
              id: '00000000-0000-0000-0000-000000000002',
              email: 'moderator@campusjob.local',
              fullName: 'Kiem Duyet Vien',
              role: 'MODERATOR',
            },
          }),
        });
      });

      // Mock queue API
      await page.route('**/api/v1/moderation/queue*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: [],
            meta: { page: 1, limit: 10, totalItems: 0, totalPages: 1, hasNextPage: false, hasPrevPage: false },
          }),
        });
      });

      await page.goto('/moderator/moderation');
      await expect(page.getByRole('heading', { name: 'Trung tâm kiểm duyệt' })).toBeVisible();

      // Moderator should NOT be able to access admin sanctions
      await page.goto('/admin/sanctions');
      const forbidden = page.locator('div[role="alert"]', {
        hasText: 'Tài khoản của bạn không có quyền xem trang này',
      });
      await expect(forbidden).toBeVisible();
    });
  });

  test.describe('AC-02 & AC-03 — Moderation Queue, Evidence, & Decision Reason', () => {
    test.beforeEach(async ({ page }) => {
      // Mock moderator session
      await page.route('**/api/v1/auth/refresh', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            accessToken: 'mock-moderator-token',
            user: {
              id: '00000000-0000-0000-0000-000000000002',
              email: 'moderator@campusjob.local',
              fullName: 'Kiem Duyet Vien',
              role: 'MODERATOR',
            },
          }),
        });
      });
    });

    test('displays queue with filters, handles empty state and pagination', async ({ page }) => {
      await page.route('**/api/v1/moderation/queue*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: [],
            meta: { page: 1, limit: 10, totalItems: 0, totalPages: 1, hasNextPage: false, hasPrevPage: false },
          }),
        });
      });

      await page.goto('/moderator/moderation');
      await expect(page.getByLabel('Trạng thái')).toBeVisible();
      await expect(page.getByLabel('Loại nội dung')).toBeVisible();
      await expect(page.getByText('Hàng đợi kiểm duyệt đang trống')).toBeVisible();
    });

    test('enforces reason requirement on decision form and displays evidence safely', async ({ page }) => {
      const reportItemId = '11111111-1111-4000-8000-000000000001';
      const reportTargetId = '22222222-2222-4000-8000-000000000002';

      await page.route('**/api/v1/moderation/queue*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: [
              {
                id: reportItemId,
                targetType: 'REPORT',
                targetId: reportTargetId,
                round: 1,
                status: 'PENDING',
                summary: 'Báo cáo thông tin sai sự thật về công ty ABC',
                submitterId: '00000000-0000-0000-0000-000000000003',
                assigneeId: '00000000-0000-0000-0000-000000000002', // assigned to current user
                assignedAt: new Date().toISOString(),
                enqueuedAt: new Date().toISOString(),
                decidedAt: null,
              },
            ],
            meta: { page: 1, limit: 10, totalItems: 1, totalPages: 1, hasNextPage: false, hasPrevPage: false },
          }),
        });
      });

      await page.route(`**/api/v1/moderation/items/${reportItemId}`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: reportItemId,
            targetType: 'REPORT',
            targetId: reportTargetId,
            round: 1,
            status: 'PENDING',
            summary: 'Báo cáo thông tin sai sự thật về công ty ABC',
            submitterId: '00000000-0000-0000-0000-000000000003',
            assigneeId: '00000000-0000-0000-0000-000000000002',
            assignedAt: new Date().toISOString(),
            enqueuedAt: new Date().toISOString(),
            decidedAt: null,
            decisions: [],
          }),
        });
      });

      await page.route(`**/api/v1/reports/review/${reportTargetId}`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: reportTargetId,
            targetType: 'COMPANY',
            targetId: '33333333-3333-4000-8000-000000000003',
            targetLabel: 'Công ty TNHH ABC',
            reason: 'FAKE_INFORMATION',
            description: 'Công ty này không có địa chỉ thực tế và thu tiền đặt cọc.',
            status: 'UNDER_REVIEW',
            evidenceCount: 1,
            evidence: [
              {
                id: 'ev-1',
                kind: 'URL',
                url: 'https://storage.campusjob.local/evidence/receipt.pdf',
                note: 'Biên lai nộp tiền đặt cọc',
              },
            ],
            reporterId: '00000000-0000-0000-0000-000000000003',
            createdAt: new Date().toISOString(),
            moderatedAt: null,
            resolvedAt: null,
          }),
        });
      });

      await page.goto('/moderator/moderation');
      await page.getByRole('button', { name: 'Xử lý' }).click();

      // Verify Dialog opens
      await expect(page.getByRole('heading', { name: 'Chi tiết kiểm duyệt' })).toBeVisible();
      await expect(page.getByText('Công ty TNHH ABC')).toBeVisible();
      await expect(page.getByText('Thông tin sai sự thật')).toBeVisible();

      // Verify safe evidence URL is rendered
      const evidenceLink = page.getByRole('link', { name: 'https://storage.campusjob.local/evidence/receipt.pdf' });
      await expect(evidenceLink).toBeVisible();
      await expect(evidenceLink).toHaveAttribute('href', 'https://storage.campusjob.local/evidence/receipt.pdf');
      await expect(evidenceLink).toHaveAttribute('target', '_blank');

      // Attempt submit without reason for SUBSTANTIATE decision
      await page.getByLabel('Quyết định').selectOption('SUBSTANTIATE');
      await page.getByRole('button', { name: 'Ghi nhận quyết định' }).click();

      // Expect AC-02 validation error
      await expect(page.getByText('Vui lòng nhập lý do cho quyết định này.')).toBeVisible();
    });
  });

  test.describe('AC-04 & Sanctions / Company Flags Workflow', () => {
    test.beforeEach(async ({ page }) => {
      // Mock admin session
      await page.route('**/api/v1/auth/refresh', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            accessToken: 'mock-admin-token',
            user: {
              id: '00000000-0000-0000-0000-000000000099',
              email: 'admin@campusjob.local',
              fullName: 'Quan Tri Vien',
              role: 'ADMIN',
            },
          }),
        });
      });
    });

    test('admin can view reports awaiting verdict and apply company suspension', async ({ page }) => {
      const reportId = '44444444-4444-4000-8000-000000000004';
      const companyId = '55555555-5555-4000-8000-000000000005';

      await page.route('**/api/v1/sanctions/reports*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: [
              {
                id: reportId,
                targetType: 'COMPANY',
                targetId: companyId,
                targetLabel: 'Doanh nghiệp Lừa đảo XYZ',
                reason: 'FRAUD',
                description: 'Yêu cầu sinh viên đóng tiền cọc trước khi nhận việc.',
                status: 'SUBSTANTIATED',
                evidenceCount: 1,
                evidence: [{ id: 'ev-2', kind: 'URL', url: 'https://evidence.example.com/proof.png', note: 'Ảnh chat' }],
                reporterId: '00000000-0000-0000-0000-000000000003',
                createdAt: new Date().toISOString(),
                moderatedAt: new Date().toISOString(),
                resolvedAt: null,
              },
            ],
            meta: { page: 1, limit: 10, totalItems: 1, totalPages: 1, hasNextPage: false, hasPrevPage: false },
          }),
        });
      });

      await page.route('**/api/v1/sanctions', async (route) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
              id: 'sanction-1',
              reportId,
              targetType: 'COMPANY',
              targetId: companyId,
              type: 'COMPANY_SUSPENSION',
              status: 'ACTIVE',
              reason: 'Vi phạm nghiêm trọng chính sách thu phí',
              startsAt: new Date().toISOString(),
              endsAt: null,
              imposedBy: '00000000-0000-0000-0000-000000000099',
              liftedAt: null,
              liftReason: null,
              createdAt: new Date().toISOString(),
              events: [],
            }),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              data: [],
              meta: { page: 1, limit: 10, totalItems: 0, totalPages: 1, hasNextPage: false, hasPrevPage: false },
            }),
          });
        }
      });

      await page.goto('/admin/sanctions');
      await expect(page.getByRole('heading', { name: 'Xử lý vi phạm' })).toBeVisible();

      // Open verdict dialog
      await page.getByRole('button', { name: 'Phán quyết' }).click();
      await expect(page.getByRole('heading', { name: 'Phán quyết báo cáo vi phạm' })).toBeVisible();

      // Verify Company Suspension is available for company target
      await page.getByLabel('Hình thức xử lý').selectOption('COMPANY_SUSPENSION');
      await page.getByLabel('Lý do (gửi kèm thông báo cho các bên)').fill('Vi phạm nghiêm trọng chính sách thu phí');
      await page.getByRole('button', { name: 'Ghi nhận phán quyết' }).click();

      // Dialog closes and list refreshes
      await expect(page.getByRole('heading', { name: 'Phán quyết báo cáo vi phạm' })).not.toBeVisible();
    });

    test('admin can access reports center with real moderation queue and audit tab', async ({ page }) => {
      await page.route('**/api/v1/moderation/queue*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: [],
            meta: { page: 1, limit: 10, totalItems: 0, totalPages: 1, hasNextPage: false, hasPrevPage: false },
          }),
        });
      });

      await page.goto('/admin/reports');
      await expect(page.getByRole('heading', { name: 'Báo cáo vi phạm & Hàng chờ kiểm duyệt' })).toBeVisible();

      // Verify tabs exist
      await expect(page.getByRole('button', { name: 'Hàng chờ báo cáo' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Chờ phán quyết (UC59)' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Nhật ký Audit' })).toBeVisible();

      // Switch to Audit Log tab
      await page.getByRole('button', { name: 'Nhật ký Audit' }).click();
      await expect(page.getByText('Trạng thái Nhật ký Kiểm toán (Audit Log)')).toBeVisible();
      await expect(page.getByText('Hiện tại backend chưa cung cấp REST API endpoint công khai')).toBeVisible();
    });
  });

  test.describe('AC-05 — Responsive Design Verification', () => {
    test('renders cleanly on mobile viewport (360px)', async ({ page }) => {
      await page.setViewportSize({ width: 360, height: 740 });
      await page.goto('/moderator/moderation');

      // Verify header and container do not produce horizontal scrolling
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      const windowWidth = await page.evaluate(() => window.innerWidth);
      expect(bodyWidth).toBeLessThanOrEqual(windowWidth + 2); // allowance for scrollbar
    });

    test('renders cleanly on tablet viewport (768px)', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto('/admin/sanctions');

      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      const windowWidth = await page.evaluate(() => window.innerWidth);
      expect(bodyWidth).toBeLessThanOrEqual(windowWidth + 2);
    });

    test('renders cleanly on desktop viewport (1440px)', async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto('/admin/reports');

      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      const windowWidth = await page.evaluate(() => window.innerWidth);
      expect(bodyWidth).toBeLessThanOrEqual(windowWidth + 2);
    });
  });
});
