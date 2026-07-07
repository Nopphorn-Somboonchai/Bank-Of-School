import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { getPublicCollection } from '@/src/utils/dbPaths';
import { Student, Account } from '@/src/types';

export interface BankNotification {
  logId: string;
  timestamp: string;
  userId: string;
  actionType: string;
  remarks: string;
}

interface BankDataContextType {
  students: Student[];
  accounts: Record<string, Account>;
  loading: boolean;
  notifications: BankNotification[];
  unreadCount: number;
  markNotificationsAsRead: () => void;
}

const BankDataContext = createContext<BankDataContextType | undefined>(undefined);

export function BankDataProvider({ 
  children, 
  userSession, 
  showToast 
}: { 
  children: React.ReactNode; 
  userSession: any; 
  showToast: (message: string, type?: string) => void 
}) {
  const [students, setStudents] = useState<Student[]>([]);
  const [accounts, setAccounts] = useState<Record<string, Account>>({});
  const [notifications, setNotifications] = useState<BankNotification[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const isFirstLoad = useRef(true);

  // Read last seen timestamp from localStorage to calculate unread notifications
  const storageKey = userSession ? `bank_last_seen_notification_${userSession.userId}` : '';
  const [lastSeenNotification, setLastSeenNotification] = useState<string>(() => {
    if (typeof window !== 'undefined' && storageKey) {
      return localStorage.getItem(storageKey) || new Date().toISOString();
    }
    return new Date().toISOString();
  });

  const markNotificationsAsRead = () => {
    const now = new Date().toISOString();
    setLastSeenNotification(now);
    if (typeof window !== 'undefined' && storageKey) {
      localStorage.setItem(storageKey, now);
    }
  };

  useEffect(() => {
    if (!userSession) return;

    setLoadingStudents(true);
    setLoadingAccounts(true);

    const studentsCol = getPublicCollection('students');
    const unsubscribeStudents = onSnapshot(studentsCol, (snapshot) => {
      const list: Student[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.deletedAt == null) {
          list.push({ studentId: doc.id, ...data } as Student);
        }
      });
      // Sort in frontend by studentNumber numerically
      list.sort((a, b) => (a.studentNumber || '').localeCompare(b.studentNumber || '', undefined, { numeric: true }));
      setStudents(list);
      setLoadingStudents(false);
    }, (error) => {
      console.error("Firestore read error for students context:", error);
      showToast("ล้มเหลวในการโหลดรายชื่อนักเรียน", "error");
      setLoadingStudents(false);
    });

    const accountsCol = getPublicCollection('accounts');
    const unsubscribeAccounts = onSnapshot(accountsCol, (snapshot) => {
      const map: Record<string, Account> = {};
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data && data.studentId) {
          map[data.studentId] = { ...data, accountId: doc.id } as Account;
        }
      });
      setAccounts(map);
      setLoadingAccounts(false);
    }, (error) => {
      console.error("Firestore read error for accounts context:", error);
      showToast("ล้มเหลวในการโหลดข้อมูลบัญชี", "error");
      setLoadingAccounts(false);
    });

    // Subscribing to audit logs for notifications in real-time
    const logsCol = getPublicCollection('audit_logs');
    const qLogs = query(logsCol, orderBy('timestamp', 'desc'), limit(15));
    const unsubscribeLogs = onSnapshot(qLogs, (snapshot) => {
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

      if (!isFirstLoad.current) {
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
        isFirstLoad.current = false;
      }

      setNotifications(list);

      if (hasNewFromOther && newRemark) {
        showToast(newRemark, 'success');
      }
    }, (error) => {
      console.error("Firestore read error for audit logs context:", error);
    });

    return () => {
      unsubscribeStudents();
      unsubscribeAccounts();
      unsubscribeLogs();
    };
  }, [userSession, showToast]);

  const unreadCount = notifications.filter(
    (n) => n.timestamp > lastSeenNotification && n.userId !== userSession.userId
  ).length;

  const value = {
    students,
    accounts,
    loading: loadingStudents || loadingAccounts,
    notifications,
    unreadCount,
    markNotificationsAsRead
  };

  return (
    <BankDataContext.Provider value={value}>
      {children}
    </BankDataContext.Provider>
  );
}

export function useBankData() {
  const context = useContext(BankDataContext);
  if (context === undefined) {
    throw new Error('useBankData must be used within a BankDataProvider');
  }
  return context;
}
