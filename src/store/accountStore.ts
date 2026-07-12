import { create } from 'zustand';
import { onSnapshot } from 'firebase/firestore';
import { getPublicCollection } from '@/src/utils/dbPaths';
import { Account } from '@/src/types';

interface AccountState {
  accounts: Record<string, Account>;
  loading: boolean;
  error: string | null;
  subscribeAccounts: (showToast: (message: string, type?: string) => void) => () => void;
}

export const useAccountStore = create<AccountState>((set) => ({
  accounts: {},
  loading: true,
  error: null,
  subscribeAccounts: (showToast) => {
    set({ loading: true, error: null });
    const accountsCol = getPublicCollection('accounts');
    const unsubscribe = onSnapshot(
      accountsCol,
      (snapshot) => {
        const map: Record<string, Account> = {};
        snapshot.forEach((doc) => {
          const data = doc.data();
          if (data && data.studentId) {
            map[data.studentId] = { ...data, accountId: doc.id } as Account;
          }
        });
        set({ accounts: map, loading: false });
      },
      (error) => {
        console.error("Firestore read error for accounts store:", error);
        showToast("ล้มเหลวในการโหลดข้อมูลบัญชี", "error");
        set({ error: error.message, loading: false });
      }
    );
    return unsubscribe;
  }
}));
