import { useContext } from 'react';
import { AuthContext } from '@/src/context/AuthContext';
import { Role } from '@/src/types';
import { normalizeRole } from '@/src/utils/roleUtils';

export function useAuthRole() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthRole must be used within an AuthProvider');
  }

  const { userSession, loading, logout, setUserSession, showToast } = context;
  const role: Role | '' = userSession ? normalizeRole(userSession.role) : '';

  // Roles checking helper logic (normalized direct comparison)
  // Hierarchy: Super Admin > Admin > Teacher
  const isSuperAdmin = role === 'Super Admin';
  const isAdmin = isSuperAdmin || role === 'Admin';
  const isTeacher = !!userSession && (isSuperAdmin || isAdmin || role === 'Teacher');

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
