import type {
  NotificationDto,
  NotificationEmailPreferenceDto,
  PaginatedResponse,
  UnreadCountResponseDto,
} from '@campusjob/contracts';
import { request } from '@/lib/m05-request';

/**
 * Lấy danh sách tùy chọn nhận email thông báo của tài khoản hiện tại (C-20 / R-M05-02).
 * Trả về 11 loại sự kiện có hỗ trợ gửi email cùng trạng thái emailEnabled.
 */
export function getNotificationPreferences(): Promise<NotificationEmailPreferenceDto[]> {
  return request<NotificationEmailPreferenceDto[]>('/notifications/preferences');
}

/**
 * Cập nhật tùy chọn nhận email cho một loại sự kiện thông báo (C-20 / R-M05-02).
 */
export function updateNotificationPreference(
  eventType: string,
  emailEnabled: boolean,
): Promise<NotificationEmailPreferenceDto> {
  return request<NotificationEmailPreferenceDto>('/notifications/preferences', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ eventType, emailEnabled }),
  });
}

/**
 * Lấy số lượng thông báo chưa đọc.
 */
export function getUnreadNotificationCount(): Promise<UnreadCountResponseDto> {
  return request<UnreadCountResponseDto>('/notifications/unread-count');
}

/**
 * Lấy danh sách thông báo của tôi theo phân trang.
 */
export function listMyNotifications(
  page = 1,
  limit = 20,
): Promise<PaginatedResponse<NotificationDto>> {
  return request<PaginatedResponse<NotificationDto>>(
    `/notifications?page=${page}&limit=${limit}`,
  );
}

/**
 * Đánh dấu một thông báo đã đọc.
 */
export function markNotificationAsRead(id: string): Promise<NotificationDto> {
  return request<NotificationDto>(`/notifications/${encodeURIComponent(id)}/read`, {
    method: 'PATCH',
  });
}

/**
 * Đánh dấu tất cả thông báo đã đọc.
 */
export function markAllNotificationsAsRead(): Promise<{ updatedCount: number }> {
  return request<{ updatedCount: number }>('/notifications/read-all', {
    method: 'PATCH',
  });
}
