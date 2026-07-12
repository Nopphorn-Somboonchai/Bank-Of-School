import { useContext } from 'react';
import { AuthContext } from '@/src/context/AuthContext';

export function useAuthRole() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthRole must be used within an AuthProvider');
  }

  const { userSession, loading, logout, setUserSession, showToast } = context;
  const role = userSession?.role || '';

  // Roles checking helper logic
  // Roles list: 'Super Admin', 'Admin', 'Teacher'
  const isSuperAdmin = role === 'Super Admin' || role?.includes('Super Admin');
  const isAdmin = role === 'Admin' || role?.includes('Admin') || isSuperAdmin;
  const isTeacher = role === 'Teacher' || role?.includes('Teacher') || role?.includes('ครู') || isAdmin || isSuperAdmin;

  return {
    userSession,
    role,
    isSuperAdmin,
    isAdmin,
    isTeacher,
    loading,
    logout,
    setUserSession,
    showToast
  };
}
