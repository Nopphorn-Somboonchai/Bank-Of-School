"use client";

import React from 'react';
import { useAuthRole } from '@/src/hooks/useAuthRole';
import { ShieldAlert, RefreshCw } from 'lucide-react';
import { Role } from '@/src/types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: Role[];
  fallback?: React.ReactNode;
}

export function ProtectedRoute({ children, allowedRoles, fallback }: ProtectedRouteProps) {
  const { userSession, loading, isSuperAdmin, isAdmin, isTeacher } = useAuthRole();

  if (loading) {
    return (
      <div className="min-h-[300px] flex flex-col items-center justify-center gap-4 text-slate-400">
        <RefreshCw className="w-8 h-8 animate-spin text-emerald-500" />
        <p className="text-sm font-medium">กำลังตรวจสอบสิทธิ์การเข้าถึง...</p>
      </div>
    );
  }

  if (!userSession) {
    return (
      <div className="text-center py-20 bg-slate-900/38 backdrop-blur-md rounded-2xl border border-white/15 p-6 max-w-md mx-auto mt-10 shadow-lg">
        <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-white mb-2">ไม่สามารถเข้าถึงได้</h3>
        <p className="text-xs text-slate-300">กรุณาเข้าสู่ระบบเพื่อใช้งานส่วนนี้</p>
      </div>
    );
  }

  if (allowedRoles) {
    const hasAccess = allowedRoles.some((allowedRole) => {
      if (allowedRole === 'Super Admin') return isSuperAdmin;
      if (allowedRole === 'Admin') return isAdmin;
      if (allowedRole === 'Teacher') return isTeacher;
      return false;
    });

    if (!hasAccess) {
      if (fallback !== undefined) {
        return <>{fallback}</>;
      }
      
      return (
        <div className="text-center py-20 bg-slate-900/38 backdrop-blur-md rounded-2xl border border-white/15 p-6 max-w-md mx-auto mt-10 shadow-lg">
          <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-white mb-2">เข้าถึงถูกปฏิเสธ</h3>
          <p className="text-xs text-slate-300">คุณไม่มีสิทธิ์เพียงพอในการเข้าใช้หน้านี้</p>
        </div>
      );
    }
  }

  return <>{children}</>;
}
