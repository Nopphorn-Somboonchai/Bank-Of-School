import React, { createContext, useContext, useState, useEffect } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { getPublicCollection } from '@/src/utils/dbPaths';
import { Student, Account } from '@/src/types';

interface BankDataContextType {
  students: Student[];
  accounts: Record<string, Account>;
  loading: boolean;
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
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [loadingAccounts, setLoadingAccounts] = useState(true);

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
      list.sort((a, b) => a.studentNumber.localeCompare(b.studentNumber, undefined, { numeric: true }));
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

    return () => {
      unsubscribeStudents();
      unsubscribeAccounts();
    };
  }, [userSession, showToast]);

  const value = {
    students,
    accounts,
    loading: loadingStudents || loadingAccounts
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
