import React, { useState, useEffect, useMemo } from 'react';
import { Clock, Search, Filter, Eye, X, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { query, orderBy, onSnapshot } from 'firebase/firestore';
import { getPublicCollection } from '@/src/utils/dbPaths';
import { AuditLog } from '@/src/types';

interface LogsMainContentProps {
  showToast: (message: string, type?: string) => void;
  userSession: any;
  embedded?: boolean;
}

export default function LogsMainContent({ showToast, userSession, embedded = false }: LogsMainContentProps) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [teachersMap, setTeachersMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  // Filters State
  const [teacherFilter, setTeacherFilter] = useState('');
  const [actionTypeFilter, setActionTypeFilter] = useState('');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Selected Log for Modal
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  // Load teachers to map IDs to Full Names
  useEffect(() => {
    const usersCol = getPublicCollection('users');
    const unsubscribe = onSnapshot(usersCol, (snapshot) => {
      const list: any[] = [];
      const map: Record<string, string> = {};
      snapshot.forEach((docSnap) => {
        const u = docSnap.data();
        list.push(u);
        if (u.userId) map[u.userId] = u.fullName;
        map[docSnap.id] = u.fullName;
      });
      setTeachers(list);
      setTeachersMap(map);
    }, (error) => {
      console.error("Firestore users load failed in Logs:", error);
    });
    return () => unsubscribe();
  }, []);

  // Load audit logs in real-time
  useEffect(() => {
    setLoading(true);
    const logsCol = getPublicCollection('audit_logs');
    const q = query(logsCol, orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: AuditLog[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ logId: docSnap.id, ...docSnap.data() } as AuditLog);
      });
      setLogs(list);
      setLoading(false);
    }, (error) => {
      console.error("Firestore audit_logs read error:", error);
      showToast("ล้มเหลวในการโหลดประวัติระบบจาก Firestore", "error");
      setLoading(false);
    });
    return () => unsubscribe();
  }, [showToast]);

  // Handle client-side filters
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // 1. Teacher Filter
      if (teacherFilter) {
        const teacherObj = teachers.find(
          (t) => t.userId === log.userId || t.email === log.userId || t.userId === teacherFilter
        );
        if (teacherObj) {
          if (teacherObj.userId !== teacherFilter) return false;
        } else {
          if (log.userId !== teacherFilter) return false;
        }
      }

      // 2. Action Type Filter
      if (actionTypeFilter && log.actionType !== actionTypeFilter) {
        return false;
      }

      // 3. Date Range Filter
      if (startDateFilter) {
        const logDateStr = log.timestamp.split('T')[0];
        if (logDateStr < startDateFilter) return false;
      }
      if (endDateFilter) {
        const logDateStr = log.timestamp.split('T')[0];
        if (logDateStr > endDateFilter) return false;
      }

      // 4. Text Search
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const remarksMatch = log.remarks?.toLowerCase().includes(q);
        const targetMatch = log.targetDocument?.toLowerCase().includes(q);
        const teacherName = (teachersMap[log.userId] || '').toLowerCase();
        const userIdMatch = log.userId.toLowerCase().includes(q);
        const actionMatch = log.actionType.toLowerCase().includes(q);
        
        if (!remarksMatch && !targetMatch && !teacherName.includes(q) && !userIdMatch && !actionMatch) {
          return false;
        }
      }

      return true;
    });
  }, [logs, teacherFilter, actionTypeFilter, startDateFilter, endDateFilter, searchQuery, teachersMap, teachers]);

  // Reset page to 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [teacherFilter, actionTypeFilter, startDateFilter, endDateFilter, searchQuery]);

  // Paginated Logs
  const paginatedLogs = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredLogs.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredLogs, currentPage]);

  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);

  const actionTranslations: Record<string, { label: string; color: string }> = {
    Login: { label: 'เข้าสู่ระบบ', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
    Logout: { label: 'ออกจากระบบ', color: 'bg-slate-500/10 text-slate-400 border-slate-500/20' },
    CreateStudent: { label: 'เพิ่มนักเรียน', color: 'bg-emerald-500/10 text-emerald-450 border-emerald-500/20' },
    EditStudent: { label: 'แก้ไขนักเรียน', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
    Deposit: { label: 'ฝากเงิน', color: 'bg-teal-500/10 text-teal-400 border-teal-500/20' },
    Withdraw: { label: 'ถอนเงิน', color: 'bg-rose-500/10 text-rose-455 border-rose-500/20' },
    Void: { label: 'ยกเลิกรายการ', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
    PrintReport: { label: 'พิมพ์รายงาน', color: 'bg-sky-500/10 text-sky-400 border-sky-500/20' },
    ExportData: { label: 'ส่งออกข้อมูล', color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' },
  };

  const handleClearFilters = () => {
    setTeacherFilter('');
    setActionTypeFilter('');
    setStartDateFilter('');
    setEndDateFilter('');
    setSearchQuery('');
  };

  return (
    <div className="space-y-6">
      {/* Title & Description */}
      {!embedded && (
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-white flex items-center gap-2">
              <Clock className="w-7 h-7 text-emerald-400" />
              <span>บันทึกประวัติกิจกรรมระบบ (System Logs)</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              แสดงประวัติการเปลี่ยนแปลงข้อมูล การเข้าใช้งานระบบ และพฤติกรรมต่างๆ ของผู้ใช้เพื่อความปลอดภัยและความโปร่งใสสูงสุด
            </p>
          </div>
        </div>
      )}

      {/* Filter panel */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Teacher Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5 font-sans">คุณครูผู้ทำรายการ</label>
            <select
              value={teacherFilter}
              onChange={(e) => setTeacherFilter(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500 transition-all cursor-pointer font-sans"
            >
              <option value="">ทั้งหมด (All Teachers)</option>
              {teachers.map((t) => (
                <option key={t.userId} value={t.userId}>{t.fullName || t.email}</option>
              ))}
            </select>
          </div>

          {/* Action Type Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5 font-sans">ประเภทการกระทำ</label>
            <select
              value={actionTypeFilter}
              onChange={(e) => setActionTypeFilter(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500 transition-all cursor-pointer font-sans"
            >
              <option value="">ทั้งหมด (All Actions)</option>
              {Object.keys(actionTranslations).map((key) => (
                <option key={key} value={key}>{actionTranslations[key].label}</option>
              ))}
            </select>
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5 font-sans">ตั้งแต่วันที่</label>
            <input
              type="date"
              value={startDateFilter}
              onChange={(e) => setStartDateFilter(e.target.value)}
              className="w-full bg-slate-955 border border-slate-800 rounded-xl px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500 transition-all cursor-pointer [color-scheme:dark] font-sans"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5 font-sans">ถึงวันที่</label>
            <input
              type="date"
              value={endDateFilter}
              onChange={(e) => setEndDateFilter(e.target.value)}
              className="w-full bg-slate-955 border border-slate-800 rounded-xl px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500 transition-all cursor-pointer [color-scheme:dark] font-sans"
            />
          </div>

        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-slate-850">
          {/* Search bar */}
          <div className="relative w-full sm:max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="ค้นหาข้อความอ้างอิง, รายละเอียดคำอธิบาย..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 pl-10 pr-4 text-sm text-slate-200 focus:outline-none focus:border-emerald-500 transition-all font-sans"
            />
          </div>

          <button
            type="button"
            onClick={handleClearFilters}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold px-5 py-2 rounded-xl text-sm transition-all cursor-pointer border border-slate-700/60 font-sans"
          >
            <Filter className="w-4 h-4 text-slate-400" />
            <span>ล้างตัวกรอง (Clear Filters)</span>
          </button>
        </div>
      </div>

      {/* Main Table Panel */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg font-sans">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin" />
            <p className="text-sm font-semibold text-slate-450">กำลังดึงข้อมูลบันทึกระบบ...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-20">
            <span className="text-4xl">📂</span>
            <h3 className="text-lg font-bold text-white mt-4">ไม่พบประวัติการทำรายการ</h3>
            <p className="text-xs text-slate-500 mt-1">ไม่มีข้อมูลประวัติการทำรายการตามช่วงเวลาหรือตัวกรองที่คุณกำหนด</p>
          </div>
        ) : (
          <div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-955/40 text-slate-400 text-xs uppercase border-b border-slate-800">
                  <tr>
                    <th className="px-6 py-4 font-semibold">วันเวลา (Timestamp)</th>
                    <th className="px-6 py-4 font-semibold">การกระทำ (Action)</th>
                    <th className="px-6 py-4 font-semibold">ผู้ทำรายการ (User)</th>
                    <th className="px-6 py-4 font-semibold">รายละเอียดคำอธิบาย (Remarks)</th>
                    <th className="px-6 py-4 font-semibold">เอกสารอ้างอิง (Target)</th>
                    <th className="px-6 py-4 font-semibold text-center">ดูรายละเอียด</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {paginatedLogs.map((log) => {
                    const actDetails = actionTranslations[log.actionType] || {
                      label: log.actionType,
                      color: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
                    };
                    const teacherName = teachersMap[log.userId] || log.userId;

                    return (
                      <tr key={log.logId} className="hover:bg-slate-800/20 transition-colors">
                        {/* Timestamp */}
                        <td className="px-6 py-4 font-mono text-xs text-slate-350">
                          {new Date(log.timestamp).toLocaleString('th-TH', {
                            year: 'numeric', month: '2-digit', day: '2-digit',
                            hour: '2-digit', minute: '2-digit', second: '2-digit'
                          })}
                        </td>

                        {/* Action Badge */}
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${actDetails.color}`}>
                            {actDetails.label}
                          </span>
                        </td>

                        {/* Teacher/User */}
                        <td className="px-6 py-4 font-medium text-slate-200">
                          {teacherName}
                        </td>

                        {/* Remarks */}
                        <td className="px-6 py-4 text-xs text-slate-300 max-w-xs truncate" title={log.remarks}>
                          {log.remarks}
                        </td>

                        {/* Target Document */}
                        <td className="px-6 py-4 font-mono text-xs text-slate-400">
                          {log.targetDocument || '-'}
                        </td>

                        {/* Action View Details */}
                        <td className="px-6 py-4 text-center">
                          <button
                            type="button"
                            onClick={() => setSelectedLog(log)}
                            className="p-2 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/25 text-emerald-400 hover:text-emerald-300 rounded-xl transition-all cursor-pointer inline-flex items-center justify-center"
                            title="ดูรายละเอียดเชิงลึก"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800">
                <span className="text-xs text-slate-400">
                  แสดงหน้า {currentPage} จากทั้งหมด {totalPages} (พบทั้งหมด {filteredLogs.length} รายการ)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(currentPage - 1)}
                    className="p-1.5 bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-white rounded-lg disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer border border-slate-700/50"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
                    const isCurrent = p === currentPage;
                    return (
                      <button
                        type="button"
                        key={p}
                        onClick={() => setCurrentPage(p)}
                        className={`w-7.5 h-7.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          isCurrent
                            ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/40'
                            : 'bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700/30'
                        }`}
                      >
                        {p}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(currentPage + 1)}
                    className="p-1.5 bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-white rounded-lg disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer border border-slate-700/50"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Audit Log Detail Modal */}
      {selectedLog && (
        <AuditLogDetailModal
          log={selectedLog}
          onClose={() => setSelectedLog(null)}
          teachersMap={teachersMap}
          actionTranslations={actionTranslations}
          showToast={showToast}
        />
      )}
    </div>
  );
}

/* ==========================================
 * AUDIT LOG DETAIL MODAL (DIFF & RAW JSON VIEW)
 * ========================================== */
interface AuditLogDetailModalProps {
  log: AuditLog;
  onClose: () => void;
  teachersMap: Record<string, string>;
  actionTranslations: Record<string, { label: string; color: string }>;
  showToast: (message: string, type?: string) => void;
}

function AuditLogDetailModal({ log, onClose, teachersMap, actionTranslations, showToast }: AuditLogDetailModalProps) {
  const [activeSubTab, setActiveSubTab] = useState<'diff' | 'raw'>('diff');
  const [showOnlyChanged, setShowOnlyChanged] = useState(true);

  const teacherName = teachersMap[log.userId] || log.userId;
  const actDetails = actionTranslations[log.actionType] || {
    label: log.actionType,
    color: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  };

  const fieldLabelMap: Record<string, string> = {
    studentId: 'รหัสนักเรียน (ID)',
    studentNumber: 'รหัสประจำตัวนักเรียน',
    fullName: 'ชื่อ-นามสกุล',
    classRoom: 'ชั้นเรียน/ห้องเรียน',
    status: 'สถานะบัญชี',
    createdAt: 'วันเวลาที่บันทึกเข้าระบบ',
    updatedAt: 'วันเวลาที่อัปเดตล่าสุด',
    deletedAt: 'วันเวลาทำลายข้อมูล (Soft Delete)',
    currentBalance: 'ยอดเงินออมคงเหลือ',
    accountNumber: 'เลขที่บัญชี',
    lastTransactionAt: 'วันที่ทำธุรกรรมล่าสุด',
    transactionId: 'รหัสธุรกรรมหลัก',
    referenceNumber: 'เลขที่เอกสารอ้างอิงธุรกรรม',
    transactionType: 'ประเภทธุรกรรมการเงิน',
    amount: 'จำนวนเงินธุรกรรม',
    balanceBefore: 'ยอดเงินก่อนทำธุรกรรม',
    balanceAfter: 'ยอดเงินหลังทำธุรกรรม',
    createdBy: 'คุณครูผู้สร้างรายการ',
    remark: 'หมายเหตุรายละเอียด',
    voidDetails: 'รายละเอียดการยกเลิกรายการ',
    voidedBy: 'ยกเลิกรายการโดยครู',
    voidedAt: 'ยกเลิกรายการเวลา',
    voidRemark: 'เหตุผลการยกเลิกรายการ',
    reversalReferenceNumber: 'เลขที่รายการยกเลิกคืนเงินอ้างอิง',
    email: 'อีเมลผู้ใช้งานครู',
    role: 'ระดับสิทธิ์ผู้ใช้งาน',
    classAssignment: 'ชั้นเรียนรับผิดชอบของครู',
  };

  const formatValue = (val: any): string => {
    if (val === null || val === undefined) return '-';
    if (typeof val === 'object') {
      if (val.voidedBy !== undefined || val.voidRemark !== undefined) {
        return `ยกเลิกโดย: ${val.voidedBy || '-'}, เหตุผล: ${val.voidRemark || '-'}, เมื่อ: ${val.voidedAt ? new Date(val.voidedAt).toLocaleString('th-TH') : '-'}`;
      }
      return JSON.stringify(val);
    }
    if (typeof val === 'boolean') {
      return val ? 'ใช่' : 'ไม่ใช่';
    }
    if (typeof val === 'number') {
      return val.toLocaleString(undefined, { minimumFractionDigits: 2 });
    }
    return String(val);
  };

  // Get keys to compare
  const diffKeys = useMemo(() => {
    const oldVal = log.oldValue;
    const newVal = log.newValue;
    if (!oldVal && !newVal) return [];

    const keysSet = new Set<string>();
    
    const addKeys = (obj: any) => {
      if (obj && typeof obj === 'object') {
        Object.keys(obj).forEach((k) => {
          if (k !== 'logId' && k !== 'password') {
            keysSet.add(k);
          }
        });
      }
    };

    addKeys(oldVal);
    addKeys(newVal);

    return Array.from(keysSet).sort((a, b) => {
      const labelA = fieldLabelMap[a] ? 0 : 1;
      const labelB = fieldLabelMap[b] ? 0 : 1;
      if (labelA !== labelB) return labelA - labelB;
      return a.localeCompare(b);
    });
  }, [log]);

  const hasChanges = log.oldValue !== null && log.newValue !== null;
  const isCreate = log.oldValue === null && log.newValue !== null;
  const isDelete = log.oldValue !== null && log.newValue === null;

  return (
    <div className="fixed inset-0 bg-slate-955/70 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn overflow-y-auto font-sans">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl shadow-2xl flex flex-col my-8 max-h-[85vh] overflow-hidden">
        
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 p-2.5 rounded-2xl">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <span>รายละเอียดประวัติกิจกรรมระบบ</span>
                <span className="text-xs font-mono font-normal bg-slate-850 px-2 py-0.5 rounded text-slate-400 border border-slate-800">
                  {log.logId}
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">เปรียบเทียบความเปลี่ยนแปลงของข้อมูลในฐานข้อมูล (Audit Log Details)</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5.5 h-5.5" />
          </button>
        </div>

        {/* Modal Info Summary Panel */}
        <div className="px-6 py-4 bg-slate-955/30 border-b border-slate-850 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs shrink-0">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-medium min-w-[100px] inline-block">วันเวลา:</span>
              <span className="font-mono text-slate-200">
                {new Date(log.timestamp).toLocaleString('th-TH', {
                  year: 'numeric', month: '2-digit', day: '2-digit',
                  hour: '2-digit', minute: '2-digit', second: '2-digit'
                })}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-medium min-w-[100px] inline-block">ผู้ทำรายการ:</span>
              <span className="text-slate-200 font-bold">{teacherName}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-medium min-w-[100px] inline-block">การกระทำ:</span>
              <span className={`inline-flex px-2 py-0.5 rounded border text-[10px] font-bold ${actDetails.color}`}>
                {actDetails.label}
              </span>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-medium min-w-[100px] inline-block">อ้างอิงเอกสาร:</span>
              <span className="font-mono text-slate-300 bg-slate-950/60 px-2 py-0.5 rounded border border-slate-850">
                {log.targetDocument || '-'}
              </span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-slate-400 font-medium min-w-[100px] inline-block pt-0.5">รายละเอียด:</span>
              <span className="text-slate-200 max-w-sm font-semibold">{log.remarks}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-medium min-w-[100px] inline-block">อุปกรณ์/เบราว์เซอร์:</span>
              <span className="text-slate-400 truncate max-w-sm" title={log.deviceInfo}>
                {log.deviceInfo}
              </span>
            </div>
          </div>
        </div>

        {/* Modal Tabs Bar */}
        <div className="px-6 border-b border-slate-855 flex items-center justify-between shrink-0 bg-slate-900/40">
          <div className="flex gap-4 font-sans">
            <button
              type="button"
              onClick={() => setActiveSubTab('diff')}
              className={`py-3 text-sm font-extrabold border-b-2 transition-all cursor-pointer ${
                activeSubTab === 'diff'
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              เปรียบเทียบข้อมูล (Diff)
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('raw')}
              className={`py-3 text-sm font-extrabold border-b-2 transition-all cursor-pointer ${
                activeSubTab === 'raw'
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              ข้อมูลดิบ JSON (Raw)
            </button>
          </div>

          {activeSubTab === 'diff' && hasChanges && (
            <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showOnlyChanged}
                onChange={() => setShowOnlyChanged(!showOnlyChanged)}
                className="accent-emerald-500 cursor-pointer rounded"
              />
              <span>แสดงเฉพาะฟิลด์ที่มีการเปลี่ยนแปลง</span>
            </label>
          )}
        </div>

        {/* Modal Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-950/20">
          {activeSubTab === 'diff' ? (
            <div>
              {/* Case 1: Modification Event (Both old and new exist) */}
              {hasChanges && (
                <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-900 shadow-md">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-955/50 text-slate-400 uppercase font-semibold border-b border-slate-800">
                      <tr>
                        <th className="px-4 py-3.5 w-1/3">ชื่อฟิลด์ (Field)</th>
                        <th className="px-4 py-3.5 w-1/3 text-rose-455 bg-rose-505/5">ค่าเดิมก่อนหน้า (Old Value)</th>
                        <th className="px-4 py-3.5 w-1/3 text-emerald-400 bg-emerald-500/5">ค่าใหม่ที่แก้ไข (New Value)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40">
                      {diffKeys.map((key) => {
                        const oldRaw = log.oldValue[key];
                        const newRaw = log.newValue[key];
                        const oldStr = formatValue(oldRaw);
                        const changed = oldStr !== formatValue(newRaw);

                        if (showOnlyChanged && !changed) {
                          return null;
                        }

                        return (
                          <tr key={key} className={`hover:bg-slate-800/10 transition-colors ${changed ? 'bg-amber-500/[0.02]' : ''}`}>
                            {/* Field label */}
                            <td className="px-4 py-3 font-medium text-slate-205">
                              <p>{fieldLabelMap[key] || key}</p>
                              <p className="text-[10px] text-slate-500 font-mono mt-0.5">{key}</p>
                            </td>

                            {/* Old value cell */}
                            <td className={`px-4 py-3 font-mono break-all text-slate-400 ${changed ? 'bg-rose-500/10 text-rose-300 font-semibold decoration-rose-500/30' : ''}`}>
                              {oldStr}
                            </td>

                            {/* New value cell */}
                            <td className={`px-4 py-3 font-mono break-all text-slate-400 ${changed ? 'bg-emerald-500/10 text-emerald-300 font-bold' : ''}`}>
                              {formatValue(newRaw)}
                            </td>
                          </tr>
                        );
                      })}

                      {/* Fallback if everything is filtered out */}
                      {showOnlyChanged && diffKeys.every(k => formatValue(log.oldValue[k]) === formatValue(log.newValue[k])) && (
                        <tr>
                          <td colSpan={3} className="text-center py-8 text-slate-500 italic">
                            ฟิลด์ข้อมูลหลักไม่มีการเปลี่ยนแปลงที่แสดงผลได้ (เช่น มีเพียงตัวแปรภายในที่เปลี่ยนไป)
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Case 2: Creation Event (New value only) */}
              {isCreate && (
                <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-900 shadow-md">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-955/50 text-slate-400 uppercase font-semibold border-b border-slate-800">
                      <tr>
                        <th className="px-4 py-3.5 w-1/3">ชื่อฟิลด์ (Field)</th>
                        <th className="px-4 py-3.5 w-2/3 text-emerald-400 bg-emerald-500/5">ข้อมูลใหม่ที่ถูกสร้าง (Created Value)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40">
                      {diffKeys.map((key) => {
                        const val = log.newValue[key];
                        return (
                          <tr key={key} className="hover:bg-slate-850/10 bg-emerald-500/[0.01]">
                            {/* Field label */}
                            <td className="px-4 py-3 font-medium text-slate-205">
                              <p>{fieldLabelMap[key] || key}</p>
                              <p className="text-[10px] text-slate-500 font-mono mt-0.5">{key}</p>
                            </td>

                            {/* New value cell */}
                            <td className="px-4 py-3 font-mono break-all bg-emerald-500/10 text-emerald-300 font-semibold">
                              {formatValue(val)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Case 3: Deletion Event (Old value only) */}
              {isDelete && (
                <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-900 shadow-md">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-955/50 text-slate-400 uppercase font-semibold border-b border-slate-800">
                      <tr>
                        <th className="px-4 py-3.5 w-1/3">ชื่อฟิลด์ (Field)</th>
                        <th className="px-4 py-3.5 w-2/3 text-rose-400 bg-rose-505/5">ข้อมูลก่อนหน้า (Deleted Value)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40">
                      {diffKeys.map((key) => {
                        const val = log.oldValue[key];
                        return (
                          <tr key={key} className="hover:bg-slate-850/10 bg-rose-500/[0.01]">
                            {/* Field label */}
                            <td className="px-4 py-3 font-medium text-slate-205">
                              <p>{fieldLabelMap[key] || key}</p>
                              <p className="text-[10px] text-slate-500 font-mono mt-0.5">{key}</p>
                            </td>

                            {/* Old value cell */}
                            <td className="px-4 py-3 font-mono break-all bg-rose-500/10 text-rose-350 font-semibold">
                              {formatValue(val)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Case 4: No structured data */}
              {!log.oldValue && !log.newValue && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-400 italic">
                  ไม่มีการดัดแปลงหรือเปลี่ยนแปลงโครงสร้างข้อมูลในเหตุการณ์นี้ (เช่น การเปิดดูรายงาน หรือ การนำข้อมูลออก)
                </div>
              )}
            </div>
          ) : (
            /* Raw JSON View Sub-Tab */
            <div className="space-y-4 font-mono text-xs">
              <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800 max-h-[50vh] overflow-y-auto text-slate-300">
                <pre>{JSON.stringify(log, null, 2)}</pre>
              </div>
              <div className="flex justify-end font-sans">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(log, null, 2));
                    showToast("คัดลอกข้อมูลดิบ JSON เรียบร้อยแล้ว", "success");
                  }}
                  className="bg-slate-800 hover:bg-slate-750 text-xs font-bold text-slate-300 hover:text-white px-4 py-2 rounded-xl border border-slate-700/60 transition-all cursor-pointer"
                >
                  คัดลอก JSON (Copy to Clipboard)
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-800 flex justify-end gap-3 shrink-0 font-sans">
          <button
            type="button"
            onClick={onClose}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-6 py-2.5 rounded-xl text-sm transition-all shadow-md active:scale-95 cursor-pointer"
          >
            ปิดหน้าต่าง (Close)
          </button>
        </div>
      </div>
    </div>
  );
}
