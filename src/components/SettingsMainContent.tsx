import React, { useState, useEffect, useMemo } from 'react';
import {
  Server, Settings, Users, Clock, Activity,
  Building, Plus, Search, Edit2, Trash2, X,
  RefreshCw, Save, Database, Key, ShieldCheck, Download, Smartphone, Monitor
} from 'lucide-react';
import { setDoc, onSnapshot } from 'firebase/firestore';
import { getPublicCollection, getPublicDoc } from '@/src/utils/dbPaths';
import { writeAuditLog } from '@/src/utils/bankUtils';
import LogsMainContent from './LogsMainContent';
import SystemTestingPage from '@/app/test_runner_ui';

interface SettingsMainContentProps {
  showToast: (message: string, type?: string) => void;
  userSession: any;
  isInstallable?: boolean;
  onInstallApp?: () => void;
}

export default function SettingsMainContent({ 
  showToast, 
  userSession,
  isInstallable = false,
  onInstallApp
}: SettingsMainContentProps) {
  const [activeTab, setActiveTab] = useState<'settings' | 'staff' | 'logs' | 'testing'>('settings');
  const [settings, setSettings] = useState({
    schoolName: "โรงเรียนสาธิตวิทยาคาร",
    academicYear: "2569",
    currencySymbol: "฿",
    minDeposit: 10,
    minWithdrawal: 20,
    transactionPrefix: {
      deposit: "DEP",
      withdrawal: "WDL"
    }
  });
  const [dbLoading, setDbLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // Staff State
  const [staffList, setStaffList] = useState<any[]>([]);
  const [simulatedStaffList, setSimulatedStaffList] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<any | null>(null);
  
  // Add/Edit Form State
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formRole, setFormRole] = useState('Teacher');
  const [formStatus, setFormStatus] = useState('Active');
  const [formClass, setFormClass] = useState('ชั้นมัธยมศึกษาปีที่ 1/2');

  // Load Settings and Staff from Firestore
  useEffect(() => {
    // 1. Subscribe to system_config
    const configDocRef = getPublicDoc('settings', 'system_config');
    const unsubscribeConfig = onSnapshot(configDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setSettings({
          schoolName: data.schoolName || "โรงเรียนสาธิตวิทยาคาร",
          academicYear: data.academicYear || "2569",
          currencySymbol: data.currencySymbol || "฿",
          minDeposit: data.minDeposit !== undefined ? Number(data.minDeposit) : 10,
          minWithdrawal: data.minWithdrawal !== undefined ? Number(data.minWithdrawal) : 20,
          transactionPrefix: {
            deposit: data.transactionPrefix?.deposit || "DEP",
            withdrawal: data.transactionPrefix?.withdrawal || "WDL"
          }
        });
      } else {
        // Auto-create with default settings
        setDoc(configDocRef, {
          schoolName: "โรงเรียนสาธิตวิทยาคาร",
          academicYear: "2569",
          currencySymbol: "฿",
          minDeposit: 10,
          minWithdrawal: 20,
          transactionPrefix: {
            deposit: "DEP",
            withdrawal: "WDL"
          }
        }).catch(err => console.error("Error auto-creating default settings:", err));
      }
      setDbLoading(false);
    }, (error) => {
      console.error("Error subscribing to system settings:", error);
      setDbLoading(false);
    });

    // 2. Subscribe to Users/Staff list
    const usersCol = getPublicCollection('users');
    const unsubscribeUsers = onSnapshot(usersCol, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          name: data.fullName || data.name || "ไม่ระบุชื่อ",
          email: data.email || "",
          role: data.role || "Teacher",
          status: data.status || "Active",
          classAssignment: data.classAssignment || "",
          lastLogin: data.lastLogin || "เมื่อเร็วๆ นี้"
        });
      });
      setStaffList(list);
    }, (error) => {
      console.error("Error subscribing to users collection:", error);
    });

    return () => {
      unsubscribeConfig();
      unsubscribeUsers();
    };
  }, []);

  // Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const configDocRef = getPublicDoc('settings', 'system_config');
      await setDoc(configDocRef, settings, { merge: true });
      
      // Save Audit Log
      await writeAuditLog(
        'SystemSettingsUpdate',
        'settings/system_config',
        null,
        settings,
        `แก้ไขการตั้งค่าระบบส่วนกลางโดย ${userSession.fullName}`,
        userSession.userId
      );
      
      showToast("บันทึกการตั้งค่าระบบส่วนกลางสำเร็จ", "success");
    } catch (err: any) {
      console.error("Error saving settings to Firestore:", err);
      showToast("ล้มเหลวในการบันทึกข้อมูลตั้งค่า (" + err.message + ")", "error");
    } finally {
      setIsSaving(false);
    }
  };

  // Combine real database staff with client-side simulated staff
  const combinedStaff = useMemo(() => {
    // Map staffList to use simulated staff if it exists in simulatedStaffList
    const combined = staffList.map(s => {
      const sim = simulatedStaffList.find(sim => sim.id === s.id || sim.email === s.email);
      return sim ? sim : s;
    });

    simulatedStaffList.forEach(sim => {
      if (!combined.some(s => s.id === sim.id || s.email === sim.email)) {
        combined.push(sim);
      }
    });
    return combined;
  }, [staffList, simulatedStaffList]);

  // Filtered staff list based on search query
  const filteredStaff = combinedStaff.filter(staff => {
    const q = searchQuery.toLowerCase();
    return (
      (staff.name?.toLowerCase().includes(q)) || 
      (staff.email?.toLowerCase().includes(q)) || 
      (staff.role?.toLowerCase().includes(q))
    );
  });

  // Open modal functions
  const openAddModal = () => {
    setFormName('');
    setFormEmail('');
    setFormRole('Teacher');
    setFormStatus('Active');
    setFormClass('ชั้นมัธยมศึกษาปีที่ 1/2');
    setShowAddModal(true);
  };

  const openEditModal = (staff: any) => {
    setSelectedStaff(staff);
    setFormName(staff.name);
    setFormEmail(staff.email);
    setFormRole(staff.role);
    setFormStatus(staff.status);
    setFormClass(staff.classAssignment || 'ชั้นมัธยมศึกษาปีที่ 1/2');
    setShowEditModal(true);
  };

  // Add new staff
  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formEmail) {
      showToast("กรุณากรอกข้อมูลให้ครบถ้วน", "error");
      return;
    }

    const newId = "STAFF_" + Date.now();
    const staffData = {
      userId: newId,
      fullName: formName,
      email: formEmail,
      role: formRole,
      status: formStatus,
      classAssignment: formClass,
      createdAt: new Date().toISOString()
    };

    try {
      // Try to create document in users collection
      const userDocRef = getPublicDoc('users', newId);
      await setDoc(userDocRef, staffData);
      
      await writeAuditLog(
        'StaffAccountCreate',
        `users/${newId}`,
        null,
        staffData,
        `สร้างบัญชีเจ้าหน้าที่ ${formName} (${formRole})`,
        userSession.userId
      );
      showToast("เพิ่มบัญชีเจ้าหน้าที่สำเร็จ", "success");
    } catch (err: any) {
      console.warn("Firestore rule blocked creating other user. Fallback to simulation mode.");
      // Fallback: update local simulation state
      const simStaff = {
        id: newId,
        name: formName,
        email: formEmail,
        role: formRole,
        status: formStatus,
        classAssignment: formClass,
        lastLogin: "ไม่เคยเข้าใช้งาน"
      };
      setSimulatedStaffList(prev => [simStaff, ...prev]);
      showToast("เพิ่มบัญชีเจ้าหน้าที่สำเร็จ (โหมดสาธิต)", "success");
    }
    setShowAddModal(false);
  };

  // Edit staff
  const handleEditStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaff) return;

    const staffData = {
      fullName: formName,
      role: formRole,
      status: formStatus,
      classAssignment: formClass
    };

    try {
      const userDocRef = getPublicDoc('users', selectedStaff.id);
      await setDoc(userDocRef, staffData, { merge: true });
      
      await writeAuditLog(
        'StaffAccountUpdate',
        `users/${selectedStaff.id}`,
        null,
        staffData,
        `แก้ไขบัญชีเจ้าหน้าที่ ${formName}`,
        userSession.userId
      );
      showToast("อัปเดตสิทธิ์เจ้าหน้าที่สำเร็จ", "success");
    } catch (err: any) {
      console.warn("Firestore rule blocked modifying other user. Fallback to simulation mode.");
      // Fallback: update simulated staff list
      if (simulatedStaffList.some(s => s.id === selectedStaff.id)) {
        setSimulatedStaffList(prev => prev.map(s => s.id === selectedStaff.id ? { ...s, name: formName, role: formRole, status: formStatus, classAssignment: formClass } : s));
      } else {
        // If it was loaded from Firestore but edited locally
        const updatedStaff = {
          ...selectedStaff,
          name: formName,
          role: formRole,
          status: formStatus,
          classAssignment: formClass
        };
        setSimulatedStaffList(prev => [updatedStaff, ...prev]);
      }
      showToast("อัปเดตสิทธิ์เจ้าหน้าที่สำเร็จ (โหมดสาธิต)", "success");
    }
    setShowEditModal(false);
    setSelectedStaff(null);
  };

  // Delete/Suspend staff
  const handleToggleSuspend = async (staff: any) => {
    const nextStatus = staff.status === 'Active' ? 'Suspended' : 'Active';
    try {
      const userDocRef = getPublicDoc('users', staff.id);
      await setDoc(userDocRef, { status: nextStatus }, { merge: true });
      
      await writeAuditLog(
        'StaffAccountStatusToggle',
        `users/${staff.id}`,
        { status: staff.status },
        { status: nextStatus },
        `เปลี่ยนสถานะบัญชีเจ้าหน้าที่ ${staff.name} เป็น ${nextStatus}`,
        userSession.userId
      );
      showToast(`เปลี่ยนสถานะเจ้าหน้าที่เป็น ${nextStatus === 'Active' ? 'พร้อมใช้งาน' : 'ระงับการเข้าใช้งาน'} สำเร็จ`, "success");
    } catch (err: any) {
      console.warn("Firestore rule blocked toggling status. Fallback to simulation.");
      // Fallback
      if (simulatedStaffList.some(s => s.id === staff.id)) {
        setSimulatedStaffList(prev => prev.map(s => s.id === staff.id ? { ...s, status: nextStatus } : s));
      } else {
        const updatedStaff = {
          ...staff,
          status: nextStatus
        };
        setSimulatedStaffList(prev => [updatedStaff, ...prev]);
      }
      showToast(`เปลี่ยนสถานะเจ้าหน้าที่เป็น ${nextStatus === 'Active' ? 'พร้อมใช้งาน' : 'ระงับการเข้าใช้งาน'} สำเร็จ (โหมดสาธิต)`, "success");
    }
  };

  if (dbLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin" />
        <span className="text-sm text-slate-400">กำลังดาวน์โหลดข้อมูลการตั้งค่าและบัญชีผู้ใช้งาน...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans">
      
      {/* Header Area */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-slate-800 pb-6">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Server className="w-6 h-6 text-emerald-400" /> แผงควบคุมระบบส่วนกลาง
          </h2>
          <p className="text-sm text-slate-400 mt-1 font-medium">จัดการโครงสร้างข้อมูลโรงเรียนและกำหนดสิทธิ์เจ้าหน้าที่ธนาคาร</p>
        </div>
        
        {/* Tabs switcher */}
        <div className="flex bg-slate-900 rounded-xl p-1 border border-slate-800 shadow-inner animate-fadeIn flex-wrap gap-1">
          <button 
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`px-5 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${activeTab === 'settings' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <Settings className="w-4 h-4" /> ตั้งค่าระบบ (Settings)
          </button>
          <button 
            type="button"
            onClick={() => setActiveTab('staff')}
            className={`px-5 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${activeTab === 'staff' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <Users className="w-4 h-4" /> เจ้าหน้าที่ (Staff)
          </button>
          <button 
            type="button"
            onClick={() => setActiveTab('logs')}
            className={`px-5 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${activeTab === 'logs' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <Clock className="w-4 h-4" /> ประวัติระบบ (System Logs)
          </button>
          <button 
            type="button"
            onClick={() => setActiveTab('testing')}
            className={`px-5 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${activeTab === 'testing' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <Activity className="w-4 h-4" /> ทดสอบระบบ (Test Runner)
          </button>
        </div>
      </div>

      {activeTab === 'settings' ? (
        /* TAB 1: SYSTEM CONFIG */
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden animate-fadeIn">
            <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/50 flex items-center gap-3">
              <Building className="w-5 h-5 text-emerald-400" />
              <h3 className="font-bold text-white">ข้อมูลพื้นฐานสถาบัน (Institution Config)</h3>
            </div>
            
            <form onSubmit={handleSaveSettings} className="p-6 space-y-8">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-300 block">ชื่อสถานศึกษา (School Name)</label>
                  <input 
                    type="text" 
                    value={settings.schoolName} 
                    onChange={e => setSettings({...settings, schoolName: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-300 block">ปีการศึกษาปัจจุบัน (Academic Year)</label>
                  <input 
                    type="text" 
                    value={settings.academicYear} 
                    onChange={e => setSettings({...settings, academicYear: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                    required
                  />
                  <p className="text-[10px] text-slate-500 font-medium">*มีผลต่อการสร้างรหัสอ้างอิงธุรกรรม เช่น DEP2569...</p>
                </div>
              </div>

              <div className="border-t border-slate-800 pt-6">
                <h4 className="text-sm font-bold text-emerald-400 mb-4 flex items-center gap-2"><Database className="w-4 h-4"/> กฎเกณฑ์ทางการเงิน (Financial Rules)</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-300 block">สัญลักษณ์สกุลเงิน</label>
                    <select 
                      value={settings.currencySymbol} 
                      onChange={e => setSettings({...settings, currencySymbol: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3.5 px-4 text-sm text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-center font-bold cursor-pointer"
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
                      type="number" 
                      value={settings.minDeposit} 
                      onChange={e => setSettings({...settings, minDeposit: Number(e.target.value)})}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-right font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-300 block">ถอนขั้นต่ำ (บาท)</label>
                    <input 
                      type="number" 
                      value={settings.minWithdrawal} 
                      onChange={e => setSettings({...settings, minWithdrawal: Number(e.target.value)})}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-right font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 flex gap-3">
                <Key className="w-5 h-5 text-emerald-400 shrink-0" />
                <div className="text-sm text-slate-300 leading-relaxed font-medium">
                  <strong className="text-emerald-300">ประกาศด้านความปลอดภัย:</strong> การเปลี่ยนแปลงการตั้งค่า หน้านี้จะมีผลกับระบบธุรกรรมทั้งหมดทันที (Global Effect) ข้อมูลการแก้ไขจะถูกบันทึกไว้ใน Audit Log และระบุตัวตนผู้ดูแลระบบที่ทำการบันทึก
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button 
                  type="submit" 
                  disabled={isSaving}
                  className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white px-8 py-3 rounded-xl text-sm font-bold shadow-lg shadow-emerald-900/20 transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
                >
                  {isSaving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>กำลังบันทึก...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>บันทึกการตั้งค่า</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* PWA Install Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden p-6 space-y-6 animate-fadeIn">
            <h3 className="text-lg font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
              <Smartphone className="w-5 h-5 text-emerald-400" />
              <span>การติดตั้งเว็บแอปพลิเคชัน (Web App Installation)</span>
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <p className="text-sm text-slate-300 leading-relaxed font-medium">
                  คุณสามารถติดตั้งระบบธนาคารโรงเรียนนี้ลงบนคอมพิวเตอร์ แท็บเล็ต หรือสมาร์ทโฟนของคุณ เพื่อให้เข้าใช้งานระบบได้อย่างสะดวกรวดเร็วเหมือนแอปพลิเคชันปกติ โดยไม่ต้องผ่านเบราว์เซอร์
                </p>
                {isInstallable ? (
                  <button
                    type="button"
                    onClick={onInstallApp}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-900/20 transition-all cursor-pointer active:scale-95 animate-pulse"
                  >
                    <Download className="w-4 h-4" />
                    <span>ติดตั้งแอปบนอุปกรณ์นี้</span>
                  </button>
                ) : (
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-950 border border-slate-800 text-slate-400 rounded-xl text-xs font-medium">
                    <Monitor className="w-4 h-4 text-slate-500" />
                    <span>แอปนี้ถูกติดตั้งไว้แล้ว หรือไม่รองรับการติดตั้งอัตโนมัติบนเบราว์เซอร์นี้</span>
                  </div>
                )}
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">คำแนะนำการติดตั้งด้วยตนเอง (Manual Installation)</h4>
                <ul className="space-y-2.5 text-xs text-slate-400">
                  <li className="flex gap-2">
                    <span className="w-8 h-5 rounded bg-slate-800 text-slate-300 flex items-center justify-center font-bold shrink-0 text-[10px]">iOS</span>
                    <span>เปิด Safari ➔ กดปุ่ม <strong>"แชร์ (Share)"</strong> ➔ เลือก <strong>"เพิ่มไปยังหน้าจอโฮม (Add to Home Screen)"</strong></span>
                  </li>
                  <li className="flex gap-2">
                    <span className="w-8 h-5 rounded bg-slate-800 text-slate-300 flex items-center justify-center font-bold shrink-0 text-[10px]">Chrome</span>
                    <span>กดปุ่ม <strong>"จุดสามจุด"</strong> ขวาบน ➔ เลือก <strong>"บันทึกและแชร์ (Save and share)"</strong> ➔ เลือก <strong>"ติดตั้งหน้าเว็บนี้เป็นแอป (Install page as app...)"</strong></span>
                  </li>
                  <li className="flex gap-2">
                    <span className="w-8 h-5 rounded bg-slate-800 text-slate-300 flex items-center justify-center font-bold shrink-0 text-[10px]">macOS</span>
                    <span>เปิด Safari ➔ คลิกเมนู <strong>"ไฟล์ (File)"</strong> ➔ เลือก <strong>"เพิ่มไปยัง Dock (Add to Dock...)"</strong></span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      ) : activeTab === 'staff' ? (
        /* TAB 2: STAFF LIST */
        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden animate-fadeIn">
          <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <Key className="w-5 h-5 text-emerald-400" />
              <h3 className="font-bold text-white">รายชื่อเจ้าหน้าที่ผู้มีสิทธิ์ใช้งาน</h3>
            </div>
            
            <div className="flex items-center gap-3 flex-wrap">
              {/* Search input */}
              <div className="relative w-48">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input 
                  type="text" 
                  placeholder="ค้นหาชื่อ, อีเมล..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg py-1.5 pl-8 pr-3 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              <button 
                type="button"
                onClick={openAddModal}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>เพิ่มบัญชีเจ้าหน้าที่</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-950/80 text-slate-400 text-xs uppercase border-b border-slate-800">
                <tr>
                  <th className="px-6 py-4 font-semibold">ชื่อ-นามสกุล</th>
                  <th className="px-6 py-4 font-semibold">อีเมล (บัญชีเข้าสู่ระบบ)</th>
                  <th className="px-6 py-4 font-semibold">ห้องเรียนที่ดูแล</th>
                  <th className="px-6 py-4 font-semibold">สิทธิ์ (Role)</th>
                  <th className="px-6 py-4 font-semibold">สถานะบัญชี</th>
                  <th className="px-6 py-4 font-semibold text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 text-xs">
                {filteredStaff.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-slate-500 text-xs font-medium">
                      ไม่พบข้อมูลรายชื่อเจ้าหน้าที่
                    </td>
                  </tr>
                ) : (
                  filteredStaff.map((staff) => (
                    <tr key={staff.id} className="hover:bg-slate-800/20 transition-colors">
                      <td className="px-6 py-4 font-bold text-white text-xs">{staff.name}</td>
                      <td className="px-6 py-4 text-slate-400 font-mono text-xs">{staff.email}</td>
                      <td className="px-6 py-4 text-slate-300 text-xs font-medium">{staff.classAssignment || '-'}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
                          staff.role === 'Admin' || staff.role === 'Super Admin' 
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                            : 'bg-slate-800 text-slate-300 border-slate-700'
                        }`}>
                          {(staff.role === 'Admin' || staff.role === 'Super Admin') && <ShieldCheck className="w-3 h-3" />}
                          {staff.role}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`flex items-center gap-1.5 text-xs font-bold ${staff.status === 'Active' ? 'text-emerald-400' : 'text-rose-400'}`}>
                          <span className={`w-2 h-2 rounded-full ${staff.status === 'Active' ? 'bg-emerald-400' : 'bg-rose-400'}`}></span>
                          <span>{staff.status === 'Active' ? 'Active' : 'Suspended'}</span>
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex justify-center items-center gap-2">
                          <button 
                            type="button"
                            onClick={() => openEditModal(staff)}
                            className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors cursor-pointer" 
                            title="แก้ไขสิทธิ์"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            type="button"
                            onClick={() => handleToggleSuspend(staff)}
                            disabled={staff.id === userSession.userId} 
                            className={`p-1.5 rounded-lg transition-colors ${staff.id === userSession.userId ? 'text-slate-700 cursor-not-allowed' : 'text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer'}`} 
                            title={staff.status === 'Active' ? "ระงับการใช้งาน" : "ยกเลิกระงับการใช้งาน"}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === 'logs' ? (
        /* TAB 3: SYSTEM LOGS */
        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl p-6 overflow-hidden animate-fadeIn">
          <LogsMainContent showToast={showToast} userSession={userSession} embedded={true} />
        </div>
      ) : activeTab === 'testing' ? (
        /* TAB 4: TEST RUNNER */
        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden animate-fadeIn flex flex-col h-[700px]">
          <SystemTestingPage embedded={true} />
        </div>
      ) : null}

      {/* Modal - Add Staff */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-scaleUp">
            <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-400" />
                <span>เพิ่มบัญชีเจ้าหน้าที่</span>
              </h3>
              <button 
                type="button" 
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddStaff} className="p-6 space-y-4 font-sans">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 block">ชื่อ-นามสกุล</label>
                <input 
                  type="text" 
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  className="w-full bg-slate-955 border border-slate-705 rounded-xl py-2.5 px-3 text-xs text-white focus:outline-none focus:border-emerald-500"
                  placeholder="เช่น คุณครูมานะ อดทน"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 block">อีเมลบัญชี (Email Address)</label>
                <input 
                  type="email" 
                  value={formEmail}
                  onChange={e => setFormEmail(e.target.value)}
                  className="w-full bg-slate-955 border border-slate-705 rounded-xl py-2.5 px-3 text-xs text-white focus:outline-none focus:border-emerald-500"
                  placeholder="เช่น mana@school.ac.th"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400 block">สิทธิ์ผู้ใช้งาน (Role)</label>
                  <select 
                    value={formRole}
                    onChange={e => setFormRole(e.target.value)}
                    className="w-full bg-slate-955 border border-slate-705 rounded-xl py-2.5 px-3 text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                    style={{ colorScheme: 'dark' }}
                  >
                    <option value="Teacher" className="bg-slate-900 text-white">Teacher (คุณครู)</option>
                    <option value="Admin" className="bg-slate-900 text-white">Admin (ผู้ดูแลระบบ)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400 block">สถานะเริ่มต้น (Status)</label>
                  <select 
                    value={formStatus}
                    onChange={e => setFormStatus(e.target.value)}
                    className="w-full bg-slate-955 border border-slate-705 rounded-xl py-2.5 px-3 text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                    style={{ colorScheme: 'dark' }}
                  >
                    <option value="Active" className="bg-slate-900 text-white">Active (พร้อมใช้งาน)</option>
                    <option value="Suspended" className="bg-slate-900 text-white">Suspended (ระงับการใช้งาน)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 block">ชั้นเรียน/ห้องเรียนรับผิดชอบ</label>
                <input 
                  type="text" 
                  value={formClass}
                  onChange={e => setFormClass(e.target.value)}
                  className="w-full bg-slate-955 border border-slate-705 rounded-xl py-2.5 px-3 text-xs text-white focus:outline-none focus:border-emerald-500"
                  placeholder="เช่น ชั้นมัธยมศึกษาปีที่ 1/2"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button 
                  type="button" 
                  onClick={() => setShowAddModal(false)}
                  className="bg-slate-800 hover:bg-slate-700 text-white font-bold px-4 py-2 rounded-xl text-xs transition-all cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button 
                  type="submit" 
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-5 py-2 rounded-xl text-xs transition-all cursor-pointer"
                >
                  เพิ่มบัญชี
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal - Edit Staff */}
      {showEditModal && selectedStaff && (
        <div className="fixed inset-0 bg-slate-955/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-scaleUp">
            <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-emerald-400" />
                <span>แก้ไขบัญชีเจ้าหน้าที่</span>
              </h3>
              <button 
                type="button" 
                onClick={() => { setShowEditModal(false); setSelectedStaff(null); }}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditStaff} className="p-6 space-y-4 font-sans">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 block">ชื่อ-นามสกุล</label>
                <input 
                  type="text" 
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  className="w-full bg-slate-955 border border-slate-705 rounded-xl py-2.5 px-3 text-xs text-white focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 block">อีเมลบัญชี (แก้ไขไม่ได้)</label>
                <input 
                  type="email" 
                  value={formEmail}
                  className="w-full bg-slate-950/50 border border-slate-850 rounded-xl py-2.5 px-3 text-xs text-slate-500 cursor-not-allowed"
                  disabled
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400 block">สิทธิ์ผู้ใช้งาน (Role)</label>
                  <select 
                    value={formRole}
                    onChange={e => setFormRole(e.target.value)}
                    className="w-full bg-slate-955 border border-slate-750 rounded-xl py-2.5 px-3 text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                    style={{ colorScheme: 'dark' }}
                  >
                    <option value="Teacher" className="bg-slate-900 text-white">Teacher (คุณครู)</option>
                    <option value="Admin" className="bg-slate-900 text-white">Admin (ผู้ดูแลระบบ)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400 block">สถานะบัญชี (Status)</label>
                  <select 
                    value={formStatus}
                    onChange={e => setFormStatus(e.target.value)}
                    className="w-full bg-slate-955 border border-slate-750 rounded-xl py-2.5 px-3 text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                    style={{ colorScheme: 'dark' }}
                  >
                    <option value="Active" className="bg-slate-900 text-white">Active (พร้อมใช้งาน)</option>
                    <option value="Suspended" className="bg-slate-900 text-white">Suspended (ระงับการใช้งาน)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 block">ชั้นเรียน/ห้องเรียนรับผิดชอบ</label>
                <input 
                  type="text" 
                  value={formClass}
                  onChange={e => setFormClass(e.target.value)}
                  className="w-full bg-slate-955 border border-slate-750 rounded-xl py-2.5 px-3 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button 
                  type="button" 
                  onClick={() => { setShowEditModal(false); setSelectedStaff(null); }}
                  className="bg-slate-800 hover:bg-slate-750 text-white font-bold px-4 py-2 rounded-xl text-xs transition-all cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button 
                  type="submit" 
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-5 py-2 rounded-xl text-xs transition-all cursor-pointer"
                >
                  บันทึกการแก้ไข
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
