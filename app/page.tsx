"use client";

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { RefreshCw, AlertCircle, CheckCircle, AlertTriangle } from 'lucide-react';
import { writeAuditLog } from '@/src/utils/bankUtils';
import { AuthProvider } from '@/src/context/AuthContext';
import { useAuthRole } from '@/src/hooks/useAuthRole';
import { ProtectedRoute } from '@/src/components/ProtectedRoute';

// Zustand stores
import { useStudentStore } from '@/src/store/studentStore';
import { useAccountStore } from '@/src/store/accountStore';
import { useNotificationStore } from '@/src/store/notificationStore';

// Extracted Sub-Components - LoginView loaded statically for instant FCP/LCP
import LoginView from '@/src/components/LoginView';

// Code-splitting authenticated dashboard views to eliminate main-thread blocking
const DashboardLayout = dynamic(() => import('@/src/components/DashboardLayout'), {
  loading: () => (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center font-sans">
      <div className="flex flex-col items-center gap-4">
        <RefreshCw className="w-10 h-10 text-emerald-500 animate-spin" />
        <p className="text-sm font-semibold text-slate-400">กำลังเข้าสู่ระบบจัดการบัญชี...</p>
      </div>
    </div>
  ),
});
const DashboardMainContent = dynamic(() => import('@/src/components/DashboardMainContent'));
const StudentsMainContent = dynamic(() => import('@/src/components/StudentsMainContent'));
const DepositMainContent = dynamic(() => import('@/src/components/DepositMainContent'));
const WithdrawMainContent = dynamic(() => import('@/src/components/WithdrawMainContent'));
const ReportsMainContent = dynamic(() => import('@/src/components/ReportsMainContent'));
const SettingsMainContent = dynamic(() => import('@/src/components/SettingsMainContent'));

export type ToastType = 'success' | 'error' | 'warning';

export interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

function AppContent({ 
  showToast 
}: { 
  showToast: (message: string, type?: string) => void;
}) {
  const { userSession, loading: authLoading, isAdmin, logout, setUserSession } = useAuthRole();
  const [activeTab, setActiveTab] = useState<string>('dashboard');

  // --- Service Worker & PWA Install Prompt Registration ---
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  // Manage Zustand Stores real-time subscriptions reactively
  useEffect(() => {
    if (!userSession) return;

    const unsubStudents = useStudentStore.getState().subscribeStudents(showToast);
    const unsubAccounts = useAccountStore.getState().subscribeAccounts(showToast);
    const unsubNotifications = useNotificationStore.getState().subscribeNotifications(userSession, showToast);

    return () => {
      unsubStudents();
      unsubAccounts();
      unsubNotifications();
    };
  }, [userSession, showToast]);

  useEffect(() => {
    // Register Service Worker
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      const handleLoad = () => {
        navigator.serviceWorker.register('/sw.js')
          .then((reg) => console.log('Service Worker registered successfully:', reg.scope))
          .catch((err) => console.error('Service Worker registration failed:', err));
      };
      
      if (document.readyState === 'complete') {
        handleLoad();
      } else {
        window.addEventListener('load', handleLoad);
        return () => window.removeEventListener('load', handleLoad);
      }
    }
  }, []);

  useEffect(() => {
    // Listen for PWA Install Prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Listen for appinstalled
    const handleAppInstalled = () => {
      showToast('ติดตั้งแอปพลิเคชันเสร็จเรียบร้อยแล้ว!', 'success');
      setIsInstallable(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [showToast]);

  const handleInstallAppClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`PWA install user choice: ${outcome}`);
    setDeferredPrompt(null);
    setIsInstallable(false);
  };

  // Redirect non-admin users from settings tab to dashboard
  useEffect(() => {
    if (userSession && activeTab === 'settings' && !isAdmin) {
      setActiveTab('dashboard');
    }
  }, [activeTab, userSession, isAdmin]);

  // Only show full-screen loader if user session is already verified and restoring
  // For initial public visit / unauthenticated state, render LoginView immediately for instant FCP & LCP (< 1.2s)
  if (authLoading && userSession) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="w-10 h-10 text-emerald-500 animate-spin" />
          <p className="text-sm font-semibold text-slate-400">กำลังเชื่อมต่อฐานข้อมูลความปลอดภัย...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans selection:bg-emerald-500 selection:text-white">
      {!userSession ? (
        <LoginView onLogin={(session) => {
          setUserSession(session);
          showToast(`ยินดีต้อนรับกลับเข้าสู่ระบบ, ${session.fullName}`);
          writeAuditLog(
            'Login',
            `users/${session.userId}`,
            null,
            { email: session.email, fullName: session.fullName, role: session.role, loginTime: session.loginTime },
            `คุณครู ${session.fullName} เข้าสู่ระบบสำเร็จ`,
            session.userId
          );
        }} showToast={showToast} />
      ) : (
        <DashboardLayout 
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isInstallable={isInstallable}
          onInstallApp={handleInstallAppClick}
        >
          {activeTab === 'dashboard' ? (
            <DashboardMainContent showToast={showToast} userSession={userSession} />
          ) : activeTab === 'students' ? (
            <StudentsMainContent showToast={showToast} userSession={userSession} />
          ) : activeTab === 'deposit' ? (
            <DepositMainContent showToast={showToast} userSession={userSession} />
          ) : activeTab === 'withdrawal' ? (
            <WithdrawMainContent showToast={showToast} userSession={userSession} />
          ) : activeTab === 'reports' ? (
            <ReportsMainContent showToast={showToast} userSession={userSession} />
          ) : activeTab === 'settings' ? (
            <ProtectedRoute allowedRoles={['Admin']}>
              <SettingsMainContent 
                showToast={showToast} 
                isInstallable={isInstallable}
                onInstallApp={handleInstallAppClick}
              />
            </ProtectedRoute>
          ) : (
            <div className="text-center py-20 text-slate-500">
              คุณไม่มีสิทธิ์เข้าถึงหน้านี้ หรือหน้านี้ยังไม่ได้เปิดใช้งาน
            </div>
          )}
        </DashboardLayout>
      )}
    </div>
  );
}

interface ToastContainerProps {
  toasts: Toast[];
}

function ToastContainer({ toasts }: ToastContainerProps) {
  return (
    <div className="fixed bottom-5 right-5 flex flex-col gap-2 z-50 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => {
        const isError = toast.type === 'error';
        const isWarning = toast.type === 'warning';

        return (
          <div
            key={toast.id}
            className={`p-4 rounded-xl shadow-lg flex items-center gap-3 border transition-all duration-300 pointer-events-auto animate-slideIn ${
              isError
                ? 'bg-rose-950/90 border-rose-500/40 text-rose-200'
                : isWarning
                ? 'bg-amber-950/90 border-amber-500/40 text-amber-200'
                : 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200'
            }`}
          >
            {isError ? (
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            ) : isWarning ? (
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            ) : (
              <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
            )}
            <span className="text-xs font-semibold">{toast.message}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function App() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  // --- Toast Manager ---
  const showToast = useCallback((message: string, type: string = 'success') => {
    const id = Date.now();
    const resolvedType: ToastType = type === 'error' ? 'error' : type === 'warning' ? 'warning' : 'success';
    setToasts((prev) => [...prev, { id, message, type: resolvedType }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 4000);
  }, []);

  return (
    <AuthProvider showToast={showToast}>
      <AppContent showToast={showToast} />
      <ToastContainer toasts={toasts} />
    </AuthProvider>
  );
}