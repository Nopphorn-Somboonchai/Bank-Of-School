import { useAccountStore } from '@/src/store/accountStore';

export function useAccounts() {
  const accounts = useAccountStore((state) => state.accounts);
  const loading = useAccountStore((state) => state.loading);
  const error = useAccountStore((state) => state.error);

  return { accounts, loading, error };
}
