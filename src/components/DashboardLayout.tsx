import React, { useState } from 'react';
import {
  Shield, Menu, LayoutDashboard, Users,
  ArrowDownToLine, ArrowUpFromLine, FileText, Settings,
  Search, Bell, User, LogOut
} from 'lucide-react';

interface DashboardLayoutProps {
  children: React.ReactNode;
  userSession: any;
  onLogout: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function DashboardLayout({ 
  children, 
  userSession, 
  onLogout, 
  activeTab, 
  setActiveTab 
}: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

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
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-medium cursor-pointer ${
        active 
          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
          : 'text-slate-400 hover:bg-slate-800 hover:text-white'
      }`}
    >
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

        {(userSession?.role === 'Admin' || userSession?.role === 'Super Admin' || userSession?.role?.includes('Admin') || userSession?.role?.includes('Super Admin')) && (
          <div className="p-4 border-t border-slate-800 space-y-2">
            <NavItem icon={Settings} label="การตั้งค่า (Settings)" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
          </div>
        )}
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
