import React, { useState } from 'react';
import {
  ShieldCheck, Users, Settings, Save, Plus,
  Edit2, Trash2, CheckCircle, AlertCircle,
  ChevronLeft, Building, Database, Key, Server
} from 'lucide-react';

interface Staff {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  lastLogin: string;
}

const initialSettings = {
  schoolName: "โรงเรียนสาธิตวิทยาคาร",
  academicYear: "2569",
  currencySymbol: "฿",
  minDeposit: 10,
  minWithdrawal: 20,
};

const mockAdminSession = {
  fullName: "คุณครูผู้ดูแลระบบสูงสุด",
  role: "Super Admin",
};

const mockStaffList: Staff[] = [
  {
    id: "STAFF_1",
    name: "คุณครูสมศักดิ์ รักเรียน",
    email: "somsak@school.mail",
    role: "Admin",
    status: "Active",
    lastLogin: "2026-07-07 10:30",
  },
  {
    id: "STAFF_2",
    name: "คุณครูวิภา ใจดี",
    email: "wipa@school.mail",
    role: "Teacher",
    status: "Active",
    lastLogin: "2026-07-06 14:15",
  },
  {
    id: "STAFF_3",
    name: "คุณครูสมชาย เรียนดี",
    email: "somchai@school.mail",
    role: "Teacher",
    status: "Suspended",
    lastLogin: "2026-07-01 09:00",
  }
];

// ==========================================
// MAIN COMPONENT
// ==========================================
export default function AdminManagementModule() {
  const [activeTab, setActiveTab] = useState('settings'); // 'settings' | 'staff'
  const [settings, setSettings] = useState(initialSettings);
  const [isSaving, setIsSaving] = useState(false);
  const [toasts, setToasts] = useState<any[]>([]);

  // --- Toast Manager ---
  const showToast = (message: string, type: string = 'success') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 4000);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    // จำลองการบันทึกข้อมูลลง Firestore: /artifacts/{appId}/public/data/settings/system_config
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsSaving(false);
    showToast("บันทึกการตั้งค่าระบบส่วนกลางสำเร็จ");
  };

  return (
    <div className="min-h-screen bg-slate-950 font-sans text-slate-100 selection:bg-indigo-500 selection:text-white flex flex-col">

      {/* --- TOP NAVBAR --- */}
      <header className="h-16 flex items-center justify-between px-6 bg-[#0f172a] border-b border-indigo-900/50 shrink-0 shadow-lg">
        <div className="flex items-center gap-4">
          <div className="bg-indigo-600/20 p-2 rounded-xl border border-indigo-500/30">
            <ShieldCheck className="w-5 h-5 text-indigo-400" />
          </div>
          <h1 className="text-lg font-bold flex items-center gap-2 text-white">
            System Administration <span className="text-xs bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-full border border-indigo-500/30">Super Admin</span>
          </h1>
        </div>
        <div className="text-right hidden sm:block">
          <p className="text-sm font-semibold text-white leading-none">{mockAdminSession.fullName}</p>
          <p className="text-xs text-indigo-400 mt-1">{mockAdminSession.role}</p>
        </div>
      </header>

      {/* --- MAIN CONTENT --- */}
      <main className="flex-1 overflow-y-auto p-6 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-fixed">
        <div className="max-w-6xl mx-auto space-y-6">

          {/* Header Area */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-8 border-b border-slate-800 pb-6">
            <div>
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <Server className="w-6 h-6 text-indigo-400" /> แผงควบคุมระบบส่วนกลาง
              </h2>
              <p className="text-sm text-slate-400 mt-1">จัดการโครงสร้างข้อมูลโรงเรียนและกำหนดสิทธิ์เจ้าหน้าที่ธนาคาร</p>
            </div>

            {/* Tabs */}
            <div className="flex bg-slate-900 rounded-xl p-1 border border-slate-800 shadow-inner">
              <button
                onClick={() => setActiveTab('settings')}
                className={`px-5 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'settings' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
              >
                <Settings className="w-4 h-4" /> ตั้งค่าระบบ (Settings)
              </button>
              <button
                onClick={() => setActiveTab('staff')}
                className={`px-5 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'staff' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
              >
                <Users className="w-4 h-4" /> เจ้าหน้าที่ (Staff)
              </button>
            </div>
          </div>

          {activeTab === 'settings' ? (
            /* ============================================================ */
            /* TAB 1: SYSTEM SETTINGS                                       */
            /* ============================================================ */
            <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden animate-fadeIn">
              <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/50 flex items-center gap-3">
                <Building className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-white">ข้อมูลพื้นฐานสถาบัน (Institution Config)</h3>
              </div>

              <form onSubmit={handleSaveSettings} className="p-6 space-y-8">

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-300 block">ชื่อสถานศึกษา (School Name)</label>
                    <input
                      type="text" value={settings.schoolName} onChange={e => setSettings({ ...settings, schoolName: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-300 block">ปีการศึกษาปัจจุบัน (Academic Year)</label>
                    <input
                      type="text" value={settings.academicYear} onChange={e => setSettings({ ...settings, academicYear: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-indigo-500"
                      required
                    />
                    <p className="text-[10px] text-slate-500">*มีผลต่อการสร้างรหัสอ้างอิงธุรกรรม เช่น DEP2569...</p>
                  </div>
                </div>

                <div className="border-t border-slate-800 pt-6">
                  <h4 className="text-sm font-bold text-indigo-400 mb-4 flex items-center gap-2"><Database className="w-4 h-4" /> กฎเกณฑ์ทางการเงิน (Financial Rules)</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-300 block">สัญลักษณ์สกุลเงิน</label>
                      <select
                        value={settings.currencySymbol}
                        onChange={e => setSettings({ ...settings, currencySymbol: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3.5 px-4 text-sm text-white focus:outline-none focus:border-indigo-500 text-center font-bold cursor-pointer"
                        style={{ colorScheme: 'dark' }}
                      >
                        {settings.currencySymbol !== '฿' && settings.currencySymbol !== '$' && (
                          <option value={settings.currencySymbol} className="bg-slate-900 text-white">
                            {settings.currencySymbol}
                          </option>
                        )}
                        <option value="฿" className="bg-slate-900 text-white">บาท</option>
                        <option value="$" className="bg-slate-900 text-white">ดอลลาร์สหรัฐ</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-300 block">ฝากขั้นต่ำ (บาท)</label>
                      <input
                        type="number" value={settings.minDeposit} onChange={e => setSettings({ ...settings, minDeposit: Number(e.target.value) })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-indigo-500 text-right"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-300 block">ถอนขั้นต่ำ (บาท)</label>
                      <input
                        type="number" value={settings.minWithdrawal} onChange={e => setSettings({ ...settings, minWithdrawal: Number(e.target.value) })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-indigo-500 text-right"
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-xl p-4 flex gap-3">
                  <Key className="w-5 h-5 text-indigo-400 shrink-0" />
                  <div className="text-sm text-slate-300 leading-relaxed">
                    <strong className="text-indigo-300">ประกาศด้านความปลอดภัย:</strong> การเปลี่ยนแปลงการตั้งค่าในหน้านี้จะมีผลกับระบบธุรกรรมทั้งหมดทันที (Global Effect) ข้อมูลการแก้ไขจะถูกบันทึกไว้ใน Audit Log และระบุตัวตนผู้ดูแลระบบที่ทำการบันทึก
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit" disabled={isSaving}
                    className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white px-8 py-3 rounded-xl text-sm font-bold shadow-lg shadow-indigo-900/20 transition-all flex items-center justify-center gap-2 active:scale-95"
                  >
                    {isSaving ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> กำลังบันทึก...</> : <><Save className="w-4 h-4" /> บันทึกการตั้งค่า</>}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            /* ============================================================ */
            /* TAB 2: STAFF MANAGEMENT                                      */
            /* ============================================================ */
            <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden animate-fadeIn">
              <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                <h3 className="font-bold text-white flex items-center gap-2">
                  <Key className="w-5 h-5 text-indigo-400" />
                  รายชื่อเจ้าหน้าที่ผู้มีสิทธิ์ใช้งาน
                </h3>
                <button className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2">
                  <Plus className="w-4 h-4" /> เพิ่มบัญชีเจ้าหน้าที่
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-950/80 text-slate-400 text-xs uppercase border-b border-slate-800">
                    <tr>
                      <th className="px-6 py-4 font-semibold">ชื่อ-นามสกุล</th>
                      <th className="px-6 py-4 font-semibold">อีเมล (บัญชีเข้าสู่ระบบ)</th>
                      <th className="px-6 py-4 font-semibold">สิทธิ์ (Role)</th>
                      <th className="px-6 py-4 font-semibold">สถานะบัญชี</th>
                      <th className="px-6 py-4 font-semibold">เข้าสู่ระบบล่าสุด</th>
                      <th className="px-6 py-4 font-semibold text-center">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {mockStaffList.map((staff: Staff) => (
                      <tr key={staff.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-4 font-medium text-white">{staff.name}</td>
                        <td className="px-6 py-4 text-slate-400">{staff.email}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${staff.role === 'Admin' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : 'bg-slate-800 text-slate-300 border-slate-700'
                            }`}>
                            {staff.role === 'Admin' && <ShieldCheck className="w-3 h-3" />}
                            {staff.role}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`flex items-center gap-1.5 text-xs font-bold ${staff.status === 'Active' ? 'text-emerald-400' : 'text-rose-400'}`}>
                            <span className={`w-2 h-2 rounded-full ${staff.status === 'Active' ? 'bg-emerald-400' : 'bg-rose-400'}`}></span>
                            {staff.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-500 text-xs">{staff.lastLogin}</td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex justify-center items-center gap-2">
                            <button className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors" title="แก้ไขสิทธิ์">
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              disabled={staff.role === 'Admin'}
                              className={`p-1.5 rounded-lg transition-colors ${staff.role === 'Admin' ? 'text-slate-700 cursor-not-allowed' : 'text-slate-400 hover:text-rose-400 hover:bg-rose-500/10'}`}
                              title="ระงับการเข้าถึง"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* --- TOAST NOTIFICATIONS --- */}
      <div className="fixed bottom-5 right-5 flex flex-col gap-2 z-[60] max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => (
          <div key={toast.id} className="p-4 rounded-xl shadow-lg flex items-center gap-3 border bg-indigo-950/90 border-indigo-500/40 text-indigo-200 transition-all duration-300 pointer-events-auto animate-slideIn">
            <CheckCircle className="w-5 h-5 text-indigo-400 shrink-0" />
            <span className="text-xs font-semibold">{toast.message}</span>
          </div>
        ))}
      </div>

    </div>
  );
}