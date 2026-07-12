import { useNotificationStore } from '@/src/store/notificationStore';

export function useAuditLogs() {
  const notifications = useNotificationStore((state) => state.notifications);
  const unreadCount = useNotificationStore((state) => state.unreadCount);
  const loading = useNotificationStore((state) => state.loading);
  const markNotificationsAsRead = useNotificationStore((state) => state.markNotificationsAsRead);

  return { notifications, unreadCount, loading, markNotificationsAsRead };
}
