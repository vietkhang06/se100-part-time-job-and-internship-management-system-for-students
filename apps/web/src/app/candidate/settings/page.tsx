'use client';

import * as React from 'react';
import Link from 'next/link';
import { NotificationEventType, type NotificationEmailPreferenceDto } from '@campusjob/contracts';
import { PageHeader } from '@/components/layout/page-header';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import { Spinner } from '@/components/ui/spinner';
import { RoleGate } from '@/components/m05/role-gate';
import { useAsyncResource } from '@/lib/use-async-resource';
import {
  getNotificationPreferences,
  updateNotificationPreference,
} from '@/lib/notifications-api';
import {
  NOTIFICATION_EVENT_METAS,
  NOTIFICATION_CATEGORY_LABEL,
  NotificationEventMeta,
} from '@/lib/notification-labels';

const header = (
  <PageHeader
    title="Cài đặt thông báo"
    description="Quản lý tùy chọn nhận email cho từng loại sự kiện thông báo. Bạn có thể bật hoặc tắt email độc lập mà không ảnh hưởng đến thông báo trong hệ thống."
    action={
      <Link href="/notifications">
        <Button variant="outline">Xem hộp thư thông báo</Button>
      </Link>
    }
  />
);

export default function CandidateSettingsPage() {
  return (
    <RoleGate roles={['STUDENT']} header={header}>
      <CandidateNotificationPreferencesContent />
    </RoleGate>
  );
}

function CandidateNotificationPreferencesContent() {
  const loadPreferences = React.useCallback(() => getNotificationPreferences(), []);
  const { data: serverPreferences, isLoading, error, reload } = useAsyncResource(
    loadPreferences,
    true,
    'Không thể tải danh sách tùy chọn thông báo. Vui lòng thử lại.',
  );

  // Lưu trạng thái emailEnabled của từng eventType
  const [preferencesMap, setPreferencesMap] = React.useState<Record<string, boolean>>({});
  // Theo dõi các eventType đang trong quá trình gọi API cập nhật
  const [updatingEvents, setUpdatingEvents] = React.useState<Record<string, boolean>>({});
  // Lưu thông báo trạng thái cập nhật (thành công hoặc lỗi) cho từng eventType
  const [eventFeedback, setEventFeedback] = React.useState<Record<string, { type: 'success' | 'error'; message: string }>>({});

  // Khởi tạo map preferences khi tải xong từ server
  React.useEffect(() => {
    if (serverPreferences && Array.isArray(serverPreferences)) {
      const map: Record<string, boolean> = {};
      for (const pref of serverPreferences) {
        map[pref.eventType] = pref.emailEnabled;
      }
      setPreferencesMap(map);
    }
  }, [serverPreferences]);

  async function handleToggleEmail(eventType: NotificationEventType, currentEnabled: boolean) {
    const nextEnabled = !currentEnabled;

    // Cập nhật optimistic UI ngay lập tức
    setPreferencesMap((prev) => ({ ...prev, [eventType]: nextEnabled }));
    setUpdatingEvents((prev) => ({ ...prev, [eventType]: true }));
    setEventFeedback((prev) => {
      const copy = { ...prev };
      delete copy[eventType];
      return copy;
    });

    try {
      const updated = await updateNotificationPreference(eventType, nextEnabled);
      setPreferencesMap((prev) => ({ ...prev, [eventType]: updated.emailEnabled }));
      setEventFeedback((prev) => ({
        ...prev,
        [eventType]: {
          type: 'success',
          message: updated.emailEnabled ? 'Đã bật nhận email' : 'Đã tắt nhận email',
        },
      }));

      // Tự động ẩn thông báo thành công sau 3 giây
      setTimeout(() => {
        setEventFeedback((prev) => {
          if (prev[eventType]?.type === 'success') {
            const next = { ...prev };
            delete next[eventType];
            return next;
          }
          return prev;
        });
      }, 3000);
    } catch (err: unknown) {
      // Revert lại trạng thái cũ nếu API báo lỗi
      setPreferencesMap((prev) => ({ ...prev, [eventType]: currentEnabled }));
      const msg = err instanceof Error ? err.message : 'Không thể lưu cài đặt. Vui lòng thử lại.';
      setEventFeedback((prev) => ({
        ...prev,
        [eventType]: {
          type: 'error',
          message: msg,
        },
      }));
    } finally {
      setUpdatingEvents((prev) => ({ ...prev, [eventType]: false }));
    }
  }

  // Nhóm 15 sự kiện theo category để hiển thị trực quan
  const categories: Array<{ id: string; title: string; events: NotificationEventMeta[] }> = [
    {
      id: 'APPLICATION',
      title: NOTIFICATION_CATEGORY_LABEL.APPLICATION,
      events: NOTIFICATION_EVENT_METAS.filter((e) => e.category === 'APPLICATION'),
    },
    {
      id: 'INTERVIEW',
      title: NOTIFICATION_CATEGORY_LABEL.INTERVIEW,
      events: NOTIFICATION_EVENT_METAS.filter((e) => e.category === 'INTERVIEW'),
    },
    {
      id: 'TRUST',
      title: NOTIFICATION_CATEGORY_LABEL.TRUST,
      events: NOTIFICATION_EVENT_METAS.filter((e) => e.category === 'TRUST'),
    },
    {
      id: 'JOB',
      title: NOTIFICATION_CATEGORY_LABEL.JOB,
      events: NOTIFICATION_EVENT_METAS.filter((e) => e.category === 'JOB'),
    },
  ];

  return (
    <div className="space-y-6">
      {header}

      <Alert variant="info" title="Chính sách bảo toàn thông báo">
        Khi bạn tắt nhận email cho một loại sự kiện, thông báo trong ứng dụng vẫn luôn được lưu
        đầy đủ tại mục <strong>Thông báo</strong>. Bạn sẽ không bỏ lỡ bất kỳ cập nhật quan trọng nào
        về hồ sơ ứng tuyển, phỏng vấn hay tài khoản.
      </Alert>

      {error ? (
        <ErrorState message={error} onRetry={() => void reload()} />
      ) : isLoading && !serverPreferences ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : (
        <div className="space-y-8">
          {categories.map((cat) => (
            <Card key={cat.id}>
              <CardHeader>
                <CardTitle>{cat.title}</CardTitle>
                <CardDescription>
                  Tùy chỉnh các thông báo liên quan đến {cat.title.toLowerCase()}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="divide-y divide-border">
                  {cat.events.map((meta) => {
                    const isEmailCapable = meta.emailCapable;
                    // Mặc định là true nếu là email-capable và chưa có giá trị rõ ràng
                    const isEmailEnabled = isEmailCapable
                      ? (preferencesMap[meta.eventType] ?? true)
                      : false;
                    const isUpdating = updatingEvents[meta.eventType] ?? false;
                    const feedback = eventFeedback[meta.eventType];

                    return (
                      <div
                        key={meta.eventType}
                        className="flex flex-col sm:flex-row sm:items-center justify-between py-4 gap-4"
                      >
                        <div className="space-y-1 max-w-2xl">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-foreground text-sm sm:text-base">
                              {meta.title}
                            </span>
                            {isEmailCapable ? (
                              <Badge variant={isEmailEnabled ? 'success' : 'secondary'}>
                                {isEmailEnabled ? 'Email: Đang bật' : 'Email: Đã tắt'}
                              </Badge>
                            ) : (
                              <Badge variant="outline">
                                Chỉ trong ứng dụng (In-app)
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs sm:text-sm text-muted-foreground">
                            {meta.description}
                          </p>
                          {feedback && (
                            <p
                              className={`text-xs font-medium ${
                                feedback.type === 'success' ? 'text-green-600' : 'text-destructive'
                              }`}
                            >
                              {feedback.message}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          {isEmailCapable ? (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                role="switch"
                                aria-checked={isEmailEnabled}
                                aria-label={`Bật tắt email cho ${meta.title}`}
                                disabled={isUpdating}
                                onClick={() => void handleToggleEmail(meta.eventType, isEmailEnabled)}
                                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 ${
                                  isEmailEnabled ? 'bg-primary' : 'bg-input'
                                }`}
                              >
                                <span
                                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                                    isEmailEnabled ? 'translate-x-5' : 'translate-x-0'
                                  }`}
                                />
                              </button>
                              <span className="text-xs text-muted-foreground min-w-[3.5rem]">
                                {isUpdating ? 'Đang lưu...' : isEmailEnabled ? 'Nhận mail' : 'Tắt mail'}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">
                              Không gửi email
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
