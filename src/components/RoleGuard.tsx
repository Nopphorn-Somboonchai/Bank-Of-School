"use client";

import React from 'react';
import { useAuthRole } from '@/src/hooks/useAuthRole';

export type UserRole = 'Super Admin' | 'Admin' | 'Teacher';

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles: UserRole[];
  fallback?: React.ReactNode;
}

export function RoleGuard({ children, allowedRoles, fallback = null }: RoleGuardProps) {
  const { isSuperAdmin, isAdmin, isTeacher, userSession } = useAuthRole();

  if (!userSession) {
    return <>{fallback}</>;
  }

  // Check if user has permission
  const hasAccess = allowedRoles.some((allowedRole) => {
    if (allowedRole === 'Super Admin') return isSuperAdmin;
    if (allowedRole === 'Admin') return isAdmin; // Admin role covers Super Admin
    if (allowedRole === 'Teacher') return isTeacher; // Teacher role covers all roles
    return false;
  });

  if (!hasAccess) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
