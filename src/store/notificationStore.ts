import { create } from 'zustand';
import { onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { getPublicCollection } from '@/src/utils/dbPaths';
import { UserSession } from '@/src/types';

export interface BankNotification {
  logId: string;
  timestamp: string;
  userId: string;
  actionType: string;
  remarks: string;
}

interface NotificationState {
  notifications: BankNotification[];
  unreadCount: number;
  lastSeenNotification: string;
  loading: boolean;
  currentUserId: string | null;
  subscribeNotifications: (
    userSession: UserSession | null,
    showToast: (message: string, type?: string) => void
  ) => () => void;
  markNotificationsAsRead: () => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  lastSeenNotification: new Date().toISOString(),
  loading: true,
  currentUserId: null,

  subscribeNotifications: (userSession, showToast) => {
    if (!userSession) return () => {};

    const storageKey = `bank_last_seen_notification_${userSession.userId}`;
    let lastSeen = new Date().toISOString();
    if (typeof window !== 'undefined') {
      lastSeen = localStorage.getItem(storageKey) || new Date().toISOString();
    }
    set({ lastSeenNotification: lastSeen, loading: true, currentUserId: userSession.userId });

    const logsCol = getPublicCollection('audit_logs');
    const qLogs = query(logsCol, orderBy('timestamp', 'desc'), limit(15));
    let isFirstLoad = true;

    const unsubscribe = onSnapshot(
      qLogs,
      (snapshot) => {
        const list: BankNotification[] = [];
        let hasNewFromOther = false;
        let newRemark = '';

        snapshot.forEach((doc) => {
          const data = doc.data();
          list.push({
            logId: doc.id,
            timestamp: data.timestamp || new Date().toISOString(),
            userId: data.userId || '',
            actionType: data.actionType || '',
            remarks: data.remarks || '',
          });
        });

        if (!isFirstLoad) {
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
              const data = change.doc.data();
              if (data.userId !== userSession.userId) {
                hasNewFromOther = true;
                newRemark = data.remarks || 'มีรายการอัปเดตใหม่ในระบบ';
              }
            }
          });
        } else {
          isFirstLoad = false;
        }

        const unread = list.filter(
          (n) => n.timestamp > get().lastSeenNotification && n.userId !== userSession.userId
        ).length;

        set({ notifications: list, unreadCount: unread, loading: false });

        if (hasNewFromOther && newRemark) {
          showToast(newRemark, 'success');
        }
      },
      (error) => {
        console.error("Firestore read error for audit logs store:", error);
        set({ loading: false });
      }
    );

    return unsubscribe;
  },

  markNotificationsAsRead: () => {
    const userId = get().currentUserId;
    if (!userId) return;

    const now = new Date().toISOString();
    const storageKey = `bank_last_seen_notification_${userId}`;
    if (typeof window !== 'undefined') {
      localStorage.setItem(storageKey, now);
    }
    
    const list = get().notifications;
    const unread = list.filter(
      (n) => n.timestamp > now && n.userId !== userId
    ).length;

    set({ lastSeenNotification: now, unreadCount: unread });
  }
}));
