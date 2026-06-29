"use client";

import React, { useState, useEffect, useMemo } from 'react';
import {
  Lock, Mail, Eye, EyeOff, LogIn, LogOut, CheckCircle, AlertCircle,
  Shield, User, Calendar, Building, LayoutDashboard, Users,
  ArrowDownToLine, ArrowUpFromLine, FileText, Settings, Menu,
  Search, Bell, TrendingUp, TrendingDown, Clock, ChevronRight,
  UserPlus, Edit2, Trash2, X, RefreshCw, Filter, Printer, ChevronLeft, Download
} from 'lucide-react';
import { db, auth, initializeAppAuth, getAppId } from '@/src/config/firebase';
import { getPublicCollection, getPublicDoc } from '@/src/utils/dbPaths';
import { onSnapshot, setDoc, updateDoc, doc, getDoc, query, orderBy, runTransaction, where, getDocs, limit, increment } from 'firebase/firestore';
import { Student, StudentStatus, Account, Transaction } from '@/src/types';

// ==========================================
// MOCK DATA (ข้อมูลจำลองสำหรับการพรีวิว)
// ==========================================
const mockTeacherSession = {
  userId: "TEACHER_69001",
  email: "teacher.somrak@school.ac.th",
  fullName: "คุณครูสมรักษ์ ใจดี",
  role: "ครูผู้ดูแลระบบ (Teacher)",
  classAssignment: "ชั้นมัธยมศึกษาปีที่ 1/2",
  schoolName: "โรงเรียนสาธิตวิทยาคาร",
  academicYear: "2569"
};

const mockDashboardMetrics = {
  totalSavings: 452500.00,
  totalStudents: 124,
  todayDeposits: 12500.00,
  todayWithdrawals: 3200.00,
};

const mockRecentTransactions = [
  { id: "TX1001", ref: "DEP2026000001", name: "เด็กชายสมชาย ใจดี", type: "Deposit", amount: 500, time: "08:15", status: "Completed" },
  { id: "TX1002", ref: "WDL2026000001", name: "เด็กหญิงสมหญิง รักเรียน", type: "Withdrawal", amount: 200, time: "09:30", status: "Completed" },
  { id: "TX1003", ref: "DEP2026000002", name: "เด็กชายมานะ อดทน", type: "Deposit", amount: 1000, time: "10:05", status: "Completed" },
  { id: "TX1004", ref: "DEP2026000003", name: "เด็กหญิงปิติ ยินดี", type: "Deposit", amount: 50, time: "11:20", status: "Completed" },
];

// ==========================================
// GLOBAL UTILITIES & HELPERS
// ==========================================
const writeAuditLog = async (
  actionType: string,
  targetDocument: string,
  oldValue: any | null,
  newValue: any | null,
  remarks: string,
  userId: string
) => {
  try {
    const logsCol = getPublicCollection('audit_logs');
    const logId = "LOG_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7).toUpperCase();
    await setDoc(doc(logsCol, logId), {
      logId,
      timestamp: new Date().toISOString(),
      userId,
      actionType,
      targetDocument,
      oldValue,
      newValue,
      remarks,
      deviceInfo: typeof window !== 'undefined' ? navigator.userAgent : 'Unknown'
    });
    console.log("Audit log saved successfully:", logId);
  } catch (error) {
    console.error("Error writing audit log:", error);
  }
};

const getLocalDateString = () => {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
};

const recalculateDashboardSummary = async () => {
  try {
    const studentsCol = getPublicCollection('students');
    const accountsCol = getPublicCollection('accounts');
    const txCol = getPublicCollection('transactions');
    const todayStr = getLocalDateString();

    // 1. Get all students count (non-deleted)
    const studentsSnap = await getDocs(studentsCol);
    let activeStudentCount = 0;
    studentsSnap.forEach((docSnap) => {
      const s = docSnap.data();
      if (s.deletedAt == null) {
        activeStudentCount++;
      }
    });

    // 2. Sum currentBalance of all accounts
    const accountsSnap = await getDocs(accountsCol);
    let totalSavings = 0;
    accountsSnap.forEach((docSnap) => {
      const acc = docSnap.data();
      if (acc.status === 'Active') {
        totalSavings += Number(acc.currentBalance || 0);
      }
    });

    // 3. Get transactions in the last 7 days (including today) to compute daily stats
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const qTx = query(txCol, where('createdAt', '>=', sevenDaysAgo.toISOString()));
    const txSnap = await getDocs(qTx);

    const dailyStats: Record<string, { deposits: number; withdrawals: number }> = {};
    let todayDeposits = 0;
    let todayWithdrawals = 0;

    txSnap.forEach((docSnap) => {
      const tx = docSnap.data();
      if (tx.status === 'Void') return;
      
      const txDateStr = new Date(tx.createdAt).toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
      const amount = Number(tx.amount || 0);

      if (!dailyStats[txDateStr]) {
        dailyStats[txDateStr] = { deposits: 0, withdrawals: 0 };
      }

      if (tx.transactionType === 'Deposit') {
        dailyStats[txDateStr].deposits += amount;
        if (txDateStr === todayStr) {
          todayDeposits += amount;
        }
      } else if (tx.transactionType === 'Withdrawal') {
        dailyStats[txDateStr].withdrawals += amount;
        if (txDateStr === todayStr) {
          todayWithdrawals += amount;
        }
      }
    });

    // Ensure dailyStats has entries for all of the last 7 days
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
      if (!dailyStats[dateStr]) {
        dailyStats[dateStr] = { deposits: 0, withdrawals: 0 };
      }
    }

    const summaryData = {
      totalSavings,
      totalStudents: activeStudentCount,
      todayDeposits,
      todayWithdrawals,
      dailyStats,
      lastUpdated: new Date().toISOString(),
      currentDate: todayStr
    };

    const summaryDocRef = getPublicDoc('settings', 'dashboard_summary');
    await setDoc(summaryDocRef, summaryData, { merge: true });
    return summaryData;
  } catch (error) {
    console.error("Error in recalculateDashboardSummary:", error);
    throw error;
  }
};

// ==========================================
// MAIN COMPONENT
// ==========================================
export default function App() {
  const [userSession, setUserSession] = useState<any>(null);
  const [toasts, setToasts] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [authLoading, setAuthLoading] = useState(true);
  const [firebaseUid, setFirebaseUid] = useState<string | null>(null);

  // --- Firebase Auth & Teacher Registration (For security rules alignment) ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        const uid = await initializeAppAuth();
        setFirebaseUid(uid);

        // Auto-register this UID as a teacher document to pass rules
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

  // --- Sub-Components ---
  const ToastContainer = () => (
    <div className="fixed bottom-5 right-5 flex flex-col gap-2 z-50 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => (
        <div key={toast.id} className={`p-4 rounded-xl shadow-lg flex items-center gap-3 border transition-all duration-300 pointer-events-auto animate-slideIn ${toast.type === 'error' ? 'bg-rose-950/90 border-rose-500/40 text-rose-200' : 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200'
          }`}>
          {toast.type === 'error' ? <AlertCircle className="w-5 h-5 text-rose-400" /> : <CheckCircle className="w-5 h-5 text-emerald-400" />}
          <span className="text-xs font-semibold">{toast.message}</span>
        </div>
      ))}
    </div>
  );

  if (authLoading) {
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
        }} showToast={showToast} />
      ) : (
        <DashboardLayout 
          userSession={userSession} 
          onLogout={() => {
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
          ) : (
            <div className="text-center py-20 text-slate-500">
              หน้านี้ยังไม่ได้เปิดใช้งาน (In Development)
            </div>
          )}
        </DashboardLayout>
      )}
      <ToastContainer />
    </div>
  );
}

// ==========================================
// LOGIN VIEW COMPONENT
// ==========================================
function LoginView({ onLogin, showToast }: { onLogin: (session: any) => void; showToast: (message: string, type?: string) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!email || !password) {
      setErrorMsg('กรุณากรอกอีเมลและรหัสผ่านให้ครบถ้วน');
      showToast('กรอกข้อมูลไม่ครบถ้วน', 'error');
      return;
    }
    setIsLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1200)); // Simulate API
      if (email.includes('@') && password === '123456') {
        onLogin({ ...mockTeacherSession, email, loginTime: new Date().toLocaleString('th-TH') });
      } else {
        throw new Error('อีเมลผู้ใช้ หรือรหัสผ่านไม่ถูกต้อง (รหัสผ่านจำลอง: 123456)');
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ';
      setErrorMsg(errMsg);
      showToast(errMsg, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-blue-500/10 blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="w-full mx-auto px-6 py-4 flex justify-between items-center border-b border-slate-800 z-10">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-600/20 text-emerald-400 p-2 rounded-xl border border-emerald-500/30">
            <Shield className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              Bank of School <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30">MVP</span>
            </h1>
          </div>
        </div>
      </header>

      {/* Login Box */}
      <main className="flex-grow flex items-center justify-center p-6 z-10">
        <div className="w-full max-w-md bg-slate-800/80 backdrop-blur-lg rounded-2xl border border-slate-700/60 shadow-2xl p-8">
          <div className="text-center mb-8">
            <span className="inline-block text-4xl mb-3">🏦</span>
            <h2 className="text-2xl font-extrabold text-white">เข้าสู่ระบบจัดการบัญชี</h2>
            <p className="text-sm text-slate-400 mt-1">เฉพาะคุณครูผู้ดูแลระบบที่ได้รับอนุญาต</p>
          </div>

          {errorMsg && (
            <div className="mb-6 p-4 bg-rose-900/30 border border-rose-500/30 rounded-xl text-sm text-rose-300 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 uppercase block">อีเมลคุณครู</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500"><Mail className="w-5 h-5" /></span>
                <input
                  type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@school.ac.th" disabled={isLoading}
                  className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl py-3 pl-11 pr-4 text-white placeholder-slate-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-sm"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-slate-300 uppercase block">รหัสผ่านบัญชี</label>
                <span className="text-xs text-emerald-400/80">*จำลอง: 123456</span>
              </div>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500"><Lock className="w-5 h-5" /></span>
                <input
                  type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" disabled={isLoading}
                  className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl py-3 pl-11 pr-12 text-white placeholder-slate-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-sm"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} disabled={isLoading} className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-white">
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={isLoading} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-emerald-900/20 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50">
              {isLoading ? <span>กำลังตรวจสอบสิทธิ์...</span> : <><LogIn className="w-5 h-5" /><span>เข้าสู่ระบบอย่างปลอดภัย</span></>}
            </button>
          </form>
        </div>
      </main>

      <footer className="w-full text-center py-4 text-xs text-slate-500 border-t border-slate-800 z-10 bg-slate-900">
        <p>© 2569 Bank of School. สงวนลิขสิทธิ์เฉพาะสถาบันการศึกษา</p>
      </footer>
    </div>
  );
}

// ==========================================
// DASHBOARD LAYOUT & UI COMPONENT
// ==========================================
interface DashboardLayoutProps {
  children: React.ReactNode;
  userSession: any;
  onLogout: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

function DashboardLayout({ children, userSession, onLogout, activeTab, setActiveTab }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const NavItem = ({ icon: Icon, label, active = false, onClick }: { icon: React.ComponentType<any>; label: string; active?: boolean; onClick?: () => void }) => (
    <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-medium ${active ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
      }`}>
      <Icon className="w-5 h-5" />
      {sidebarOpen && <span>{label}</span>}
    </button>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950">

      {/* Sidebar (Desktop First) */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} flex-shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col transition-all duration-300`}>
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800">
          {sidebarOpen && (
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-lg">
              <Shield className="w-6 h-6" />
              <span>Bank of School</span>
            </div>
          )}
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 mx-auto cursor-pointer">
            <Menu className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 flex-grow space-y-2 overflow-y-auto">
          <NavItem icon={LayoutDashboard} label="แผงควบคุม (Dashboard)" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <NavItem icon={Users} label="จัดการนักเรียน (Students)" active={activeTab === 'students'} onClick={() => setActiveTab('students')} />
          <NavItem icon={ArrowDownToLine} label="ฝากเงิน (Deposit)" active={activeTab === 'deposit'} onClick={() => setActiveTab('deposit')} />
          <NavItem icon={ArrowUpFromLine} label="ถอนเงิน (Withdrawal)" active={activeTab === 'withdrawal'} onClick={() => setActiveTab('withdrawal')} />
          <NavItem icon={FileText} label="รายงาน (Reports)" active={activeTab === 'reports'} onClick={() => setActiveTab('reports')} />
        </div>

        <div className="p-4 border-t border-slate-800 space-y-2">
          <NavItem icon={Settings} label="การตั้งค่า (Settings)" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Top Navbar */}
        <header className="h-16 flex items-center justify-between px-6 bg-slate-900 border-b border-slate-800 shrink-0">
          <div className="flex-1 flex items-center">
            <div className="relative w-64 hidden sm:block">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input type="text" placeholder="ค้นหา รหัสนักเรียน, ชื่อ..." className="w-full bg-slate-800 border border-slate-700 rounded-full py-1.5 pl-9 pr-4 text-sm text-slate-200 focus:outline-none focus:border-emerald-500" />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button className="relative text-slate-400 hover:text-white p-2 cursor-pointer">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border border-slate-900"></span>
            </button>
            <div className="h-6 w-px bg-slate-700 mx-2"></div>
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold text-white leading-none mb-1">{userSession.fullName}</p>
                <p className="text-xs text-emerald-400 leading-none">{userSession.role}</p>
              </div>
              <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400">
                <User className="w-5 h-5" />
              </div>
              <button onClick={onLogout} className="ml-2 text-slate-500 hover:text-rose-400 transition-colors p-2 rounded-lg hover:bg-slate-800 cursor-pointer">
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </header>

        {/* Dynamic Page Content */}
        <main className="flex-1 overflow-y-auto p-6 bg-slate-950">
          {children}
        </main>
      </div>
    </div>
  );
}

// ==========================================
// DASHBOARD METRICS & TABLES COMPONENT
// ==========================================
function DashboardMainContent({ showToast, userSession }: { showToast: (message: string, type?: string) => void; userSession: any }) {
  const [summary, setSummary] = useState<any>(null);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [studentNames, setStudentNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // 1. Listen to Dashboard summary & Transactions
  useEffect(() => {
    const summaryDocRef = getPublicDoc('settings', 'dashboard_summary');
    
    const unsubscribeSummary = onSnapshot(summaryDocRef, async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const todayStr = getLocalDateString();
        
        // Auto-healing/Rollover when dates don't match
        if (data.currentDate !== todayStr) {
          console.log("Rollover mismatch detected in summary subscription. Recalculating...");
          try {
            const freshData = await recalculateDashboardSummary();
            setSummary(freshData);
          } catch (err) {
            console.error("Error auto-recalculating on subscribe:", err);
          }
        } else {
          setSummary(data);
        }
      } else {
        // Init summary if it doesn't exist
        console.log("Summary document does not exist. Recalculating for the first time...");
        try {
          const freshData = await recalculateDashboardSummary();
          setSummary(freshData);
        } catch (err) {
          console.error("Error initializing summary on subscribe:", err);
        }
      }
      setLoading(false);
    }, (error) => {
      console.error("Summary load error:", error);
      showToast("ล้มเหลวในการเชื่อมต่อข้อมูลแดชบอร์ด", "error");
      setLoading(false);
    });

    const txCol = getPublicCollection('transactions');
    const qTx = query(txCol, orderBy('createdAt', 'desc'), limit(10));
    const unsubscribeTx = onSnapshot(qTx, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setRecentTransactions(list);
    }, (error) => {
      console.error("Recent transactions read error:", error);
    });

    return () => {
      unsubscribeSummary();
      unsubscribeTx();
    };
  }, [showToast]);

  // 2. Fetch missing student names for recent transactions
  useEffect(() => {
    const fetchMissingNames = async () => {
      const missingIds = recentTransactions
        .map(tx => tx.studentId)
        .filter(id => id && !studentNames[id]);
      
      if (missingIds.length === 0) return;
      
      const newNames = { ...studentNames };
      await Promise.all(missingIds.map(async (id) => {
        try {
          const studentDocRef = getPublicDoc('students', id);
          const snap = await getDoc(studentDocRef);
          if (snap.exists()) {
            newNames[id] = snap.data().fullName;
          } else {
            newNames[id] = 'ไม่พบข้อมูลนักเรียน';
          }
        } catch (err) {
          console.error("Error fetching student name:", id, err);
          newNames[id] = 'ดึงข้อมูลล้มเหลว';
        }
      }));
      setStudentNames(newNames);
    };

    fetchMissingNames();
  }, [recentTransactions]);

  // 3. Manual recalculate handler
  const handleManualRecalculate = async () => {
    setRefreshing(true);
    try {
      const freshData = await recalculateDashboardSummary();
      setSummary(freshData);
      showToast("รีเฟรชข้อมูลแดชบอร์ดเรียบร้อยแล้ว");
    } catch (err: any) {
      console.error("Manual recalculate error:", err);
      showToast("ไม่สามารถรีเฟรชข้อมูลได้: " + err.message, "error");
    } finally {
      setRefreshing(false);
    }
  };

  const MetricCard = ({ title, value, icon: Icon, colorClass, trendText }: { title: string; value: string | number; icon: React.ComponentType<any>; colorClass: string; trendText: string }) => (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm animate-fadeIn">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm text-slate-400 font-medium mb-1">{title}</p>
          <h3 className="text-2xl font-bold text-white mb-2">{value}</h3>
          <p className={`text-xs flex items-center gap-1 ${trendText.includes('+') ? 'text-emerald-400' : 'text-slate-500'}`}>
            {trendText.includes('+') ? <TrendingUp className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
            {trendText}
          </p>
        </div>
        <div className={`p-3 rounded-xl ${colorClass}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-500 flex flex-col items-center gap-3">
        <RefreshCw className="w-8 h-8 animate-spin text-emerald-500" />
        <span className="text-sm">กำลังโหลดข้อมูลแดชบอร์ด...</span>
      </div>
    );
  }

  // Pre-calculate weekly chart data
  const todayStr = getLocalDateString();
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
  });

  const dailyStats = summary?.dailyStats || {};
  const chartData = last7Days.map(dateStr => {
    const isToday = dateStr === todayStr;
    const deposits = isToday ? (summary?.todayDeposits || 0) : (dailyStats[dateStr]?.deposits || 0);
    const withdrawals = isToday ? (summary?.todayWithdrawals || 0) : (dailyStats[dateStr]?.withdrawals || 0);
    
    const dateObj = new Date(dateStr);
    const dayLabel = dateObj.toLocaleDateString('th-TH', { weekday: 'short' });
    const dateLabel = dateObj.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
    
    return {
      dateStr,
      dayLabel,
      dateLabel,
      deposits,
      withdrawals,
      isToday
    };
  });

  const maxAmount = Math.max(
    100,
    ...chartData.map(d => Math.max(d.deposits, d.withdrawals))
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fadeIn">
      {/* Page Title */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            ภาพรวมระบบ (Overview)
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            ข้อมูลออมทรัพย์ประจำวันที่ {new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={handleManualRecalculate}
            disabled={refreshing}
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 hover:text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50 active:scale-95"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            คำนวณใหม่
          </button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="ยอดเงินออมรวม (Total Savings)"
          value={`฿${(summary?.totalSavings || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
          icon={Building} colorClass="bg-blue-500/10 text-blue-400 border border-blue-500/20"
          trendText="อัปเดตล่าสุดเรียลไทม์"
        />
        <MetricCard
          title="นักเรียนในระบบ (Students)"
          value={(summary?.totalStudents || 0).toLocaleString()}
          icon={Users} colorClass="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
          trendText="เฉพาะนักเรียนไม่รวมที่ลบ"
        />
        <MetricCard
          title="รายการฝากวันนี้ (Today Deposits)"
          value={`฿${(summary?.todayDeposits || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
          icon={ArrowDownToLine} colorClass="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
          trendText="ออมเพิ่มวันนี้"
        />
        <MetricCard
          title="รายการถอนวันนี้ (Today Withdrawals)"
          value={`฿${(summary?.todayWithdrawals || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
          icon={ArrowUpFromLine} colorClass="bg-rose-500/10 text-rose-400 border border-rose-500/20"
          trendText="ถอนออกวันนี้"
        />
      </div>

      {/* Graphical Chart Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* custom simulated weekly bar chart */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between h-[340px]">
          <div>
            <h3 className="font-semibold text-white flex items-center gap-2 mb-1">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
              แนวโน้มการออมและการถอนในรอบสัปดาห์ (Weekly Savings Trend)
            </h3>
            <p className="text-xs text-slate-400">เปรียบเทียบยอดฝากและยอดถอนสะสมย้อนหลัง 7 วันในระบบ</p>
          </div>

          <div className="relative flex-grow flex items-end justify-between gap-2 mt-6 h-40 border-b border-slate-800/80 pb-2">
            {chartData.map((data) => {
              const depHeight = (data.deposits / maxAmount) * 100;
              const wdHeight = (data.withdrawals / maxAmount) * 100;

              return (
                <div key={data.dateStr} className="flex-1 flex flex-col items-center group relative">
                  
                  {/* Tooltip */}
                  <div className="absolute bottom-full mb-2 bg-slate-950 border border-slate-800 rounded-xl p-2.5 shadow-2xl text-[10px] font-medium pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10 w-36 -translate-x-1/2 left-1/2">
                    <p className="text-slate-300 font-bold text-center border-b border-slate-800 pb-1 mb-1.5">{data.dateLabel} {data.isToday ? '(วันนี้)' : ''}</p>
                    <div className="flex justify-between items-center text-emerald-400 font-bold mb-0.5">
                      <span>ฝาก:</span>
                      <span>฿{data.deposits.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between items-center text-rose-400 font-bold">
                      <span>ถอน:</span>
                      <span>฿{data.withdrawals.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>

                  {/* Vertical Bars */}
                  <div className="w-full flex items-end justify-center gap-1 sm:gap-1.5 h-36">
                    <div 
                      className="w-2.5 sm:w-3.5 bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-t-sm hover:brightness-110 transition-all duration-500 ease-out cursor-pointer"
                      style={{ height: `${Math.max(2, depHeight)}%` }}
                    />
                    <div 
                      className="w-2.5 sm:w-3.5 bg-gradient-to-t from-rose-600 to-rose-400 rounded-t-sm hover:brightness-110 transition-all duration-500 ease-out cursor-pointer"
                      style={{ height: `${Math.max(2, wdHeight)}%` }}
                    />
                  </div>

                  {/* Axis Label */}
                  <div className="mt-2 text-[10px] text-center">
                    <span className={`block font-semibold ${data.isToday ? 'text-emerald-400' : 'text-slate-400'}`}>
                      {data.dayLabel}
                    </span>
                    <span className="block text-[8px] text-slate-500 mt-0.5">
                      {data.dateLabel.split(' ')[0]}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-4 text-xs mt-4 justify-center">
            <div className="flex items-center gap-1.5 text-slate-400">
              <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full inline-block"></span>
              <span>ยอดฝาก (Deposits)</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-400">
              <span className="w-2.5 h-2.5 bg-rose-500 rounded-full inline-block"></span>
              <span>ยอดถอน (Withdrawals)</span>
            </div>
          </div>
        </div>

        {/* System Status on Right Column */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col justify-between h-[340px]">
          <div>
            <h3 className="font-semibold text-white mb-4">สถานะระบบ (System Status)</h3>

            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-emerald-400">Database Connected</p>
                  <p className="text-xs text-slate-400 mt-1">เชื่อมต่อข้อมูลแบบเรียลไทม์กับ Firestore เรียบร้อย</p>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/5 flex items-start gap-3">
                <Shield className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-blue-400">Secure Session Active</p>
                  <p className="text-xs text-slate-400 mt-1">ใช้งานโดย: {userSession.fullName}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800">
            <p className="text-xs text-slate-500 text-center">Version MVP 1.0 (Phase 11/16)</p>
          </div>
        </div>

      </div>

      {/* Recent Transactions Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-5 border-b border-slate-800 flex justify-between items-center">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-400" />
            รายการทำธุรกรรมล่าสุด (Recent Transactions)
          </h3>
          <span className="text-xs bg-slate-800 text-slate-400 px-2.5 py-1 rounded-full border border-slate-700">
            แสดง {recentTransactions.length} รายการล่าสุด
          </span>
        </div>
        <div className="overflow-x-auto">
          {recentTransactions.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">
              ยังไม่มีการบันทึกรายการธุรกรรมใด ๆ ในระบบ
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-950/50 text-slate-400 text-xs uppercase">
                <tr>
                  <th className="px-5 py-3 font-medium">Ref No.</th>
                  <th className="px-5 py-3 font-medium">นักเรียน</th>
                  <th className="px-5 py-3 font-medium">ประเภท</th>
                  <th className="px-5 py-3 font-medium text-right">จำนวนเงิน</th>
                  <th className="px-5 py-3 font-medium text-center">วันเวลาทำรายการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {recentTransactions.map((tx) => {
                  const isVoid = tx.status === 'Void';
                  const studentName = studentNames[tx.studentId] || 'กำลังโหลดชื่อ...';
                  return (
                    <tr key={tx.id} className={`hover:bg-slate-800/50 transition-colors ${isVoid ? 'opacity-40 line-through' : ''}`}>
                      <td className="px-5 py-3 text-slate-300 font-mono text-xs font-semibold">{tx.referenceNumber}</td>
                      <td className="px-5 py-3 font-medium text-slate-200">{studentName}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                          isVoid ? 'bg-slate-950 text-slate-500 border-slate-800' :
                          tx.transactionType === 'Deposit' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        }`}>
                          {tx.transactionType === 'Deposit' ? <ArrowDownToLine className="w-3 h-3" /> : <ArrowUpFromLine className="w-3 h-3" />}
                          {tx.transactionType}
                        </span>
                      </td>
                      <td className={`px-5 py-3 text-right font-bold font-mono ${
                        isVoid ? 'text-slate-500' :
                        tx.transactionType === 'Deposit' ? 'text-emerald-400' : 'text-rose-400'
                      }`}>
                        {isVoid ? '' : tx.transactionType === 'Deposit' ? '+' : '-'}฿{tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-5 py-3 text-center text-slate-400 text-xs">
                        {new Date(tx.createdAt).toLocaleString('th-TH', {
                          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                        })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ==========================================
// STUDENT MANAGEMENT VIEW COMPONENT (PHASE 6)
// ==========================================
const TableSkeleton = () => (
  <div className="animate-pulse space-y-4">
    <div className="h-10 bg-slate-800/80 rounded-lg w-full"></div>
    <div className="h-12 bg-slate-800/40 rounded-lg w-full"></div>
    <div className="h-12 bg-slate-800/40 rounded-lg w-full"></div>
    <div className="h-12 bg-slate-800/40 rounded-lg w-full"></div>
    <div className="h-12 bg-slate-800/40 rounded-lg w-full"></div>
  </div>
);

interface StudentsMainContentProps {
  showToast: (message: string, type?: string) => void;
  userSession: any;
}

function StudentsMainContent({ showToast, userSession }: StudentsMainContentProps) {
  const [students, setStudents] = useState<Student[]>([]);
  const [accounts, setAccounts] = useState<Record<string, Account>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [classFilter, setClassFilter] = useState('All');
  const [hideInactive, setHideInactive] = useState(false);
  const [viewingLedgerStudent, setViewingLedgerStudent] = useState<Student | null>(null);

  // Form Modal state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);

  // Form Fields
  const [studentNumber, setStudentNumber] = useState('');
  const [fullName, setFullName] = useState('');
  const [classRoom, setClassRoom] = useState('');
  const [status, setStatus] = useState<StudentStatus>('Active');
  const [submitting, setSubmitting] = useState(false);

  // Soft Delete Confirmation state
  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null);
  const [deleteStatus, setDeleteStatus] = useState<StudentStatus>('Inactive');

  // Load students in real-time
  useEffect(() => {
    const studentsCol = getPublicCollection('students');

    const unsubscribe = onSnapshot(studentsCol, (snapshot) => {
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
      setLoading(false);
    }, (error) => {
      console.error("Firestore read error:", error);
      showToast("ล้มเหลวในการโหลดรายชื่อนักเรียนจาก Firestore", "error");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [showToast]);

  // Load accounts in real-time
  useEffect(() => {
    const accountsCol = getPublicCollection('accounts');

    const unsubscribe = onSnapshot(accountsCol, (snapshot) => {
      const map: Record<string, Account> = {};
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data && data.studentId) {
          map[data.studentId] = { ...data, accountId: doc.id } as Account;
        }
      });
      setAccounts(map);
    }, (error) => {
      console.error("Firestore accounts read error:", error);
      showToast("ล้มเหลวในการโหลดข้อมูลบัญชีจาก Firestore", "error");
    });

    return () => unsubscribe();
  }, [showToast]);

  // Handle open add modal
  const handleOpenAdd = () => {
    setFormMode('create');
    setEditingStudentId(null);
    setStudentNumber('');
    setFullName('');
    setClassRoom('');
    setStatus('Active');
    setIsFormOpen(true);
  };

  // Handle open edit modal
  const handleOpenEdit = (student: Student) => {
    setFormMode('edit');
    setEditingStudentId(student.studentId);
    setStudentNumber(student.studentNumber);
    setFullName(student.fullName);
    setClassRoom(student.classRoom);
    setStatus(student.status);
    setIsFormOpen(true);
  };

  // Handle Form Submission (Create or Edit)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentNumber.trim() || !fullName.trim() || !classRoom.trim()) {
      showToast("กรุณากรอกข้อมูลสำคัญให้ครบถ้วน", "error");
      return;
    }

    // Number check
    if (!/^\d+$/.test(studentNumber.trim())) {
      showToast("รหัสนักเรียนต้องเป็นตัวเลขเท่านั้น", "error");
      return;
    }

    setSubmitting(true);

    try {
      const formattedNum = studentNumber.trim();
      const formattedName = fullName.trim();
      const formattedRoom = classRoom.trim();

      if (formMode === 'create') {
        const studentId = "STD" + formattedNum;

        // Check duplicate
        const exists = students.some(s => s.studentId === studentId);
        if (exists) {
          showToast("รหัสนักเรียนนี้มีอยู่ในระบบแล้ว", "error");
          setSubmitting(false);
          return;
        }

        const studentDocRef = getPublicDoc('students', studentId);
        const studentData: Student = {
          studentId,
          studentNumber: formattedNum,
          fullName: formattedName,
          classRoom: formattedRoom,
          status: 'Active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          deletedAt: null
        };

        // Write student
        await setDoc(studentDocRef, studentData);

        // Auto create savings account for the student
        const accountDocRef = getPublicDoc('accounts', studentId);
        await setDoc(accountDocRef, {
          accountId: studentId,
          studentId: studentId,
          accountNumber: "AC" + formattedNum,
          currentBalance: 0.00,
          status: 'Active',
          createdAt: new Date().toISOString(),
          lastTransactionAt: new Date().toISOString()
        });

        // Audit Log
        await writeAuditLog(
          'CreateStudent',
          `students/${studentId}`,
          null,
          studentData,
          `เพิ่มนักเรียนใหม่: ${formattedName} (รหัสประจำตัว: ${formattedNum}, ชั้น: ${formattedRoom})`,
          userSession.userId
        );

        // Increment totalStudents in dashboard summary
        const summaryDocRef = getPublicDoc('settings', 'dashboard_summary');
        await setDoc(summaryDocRef, {
          totalStudents: increment(1)
        }, { merge: true });

        showToast("เพิ่มข้อมูลนักเรียนใหม่เรียบร้อยแล้ว");
      } else {
        // Edit Mode
        if (!editingStudentId) return;
        const studentDocRef = getPublicDoc('students', editingStudentId);

        // Fetch old data for audit trail
        const oldSnap = await getDoc(studentDocRef);
        const oldData = oldSnap.exists() ? oldSnap.data() : null;

        const updatedData = {
          fullName: formattedName,
          classRoom: formattedRoom,
          status,
          updatedAt: new Date().toISOString(),
          ...(status === 'Active' ? { deletedAt: null } : {})
        };

        await updateDoc(studentDocRef, updatedData);

        // Audit Log
        await writeAuditLog(
          'EditStudent',
          `students/${editingStudentId}`,
          oldData,
          { ...oldData, ...updatedData },
          `แก้ไขข้อมูลนักเรียน: ${formattedName} (ชั้น: ${formattedRoom}, สถานะ: ${status})`,
          userSession.userId
        );

        showToast("แก้ไขข้อมูลนักเรียนเรียบร้อยแล้ว");
      }
      setIsFormOpen(false);
    } catch (err: any) {
      console.error(err);
      showToast("เกิดข้อผิดพลาด: " + err.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Soft Delete
  const handleSoftDelete = async () => {
    if (!deleteTarget) return;
    setSubmitting(true);

    try {
      const studentDocRef = getPublicDoc('students', deleteTarget.studentId);
      const oldSnap = await getDoc(studentDocRef);
      const oldData = oldSnap.exists() ? oldSnap.data() : null;

      const updatedData = {
        status: deleteStatus,
        updatedAt: new Date().toISOString(),
        deletedAt: new Date().toISOString()
      };

      await updateDoc(studentDocRef, updatedData);

      // Audit Log
      await writeAuditLog(
        'EditStudent',
        `students/${deleteTarget.studentId}`,
        oldData,
        { ...oldData, ...updatedData },
        `ลบนักเรียนแบบ Soft Delete: ${deleteTarget.fullName} (เปลี่ยนสถานะเป็น ${deleteStatus})`,
        userSession.userId
      );

      // Decrement totalStudents in dashboard summary
      const summaryDocRef = getPublicDoc('settings', 'dashboard_summary');
      await setDoc(summaryDocRef, {
        totalStudents: increment(-1)
      }, { merge: true });

      showToast(`เปลี่ยนสถานะนักเรียนเป็น ${deleteStatus} เรียบร้อยแล้ว`);
      setDeleteTarget(null);
    } catch (err: any) {
      console.error(err);
      showToast("เกิดข้อผิดพลาดในการเปลี่ยนสถานะ: " + err.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Get distinct classes for classroom filter dropdown
  const classList = ['All', ...Array.from(new Set(students.map(s => s.classRoom)))];

  // Filtering Logic (Client side, real-time)
  const filteredStudents = students.filter(student => {
    const matchesSearch = student.fullName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          student.studentNumber.includes(searchQuery) ||
                          student.studentId.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesClass = classFilter === 'All' || student.classRoom === classFilter;
    const matchesHideInactive = !hideInactive || student.status === 'Active';

    return matchesSearch && matchesClass && matchesHideInactive;
  });

  if (viewingLedgerStudent) {
    return (
      <StudentLedgerView
        student={viewingLedgerStudent}
        account={accounts[viewingLedgerStudent.studentId]}
        onBack={() => setViewingLedgerStudent(null)}
        showToast={showToast}
        userSession={userSession}
      />
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header section */}
      <div className="flex justify-between items-end flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <Users className="w-7 h-7 text-emerald-400" />
            จัดการข้อมูลนักเรียน (Students)
          </h2>
          <p className="text-sm text-slate-400 mt-1">ทะเบียนประวัตินักเรียนและสถานะบัญชีเงินฝากในระบบ</p>
        </div>
        <button 
          onClick={handleOpenAdd}
          className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 shadow-lg shadow-emerald-950/20 active:scale-95 cursor-pointer animate-fadeIn"
        >
          <UserPlus className="w-4 h-4" /> เพิ่มนักเรียนใหม่
        </button>
      </div>

      {/* Filters and Search Bar section */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input 
            type="text" 
            placeholder="ค้นหาด้วย ชื่อ, รหัสนักเรียน หรือ ID..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950/80 border border-slate-700/60 rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-200 focus:outline-none focus:border-emerald-500 transition-colors focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 w-full md:w-auto justify-end flex-wrap">
          {/* Class Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500" />
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="bg-slate-950/80 border border-slate-700/60 text-slate-200 rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              {classList.map(cls => (
                <option key={cls} value={cls}>{cls === 'All' ? 'ทุกระดับชั้น' : `ชั้น ${cls}`}</option>
              ))}
            </select>
          </div>

          {/* Hide Inactive Toggle */}
          <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-400 hover:text-slate-200">
            <input 
              type="checkbox" 
              checked={hideInactive} 
              onChange={(e) => setHideInactive(e.target.checked)}
              className="rounded border-slate-700 bg-slate-950/80 text-emerald-600 focus:ring-0 focus:ring-offset-0 cursor-pointer w-4 h-4"
            />
            ซ่อนสถานะ Inactive
          </label>
        </div>
      </div>

      {/* Main Table section */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="p-8">
            <TableSkeleton />
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="p-20 text-center text-slate-500 space-y-2">
            <p className="text-lg font-medium">ไม่พบข้อมูลนักเรียน</p>
            <p className="text-xs text-slate-600">กรุณาลองเปลี่ยนคำค้นหา หรือกรองระดับชั้นใหม่</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-950/40 text-slate-400 text-xs uppercase border-b border-slate-800">
                <tr>
                  <th className="px-6 py-4 font-medium">ID ระบบ</th>
                  <th className="px-6 py-4 font-medium">รหัสประจำตัว</th>
                  <th className="px-6 py-4 font-medium">ชื่อ-นามสกุล</th>
                  <th className="px-6 py-4 font-medium">ชั้นเรียน</th>
                  <th className="px-6 py-4 font-medium">เลขที่บัญชี</th>
                  <th className="px-6 py-4 font-medium text-right">ยอดเงินคงเหลือ</th>
                  <th className="px-6 py-4 font-medium">สถานะ</th>
                  <th className="px-6 py-4 font-medium">วันที่ลงทะเบียน</th>
                  <th className="px-6 py-4 font-medium text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {filteredStudents.map((student) => {
                  const account = accounts[student.studentId];
                  return (
                    <tr key={student.studentId} className="hover:bg-slate-800/20 transition-colors">
                      <td className="px-6 py-4 text-slate-400 font-mono text-xs">{student.studentId}</td>
                      <td className="px-6 py-4 font-mono font-semibold text-slate-300">{student.studentNumber}</td>
                      <td className="px-6 py-4 font-bold text-white">{student.fullName}</td>
                      <td className="px-6 py-4 text-slate-300">{student.classRoom}</td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-300">
                        {account ? account.accountNumber : (
                          <span className="text-slate-600 italic">ไม่มีบัญชี</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-bold text-emerald-400">
                        {account ? `฿${account.currentBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '฿0.00'}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          student.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                          student.status === 'Inactive' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                          student.status === 'Graduated' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                          'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        }`}>
                          {student.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-500 text-xs">
                        {new Date(student.createdAt).toLocaleDateString('th-TH', {
                          year: 'numeric', month: 'short', day: 'numeric',
                          hour: '2-digit', minute: '2-digit'
                        })}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button 
                            onClick={() => setViewingLedgerStudent(student)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-slate-800 transition-all cursor-pointer"
                            title="ดูสมุดบัญชี (Statement)"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleOpenEdit(student)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-slate-800 transition-all cursor-pointer"
                            title="แก้ไขข้อมูล"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => setDeleteTarget(student)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-all cursor-pointer"
                            title="ลบข้อมูล (Soft Delete)"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal - Add / Edit Student */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-scaleUp">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/20">
              <h3 className="font-bold text-white text-lg">
                {formMode === 'create' ? 'เพิ่มข้อมูลนักเรียนใหม่' : 'แก้ไขข้อมูลนักเรียน'}
              </h3>
              <button onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit}>
              <div className="p-6 space-y-4">
                {/* Student Number */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400 uppercase">รหัสประจำตัวนักเรียน</label>
                  <input
                    type="text"
                    required
                    placeholder="เช่น 10245"
                    disabled={formMode === 'edit' || submitting}
                    value={studentNumber}
                    onChange={(e) => setStudentNumber(e.target.value)}
                    className="w-full bg-slate-950/80 border border-slate-700/60 rounded-xl py-2.5 px-3.5 text-sm text-white placeholder-slate-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
                  />
                </div>

                {/* Full Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400 uppercase">ชื่อ - นามสกุล</label>
                  <input
                    type="text"
                    required
                    placeholder="เช่น เด็กชายสมชาย ใจดี"
                    disabled={submitting}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full bg-slate-950/80 border border-slate-700/60 rounded-xl py-2.5 px-3.5 text-sm text-white placeholder-slate-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                {/* Classroom */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400 uppercase">ชั้นเรียน / ห้องเรียน</label>
                  <input
                    type="text"
                    required
                    placeholder="เช่น ม.1/2"
                    disabled={submitting}
                    value={classRoom}
                    onChange={(e) => setClassRoom(e.target.value)}
                    className="w-full bg-slate-950/80 border border-slate-700/60 rounded-xl py-2.5 px-3.5 text-sm text-white placeholder-slate-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                {/* Status (Edit only) */}
                {formMode === 'edit' && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-400 uppercase">สถานะนักเรียน</label>
                    <select
                      value={status}
                      disabled={submitting}
                      onChange={(e) => setStatus(e.target.value as StudentStatus)}
                      className="w-full bg-slate-950/80 border border-slate-700/60 text-white rounded-xl py-2.5 px-3.5 text-sm focus:border-emerald-500 focus:outline-none"
                    >
                      <option value="Active" className="bg-slate-900 text-white">Active (ปกติ)</option>
                      <option value="Inactive" className="bg-slate-900 text-white">Inactive (ปิดใช้งาน)</option>
                      <option value="Graduated" className="bg-slate-900 text-white">Graduated (จบการศึกษา)</option>
                      <option value="Transferred" className="bg-slate-900 text-white">Transferred (ย้ายสถานศึกษา)</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Actions Footer */}
              <div className="px-6 py-4 bg-slate-950/30 border-t border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white transition-all bg-slate-800 rounded-lg hover:bg-slate-750 cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-lg text-xs flex items-center justify-center gap-1.5 transition-all shadow-md disabled:opacity-50 cursor-pointer"
                >
                  {submitting && <RefreshCw className="w-3 h-3 animate-spin" />}
                  <span>{formMode === 'create' ? 'เพิ่มนักเรียน' : 'บันทึกการแก้ไข'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal - Soft Delete Confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-scaleUp">
            <div className="p-6 text-center space-y-4">
              <div className="w-12 h-12 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-full flex items-center justify-center mx-auto mb-2 text-xl font-bold">
                ⚠️
              </div>
              <div className="space-y-1">
                <h3 className="font-extrabold text-white text-lg">ต้องการทำ Soft Delete หรือไม่?</h3>
                <p className="text-xs text-slate-400">
                  นักเรียน <strong className="text-white font-bold">"{deleteTarget.fullName}"</strong> จะไม่ถูกลบออกจากฐานข้อมูลถาวร แต่จะเปลี่ยนสถานะบัญชี
                </p>
              </div>

              {/* Status Select for soft delete */}
              <div className="space-y-1.5 text-left max-w-xs mx-auto">
                <label className="text-[10px] font-semibold text-slate-400 uppercase">เลือกสถานะปลายทาง</label>
                <select
                  value={deleteStatus}
                  onChange={(e) => setDeleteStatus(e.target.value as StudentStatus)}
                  className="w-full bg-slate-950/80 border border-slate-700/60 rounded-xl py-2 px-3 text-xs text-white focus:border-emerald-500 focus:outline-none"
                >
                  <option value="Inactive" className="bg-slate-900 text-white">Inactive (ปิดใช้งานชั่วคราว)</option>
                  <option value="Graduated" className="bg-slate-900 text-white">Graduated (จบการศึกษา)</option>
                  <option value="Transferred" className="bg-slate-900 text-white">Transferred (ย้ายสถานศึกษา)</option>
                </select>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-950/30 border-t border-slate-800 flex justify-end gap-3">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white bg-slate-800 rounded-lg hover:bg-slate-750 cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleSoftDelete}
                className="bg-rose-600 hover:bg-rose-500 text-white font-bold px-4 py-2 rounded-lg text-xs flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {submitting && <RefreshCw className="w-3 h-3 animate-spin" />}
                <span>ยืนยันการลบ (Soft Delete)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// STUDENT TRANSACTION HISTORY LEDGER VIEW (PHASE 10)
// ==========================================
function StudentLedgerView({
  student,
  account,
  onBack,
  showToast,
  userSession
}: {
  student: Student;
  account: Account | undefined;
  onBack: () => void;
  showToast: (message: string, type?: string) => void;
  userSession: any;
}) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [monthFilter, setMonthFilter] = useState<string>('All');
  const [yearFilter, setYearFilter] = useState<string>('All');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');

  // Load transactions for this student
  useEffect(() => {
    if (!student) return;
    setLoading(true);

    const txCol = getPublicCollection('transactions');
    const q = query(txCol, where('studentId', '==', student.studentId));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Transaction[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ transactionId: docSnap.id, ...docSnap.data() } as Transaction);
      });
      setTransactions(list);
      setLoading(false);
    }, (error) => {
      console.error("Firestore read error for transactions:", error);
      showToast("ล้มเหลวในการโหลดข้อมูลประวัติธุรกรรม", "error");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [student, showToast]);

  // Extract unique years from transactions for the filter dropdown
  const currentYear = new Date().getFullYear();
  const uniqueYears = Array.from(
    new Set([
      currentYear,
      ...transactions.map((tx) => new Date(tx.createdAt).getFullYear())
    ])
  ).sort((a, b) => b - a);

  // Filter & Sort transactions
  const filteredAndSortedTransactions = transactions
    .filter((tx) => {
      const txDate = new Date(tx.createdAt);
      
      // Filter by month
      if (monthFilter !== 'All') {
        const month = txDate.getMonth().toString();
        if (month !== monthFilter) return false;
      }

      // Filter by year
      if (yearFilter !== 'All') {
        const year = txDate.getFullYear().toString();
        if (year !== yearFilter) return false;
      }

      return true;
    })
    .sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
    });

  // Calculate totals for summary block
  const totalDeposits = filteredAndSortedTransactions
    .filter(tx => tx.transactionType === 'Deposit' && tx.status !== 'Void')
    .reduce((sum, tx) => sum + tx.amount, 0);

  const totalWithdrawals = filteredAndSortedTransactions
    .filter(tx => tx.transactionType === 'Withdrawal' && tx.status !== 'Void')
    .reduce((sum, tx) => sum + tx.amount, 0);

  const handlePrint = () => {
    window.print();
  };

  // Month list helper
  const monthsThai = [
    { value: '0', label: 'มกราคม' },
    { value: '1', label: 'กุมภาพันธ์' },
    { value: '2', label: 'มีนาคม' },
    { value: '3', label: 'เมษายน' },
    { value: '4', label: 'พฤษภาคม' },
    { value: '5', label: 'มิถุนายน' },
    { value: '6', label: 'กรกฎาคม' },
    { value: '7', label: 'สิงหาคม' },
    { value: '8', label: 'กันยายน' },
    { value: '9', label: 'ตุลาคม' },
    { value: '10', label: 'พฤศจิกายน' },
    { value: '11', label: 'ธันวาคม' }
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* CSS Print Styles override */}
      <style>{`
        @media print {
          body, html, main, #__next, .min-h-screen {
            background: white !important;
            color: black !important;
            font-family: 'Sarabun', 'Helvetica Neue', Arial, sans-serif !important;
          }
          aside, header, nav, .no-print, button, select, input {
            display: none !important;
          }
          main {
            padding: 0 !important;
            margin: 0 !important;
            background: white !important;
            color: black !important;
            width: 100% !important;
            max-width: 100% !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            overflow: visible !important;
          }
          .print-header {
            display: block !important;
            margin-bottom: 24px !important;
            border-bottom: 2px solid #000000 !important;
            padding-bottom: 12px !important;
          }
          .print-signature {
            display: flex !important;
            justify-content: space-between !important;
            margin-top: 60px !important;
            padding: 0 40px !important;
            page-break-inside: avoid !important;
          }
          .print-card-grid {
            display: grid !important;
            grid-template-cols: repeat(3, minmax(0, 1fr)) !important;
            gap: 16px !important;
          }
          /* Passbook Ledger layout overrides */
          .ledger-container {
            background: white !important;
            color: black !important;
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
          }
          table {
            border-collapse: collapse !important;
            width: 100% !important;
            margin-top: 16px !important;
          }
          th {
            background-color: #f1f5f9 !important;
            color: #000000 !important;
            border: 1px solid #94a3b8 !important;
            font-weight: bold !important;
            padding: 8px 12px !important;
            text-align: center !important;
            font-size: 11px !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          td {
            border: 1px solid #cbd5e1 !important;
            color: #334155 !important;
            padding: 8px 12px !important;
            font-size: 10px !important;
          }
          .text-emerald-400, .text-emerald-500, .text-emerald-600 {
            color: #047857 !important; /* dark green */
          }
          .text-rose-400, .text-rose-500, .text-rose-600 {
            color: #be123c !important; /* dark red */
          }
          .text-blue-400, .text-blue-500 {
            color: #1e3a8a !important; /* dark blue */
          }
          .text-slate-400, .text-slate-500 {
            color: #475569 !important;
          }
          .text-white {
            color: black !important;
          }
          .bg-slate-900, .bg-slate-950, .bg-slate-800, .bg-slate-950\/40, .bg-gradient-to-r {
            background: transparent !important;
            border-color: #cbd5e1 !important;
            box-shadow: none !important;
          }
        }
      `}</style>

      {/* Screen Header (Hidden on Print) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-semibold cursor-pointer w-fit"
        >
          <ChevronLeft className="w-5 h-5" />
          <span>กลับไปหน้ารายชื่อนักเรียน</span>
        </button>

        <button
          onClick={handlePrint}
          className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-950/20 active:scale-95 cursor-pointer self-end sm:self-auto"
        >
          <Printer className="w-4 h-4" />
          <span>พิมพ์สมุดบัญชี (Print Statement)</span>
        </button>
      </div>

      {/* Print-Only Header (Hidden on Screen) */}
      <div className="hidden print-header text-slate-900">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <h1 className="text-2xl font-extrabold">{userSession.schoolName || "โรงเรียนสาธิตวิทยาคาร"}</h1>
            <p className="text-sm font-semibold text-slate-600">เอกสารแสดงความเคลื่อนไหวทางบัญชีออมทรัพย์นักเรียน (Account Statement)</p>
            <p className="text-xs text-slate-500">ปีการศึกษา {userSession.academicYear || "2569"}</p>
          </div>
          <div className="text-right text-xs text-slate-500 space-y-1">
            <p>วันที่พิมพ์: {new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            <p>เวลา: {new Date().toLocaleTimeString('th-TH')}</p>
            <p>ผู้จัดการระบบ: {userSession.fullName}</p>
          </div>
        </div>
      </div>

      {/* Student Profile Card - Gorgeous on Screen, Clean & B&W on Print */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl ledger-container">
        {/* Card Header (B&W/Gray style on print) */}
        <div className="bg-gradient-to-r from-blue-900/20 to-indigo-900/20 border-b border-slate-800 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 print:bg-none print:border-b-2 print:border-slate-300 print:px-0">
          <div>
            <span className="text-xs font-bold text-blue-400 uppercase tracking-wider print:text-slate-700">ประวัติบัญชีออมทรัพย์</span>
            <h3 className="text-xl font-extrabold text-white mt-0.5 print:text-slate-900">{student.fullName}</h3>
          </div>
          <div className="flex items-center gap-2.5 print:mt-1">
            <span className="text-xs bg-slate-800 text-slate-300 border border-slate-700 px-2.5 py-0.5 rounded-full font-mono print:border-slate-400 print:text-slate-800">
              ID: {student.studentId}
            </span>
            <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${
              student.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 print:border-slate-400 print:text-slate-800' :
              'bg-slate-800 text-slate-400 border-slate-700'
            }`}>
              สถานะนักเรียน: {student.status}
            </span>
          </div>
        </div>

        {/* Profile Info Details */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 print:px-0 print:py-4 print-card-grid">
          {/* Col 1: Student Details */}
          <div className="space-y-3 print:space-y-1">
            <div className="flex justify-between md:block">
              <span className="text-xs font-semibold text-slate-500 uppercase block">เลขประจำตัวนักเรียน</span>
              <span className="text-sm font-bold text-slate-200 mt-0.5 print:text-slate-900 font-mono">{student.studentNumber}</span>
            </div>
            <div className="flex justify-between md:block">
              <span className="text-xs font-semibold text-slate-500 uppercase block">ระดับชั้นเรียน</span>
              <span className="text-sm font-bold text-slate-200 mt-0.5 print:text-slate-900">ชั้น {student.classRoom}</span>
            </div>
          </div>

          {/* Col 2: Account Details */}
          <div className="space-y-3 print:space-y-1">
            <div className="flex justify-between md:block">
              <span className="text-xs font-semibold text-slate-500 uppercase block">เลขที่บัญชีออมทรัพย์</span>
              <span className="text-sm font-bold text-slate-200 mt-0.5 print:text-slate-900 font-mono">
                {account ? account.accountNumber : "ไม่มีข้อมูลบัญชี"}
              </span>
            </div>
            <div className="flex justify-between md:block">
              <span className="text-xs font-semibold text-slate-500 uppercase block">วันเปิดบัญชี</span>
              <span className="text-sm font-bold text-slate-200 mt-0.5 print:text-slate-900">
                {account ? new Date(account.createdAt).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' }) : "-"}
              </span>
            </div>
          </div>

          {/* Col 3: Running Balance Summary */}
          <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-center print:bg-none print:border-none print:p-0">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block print:text-slate-700">ยอดเงินคงเหลือสุทธิ</span>
            <span className="text-3xl font-black text-emerald-400 font-mono mt-1 block print:text-slate-900">
              ฿{account ? account.currentBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}
            </span>
          </div>
        </div>
      </div>

      {/* Filters (Hidden on Print) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 no-print shadow-md">
        <h4 className="font-bold text-white flex items-center gap-2 text-sm shrink-0">
          <Filter className="w-4 h-4 text-blue-400" />
          ตัวกรองข้อมูล (Filters)
        </h4>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
          {/* Month Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium">เดือน:</span>
            <select
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="bg-slate-950/80 border border-slate-700/60 text-slate-200 rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="All">ทุกเดือน</option>
              {monthsThai.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          {/* Year Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium">ปี:</span>
            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className="bg-slate-950/80 border border-slate-700/60 text-slate-200 rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="All">ทุกปี</option>
              {uniqueYears.map((yr) => (
                <option key={yr} value={yr.toString()}>{yr + 543} (ค.ศ. {yr})</option>
              ))}
            </select>
          </div>

          {/* Sort Order */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium">เรียงลำดับ:</span>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as 'newest' | 'oldest')}
              className="bg-slate-950/80 border border-slate-700/60 text-slate-200 rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="newest">ใหม่สุด &rarr; เก่าสุด</option>
              <option value="oldest">เก่าสุด &rarr; ใหม่สุด</option>
            </select>
          </div>

          {/* Clear Filters */}
          {(monthFilter !== 'All' || yearFilter !== 'All' || sortOrder !== 'newest') && (
            <button
              onClick={() => {
                setMonthFilter('All');
                setYearFilter('All');
                setSortOrder('newest');
              }}
              className="text-xs text-slate-400 hover:text-white underline cursor-pointer"
            >
              ล้างค่า
            </button>
          )}
        </div>
      </div>

      {/* Summary statistics bar on screen (Hidden on print) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 no-print">
        <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-4 text-center">
          <span className="text-xs font-semibold text-slate-500 uppercase block">รายการทั้งหมด</span>
          <span className="text-xl font-bold text-white mt-1 block font-mono">
            {filteredAndSortedTransactions.length} รายการ
          </span>
        </div>
        <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-4 text-center">
          <span className="text-xs font-semibold text-slate-500 uppercase block">ยอดฝากรวม (ช่วงเวลาที่กรอง)</span>
          <span className="text-xl font-bold text-emerald-400 mt-1 block font-mono">
            ฿{totalDeposits.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-4 text-center">
          <span className="text-xs font-semibold text-slate-500 uppercase block">ยอดถอนรวม (ช่วงเวลาที่กรอง)</span>
          <span className="text-xl font-bold text-rose-400 mt-1 block font-mono">
            ฿{totalWithdrawals.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-4 text-center">
          <span className="text-xs font-semibold text-slate-500 uppercase block">ยอดต่างฝาก-ถอน</span>
          <span className={`text-xl font-bold mt-1 block font-mono ${
            (totalDeposits - totalWithdrawals) >= 0 ? 'text-emerald-400' : 'text-rose-400'
          }`}>
            ฿{(totalDeposits - totalWithdrawals).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* Ledger Table Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl ledger-container">
        {loading ? (
          <div className="p-12 text-center text-slate-500 space-y-3">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mx-auto" />
            <p className="text-sm font-medium">กำลังโหลดประวัติธุรกรรม...</p>
          </div>
        ) : filteredAndSortedTransactions.length === 0 ? (
          <div className="p-20 text-center text-slate-500 space-y-2">
            <p className="text-lg font-medium">ไม่พบรายการธุรกรรม</p>
            <p className="text-xs text-slate-600 no-print">ไม่มีธุรกรรมตามช่วงเวลาที่กำหนด หรือนักเรียนยังไม่ได้ทำรายการฝาก-ถอน</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm print:text-xs">
              <thead className="bg-slate-950/40 text-slate-400 text-xs uppercase border-b border-slate-800 print:bg-slate-100 print:text-slate-900">
                <tr>
                  <th className="px-6 py-4 font-medium print:py-2">วันเวลาทำรายการ</th>
                  <th className="px-6 py-4 font-medium print:py-2">เลขที่อ้างอิง (Ref No.)</th>
                  <th className="px-6 py-4 font-medium print:py-2">ประเภทรายการ</th>
                  <th className="px-6 py-4 font-medium text-right print:py-2">ฝากเงิน (+)</th>
                  <th className="px-6 py-4 font-medium text-right print:py-2">ถอนเงิน (-)</th>
                  <th className="px-6 py-4 font-medium text-right print:py-2">ยอดคงเหลือ (Running Balance)</th>
                  <th className="px-6 py-4 font-medium print:py-2">หมายเหตุ</th>
                  <th className="px-6 py-4 font-medium text-center print:py-2">สถานะ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40 print:divide-y print:divide-slate-200">
                {filteredAndSortedTransactions.map((tx) => {
                  const isDeposit = tx.transactionType === 'Deposit';
                  const isWithdrawal = tx.transactionType === 'Withdrawal';
                  const isVoid = tx.status === 'Void';
                  
                  return (
                    <tr 
                      key={tx.transactionId} 
                      className={`hover:bg-slate-800/10 transition-colors ${
                        isVoid ? 'opacity-50 line-through bg-slate-950/20 text-slate-500' : ''
                      }`}
                    >
                      {/* Date & Time */}
                      <td className="px-6 py-4 print:py-2 font-mono text-xs text-slate-300 print:text-slate-900">
                        {new Date(tx.createdAt).toLocaleString('th-TH', {
                          year: 'numeric', month: '2-digit', day: '2-digit',
                          hour: '2-digit', minute: '2-digit', second: '2-digit'
                        })}
                      </td>

                      {/* Reference Number */}
                      <td className="px-6 py-4 print:py-2 font-mono text-xs font-semibold text-slate-300 print:text-slate-900">
                        {tx.referenceNumber}
                      </td>

                      {/* Description / Type */}
                      <td className="px-6 py-4 print:py-2 font-semibold">
                        <span className={`print:text-slate-900 ${
                          isVoid ? 'text-slate-500' :
                          isDeposit ? 'text-emerald-400' :
                          isWithdrawal ? 'text-rose-400' : 'text-blue-400'
                        }`}>
                          {isVoid ? 'ยกเลิกรายการ' : 
                           isDeposit ? 'ฝากเงิน' : 
                           isWithdrawal ? 'ถอนเงิน' : tx.transactionType}
                        </span>
                      </td>

                      {/* Deposit Amount */}
                      <td className="px-6 py-4 print:py-2 text-right font-mono font-bold text-emerald-400 print:text-emerald-700">
                        {isDeposit && !isVoid ? `+฿${tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                      </td>

                      {/* Withdrawal Amount */}
                      <td className="px-6 py-4 print:py-2 text-right font-mono font-bold text-rose-400 print:text-rose-700">
                        {isWithdrawal && !isVoid ? `-฿${tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                      </td>

                      {/* Running Balance */}
                      <td className="px-6 py-4 print:py-2 text-right font-mono font-extrabold text-blue-400 print:text-slate-900">
                        ฿{tx.balanceAfter.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* Remark */}
                      <td className="px-6 py-4 print:py-2 text-xs text-slate-400 print:text-slate-600 max-w-[200px] truncate" title={tx.remark || ''}>
                        {tx.remark || '-'}
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4 print:py-2 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          isVoid ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        }`}>
                          {tx.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Print Signature Section (Hidden on Screen, Visible on Print) */}
      <div className="hidden print-signature text-slate-900 text-center text-xs font-semibold">
        <div className="space-y-16">
          <p>ลงชื่อ...................................................... นักเรียนเจ้าของบัญชี</p>
          <p>( {student.fullName} )</p>
        </div>
        <div className="space-y-16">
          <p>ลงชื่อ...................................................... ครูผู้ดูแล / ผู้จัดการระบบ</p>
          <p>( {userSession.fullName} )</p>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// REPORTS MODULE COMPONENT (PHASE 10)
// ==========================================
function ReportsMainContent({ showToast, userSession }: { showToast: (message: string, type?: string) => void; userSession: any }) {
  const [students, setStudents] = useState<Student[]>([]);
  const [allStudentsMap, setAllStudentsMap] = useState<Record<string, Student>>({});
  const [accounts, setAccounts] = useState<Record<string, Account>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  
  // Phase 12 Tab State
  const [reportsTab, setReportsTab] = useState<'individual' | 'daily' | 'classroom'>('individual');

  // Load students in real-time
  useEffect(() => {
    const studentsCol = getPublicCollection('students');
    const unsubscribe = onSnapshot(studentsCol, (snapshot) => {
      const list: Student[] = [];
      const map: Record<string, Student> = {};
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.deletedAt == null) {
          const s = { studentId: docSnap.id, ...data } as Student;
          map[docSnap.id] = s;
          if (data.status === 'Active') {
            list.push(s);
          }
        }
      });
      list.sort((a, b) => a.studentNumber.localeCompare(b.studentNumber, undefined, { numeric: true }));
      setStudents(list);
      setAllStudentsMap(map);
      setLoading(false);
    }, (error) => {
      console.error("Firestore read error:", error);
      showToast("ล้มเหลวในการโหลดรายชื่อนักเรียนจาก Firestore", "error");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [showToast]);

  // Load accounts in real-time
  useEffect(() => {
    const accountsCol = getPublicCollection('accounts');
    const unsubscribe = onSnapshot(accountsCol, (snapshot) => {
      const map: Record<string, Account> = {};
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data && data.studentId) {
          map[data.studentId] = { ...data, accountId: docSnap.id } as Account;
        }
      });
      setAccounts(map);
    }, (error) => {
      console.error("Firestore accounts read error:", error);
      showToast("ล้มเหลวในการโหลดข้อมูลบัญชีจาก Firestore", "error");
    });

    return () => unsubscribe();
  }, [showToast]);

  // CSV Export Utility
  const handleExportToCSV = (filename: string, headers: string[], rows: any[][]) => {
    try {
      const csvContent = [
        headers.join(','),
        ...rows.map(row => 
          row.map(val => {
            const str = val === null || val === undefined ? '' : String(val);
            const escaped = str.replace(/"/g, '""');
            if (escaped.includes(',') || escaped.includes('"') || escaped.includes('\n')) {
              return `"${escaped}"`;
            }
            return escaped;
          }).join(',')
        )
      ].join('\n');

      // Add UTF-8 BOM (\uFEFF) so Excel displays Thai characters correctly
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast("ส่งออกข้อมูลเป็น CSV สำเร็จ", "success");
    } catch (error) {
      console.error("Export error:", error);
      showToast("ล้มเหลวในการส่งออกข้อมูล", "error");
    }
  };

  const filteredStudents = students.filter(student => {
    return student.fullName.toLowerCase().includes(searchQuery.toLowerCase()) || 
           student.studentNumber.includes(searchQuery) ||
           student.studentId.toLowerCase().includes(searchQuery.toLowerCase());
  });

  if (selectedStudent) {
    return (
      <StudentLedgerView
        student={selectedStudent}
        account={accounts[selectedStudent.studentId]}
        onBack={() => setSelectedStudent(null)}
        showToast={showToast}
        userSession={userSession}
      />
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="no-print">
        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
          <FileText className="w-7 h-7 text-blue-400" />
          ระบบรายงานสรุปผล (Reports Summary Dashboard)
        </h2>
        <p className="text-sm text-slate-400 mt-1">เลือกประเภทรายงานที่ต้องการตรวจสอบ พิมพ์รายงาน และส่งออกข้อมูลเป็นไฟล์ Excel/CSV</p>
      </div>

      {/* Tabs Selector */}
      <div className="flex border-b border-slate-800 gap-2 no-print">
        <button
          onClick={() => setReportsTab('individual')}
          className={`px-5 py-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            reportsTab === 'individual'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <User className="w-4 h-4" />
          สมุดบัญชีรายบุคคล
        </button>
        <button
          onClick={() => setReportsTab('daily')}
          className={`px-5 py-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            reportsTab === 'daily'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Calendar className="w-4 h-4" />
          สรุปธุรกรรมประจำวัน (Drawer)
        </button>
        <button
          onClick={() => setReportsTab('classroom')}
          className={`px-5 py-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            reportsTab === 'classroom'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Building className="w-4 h-4" />
          สรุปยอดออมรายห้องเรียน
        </button>
      </div>

      {/* Tab Contents */}
      {reportsTab === 'individual' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4 no-print">
          <h3 className="text-md font-bold text-white flex items-center gap-2">
            <Search className="w-4 h-4 text-blue-400" />
            ค้นหาและเลือกรายชื่อนักเรียน เพื่อพิมพ์ใบเคลื่อนไหวบัญชี (Statement)
          </h3>
          
          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input 
              type="text" 
              placeholder="พิมพ์ชื่อนักเรียน, รหัสประจำตัว หรือ ID ระบบ..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950/80 border border-slate-700/60 rounded-xl py-3 pl-10 pr-4 text-sm text-slate-200 focus:outline-none focus:border-blue-500 transition-colors focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Students List Grid */}
          {loading ? (
            <div className="p-12 text-center text-slate-500 flex flex-col items-center gap-2">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
              <span className="text-sm">กำลังโหลดรายชื่อนักเรียน...</span>
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <span className="text-sm">ไม่พบนักเรียนตามเงื่อนไขการค้นหา</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[500px] overflow-y-auto p-1">
              {filteredStudents.map((student) => {
                const acc = accounts[student.studentId];
                return (
                  <button
                    key={student.studentId}
                    type="button"
                    onClick={() => setSelectedStudent(student)}
                    className="text-left p-4 rounded-xl border border-slate-800 bg-slate-950/40 hover:bg-slate-800/40 hover:border-slate-700 transition-all flex justify-between items-start cursor-pointer group"
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors">{student.fullName}</p>
                      <p className="text-xs text-slate-500 font-mono">รหัสประจำตัว: {student.studentNumber}</p>
                      <p className="text-xs text-slate-500">ห้องเรียน: ชั้น {student.classRoom}</p>
                      {acc && <p className="text-[10px] text-slate-600 font-mono">เลขบัญชี: {acc.accountNumber}</p>}
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-500 block">ยอดคงเหลือ</span>
                      <span className="text-sm font-extrabold text-emerald-400 font-mono block mt-1">
                        ฿{acc ? acc.currentBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {reportsTab === 'daily' && (
        <DailyReportView
          allStudentsMap={allStudentsMap}
          userSession={userSession}
          onExportCSV={handleExportToCSV}
          showToast={showToast}
        />
      )}

      {reportsTab === 'classroom' && (
        <ClassroomSummaryView
          students={students}
          accounts={accounts}
          userSession={userSession}
          onExportCSV={handleExportToCSV}
        />
      )}
    </div>
  );
}

// ==========================================
// CUSTOM DATE PICKER COMPONENT (POP-UP)
// ==========================================
function DatePicker({
  value,
  onChange
}: {
  value: string;
  onChange: (val: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = React.useRef<HTMLDivElement>(null);

  // Parse current YYYY-MM-DD value
  const currentDate = useMemo(() => {
    const parts = value.split('-');
    if (parts.length === 3) {
      return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    }
    return new Date();
  }, [value]);

  // Keep track of the month/year currently shown in the picker
  const [viewDate, setViewDate] = useState(() => currentDate);

  // Sync viewDate when popover opens or value changes
  useEffect(() => {
    if (isOpen) {
      setViewDate(currentDate);
    }
  }, [isOpen, currentDate]);

  // Handle clicking outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const monthsAbbr = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthsFullThai = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];

  // Format date as "28-Jun-2026"
  const formattedDisplay = useMemo(() => {
    const parts = value.split('-');
    if (parts.length === 3) {
      const year = parts[0];
      const monthIdx = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      if (monthIdx >= 0 && monthIdx < 12) {
        return `${day.toString().padStart(2, '0')}-${monthsAbbr[monthIdx]}-${year}`;
      }
    }
    return value;
  }, [value]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const handlePrevMonth = () => {
    setViewDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(year, month + 1, 1));
  };

  const handleMonthChange = (newMonth: number) => {
    setViewDate(new Date(year, newMonth, 1));
  };

  const handleYearChange = (newYear: number) => {
    setViewDate(new Date(newYear, month, 1));
  };

  // Generate calendar days
  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 = Sunday
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  // Generate years list (current year - 10 to current year + 10)
  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const list = [];
    for (let y = currentYear - 10; y <= currentYear + 10; y++) {
      list.push(y);
    }
    return list;
  }, []);

  const handleSelectDay = (day: number) => {
    const pad = (n: number) => n.toString().padStart(2, '0');
    const selectedDateStr = `${year}-${pad(month + 1)}-${pad(day)}`;
    onChange(selectedDateStr);
    setIsOpen(false);
  };

  const days = [];
  
  // Previous month's overlapping days
  for (let i = firstDayOfMonth - 1; i >= 0; i--) {
    days.push({
      day: daysInPrevMonth - i,
      isCurrentMonth: false,
      isPrevMonth: true
    });
  }

  // Current month's days
  for (let d = 1; d <= daysInMonth; d++) {
    days.push({
      day: d,
      isCurrentMonth: true,
      isPrevMonth: false
    });
  }

  // Next month's overlapping days to fill 42 cells (6 weeks)
  const remaining = 42 - days.length;
  for (let d = 1; d <= remaining; d++) {
    days.push({
      day: d,
      isCurrentMonth: false,
      isPrevMonth: false,
      isNextMonth: true
    });
  }

  return (
    <div className="relative inline-block" ref={popoverRef}>
      {/* Date button styled to match mockup */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between gap-4 bg-slate-950 border border-slate-700/80 rounded-lg px-3.5 py-1.5 text-sm font-bold text-white focus:outline-none focus:border-blue-500 mt-1 cursor-pointer min-w-[190px] text-left hover:border-slate-600 transition-all select-none"
      >
        <span className="text-white text-base tracking-wide font-extrabold">{formattedDisplay}</span>
        <Calendar className="w-4 h-4 text-slate-500 shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-2 w-80 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-4 z-50 animate-scaleUp text-slate-100 font-sans">
          {/* Header Controls: Month & Year Selector */}
          <div className="flex items-center justify-between gap-1 mb-3">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4.5 h-4.5" />
            </button>

            <div className="flex items-center gap-1.5">
              {/* Month Dropdown */}
              <select
                value={month}
                onChange={(e) => handleMonthChange(parseInt(e.target.value))}
                className="bg-slate-950 border border-slate-800 text-xs font-semibold text-slate-200 rounded px-1.5 py-1 focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                {monthsFullThai.map((m, idx) => (
                  <option key={idx} value={idx}>{m}</option>
                ))}
              </select>

              {/* Year Dropdown */}
              <select
                value={year}
                onChange={(e) => handleYearChange(parseInt(e.target.value))}
                className="bg-slate-950 border border-slate-800 text-xs font-semibold text-slate-200 rounded px-1.5 py-1 focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                {years.map((y) => (
                  <option key={y} value={y}>พ.ศ. {y + 543} ({y})</option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4.5 h-4.5" />
            </button>
          </div>

          {/* Weekdays */}
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400 mb-1">
            <span className="text-rose-500">อา</span>
            <span>จ</span>
            <span>อ</span>
            <span>พ</span>
            <span>พฤ</span>
            <span>ศ</span>
            <span>ส</span>
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1">
            {days.map((item, index) => {
              const isSelected = item.isCurrentMonth && 
                currentDate.getDate() === item.day && 
                currentDate.getMonth() === month && 
                currentDate.getFullYear() === year;

              const isToday = item.isCurrentMonth &&
                new Date().getDate() === item.day &&
                new Date().getMonth() === month &&
                new Date().getFullYear() === year;

              let btnClass = "w-9 h-9 flex items-center justify-center text-xs font-semibold rounded-lg transition-colors cursor-pointer ";
              
              if (!item.isCurrentMonth) {
                btnClass += "text-slate-650 hover:bg-slate-800 hover:text-slate-400";
              } else if (isSelected) {
                btnClass += "bg-blue-600 text-white font-extrabold shadow-md shadow-blue-900/30";
              } else if (isToday) {
                btnClass += "border border-blue-500/50 text-blue-400 font-bold hover:bg-slate-800";
              } else {
                btnClass += "text-slate-300 hover:bg-slate-800 hover:text-white";
              }

              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => {
                    if (item.isCurrentMonth) {
                      handleSelectDay(item.day);
                    } else if (item.isPrevMonth) {
                      const prevDate = new Date(year, month - 1, item.day);
                      const pad = (n: number) => n.toString().padStart(2, '0');
                      onChange(`${prevDate.getFullYear()}-${pad(prevDate.getMonth() + 1)}-${pad(item.day)}`);
                      setIsOpen(false);
                    } else if (item.isNextMonth) {
                      const nextDate = new Date(year, month + 1, item.day);
                      const pad = (n: number) => n.toString().padStart(2, '0');
                      onChange(`${nextDate.getFullYear()}-${pad(nextDate.getMonth() + 1)}-${pad(item.day)}`);
                      setIsOpen(false);
                    }
                  }}
                  className={btnClass}
                >
                  {item.day}
                </button>
              );
            })}
          </div>
          
          {/* Quick Select Today */}
          <div className="border-t border-slate-800/80 mt-3 pt-2 flex justify-end">
            <button
              type="button"
              onClick={() => {
                const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
                onChange(todayStr);
                setIsOpen(false);
              }}
              className="text-[11px] font-bold text-blue-400 hover:text-blue-300 px-2 py-1 rounded hover:bg-blue-950/30 cursor-pointer"
            >
              เลือกวันนี้ (Today)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// DAILY TRANSACTION REPORT VIEW (PHASE 12)
// ==========================================
function DailyReportView({
  allStudentsMap,
  userSession,
  onExportCSV,
  showToast
}: {
  allStudentsMap: Record<string, Student>;
  userSession: any;
  onExportCSV: (filename: string, headers: string[], rows: any[][]) => void;
  showToast: (message: string, type?: string) => void;
}) {
  const [reportDate, setReportDate] = useState<string>(() => {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
  });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const startOfDay = new Date(`${reportDate}T00:00:00+07:00`).toISOString();
    const endOfDay = new Date(`${reportDate}T23:59:59.999+07:00`).toISOString();

    const txCol = getPublicCollection('transactions');
    const q = query(
      txCol,
      where('createdAt', '>=', startOfDay),
      where('createdAt', '<=', endOfDay),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Transaction[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ transactionId: docSnap.id, ...docSnap.data() } as Transaction);
      });
      setTransactions(list);
      setLoading(false);
    }, (error) => {
      console.error("Daily transactions read error:", error);
      showToast("ล้มเหลวในการเชื่อมต่อข้อมูลรายการธุรกรรม", "error");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [reportDate, showToast]);

  const activeTx = transactions.filter(tx => tx.status !== 'Void');
  const totalDeposits = activeTx
    .filter(tx => tx.transactionType === 'Deposit')
    .reduce((sum, tx) => sum + tx.amount, 0);

  const totalWithdrawals = activeTx
    .filter(tx => tx.transactionType === 'Withdrawal')
    .reduce((sum, tx) => sum + tx.amount, 0);

  const netCashFlow = totalDeposits - totalWithdrawals;

  const handlePrint = () => {
    window.print();
  };

  const handleExport = () => {
    const headers = [
      'เวลา',
      'เลขที่อ้างอิง',
      'รหัสนักเรียน',
      'ชื่อ-นามสกุล',
      'ห้องเรียน',
      'ประเภทรายการ',
      'จำนวนเงิน (บาท)',
      'สถานะ',
      'ผู้บันทึกรายการ',
      'หมายเหตุ/เหตุผลยกเลิก'
    ];

    const rows = transactions.map(tx => {
      const student = allStudentsMap[tx.studentId];
      const thaiTime = new Date(tx.createdAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
      const typeThai = tx.transactionType === 'Deposit' ? 'ฝากเงิน' : 'ถอนเงิน';
      const statusThai = tx.status === 'Void' ? 'ยกเลิกรายการ' : 'สำเร็จ';
      const remarkText = tx.status === 'Void' ? (tx.voidDetails?.voidRemark || 'ยกเลิก') : (tx.remark || '-');

      return [
        thaiTime,
        tx.referenceNumber,
        student ? student.studentNumber : tx.studentId,
        student ? student.fullName : 'ไม่พบข้อมูลนักเรียน',
        student ? student.classRoom : '-',
        typeThai,
        tx.amount,
        statusThai,
        tx.createdBy,
        remarkText
      ];
    });

    const dateFormatted = reportDate.replace(/-/g, '');
    onExportCSV(`Daily_Report_${dateFormatted}.csv`, headers, rows);
  };

  return (
    <div className="space-y-6">
      <style>{`
        @media print {
          body, html, main, #__next, .min-h-screen {
            background: white !important;
            color: black !important;
            font-family: 'Sarabun', 'Helvetica Neue', Arial, sans-serif !important;
          }
          aside, header, nav, .no-print, button, select, input {
            display: none !important;
          }
          main {
            padding: 0 !important;
            margin: 0 !important;
            background: white !important;
            color: black !important;
            width: 100% !important;
            max-width: 100% !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            overflow: visible !important;
          }
          .print-header-report {
            display: block !important;
            margin-bottom: 24px !important;
            border-bottom: 2px solid #000000 !important;
            padding-bottom: 12px !important;
          }
          .print-cards-grid {
            display: grid !important;
            grid-template-cols: repeat(3, minmax(0, 1fr)) !important;
            gap: 16px !important;
            margin-bottom: 24px !important;
          }
          .print-card-box {
            border: 1px solid #cbd5e1 !important;
            padding: 12px !important;
            border-radius: 8px !important;
            background: #f8fafc !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print-card-title {
            color: #475569 !important;
            font-size: 11px !important;
            font-weight: bold !important;
          }
          .print-card-value {
            color: #0f172a !important;
            font-size: 18px !important;
            font-weight: 800 !important;
            font-family: monospace !important;
            margin-top: 4px !important;
          }
          .print-table {
            border-collapse: collapse !important;
            width: 100% !important;
            margin-top: 16px !important;
          }
          .print-table th {
            background-color: #f1f5f9 !important;
            color: #000000 !important;
            border: 1px solid #94a3b8 !important;
            font-weight: bold !important;
            padding: 6px 8px !important;
            text-align: center !important;
            font-size: 10px !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print-table td {
            border: 1px solid #cbd5e1 !important;
            color: #334155 !important;
            padding: 6px 8px !important;
            font-size: 9px !important;
          }
          .print-text-green {
            color: #047857 !important;
          }
          .print-text-red {
            color: #be123c !important;
          }
          .print-text-blue {
            color: #1e3a8a !important;
          }
          .print-void-row {
            background-color: #f8fafc !important;
            text-decoration: line-through !important;
            color: #94a3b8 !important;
          }
          .print-void-row td {
            color: #94a3b8 !important;
          }
          .print-signature-section {
            display: flex !important;
            justify-content: space-between !important;
            margin-top: 50px !important;
            page-break-inside: avoid !important;
          }
          .print-signature-box {
            text-align: center !important;
            width: 200px !important;
            font-size: 10px !important;
          }
          .print-signature-line {
            border-bottom: 1px dotted #000 !important;
            margin-bottom: 8px !important;
            height: 25px !important;
          }
        }
      `}</style>

      {/* Screen Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg no-print">
        <div className="flex items-center gap-3">
          <div className="bg-blue-500/10 p-2.5 rounded-xl text-blue-400">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">เลือกวันที่เรียกรายงาน</label>
            <DatePicker
              value={reportDate}
              onChange={setReportDate}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            onClick={handlePrint}
            className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
          >
            <Printer className="w-4 h-4 text-slate-300" />
            <span>พิมพ์รายงาน</span>
          </button>
          
          <button
            onClick={handleExport}
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 shadow-md shadow-blue-900/15"
          >
            <Download className="w-4 h-4" />
            <span>ส่งออก Excel/CSV</span>
          </button>
        </div>
      </div>

      {/* Print-Only Header */}
      <div className="hidden print-header-report text-slate-900">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-extrabold">{userSession.schoolName || "โรงเรียนสาธิตวิทยาคาร"}</h1>
            <p className="text-sm font-semibold text-slate-600 mt-0.5">รายงานสรุปการทำรายการฝาก-ถอน ประจำวัน (Daily Transaction & Drawer Reconciliation)</p>
            <p className="text-xs text-slate-500 mt-0.5">ประจำวันที่: {new Date(reportDate).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
          <div className="text-right text-xs text-slate-500 space-y-1">
            <p>วันที่พิมพ์: {new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            <p>เวลา: {new Date().toLocaleTimeString('th-TH')}</p>
            <p>ผู้จัดการระบบ: {userSession.fullName}</p>
          </div>
        </div>
      </div>

      {/* Summary Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 print-cards-grid">
        {/* Deposits Summary */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-md flex items-center gap-4 print-card-box">
          <div className="bg-emerald-500/10 p-3 rounded-2xl text-emerald-400 no-print">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block print-card-title">ยอดเงินฝากรวม (Total Deposits)</span>
            <span className="text-2xl font-black text-emerald-400 font-mono mt-1 block print-text-green print-card-value">
              ฿{totalDeposits.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Withdrawals Summary */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-md flex items-center gap-4 print-card-box">
          <div className="bg-rose-500/10 p-3 rounded-2xl text-rose-400 no-print">
            <TrendingDown className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block print-card-title">ยอดเงินถอนรวม (Total Withdrawals)</span>
            <span className="text-2xl font-black text-rose-400 font-mono mt-1 block print-text-red print-card-value">
              ฿{totalWithdrawals.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Net Cash Flow (Reconciliation) */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-md flex items-center gap-4 print-card-box">
          <div className="bg-blue-500/10 p-3 rounded-2xl text-blue-400 no-print">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block print-card-title">ยอดเงินสดสุทธิในลิ้นชัก (Net Cash Flow)</span>
            <span className={`text-2xl font-black font-mono mt-1 block print-card-value ${netCashFlow >= 0 ? 'text-blue-400 print-text-blue' : 'text-rose-400 print-text-red'}`}>
              {netCashFlow >= 0 ? '+' : ''}฿{netCashFlow.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      {/* Informative tips box */}
      <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-4 text-xs text-slate-400 space-y-1 no-print">
        <p className="font-bold text-slate-300 flex items-center gap-1.5">
          <AlertCircle className="w-4 h-4 text-blue-400" />
          คำแนะนำสำหรับการตรวจสอบยอดเงินสด (Cash drawer check):
        </p>
        <p>• ยอดเงินฝากเพิ่มเงินสดเข้ากระปุก/ลิ้นชัก ยอดเงินถอนนำเงินสดออกจากลิ้นชัก</p>
        <p>• ยอดเงินสดสุทธิในลิ้นชักวันนี้ควรเพิ่มขึ้น/ลดลงตรงกับยอดเงินสดสุทธิ (Net Cash Flow) ข้างต้น</p>
        <p>• รายการที่ถูกยกเลิก (Void) จะแสดงอยู่ในตารางสำหรับเก็บประวัติการตรวจสอบ แต่ยอดเงินจะถูกหักออกไม่นำมารวมในสรุปยอดเงินสด</p>
      </div>

      {/* Transactions Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center no-print">
          <h3 className="text-sm font-bold text-white">รายละเอียดรายการธุรกรรมประจำวัน ({transactions.length} รายการ)</h3>
        </div>

        {loading ? (
          <div className="p-16 text-center text-slate-500 flex flex-col items-center gap-2">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
            <span className="text-sm">กำลังค้นหาข้อมูลธุรกรรม...</span>
          </div>
        ) : transactions.length === 0 ? (
          <div className="p-16 text-center text-slate-500">
            <Calendar className="w-12 h-12 text-slate-700 mx-auto mb-3" />
            <p className="text-sm font-semibold">ไม่มีข้อมูลการทำรายการในวันที่เลือก</p>
            <p className="text-xs text-slate-600 mt-1">ยังไม่มีคุณครูทำรายการฝากหรือถอนเงินในระบบของวันนี้</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse print-table">
              <thead>
                <tr className="bg-slate-950/40 border-b border-slate-800">
                  <th className="px-6 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider text-center">เวลา</th>
                  <th className="px-6 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">เลขที่อ้างอิง</th>
                  <th className="px-6 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">ชื่อ-นามสกุล</th>
                  <th className="px-6 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider text-center">ชั้นเรียน</th>
                  <th className="px-6 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider text-center">ประเภท</th>
                  <th className="px-6 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">จำนวนเงิน</th>
                  <th className="px-6 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider text-center">สถานะ</th>
                  <th className="px-6 py-3.5 text-xs font-bold text-slate-400 tracking-wider text-center no-print">ครูผู้บันทึก</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {transactions.map((tx) => {
                  const student = allStudentsMap[tx.studentId];
                  const isVoid = tx.status === 'Void';
                  const txTime = new Date(tx.createdAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

                  return (
                    <tr 
                      key={tx.transactionId} 
                      className={`hover:bg-slate-800/10 transition-colors ${isVoid ? 'bg-slate-950/45 text-slate-500 line-through decoration-slate-600 print-void-row' : ''}`}
                    >
                      <td className="px-6 py-3.5 text-xs font-mono text-center">{txTime}</td>
                      <td className="px-6 py-3.5 text-xs font-mono">{tx.referenceNumber}</td>
                      <td className="px-6 py-3.5 text-xs font-bold">
                        {student ? student.fullName : 'ไม่พบข้อมูลนักเรียน'}
                        {student?.deletedAt && <span className="text-[10px] text-rose-400 ml-1.5">(ถูกลบแล้ว)</span>}
                      </td>
                      <td className="px-6 py-3.5 text-xs text-center">{student ? student.classRoom : '-'}</td>
                      <td className="px-6 py-3.5 text-xs text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                          isVoid ? 'bg-slate-800 text-slate-500' :
                          tx.transactionType === 'Deposit' ? 'bg-emerald-500/10 text-emerald-400 print-text-green' : 'bg-rose-500/10 text-rose-400 print-text-red'
                        }`}>
                          {tx.transactionType === 'Deposit' ? 'ฝากเงิน' : 'ถอนเงิน'}
                        </span>
                      </td>
                      <td className={`px-6 py-3.5 text-xs font-bold font-mono text-right ${
                        isVoid ? 'text-slate-500' :
                        tx.transactionType === 'Deposit' ? 'text-emerald-400 print-text-green' : 'text-rose-400 print-text-red'
                      }`}>
                        ฿{tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-3.5 text-xs text-center">
                        <div className="flex flex-col items-center">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-bold ${
                            isVoid ? 'text-rose-400 print-text-red' : 'text-emerald-400 print-text-green'
                          }`}>
                            {isVoid ? (
                              <>
                                <AlertCircle className="w-3 h-3 no-print" />
                                <span>ยกเลิกรายการ</span>
                              </>
                            ) : (
                              <>
                                <CheckCircle className="w-3 h-3 no-print" />
                                <span>สำเร็จ</span>
                              </>
                            )}
                          </span>
                          {isVoid && tx.voidDetails?.voidRemark && (
                            <span className="text-[9px] text-slate-500 mt-0.5 block max-w-[150px] truncate print:max-w-none print:whitespace-normal no-print" title={tx.voidDetails.voidRemark}>
                              ({tx.voidDetails.voidRemark})
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-3.5 text-xs text-center font-mono text-slate-400 no-print">{tx.createdBy}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Print-Only Signature Section */}
      <div className="hidden print-signature-section text-slate-900">
        <div className="print-signature-box">
          <div className="print-signature-line"></div>
          <p className="font-semibold">{userSession.fullName || "เจ้าหน้าที่ดูแลระบบ"}</p>
          <p className="text-slate-500">ผู้บันทึกรายงาน</p>
        </div>
        <div className="print-signature-box">
          <div className="print-signature-line"></div>
          <p className="text-slate-400 font-light">(......................................................)</p>
          <p className="text-slate-500">ครูผู้ตรวจสอบ / หัวหน้าการเงิน</p>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// CLASSROOM SUMMARY REPORT VIEW (PHASE 12)
// ==========================================
function ClassroomSummaryView({
  students,
  accounts,
  userSession,
  onExportCSV
}: {
  students: Student[];
  accounts: Record<string, Account>;
  userSession: any;
  onExportCSV: (filename: string, headers: string[], rows: any[][]) => void;
}) {
  const summariesList = useMemo(() => {
    const map: Record<string, {
      classRoom: string;
      totalStudents: number;
      activeAccountsCount: number;
      totalSavings: number;
    }> = {};

    students.forEach((student) => {
      const room = student.classRoom || 'ไม่ระบุห้อง';
      const acc = accounts[student.studentId];
      const balance = acc ? (acc.currentBalance || 0) : 0;
      const hasAccount = !!acc;

      if (!map[room]) {
        map[room] = {
          classRoom: room,
          totalStudents: 0,
          activeAccountsCount: 0,
          totalSavings: 0
        };
      }

      map[room].totalStudents += 1;
      if (hasAccount) {
        map[room].activeAccountsCount += 1;
        map[room].totalSavings += balance;
      }
    });

    const list = Object.values(map).map((item) => {
      return {
        ...item,
        averageSavings: item.totalStudents > 0 ? item.totalSavings / item.totalStudents : 0
      };
    });

    list.sort((a, b) => b.totalSavings - a.totalSavings);

    return list.map((item, index) => ({
      ...item,
      rank: index + 1
    }));
  }, [students, accounts]);

  const totals = useMemo(() => {
    let totalSavings = 0;
    let totalStudents = 0;
    
    summariesList.forEach(item => {
      totalSavings += item.totalSavings;
      totalStudents += item.totalStudents;
    });

    const topSavingsClass = summariesList.length > 0 ? summariesList[0] : null;
    
    const sortedByAvg = [...summariesList].sort((a, b) => b.averageSavings - a.averageSavings);
    const topAvgClass = sortedByAvg.length > 0 ? sortedByAvg[0] : null;

    return {
      totalSavings,
      totalStudents,
      topSavingsClassName: topSavingsClass ? topSavingsClass.classRoom : '-',
      topSavingsClassAmount: topSavingsClass ? topSavingsClass.totalSavings : 0,
      topAvgClassName: topAvgClass ? topAvgClass.classRoom : '-',
      topAvgClassAmount: topAvgClass ? topAvgClass.averageSavings : 0
    };
  }, [summariesList]);

  const handlePrint = () => {
    window.print();
  };

  const handleExport = () => {
    const headers = [
      'อันดับ',
      'ระดับชั้น/ห้องเรียน',
      'จำนวนนักเรียนทั้งหมด (คน)',
      'จำนวนบัญชีออมทรัพย์ (บัญชี)',
      'ยอดเงินออมรวม (บาท)',
      'ค่าเฉลี่ยเงินออมต่อคน (บาท)',
      'สัดส่วนการออมของโรงเรียน (%)'
    ];

    const rows = summariesList.map(item => {
      const percentage = totals.totalSavings > 0 ? (item.totalSavings / totals.totalSavings) * 100 : 0;
      return [
        item.rank,
        item.classRoom,
        item.totalStudents,
        item.activeAccountsCount,
        item.totalSavings,
        item.averageSavings.toFixed(2),
        percentage.toFixed(2)
      ];
    });

    onExportCSV('Classroom_Savings_Summary.csv', headers, rows);
  };

  return (
    <div className="space-y-6">
      <style>{`
        @media print {
          body, html, main, #__next, .min-h-screen {
            background: white !important;
            color: black !important;
            font-family: 'Sarabun', 'Helvetica Neue', Arial, sans-serif !important;
          }
          aside, header, nav, .no-print, button, select, input {
            display: none !important;
          }
          main {
            padding: 0 !important;
            margin: 0 !important;
            background: white !important;
            color: black !important;
            width: 100% !important;
            max-width: 100% !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            overflow: visible !important;
          }
          .print-header-report {
            display: block !important;
            margin-bottom: 24px !important;
            border-bottom: 2px solid #000000 !important;
            padding-bottom: 12px !important;
          }
          .print-cards-grid {
            display: grid !important;
            grid-template-cols: repeat(3, minmax(0, 1fr)) !important;
            gap: 16px !important;
            margin-bottom: 24px !important;
          }
          .print-card-box {
            border: 1px solid #cbd5e1 !important;
            padding: 12px !important;
            border-radius: 8px !important;
            background: #f8fafc !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print-card-title {
            color: #475569 !important;
            font-size: 11px !important;
            font-weight: bold !important;
          }
          .print-card-value {
            color: #0f172a !important;
            font-size: 18px !important;
            font-weight: 800 !important;
            font-family: monospace !important;
            margin-top: 4px !important;
          }
          .print-table {
            border-collapse: collapse !important;
            width: 100% !important;
            margin-top: 16px !important;
          }
          .print-table th {
            background-color: #f1f5f9 !important;
            color: #000000 !important;
            border: 1px solid #94a3b8 !important;
            font-weight: bold !important;
            padding: 6px 8px !important;
            text-align: center !important;
            font-size: 10px !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print-table td {
            border: 1px solid #cbd5e1 !important;
            color: #334155 !important;
            padding: 6px 8px !important;
            font-size: 9px !important;
          }
          .print-text-green {
            color: #047857 !important;
          }
          .print-text-blue {
            color: #1e3a8a !important;
          }
          .print-signature-section {
            display: flex !important;
            justify-content: space-between !important;
            margin-top: 50px !important;
            page-break-inside: avoid !important;
          }
          .print-signature-box {
            text-align: center !important;
            width: 200px !important;
            font-size: 10px !important;
          }
          .print-signature-line {
            border-bottom: 1px dotted #000 !important;
            margin-bottom: 8px !important;
            height: 25px !important;
          }
        }
      `}</style>

      {/* Screen Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg no-print">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-500/10 p-2.5 rounded-xl text-indigo-400">
            <Building className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">รายงานสรุปผลชั้นเรียน</span>
            <span className="text-sm font-extrabold text-white mt-1 block">วิเคราะห์ยอดออมสะสมแยกตามห้องเรียน</span>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            onClick={handlePrint}
            className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
          >
            <Printer className="w-4 h-4 text-slate-300" />
            <span>พิมพ์รายงาน</span>
          </button>
          
          <button
            onClick={handleExport}
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 shadow-md shadow-blue-900/15"
          >
            <Download className="w-4 h-4" />
            <span>ส่งออก Excel/CSV</span>
          </button>
        </div>
      </div>

      {/* Print-Only Header */}
      <div className="hidden print-header-report text-slate-900">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-extrabold">{userSession.schoolName || "โรงเรียนสาธิตวิทยาคาร"}</h1>
            <p className="text-sm font-semibold text-slate-600 mt-0.5">รายงานสรุปยอดเงินออมแยกตามระดับชั้น/ห้องเรียน (Classroom Savings Ledger Summary)</p>
            <p className="text-xs text-slate-500 mt-0.5">ปีการศึกษา: {userSession.academicYear || "2569"}</p>
          </div>
          <div className="text-right text-xs text-slate-500 space-y-1">
            <p>วันที่พิมพ์: {new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            <p>เวลา: {new Date().toLocaleTimeString('th-TH')}</p>
            <p>ผู้จัดการระบบ: {userSession.fullName}</p>
          </div>
        </div>
      </div>

      {/* Aggregated Highlights Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 print-cards-grid">
        {/* Total School Savings */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-md flex items-center gap-4 print-card-box">
          <div className="bg-indigo-500/10 p-3 rounded-2xl text-indigo-400 no-print">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block print-card-title">ยอดเงินออมสะสมทั้งโรงเรียน</span>
            <span className="text-2xl font-black text-indigo-400 font-mono mt-1 block print-text-blue print-card-value">
              ฿{totals.totalSavings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Top Savings Classroom */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-md flex items-center gap-4 print-card-box">
          <div className="bg-emerald-500/10 p-3 rounded-2xl text-emerald-400 no-print">
            <Building className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block print-card-title">ห้องเรียนที่ยอดออมสูงสุด</span>
            <span className="text-2xl font-black text-emerald-400 mt-1 block print-text-green print-card-value">
              ชั้น {totals.topSavingsClassName}
            </span>
            <span className="text-[10px] text-slate-500 block font-mono print:hidden">
              (สะสม ฿{totals.topSavingsClassAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })})
            </span>
          </div>
        </div>

        {/* Top Average Savings Classroom */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-md flex items-center gap-4 print-card-box">
          <div className="bg-amber-500/10 p-3 rounded-2xl text-amber-400 no-print">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block print-card-title">ห้องเรียนที่ยอดออมเฉลี่ยสูงสุด</span>
            <span className="text-2xl font-black text-amber-400 mt-1 block print-text-blue print-card-value">
              ชั้น {totals.topAvgClassName}
            </span>
            <span className="text-[10px] text-slate-500 block font-mono print:hidden">
              (เฉลี่ย ฿{totals.topAvgClassAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}/คน)
            </span>
          </div>
        </div>
      </div>

      {/* Classroom Summary Leaderboard Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center no-print">
          <h3 className="text-sm font-bold text-white">ตารางสรุปผลงานและยอดออมรายห้องเรียน ({summariesList.length} ห้องเรียน)</h3>
        </div>

        {summariesList.length === 0 ? (
          <div className="p-16 text-center text-slate-500">
            <Building className="w-12 h-12 text-slate-700 mx-auto mb-3" />
            <p className="text-sm font-semibold">ไม่มีข้อมูลห้องเรียน</p>
            <p className="text-xs text-slate-600 mt-1">กรุณาเพิ่มข้อมูลนักเรียนและระบุห้องเรียนในระบบ</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse print-table">
              <thead>
                <tr className="bg-slate-950/40 border-b border-slate-800">
                  <th className="px-6 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider text-center w-20">อันดับ</th>
                  <th className="px-6 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider">ระดับชั้น/ห้องเรียน</th>
                  <th className="px-6 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider text-center">นักเรียนทั้งหมด (คน)</th>
                  <th className="px-6 py-3.5 text-xs font-bold text-slate-400 uppercase tracking-wider text-center">เปิดบัญชีแล้ว (บัญชี)</th>
                  <th className="px-6 py-3.5 text-xs font-bold text-slate-400 tracking-wider text-right">ยอดออมสะสมรวม</th>
                  <th className="px-6 py-3.5 text-xs font-bold text-slate-400 tracking-wider text-right">ค่าเฉลี่ยต่อคน</th>
                  <th className="px-6 py-3.5 text-xs font-bold text-slate-400 tracking-wider text-right">สัดส่วนการออม</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {summariesList.map((item) => {
                  const percentage = totals.totalSavings > 0 ? (item.totalSavings / totals.totalSavings) * 100 : 0;
                  const isTopRank = item.rank === 1;

                  return (
                    <tr 
                      key={item.classRoom} 
                      className={`hover:bg-slate-800/10 transition-colors ${isTopRank ? 'bg-indigo-900/5' : ''}`}
                    >
                      <td className="px-6 py-3.5 text-xs text-center font-mono font-bold text-slate-300 print:text-black">
                        {isTopRank ? (
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] print:bg-none print:border-none print:text-black">🏆 1</span>
                        ) : (
                          item.rank
                        )}
                      </td>
                      <td className="px-6 py-3.5 text-xs font-bold text-white print:text-black">ชั้น {item.classRoom}</td>
                      <td className="px-6 py-3.5 text-xs text-center font-mono">{item.totalStudents}</td>
                      <td className="px-6 py-3.5 text-xs text-center font-mono text-slate-400 print:text-black">{item.activeAccountsCount}</td>
                      <td className="px-6 py-3.5 text-xs font-bold font-mono text-right text-emerald-400 print:text-black">
                        ฿{item.totalSavings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-3.5 text-xs font-semibold font-mono text-right text-indigo-400 print:text-black">
                        ฿{item.averageSavings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-3.5 text-xs font-semibold font-mono text-right text-slate-400 print:text-black">
                        {percentage.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Print-Only Signature Section */}
      <div className="hidden print-signature-section text-slate-900">
        <div className="print-signature-box">
          <div className="print-signature-line"></div>
          <p className="font-semibold">{userSession.fullName || "เจ้าหน้าที่ดูแลระบบ"}</p>
          <p className="text-slate-500">ผู้รายงาน</p>
        </div>
        <div className="print-signature-box">
          <div className="print-signature-line"></div>
          <p className="text-slate-400 font-light">(......................................................)</p>
          <p className="text-slate-500">ผู้อำนวยการ / ผู้บริหารโรงเรียน</p>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// DEPOSIT MODULE COMPONENT (PHASE 8)
// ==========================================
interface DepositMainContentProps {
  showToast: (message: string, type?: string) => void;
  userSession: any;
}

function DepositMainContent({ showToast, userSession }: DepositMainContentProps) {
  const [students, setStudents] = useState<Student[]>([]);
  const [accounts, setAccounts] = useState<Record<string, Account>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Selected Student & Deposit Amount
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [amount, setAmount] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Modals state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Completed transaction for receipt
  const [currentTx, setCurrentTx] = useState<any | null>(null);

  // Load students in real-time
  useEffect(() => {
    const studentsCol = getPublicCollection('students');
    const unsubscribe = onSnapshot(studentsCol, (snapshot) => {
      const list: Student[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        // Only load active students
        if (data.status === 'Active') {
          list.push({ studentId: doc.id, ...data } as Student);
        }
      });
      list.sort((a, b) => a.studentNumber.localeCompare(b.studentNumber, undefined, { numeric: true }));
      setStudents(list);
      setLoading(false);
    }, (error) => {
      console.error("Firestore read error:", error);
      showToast("ล้มเหลวในการโหลดรายชื่อนักเรียนจาก Firestore", "error");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [showToast]);

  // Load accounts in real-time
  useEffect(() => {
    const accountsCol = getPublicCollection('accounts');
    const unsubscribe = onSnapshot(accountsCol, (snapshot) => {
      const map: Record<string, Account> = {};
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data && data.studentId) {
          map[data.studentId] = { ...data, accountId: doc.id } as Account;
        }
      });
      setAccounts(map);
    }, (error) => {
      console.error("Firestore accounts read error:", error);
      showToast("ล้มเหลวในการโหลดข้อมูลบัญชีจาก Firestore", "error");
    });

    return () => unsubscribe();
  }, [showToast]);

  // Validation function
  const validateAmount = (val: string): boolean => {
    setValidationError(null);
    if (!val) {
      setValidationError("กรุณาระบุจำนวนเงิน");
      return false;
    }
    const num = Number(val);
    if (isNaN(num)) {
      setValidationError("จำนวนเงินต้องเป็นตัวเลขเท่านั้น");
      return false;
    }
    if (num <= 0) {
      setValidationError("จำนวนเงินต้องมากกว่า 0 บาท");
      return false;
    }
    // Check decimal places (max 2)
    const decimalMatch = val.match(/^\d+(\.\d{1,2})?$/);
    if (!decimalMatch) {
      setValidationError("จำนวนเงินทศนิยมต้องไม่เกิน 2 ตำแหน่ง");
      return false;
    }
    return true;
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    // Allow empty string, float numbers, dots
    setAmount(val);
    if (val === '') {
      setValidationError(null);
    } else {
      validateAmount(val);
    }
  };

  const handleOpenConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) {
      showToast("กรุณาเลือกนักเรียน", "error");
      return;
    }
    if (!validateAmount(amount)) {
      showToast(validationError || "ข้อมูลไม่ถูกต้อง", "error");
      return;
    }
    
    // Check account status
    const account = accounts[selectedStudent.studentId];
    if (!account) {
      showToast("ไม่พบข้อมูลบัญชีเงินออมสำหรับนักเรียนท่านนี้", "error");
      return;
    }
    if (account.status !== 'Active') {
      showToast("บัญชีของนักเรียนถูกระงับชั่วคราว ไม่สามารถรับฝากเงินได้", "error");
      return;
    }

    setShowConfirmModal(true);
  };

  const handleConfirmTransaction = async () => {
    if (!selectedStudent || submitting) return;
    const account = accounts[selectedStudent.studentId];
    if (!account) return;

    setSubmitting(true);
    const depositAmount = parseFloat(amount);
    const currentYear = new Date().getFullYear();

    try {
      // Run atomic transaction
      const transactionResult = await runTransaction(db, async (transaction) => {
        // Prepare document references
        const accountDocRef = getPublicDoc('accounts', selectedStudent.studentId);
        const counterDocRef = getPublicDoc('counter', currentYear.toString());
        const summaryDocRef = getPublicDoc('settings', 'dashboard_summary');

        // 1. Execute all reads before any writes (Firestore requirement)
        const freshAccountSnap = await transaction.get(accountDocRef);
        const counterSnap = await transaction.get(counterDocRef);
        const freshSummarySnap = await transaction.get(summaryDocRef);

        if (!freshAccountSnap.exists()) {
          throw new Error("ไม่พบข้อมูลบัญชีเงินออมในระบบขณะทำธุรกรรม");
        }
        
        const freshAccountData = freshAccountSnap.data() as Account;
        if (freshAccountData.status !== 'Active') {
          throw new Error("บัญชีไม่ได้อยู่ในสถานะพร้อมใช้งาน (Suspended)");
        }

        const freshBalanceBefore = Number(freshAccountData.currentBalance || 0);
        const freshBalanceAfter = freshBalanceBefore + depositAmount;

        let newSeq = 1;
        if (counterSnap.exists()) {
          const counterData = counterSnap.data();
          newSeq = (counterData.lastSequenceNumber || 0) + 1;
        }

        // 2. Write operations
        // Write YearCounter update
        transaction.set(counterDocRef, {
          year: currentYear,
          lastSequenceNumber: newSeq
        }, { merge: true });

        // Update Student's Account Balance
        transaction.update(accountDocRef, {
          currentBalance: freshBalanceAfter,
          lastTransactionAt: new Date().toISOString()
        });

        // 2.5 Update Dashboard Summary atomically
        
        const todayStr = getLocalDateString();
        
        let totalSavings = depositAmount;
        let todayDeposits = depositAmount;
        let todayWithdrawals = 0;
        let dailyStats: Record<string, { deposits: number; withdrawals: number }> = {};
        
        if (freshSummarySnap.exists()) {
          const sData = freshSummarySnap.data();
          totalSavings = (sData.totalSavings || 0) + depositAmount;
          dailyStats = sData.dailyStats || {};
          
          if (sData.currentDate === todayStr) {
            todayDeposits = (sData.todayDeposits || 0) + depositAmount;
            todayWithdrawals = sData.todayWithdrawals || 0;
          } else {
            // Rollover: shift old today values into dailyStats before resetting
            if (sData.currentDate) {
              dailyStats[sData.currentDate] = {
                deposits: sData.todayDeposits || 0,
                withdrawals: sData.todayWithdrawals || 0
              };
            }
            todayDeposits = depositAmount;
            todayWithdrawals = 0;
          }
        }
        
        // Update dailyStats for today too
        dailyStats[todayStr] = {
          deposits: todayDeposits,
          withdrawals: todayWithdrawals
        };
        
        // Clean up dailyStats to keep last 10 days
        const sortedKeys = Object.keys(dailyStats).sort();
        if (sortedKeys.length > 10) {
          const keysToDelete = sortedKeys.slice(0, sortedKeys.length - 10);
          keysToDelete.forEach(k => delete dailyStats[k]);
        }
        
        transaction.set(summaryDocRef, {
          totalSavings,
          todayDeposits,
          todayWithdrawals,
          dailyStats,
          currentDate: todayStr,
          lastUpdated: new Date().toISOString()
        }, { merge: true });

        // 3. Create Transaction Document
        const txCol = getPublicCollection('transactions');
        // Let's create an auto ID reference
        const txDocRef = doc(txCol); 
        
        // Pattern: DEP + Year + 6 digit padded seq (e.g. DEP2026000001)
        const refNo = `DEP${currentYear}${newSeq.toString().padStart(6, '0')}`;
        
        const newTransaction: Transaction = {
          transactionId: txDocRef.id,
          referenceNumber: refNo,
          studentId: selectedStudent.studentId,
          accountId: account.accountId,
          transactionType: 'Deposit',
          amount: depositAmount,
          balanceBefore: freshBalanceBefore,
          balanceAfter: freshBalanceAfter,
          createdAt: new Date().toISOString(),
          createdBy: userSession.userId,
          remark: `ฝากเงินเข้าบัญชี ${account.accountNumber}`,
          status: 'Completed',
          voidDetails: {
            voidedBy: null,
            voidedAt: null,
            voidRemark: null,
            reversalReferenceNumber: null
          }
        };

        transaction.set(txDocRef, newTransaction);

        // 4. Create Audit Log
        const logsCol = getPublicCollection('audit_logs');
        const logDocRef = doc(logsCol);
        const newAudit = {
          logId: logDocRef.id,
          timestamp: new Date().toISOString(),
          userId: userSession.userId,
          actionType: 'Deposit',
          targetDocument: `transactions/${txDocRef.id}`,
          oldValue: null,
          newValue: newTransaction,
          remarks: `ครู ${userSession.fullName} ทำรายการฝากเงิน ฿${depositAmount.toLocaleString(undefined, {minimumFractionDigits: 2})} ให้กับ ${selectedStudent.fullName} (Ref: ${refNo})`,
          deviceInfo: typeof window !== 'undefined' ? navigator.userAgent : 'Unknown'
        };

        transaction.set(logDocRef, newAudit);

        return newTransaction;
      });

      // Clear form inputs
      setAmount('');
      setSelectedStudent(null);
      setValidationError(null);
      setShowConfirmModal(false);

      // Open Success receipt modal
      setCurrentTx(transactionResult);
      setShowReceiptModal(true);
      showToast("บันทึกธุรกรรมการฝากเงินสำเร็จ");

    } catch (err: any) {
      console.error("Transaction failed: ", err);
      showToast("ธุรกรรมล้มเหลว: " + err.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Filter students based on search query
  const filteredStudents = students.filter(student => {
    const matchesSearch = student.fullName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          student.studentNumber.includes(searchQuery) ||
                          student.studentId.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const selectedAccount = selectedStudent ? accounts[selectedStudent.studentId] : null;

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fadeIn">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
          <ArrowDownToLine className="w-7 h-7 text-emerald-400" />
          ทำรายการฝากเงิน (Deposit)
        </h2>
        <p className="text-sm text-slate-400 mt-1">ทำรายการฝากเงินเข้าบัญชีออมทรัพย์ของนักเรียนอย่างปลอดภัย</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Left/Middle Column: Search and Select Student */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <h3 className="text-md font-bold text-white flex items-center gap-2">
              <Search className="w-4 h-4 text-emerald-400" />
              1. ค้นหาและเลือกรายชื่อนักเรียน
            </h3>
            
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input 
                type="text" 
                placeholder="พิมพ์ชื่อนักเรียน, รหัสประจำตัว หรือ ID ระบบ..." 
                value={searchQuery}
                disabled={submitting}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-700/60 rounded-xl py-3 pl-10 pr-4 text-sm text-slate-200 focus:outline-none focus:border-emerald-500 transition-colors focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
              />
            </div>

            {/* Students List Box */}
            <div className="border border-slate-800 bg-slate-950/50 rounded-xl overflow-hidden max-h-[350px] overflow-y-auto divide-y divide-slate-850">
              {loading ? (
                <div className="p-8 text-center text-slate-500 flex flex-col items-center gap-2">
                  <RefreshCw className="w-6 h-6 animate-spin text-emerald-500" />
                  <span className="text-xs">กำลังโหลดรายชื่อนักเรียน...</span>
                </div>
              ) : filteredStudents.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  <span className="text-sm">ไม่พบนักเรียนตามเงื่อนไขการค้นหา</span>
                </div>
              ) : (
                filteredStudents.map((student) => {
                  const isSelected = selectedStudent?.studentId === student.studentId;
                  const acc = accounts[student.studentId];
                  return (
                    <button
                      key={student.studentId}
                      type="button"
                      disabled={submitting}
                      onClick={() => {
                        setSelectedStudent(student);
                        setValidationError(null);
                      }}
                      className={`w-full text-left px-5 py-3.5 transition-all flex items-center justify-between hover:bg-slate-800/30 ${
                        isSelected ? 'bg-emerald-500/10 hover:bg-emerald-500/15 border-l-4 border-emerald-500' : ''
                      }`}
                    >
                      <div>
                        <p className="text-sm font-bold text-white">{student.fullName}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-slate-400 font-mono">
                          <span>เลขประจำตัว: {student.studentNumber}</span>
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-700"></span>
                          <span>ห้อง: {student.classRoom}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-500">ยอดเงินคงเหลือ</p>
                        <p className="text-sm font-bold text-emerald-400 font-mono">
                          ฿{acc ? acc.currentBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                        </p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Transaction Form */}
        <div className="space-y-6">
          
          {/* Student Profile Card (if selected) */}
          {selectedStudent ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl animate-scaleUp">
              <div className="bg-emerald-600/10 border-b border-emerald-500/20 px-6 py-4 flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">บัญชีที่เลือก</span>
                <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30">Active</span>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase">ชื่อ-นามสกุล</h4>
                  <p className="text-lg font-bold text-white mt-0.5">{selectedStudent.fullName}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-xs font-semibold text-slate-500 uppercase">ชั้นเรียน</h4>
                    <p className="text-sm font-semibold text-slate-200 mt-0.5">ชั้น {selectedStudent.classRoom}</p>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-slate-500 uppercase">เลขบัญชีออมทรัพย์</h4>
                    <p className="text-sm font-semibold text-slate-200 mt-0.5 font-mono">
                      {selectedAccount ? selectedAccount.accountNumber : 'ไม่มีบัญชี'}
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800">
                  <h4 className="text-xs font-semibold text-slate-500 uppercase">ยอดเงินปัจจุบัน</h4>
                  <p className="text-2xl font-extrabold text-emerald-400 font-mono mt-1">
                    ฿{selectedAccount ? selectedAccount.currentBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center text-slate-500 space-y-2 py-12 shadow-xl">
              <span className="text-4xl block">👤</span>
              <p className="text-sm font-medium text-slate-400">กรุณาเลือกนักเรียนทางซ้ายมือ</p>
              <p className="text-xs text-slate-600">เพื่อเริ่มกรอกยอดทำรายการฝากเงิน</p>
            </div>
          )}

          {/* Form */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <h3 className="text-md font-bold text-white flex items-center gap-2">
              💵
              2. ระบุจำนวนเงินฝาก
            </h3>
            
            <form onSubmit={handleOpenConfirm} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase">จำนวนเงิน (บาท)</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500 font-bold text-sm">฿</span>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    disabled={!selectedStudent || submitting}
                    value={amount}
                    onChange={handleAmountChange}
                    className="w-full bg-slate-950/80 border border-slate-700/60 rounded-xl py-3 pl-8 pr-4 text-white text-lg font-bold font-mono placeholder-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
                {validationError && (
                  <p className="text-xs text-rose-400 font-semibold flex items-center gap-1.5 mt-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    {validationError}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={!selectedStudent || submitting || !!validationError || !amount}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-emerald-950/20 active:scale-95 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
              >
                <span>ทำรายการฝากเงิน</span>
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && selectedStudent && selectedAccount && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-scaleUp">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/20">
              <h3 className="font-bold text-white text-lg flex items-center gap-2">
                <span>⚠️ ตรวจสอบรายละเอียดการฝากเงิน</span>
              </h3>
              <button 
                onClick={() => !submitting && setShowConfirmModal(false)} 
                disabled={submitting}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Details */}
            <div className="p-6 space-y-4">
              <div className="p-4 bg-slate-950/40 rounded-xl space-y-3 border border-slate-850">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">นักเรียน</span>
                  <span className="text-white font-bold">{selectedStudent.fullName}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">รหัสประจำตัว</span>
                  <span className="text-slate-300 font-mono">{selectedStudent.studentNumber}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">เลขบัญชี</span>
                  <span className="text-slate-300 font-mono">{selectedAccount.accountNumber}</span>
                </div>
              </div>

              {/* Balance computations */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs py-1.5 px-1">
                  <span className="text-slate-400">ยอดเงินก่อนฝาก</span>
                  <span className="text-slate-300 font-mono">
                    ฿{selectedAccount.currentBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm py-2 px-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                  <span className="text-emerald-400 font-bold">จำนวนเงินที่ฝาก</span>
                  <span className="text-emerald-400 font-extrabold font-mono text-base">
                    + ฿{parseFloat(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm py-1.5 px-1 font-bold border-t border-slate-800 pt-3">
                  <span className="text-white">ยอดเงินหลังฝาก</span>
                  <span className="text-white font-mono text-base">
                    ฿{(selectedAccount.currentBalance + parseFloat(amount)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {submitting && (
                <div className="text-center p-3 bg-slate-950/20 rounded-xl flex items-center justify-center gap-2 border border-slate-850">
                  <RefreshCw className="w-4 h-4 text-emerald-500 animate-spin" />
                  <span className="text-xs text-slate-400 font-semibold">ระบบกำลังประมวลผลธุรกรรมทางการเงินอย่างปลอดภัย...</span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="px-6 py-4 bg-slate-950/30 border-t border-slate-800 flex justify-end gap-3">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white bg-slate-800 rounded-lg hover:bg-slate-750 cursor-pointer disabled:opacity-50"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleConfirmTransaction}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-5 py-2.5 rounded-lg text-xs flex items-center justify-center gap-1.5 transition-all shadow-md disabled:opacity-50 cursor-pointer"
              >
                {submitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>ยืนยันทำรายการฝากเงิน</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Receipt Modal */}
      {showReceiptModal && currentTx && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-scaleUp">
            {/* Header Status */}
            <div className="bg-emerald-600/10 border-b border-emerald-500/20 px-6 py-5 text-center relative">
              <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto mb-2 text-xl font-bold">
                ✓
              </div>
              <h3 className="font-extrabold text-white text-base">ทำรายการฝากเงินสำเร็จ</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">ใบเสร็จรับเงินอิเล็กทรอนิกส์</p>
            </div>

            {/* Receipt Body */}
            <div className="p-6 space-y-4">
              
              <div className="text-center pb-2 border-b border-dashed border-slate-850">
                <span className="text-xs text-slate-500 block">จำนวนเงินฝาก</span>
                <span className="text-2xl font-extrabold text-white font-mono block mt-1">
                  ฿{currentTx.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">รหัสอ้างอิง (Ref No.)</span>
                  <span className="text-white font-mono font-semibold">{currentTx.referenceNumber}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">วันเวลาทำรายการ</span>
                  <span className="text-white font-mono">
                    {new Date(currentTx.createdAt).toLocaleString('th-TH', {
                      year: 'numeric', month: 'short', day: 'numeric',
                      hour: '2-digit', minute: '2-digit', second: '2-digit'
                    })}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">ชื่อนักเรียน</span>
                  <span className="text-white font-bold font-sans">
                    {students.find(s => s.studentId === currentTx.studentId)?.fullName || 'นักเรียนในระบบ'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">เลขที่บัญชี</span>
                  <span className="text-white font-mono">{accounts[currentTx.studentId]?.accountNumber || ''}</span>
                </div>
                <div className="flex justify-between items-center border-t border-slate-850 pt-2.5">
                  <span className="text-slate-500">ยอดก่อนฝาก</span>
                  <span className="text-slate-300 font-mono">
                    ฿{currentTx.balanceBefore.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">ยอดคงเหลือสุทธิ</span>
                  <span className="text-emerald-400 font-bold font-mono">
                    ฿{currentTx.balanceAfter.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Audit Badge */}
              <div className="p-2 bg-slate-950/30 rounded-lg text-center border border-slate-850">
                <span className="text-[9px] text-slate-500 font-mono block">บันทึกประวัติความปลอดภัยบน Firestore สมบูรณ์</span>
              </div>
            </div>

            {/* Receipt Actions */}
            <div className="px-6 py-4 bg-slate-950/30 border-t border-slate-805 flex justify-center gap-3">
              <button
                type="button"
                onClick={() => setShowReceiptModal(false)}
                className="w-full bg-slate-800 hover:bg-slate-750 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-all cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// WITHDRAWAL MODULE COMPONENT (PHASE 9)
// ==========================================
interface WithdrawMainContentProps {
  showToast: (message: string, type?: string) => void;
  userSession: any;
}

function WithdrawMainContent({ showToast, userSession }: WithdrawMainContentProps) {
  const [students, setStudents] = useState<Student[]>([]);
  const [accounts, setAccounts] = useState<Record<string, Account>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Selected Student & Withdraw Amount
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [amount, setAmount] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Modals state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Completed transaction for receipt
  const [currentTx, setCurrentTx] = useState<any | null>(null);

  // Load students in real-time
  useEffect(() => {
    const studentsCol = getPublicCollection('students');
    const unsubscribe = onSnapshot(studentsCol, (snapshot) => {
      const list: Student[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        // Only load active students
        if (data.status === 'Active') {
          list.push({ studentId: doc.id, ...data } as Student);
        }
      });
      list.sort((a, b) => a.studentNumber.localeCompare(b.studentNumber, undefined, { numeric: true }));
      setStudents(list);
      setLoading(false);
    }, (error) => {
      console.error("Firestore read error:", error);
      showToast("ล้มเหลวในการโหลดรายชื่อนักเรียนจาก Firestore", "error");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [showToast]);

  // Load accounts in real-time
  useEffect(() => {
    const accountsCol = getPublicCollection('accounts');
    const unsubscribe = onSnapshot(accountsCol, (snapshot) => {
      const map: Record<string, Account> = {};
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data && data.studentId) {
          map[data.studentId] = { ...data, accountId: doc.id } as Account;
        }
      });
      setAccounts(map);
    }, (error) => {
      console.error("Firestore accounts read error:", error);
      showToast("ล้มเหลวในการโหลดข้อมูลบัญชีจาก Firestore", "error");
    });

    return () => unsubscribe();
  }, [showToast]);

  const selectedAccount = selectedStudent ? accounts[selectedStudent.studentId] : null;

  // Validation function
  const validateAmount = (val: string): boolean => {
    setValidationError(null);
    if (!val) {
      setValidationError("กรุณาระบุจำนวนเงิน");
      return false;
    }
    const num = Number(val);
    if (isNaN(num)) {
      setValidationError("จำนวนเงินต้องเป็นตัวเลขเท่านั้น");
      return false;
    }
    if (num <= 0) {
      setValidationError("จำนวนเงินต้องมากกว่า 0 บาท");
      return false;
    }
    // Check decimal places (max 2)
    const decimalMatch = val.match(/^\d+(\.\d{1,2})?$/);
    if (!decimalMatch) {
      setValidationError("จำนวนเงินทศนิยมต้องไม่เกิน 2 ตำแหน่ง");
      return false;
    }
    // Overdraft protection
    const balance = selectedAccount ? selectedAccount.currentBalance : 0;
    if (num > balance) {
      setValidationError(`ยอดเงินคงเหลือไม่เพียงพอสำหรับการถอนเงิน (มียอดคงเหลือ ฿${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`);
      return false;
    }
    return true;
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setAmount(val);
    if (val === '') {
      setValidationError(null);
    } else {
      validateAmount(val);
    }
  };

  const handleOpenConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) {
      showToast("กรุณาเลือกนักเรียน", "error");
      return;
    }
    if (!validateAmount(amount)) {
      showToast(validationError || "ข้อมูลไม่ถูกต้อง", "error");
      return;
    }
    
    // Check account status
    const account = accounts[selectedStudent.studentId];
    if (!account) {
      showToast("ไม่พบข้อมูลบัญชีเงินออมสำหรับนักเรียนท่านนี้", "error");
      return;
    }
    if (account.status !== 'Active') {
      showToast("บัญชีของนักเรียนถูกระงับชั่วคราว ไม่สามารถถอนเงินได้", "error");
      return;
    }

    setShowConfirmModal(true);
  };

  const handleConfirmTransaction = async () => {
    if (!selectedStudent || submitting) return;
    const account = accounts[selectedStudent.studentId];
    if (!account) return;

    setSubmitting(true);
    const withdrawAmount = parseFloat(amount);
    const currentYear = new Date().getFullYear();

    try {
      // Run atomic transaction
      const transactionResult = await runTransaction(db, async (transaction) => {
        // Prepare document references
        const accountDocRef = getPublicDoc('accounts', selectedStudent.studentId);
        const counterDocRef = getPublicDoc('counter', currentYear.toString());
        const summaryDocRef = getPublicDoc('settings', 'dashboard_summary');

        // 1. Execute all reads before any writes (Firestore requirement)
        const freshAccountSnap = await transaction.get(accountDocRef);
        const counterSnap = await transaction.get(counterDocRef);
        const freshSummarySnap = await transaction.get(summaryDocRef);

        if (!freshAccountSnap.exists()) {
          throw new Error("ไม่พบข้อมูลบัญชีเงินออมในระบบขณะทำธุรกรรม");
        }
        
        const freshAccountData = freshAccountSnap.data() as Account;
        if (freshAccountData.status !== 'Active') {
          throw new Error("บัญชีไม่ได้อยู่ในสถานะพร้อมใช้งาน (Suspended)");
        }

        const freshBalanceBefore = Number(freshAccountData.currentBalance || 0);
        // Overdraft protection in transaction
        if (freshBalanceBefore < withdrawAmount) {
          throw new Error(`ยอดเงินคงเหลือไม่เพียงพอ (มียอดคงเหลือ ฿${freshBalanceBefore.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`);
        }

        const freshBalanceAfter = freshBalanceBefore - withdrawAmount;

        let newSeq = 1;
        if (counterSnap.exists()) {
          const counterData = counterSnap.data();
          newSeq = (counterData.lastSequenceNumber || 0) + 1;
        }

        // 2. Write operations
        // Write YearCounter update
        transaction.set(counterDocRef, {
          year: currentYear,
          lastSequenceNumber: newSeq
        }, { merge: true });

        // Update Student's Account Balance
        transaction.update(accountDocRef, {
          currentBalance: freshBalanceAfter,
          lastTransactionAt: new Date().toISOString()
        });

        // 2.5 Update Dashboard Summary atomically
        
        const todayStr = getLocalDateString();
        
        let totalSavings = -withdrawAmount;
        let todayDeposits = 0;
        let todayWithdrawals = withdrawAmount;
        let dailyStats: Record<string, { deposits: number; withdrawals: number }> = {};
        
        if (freshSummarySnap.exists()) {
          const sData = freshSummarySnap.data();
          totalSavings = (sData.totalSavings || 0) - withdrawAmount;
          dailyStats = sData.dailyStats || {};
          
          if (sData.currentDate === todayStr) {
            todayDeposits = sData.todayDeposits || 0;
            todayWithdrawals = (sData.todayWithdrawals || 0) + withdrawAmount;
          } else {
            // Rollover: shift old today values into dailyStats before resetting
            if (sData.currentDate) {
              dailyStats[sData.currentDate] = {
                deposits: sData.todayDeposits || 0,
                withdrawals: sData.todayWithdrawals || 0
              };
            }
            todayDeposits = 0;
            todayWithdrawals = withdrawAmount;
          }
        }
        
        // Update dailyStats for today too
        dailyStats[todayStr] = {
          deposits: todayDeposits,
          withdrawals: todayWithdrawals
        };
        
        // Clean up dailyStats to keep last 10 days
        const sortedKeys = Object.keys(dailyStats).sort();
        if (sortedKeys.length > 10) {
          const keysToDelete = sortedKeys.slice(0, sortedKeys.length - 10);
          keysToDelete.forEach(k => delete dailyStats[k]);
        }
        
        transaction.set(summaryDocRef, {
          totalSavings,
          todayDeposits,
          todayWithdrawals,
          dailyStats,
          currentDate: todayStr,
          lastUpdated: new Date().toISOString()
        }, { merge: true });

        // 3. Create Transaction Document
        const txCol = getPublicCollection('transactions');
        const txDocRef = doc(txCol); 
        
        // Pattern: WDL + Year + 6 digit padded seq (e.g. WDL2026000001)
        const refNo = `WDL${currentYear}${newSeq.toString().padStart(6, '0')}`;
        
        const newTransaction: Transaction = {
          transactionId: txDocRef.id,
          referenceNumber: refNo,
          studentId: selectedStudent.studentId,
          accountId: account.accountId,
          transactionType: 'Withdrawal',
          amount: withdrawAmount,
          balanceBefore: freshBalanceBefore,
          balanceAfter: freshBalanceAfter,
          createdAt: new Date().toISOString(),
          createdBy: userSession.userId,
          remark: `ถอนเงินออกจากบัญชี ${account.accountNumber}`,
          status: 'Completed',
          voidDetails: {
            voidedBy: null,
            voidedAt: null,
            voidRemark: null,
            reversalReferenceNumber: null
          }
        };

        transaction.set(txDocRef, newTransaction);

        // 4. Create Audit Log
        const logsCol = getPublicCollection('audit_logs');
        const logDocRef = doc(logsCol);
        const newAudit = {
          logId: logDocRef.id,
          timestamp: new Date().toISOString(),
          userId: userSession.userId,
          actionType: 'Withdraw',
          targetDocument: `transactions/${txDocRef.id}`,
          oldValue: null,
          newValue: newTransaction,
          remarks: `ครู ${userSession.fullName} ทำรายการถอนเงิน ฿${withdrawAmount.toLocaleString(undefined, {minimumFractionDigits: 2})} จาก ${selectedStudent.fullName} (Ref: ${refNo})`,
          deviceInfo: typeof window !== 'undefined' ? navigator.userAgent : 'Unknown'
        };

        transaction.set(logDocRef, newAudit);

        return newTransaction;
      });

      // Clear form inputs
      setAmount('');
      setSelectedStudent(null);
      setValidationError(null);
      setShowConfirmModal(false);

      // Open Success receipt modal
      setCurrentTx(transactionResult);
      setShowReceiptModal(true);
      showToast("บันทึกธุรกรรมการถอนเงินสำเร็จ");

    } catch (err: any) {
      console.error("Transaction failed: ", err);
      showToast("ธุรกรรมล้มเหลว: " + err.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Filter students based on search query
  const filteredStudents = students.filter(student => {
    const matchesSearch = student.fullName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          student.studentNumber.includes(searchQuery) ||
                          student.studentId.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fadeIn">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
          <ArrowUpFromLine className="w-7 h-7 text-rose-500" />
          ทำรายการถอนเงิน (Withdrawal)
        </h2>
        <p className="text-sm text-slate-400 mt-1">ทำรายการถอนเงินออกจากบัญชีออมทรัพย์ของนักเรียนอย่างปลอดภัย</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Left/Middle Column: Search and Select Student */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <h3 className="text-md font-bold text-white flex items-center gap-2">
              <Search className="w-4 h-4 text-rose-500" />
              1. ค้นหาและเลือกรายชื่อนักเรียน
            </h3>
            
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input 
                type="text" 
                placeholder="พิมพ์ชื่อนักเรียน, รหัสประจำตัว หรือ ID ระบบ..." 
                value={searchQuery}
                disabled={submitting}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-700/60 rounded-xl py-3 pl-10 pr-4 text-sm text-slate-200 focus:outline-none focus:border-rose-500 transition-colors focus:ring-1 focus:ring-rose-500 disabled:opacity-50"
              />
            </div>

            {/* Students List Box */}
            <div className="border border-slate-800 bg-slate-950/50 rounded-xl overflow-hidden max-h-[350px] overflow-y-auto divide-y divide-slate-850">
              {loading ? (
                <div className="p-8 text-center text-slate-500 flex flex-col items-center gap-2">
                  <RefreshCw className="w-6 h-6 animate-spin text-rose-500" />
                  <span className="text-xs">กำลังโหลดรายชื่อนักเรียน...</span>
                </div>
              ) : filteredStudents.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  <span className="text-sm">ไม่พบนักเรียนตามเงื่อนไขการค้นหา</span>
                </div>
              ) : (
                filteredStudents.map((student) => {
                  const isSelected = selectedStudent?.studentId === student.studentId;
                  const acc = accounts[student.studentId];
                  return (
                    <button
                      key={student.studentId}
                      type="button"
                      disabled={submitting}
                      onClick={() => {
                        setSelectedStudent(student);
                        setValidationError(null);
                      }}
                      className={`w-full text-left px-5 py-3.5 transition-all flex items-center justify-between hover:bg-slate-800/30 ${
                        isSelected ? 'bg-rose-500/10 hover:bg-rose-500/15 border-l-4 border-rose-500' : ''
                      }`}
                    >
                      <div>
                        <p className="text-sm font-bold text-white">{student.fullName}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-slate-400 font-mono">
                          <span>เลขประจำตัว: {student.studentNumber}</span>
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-700"></span>
                          <span>ห้อง: {student.classRoom}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-500">ยอดเงินคงเหลือ</p>
                        <p className="text-sm font-bold text-rose-400 font-mono">
                          ฿{acc ? acc.currentBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                        </p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Transaction Form */}
        <div className="space-y-6">
          
          {/* Student Profile Card (if selected) */}
          {selectedStudent ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl animate-scaleUp">
              <div className="bg-rose-600/10 border-b border-rose-500/20 px-6 py-4 flex items-center justify-between">
                <span className="text-xs font-bold text-rose-400 uppercase tracking-wider">บัญชีที่เลือก</span>
                <span className="text-xs bg-rose-500/20 text-rose-400 px-2 py-0.5 rounded-full border border-rose-500/30">Active</span>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase">ชื่อ-นามสกุล</h4>
                  <p className="text-lg font-bold text-white mt-0.5">{selectedStudent.fullName}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-xs font-semibold text-slate-500 uppercase">ชั้นเรียน</h4>
                    <p className="text-sm font-semibold text-slate-200 mt-0.5">ชั้น {selectedStudent.classRoom}</p>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-slate-500 uppercase">เลขบัญชีออมทรัพย์</h4>
                    <p className="text-sm font-semibold text-slate-200 mt-0.5 font-mono">
                      {selectedAccount ? selectedAccount.accountNumber : 'ไม่มีบัญชี'}
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800">
                  <h4 className="text-xs font-semibold text-slate-500 uppercase">ยอดเงินปัจจุบัน</h4>
                  <p className="text-2xl font-extrabold text-rose-400 font-mono mt-1">
                    ฿{selectedAccount ? selectedAccount.currentBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center text-slate-500 space-y-2 py-12 shadow-xl">
              <span className="text-4xl block">👤</span>
              <p className="text-sm font-medium text-slate-400">กรุณาเลือกนักเรียนทางซ้ายมือ</p>
              <p className="text-xs text-slate-600">เพื่อเริ่มกรอกยอดทำรายการถอนเงิน</p>
            </div>
          )}

          {/* Form */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <h3 className="text-md font-bold text-white flex items-center gap-2">
              💸
              2. ระบุจำนวนเงินถอน
            </h3>
            
            <form onSubmit={handleOpenConfirm} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase">จำนวนเงิน (บาท)</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500 font-bold text-sm">฿</span>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    disabled={!selectedStudent || submitting}
                    value={amount}
                    onChange={handleAmountChange}
                    className="w-full bg-slate-950/80 border border-slate-700/60 rounded-xl py-3 pl-8 pr-4 text-rose-400 text-lg font-bold font-mono placeholder-slate-750 focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
                {validationError && (
                  <p className="text-xs text-rose-400 font-semibold flex items-center gap-1.5 mt-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    {validationError}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={!selectedStudent || submitting || !!validationError || !amount}
                className="w-full bg-rose-600 hover:bg-rose-500 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-rose-950/20 active:scale-95 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
              >
                <span>ทำรายการถอนเงิน</span>
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && selectedStudent && selectedAccount && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-scaleUp">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/20">
              <h3 className="font-bold text-white text-lg flex items-center gap-2">
                <span>⚠️ ตรวจสอบรายละเอียดการถอนเงิน</span>
              </h3>
              <button 
                onClick={() => !submitting && setShowConfirmModal(false)} 
                disabled={submitting}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Details */}
            <div className="p-6 space-y-4">
              <div className="p-4 bg-slate-950/40 rounded-xl space-y-3 border border-slate-850">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">นักเรียน</span>
                  <span className="text-white font-bold">{selectedStudent.fullName}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">รหัสประจำตัว</span>
                  <span className="text-slate-300 font-mono">{selectedStudent.studentNumber}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">เลขบัญชี</span>
                  <span className="text-slate-300 font-mono">{selectedAccount.accountNumber}</span>
                </div>
              </div>

              {/* Math Equation for Transparency */}
              <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-850 text-center space-y-2">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">สมการการทำรายการถอนเงิน</p>
                <div className="flex items-center justify-center gap-2 flex-wrap text-sm md:text-base font-mono font-bold">
                  <span className="text-slate-300" title="ยอดคงเหลือก่อนถอน">฿{selectedAccount.currentBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  <span className="text-rose-500 font-extrabold" title="ลบ">-</span>
                  <span className="text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20" title="ยอดถอน">฿{parseFloat(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  <span className="text-slate-400" title="เท่ากับ">=</span>
                  <span className="text-white underline decoration-rose-500 decoration-2" title="ยอดคงเหลือหลังถอน">฿{(selectedAccount.currentBalance - parseFloat(amount)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>

              {submitting && (
                <div className="text-center p-3 bg-slate-950/20 rounded-xl flex items-center justify-center gap-2 border border-slate-850">
                  <RefreshCw className="w-4 h-4 text-rose-500 animate-spin" />
                  <span className="text-xs text-slate-400 font-semibold">ระบบกำลังประมวลผลธุรกรรมทางการเงินอย่างปลอดภัย...</span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="px-6 py-4 bg-slate-950/30 border-t border-slate-800 flex justify-end gap-3">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white bg-slate-800 rounded-lg hover:bg-slate-750 cursor-pointer disabled:opacity-50"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleConfirmTransaction}
                className="bg-rose-600 hover:bg-rose-500 text-white font-bold px-5 py-2.5 rounded-lg text-xs flex items-center justify-center gap-1.5 transition-all shadow-md disabled:opacity-50 cursor-pointer"
              >
                {submitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>ยืนยันทำรายการถอนเงิน</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Receipt Modal */}
      {showReceiptModal && currentTx && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-scaleUp">
            {/* Header Status */}
            <div className="bg-rose-600/10 border-b border-rose-500/20 px-6 py-5 text-center relative">
              <div className="w-12 h-12 bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-full flex items-center justify-center mx-auto mb-2 text-xl font-bold">
                ✓
              </div>
              <h3 className="font-extrabold text-white text-base">ทำรายการถอนเงินสำเร็จ</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">ใบเสร็จรับเงินอิเล็กทรอนิกส์</p>
            </div>

            {/* Receipt Body */}
            <div className="p-6 space-y-4">
              
              <div className="text-center pb-2 border-b border-dashed border-slate-850">
                <span className="text-xs text-slate-500 block">จำนวนเงินถอน</span>
                <span className="text-2xl font-extrabold text-white font-mono block mt-1">
                  ฿{currentTx.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">รหัสอ้างอิง (Ref No.)</span>
                  <span className="text-white font-mono font-semibold">{currentTx.referenceNumber}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">วันเวลาทำรายการ</span>
                  <span className="text-white font-mono">
                    {new Date(currentTx.createdAt).toLocaleString('th-TH', {
                      year: 'numeric', month: 'short', day: 'numeric',
                      hour: '2-digit', minute: '2-digit', second: '2-digit'
                    })}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">ชื่อนักเรียน</span>
                  <span className="text-white font-bold font-sans">
                    {students.find(s => s.studentId === currentTx.studentId)?.fullName || 'นักเรียนในระบบ'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">เลขที่บัญชี</span>
                  <span className="text-white font-mono">{accounts[currentTx.studentId]?.accountNumber || ''}</span>
                </div>
                <div className="flex justify-between items-center border-t border-slate-855 pt-2.5">
                  <span className="text-slate-500">ยอดก่อนถอน</span>
                  <span className="text-slate-300 font-mono">
                    ฿{currentTx.balanceBefore.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">ยอดคงเหลือสุทธิ</span>
                  <span className="text-rose-400 font-bold font-mono">
                    ฿{currentTx.balanceAfter.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Audit Badge */}
              <div className="p-2 bg-slate-950/30 rounded-lg text-center border border-slate-850">
                <span className="text-[9px] text-slate-500 font-mono block">บันทึกประวัติความปลอดภัยบน Firestore สมบูรณ์</span>
              </div>
            </div>

            {/* Receipt Actions */}
            <div className="px-6 py-4 bg-slate-950/30 border-t border-slate-800 flex justify-center gap-3">
              <button
                type="button"
                onClick={() => setShowReceiptModal(false)}
                className="w-full bg-slate-800 hover:bg-slate-750 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-all cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}