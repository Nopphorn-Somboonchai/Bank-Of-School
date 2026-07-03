"use client";

import React, { useState, useEffect } from 'react';
import { RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';
import { db, initializeAppAuth, getAppId } from '@/src/config/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { BankDataProvider } from '@/src/context/BankDataContext';
import { writeAuditLog } from '@/src/utils/bankUtils';

// Extracted Sub-Components
import LoginView from '@/src/components/LoginView';
import DashboardLayout from '@/src/components/DashboardLayout';
import DashboardMainContent from '@/src/components/DashboardMainContent';
import StudentsMainContent from '@/src/components/StudentsMainContent';
import DepositMainContent from '@/src/components/DepositMainContent';
import WithdrawMainContent from '@/src/components/WithdrawMainContent';
import ReportsMainContent from '@/src/components/ReportsMainContent';
import SettingsMainContent from '@/src/components/SettingsMainContent';

const mockTeacherSession = {
  userId: "TEACHER_69001",
  email: "teacher.somrak@school.ac.th",
  fullName: "คุณครูสมรักษ์ ใจดี",
  role: "ครูผู้ดูแลระบบ (Teacher)",
  classAssignment: "ชั้นมัธยมศึกษาปีที่ 1/2",
  schoolName: "โรงเรียนสาธิตวิทยาคาร",
  academicYear: "2569"
};

export default function App() {
  const [userSession, setUserSession] = useState<any>(null);
  const [toasts, setToasts] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [authLoading, setAuthLoading] = useState(true);
  const [firebaseUid, setFirebaseUid] = useState<string | null>(null);

  // --- Firebase Auth & Teacher Registration ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        const uid = await initializeAppAuth();
        setFirebaseUid(uid);

        // Auto-register this UID as a teacher document to pass security rules
        const appId = getAppId();
        const userDocRef = doc(db, 'artifacts', appId, 'users', uid);
        const userDocSnap = await getDoc(userDocRef);

        if (!userDocSnap.exists()) {
          await setDoc(userDocRef, {
            userId: uid,
            email: mockTeacherSession.email,
            fullName: mockTeacherSession.fullName,
            role: "Teacher",
            classAssignment: mockTeacherSession.classAssignment,
            status: "Active",
            createdAt: new Date().toISOString()
          });
          console.log("Teacher auto-registered in Firestore for UID:", uid);
        } else {
          console.log("Teacher already registered in Firestore for UID:", uid);
        }
      } catch (error) {
        console.error("Firebase Auth or Registration failed:", error);
        showToast("เกิดข้อผิดพลาดในการเชื่อมต่อระบบความปลอดภัยฐานข้อมูล", "error");
      } finally {
        setAuthLoading(false);
      }
    };
    initAuth();
  }, []);

  // --- Toast Manager ---
  const showToast = (message: string, type: string = 'success') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 4000);
  };

  const ToastContainer = () => (
    <div className="fixed bottom-5 right-5 flex flex-col gap-2 z-50 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => (
        <div key={toast.id} className={`p-4 rounded-xl shadow-lg flex items-center gap-3 border transition-all duration-305 pointer-events-auto animate-slideIn ${
          toast.type === 'error' ? 'bg-rose-950/90 border-rose-500/40 text-rose-200' : 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200'
        }`}>
          {toast.type === 'error' ? <AlertCircle className="w-5 h-5 text-rose-450" /> : <CheckCircle className="w-5 h-5 text-emerald-400" />}
          <span className="text-xs font-semibold">{toast.message}</span>
        </div>
      ))}
    </div>
  );

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="w-10 h-10 text-emerald-505 animate-spin" />
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
        <BankDataProvider userSession={userSession} showToast={showToast}>
          <DashboardLayout 
            userSession={userSession} 
            onLogout={() => {
              if (userSession) {
                writeAuditLog(
                  'Logout',
                  `users/${userSession.userId}`,
                  { email: userSession.email, fullName: userSession.fullName, role: userSession.role },
                  null,
                  `คุณครู ${userSession.fullName} ออกจากระบบ`,
                  userSession.userId
                );
              }
              setUserSession(null);
              showToast('ออกจากระบบเรียบร้อยแล้ว', 'success');
            }}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
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
              <SettingsMainContent showToast={showToast} userSession={userSession} />
            ) : (
              <div className="text-center py-20 text-slate-500">
                หน้านี้ยังไม่ได้เปิดใช้งาน (In Development)
              </div>
            )}
          </DashboardLayout>
        </BankDataProvider>
      )}
      <ToastContainer />
    </div>
  );
}