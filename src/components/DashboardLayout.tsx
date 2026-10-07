import React, { useState } from 'react';
import {
  Shield, Menu, LayoutDashboard, Users,
  ArrowDownToLine, ArrowUpFromLine, FileText, Settings,
  Search, Bell, User, LogOut, Download, Activity, Clock, Key
} from 'lucide-react';
import { useAuditLogs } from '@/src/hooks/useAuditLogs';
import { useAuthRole } from '@/src/hooks/useAuthRole';
import { RoleGuard } from '@/src/components/RoleGuard';

interface DashboardLayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isInstallable?: boolean;
  onInstallApp?: () => void;
}

export default function DashboardLayout({
  children,
  activeTab,
  setActiveTab,
  isInstallable = false,
  onInstallApp
}: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const { notifications, unreadCount, markNotificationsAsRead } = useAuditLogs();
  const { userSession, logout } = useAuthRole();

  const getRelativeTime = (isoString: string) => {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'เมื่อสักครู่';
    if (diffMins < 60) return `เมื่อ ${diffMins} นาทีที่แล้ว`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `เมื่อ ${diffHours} ชั่วโมงที่แล้ว`;
    return new Date(isoString).toLocaleDateString('th-TH', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getNotificationIcon = (actionType: string) => {
    const type = actionType?.toLowerCase() || '';
    if (type.includes('login') || type.includes('logout')) return Key;
    if (type.includes('deposit')) return ArrowDownToLine;
    if (type.includes('withdraw')) return ArrowUpFromLine;
    if (type.includes('student')) return Users;
    if (type.includes('settings')) return Settings;
    return Activity;
  };

  const getNotificationIconColor = (actionType: string) => {
    const type = actionType?.toLowerCase() || '';
    if (type.includes('login') || type.includes('logout')) return 'bg-sky-500/10 text-sky-400 border border-sky-500/20';
    if (type.includes('deposit')) return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
    if (type.includes('withdraw')) return 'bg-rose-500/10 text-rose-450 border border-rose-500/20';
    if (type.includes('student')) return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
    if (type.includes('settings')) return 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20';
    return 'bg-slate-800 text-slate-400 border border-slate-700';
  };

  const NavItem = ({
    icon: Icon,
    label,
    active = false,
    onClick
  }: {
    icon: React.ComponentType<any>;
    label: string;
    active?: boolean;
    onClick?: () => void
  }) => (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-semibold cursor-pointer ${active
          ? 'bg-gradient-to-r from-sky-500/25 via-teal-500/20 to-emerald-500/20 text-white border-l-4 border-sky-400 shadow-sm shadow-sky-950/20 backdrop-blur-sm'
          : 'text-slate-300 hover:bg-white/10 hover:text-white'
        }`}
    >
      <Icon className="w-5 h-5" />
      {sidebarOpen && <span>{label}</span>}
    </button>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-transparent">

      {/* Sidebar (Desktop First) */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} flex-shrink-0 bg-slate-950/35 backdrop-blur-xl border-r border-white/15 flex flex-col transition-all duration-300`}>
        <div className="h-16 flex items-center justify-between px-4 border-b border-white/10">
          {sidebarOpen && (
            <div className="flex items-center gap-2 text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-teal-300 to-emerald-400 font-extrabold text-lg">
              <Shield className="w-6 h-6 text-emerald-400" />
              <span>Bank of School</span>
            </div>
          )}
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 rounded-lg hover:bg-white/10 text-slate-300 mx-auto cursor-pointer transition-colors">
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

        <RoleGuard allowedRoles={['Admin']}>
          <div className="p-4 border-t border-white/10 space-y-2">
            <NavItem icon={Settings} label="การตั้งค่า (Settings)" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
          </div>
        </RoleGuard>

        {isInstallable && (
          <div className="p-4 border-t border-white/10">
            <button
              onClick={onInstallApp}
              className={`w-full flex items-center gap-3 px-4 py-2.5 bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-400 hover:to-cyan-400 text-white rounded-xl transition-all text-xs font-bold shadow-md shadow-sky-500/25 cursor-pointer active:scale-95 ${!sidebarOpen && 'justify-center'}`}
              title="ติดตั้งแอป (Install App)"
            >
              <Download className="w-4 h-4" />
              {sidebarOpen && <span>ติดตั้งแอป (Install)</span>}
            </button>
          </div>
        )}

        {/* Sidebar App Version Footer */}
        <div className="p-4 border-t border-white/10 flex flex-col gap-1.5 shrink-0 bg-slate-950/20">
          {sidebarOpen ? (
            <div className="flex items-center justify-between text-[11px] text-slate-300 font-medium">
              <span>เวอร์ชันระบบ (App Version)</span>
              <span className="bg-sky-500/20 text-sky-300 px-2 py-0.5 rounded-md border border-sky-400/30 font-bold uppercase tracking-wider text-[10px]">
                v0.1.0-web
              </span>
            </div>
          ) : (
            <div className="text-center text-[10px] text-slate-400 font-bold" title="Version 0.1.0-web">
              v0.1.0
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Top Navbar */}
        <header className="h-16 flex items-center justify-between px-6 bg-slate-950/35 backdrop-blur-xl border-b border-white/15 shrink-0">
          <div className="flex-1 flex items-center">
            <div className="relative w-64 hidden sm:block">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" placeholder="ค้นหา รหัสนักเรียน, ชื่อ..." className="w-full bg-slate-950/40 border border-white/15 rounded-full py-1.5 pl-9 pr-4 text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400/30 backdrop-blur-md transition-all" />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative">
              <button
                onClick={() => {
                  setNotificationsOpen(!notificationsOpen);
                  if (!notificationsOpen) {
                    markNotificationsAsRead();
                  }
                }}
                className={`relative text-slate-300 hover:text-white p-2 cursor-pointer rounded-lg hover:bg-white/10 transition-colors ${notificationsOpen ? 'bg-white/15 text-white' : ''}`}
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-rose-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center border border-slate-900 animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </button>

              {notificationsOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setNotificationsOpen(false)}></div>

                  <div className="absolute right-0 mt-2 w-80 max-h-[480px] bg-slate-950/80 backdrop-blur-2xl border border-white/20 rounded-2xl shadow-2xl shadow-sky-950/40 z-50 flex flex-col overflow-hidden animate-fadeIn">
                    <div className="p-4 border-b border-white/10 flex justify-between items-center bg-slate-950/50">
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        <Activity className="w-4 h-4 text-emerald-400" />
                        <span>การแจ้งเตือนระบบ (Audit Logs)</span>
                      </h4>
                      {unreadCount > 0 && (
                        <span className="text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2 py-0.5 rounded-full font-bold">
                          {unreadCount} ใหม่
                        </span>
                      )}
                    </div>

                    <div className="overflow-y-auto flex-1 max-h-[350px] divide-y divide-white/5 custom-scrollbar">
                      {notifications.length === 0 ? (
                        <div className="p-8 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
                          <Bell className="w-8 h-8 text-slate-500 stroke-[1.5]" />
                          <span>ไม่มีประวัติการแจ้งเตือน</span>
                        </div>
                      ) : (
                        notifications.map((notif) => {
                          const Icon = getNotificationIcon(notif.actionType);
                          const iconColorClass = getNotificationIconColor(notif.actionType);
                          return (
                            <div key={notif.logId} className="p-3.5 hover:bg-white/5 transition-colors flex gap-3 text-left">
                              <div className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center ${iconColorClass}`}>
                                <Icon className="w-4 h-4" />
                              </div>
                              <div className="space-y-1 min-w-0">
                                <p className="text-xs text-slate-200 font-medium leading-normal break-words">
                                  {notif.remarks}
                                </p>
                                <div className="flex items-center gap-1 text-[10px] text-slate-400">
                                  <Clock className="w-3 h-3" />
                                  <span>{getRelativeTime(notif.timestamp)}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    <div className="p-3 bg-slate-950/60 border-t border-white/10 text-center">
                      <button
                        onClick={() => {
                          markNotificationsAsRead();
                          setNotificationsOpen(false);
                        }}
                        className="text-[11px] font-semibold text-sky-300 hover:text-sky-200 transition-colors cursor-pointer w-full"
                      >
                        ทำเครื่องหมายว่าอ่านแล้วทั้งหมด
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="h-6 w-px bg-white/10 mx-2"></div>
            <div className="flex items-center gap-3">
              {userSession && (
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-semibold text-white leading-none mb-1">{userSession.fullName}</p>
                  <p className="text-xs text-emerald-300 leading-none font-medium">{userSession.role}</p>
                </div>
              )}
              <div className="w-9 h-9 rounded-full bg-sky-500/15 border border-sky-400/30 flex items-center justify-center text-sky-300 shadow-sm shadow-sky-500/20">
                <User className="w-5 h-5" />
              </div>
              <button onClick={logout} className="ml-2 text-slate-400 hover:text-rose-300 transition-colors p-2 rounded-lg hover:bg-rose-500/10 cursor-pointer">
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </header>

        {/* Dynamic Page Content */}
        <main className="flex-1 overflow-y-auto p-6 bg-transparent">
          {children}
        </main>
      </div>
    </div>
  );
}
