import React, { useState, useMemo } from 'react';
import { FileText, User, Calendar, Building, Search, RefreshCw } from 'lucide-react';
import { Student, Account } from '@/src/types';
import { writeAuditLog } from '@/src/utils/bankUtils';
import { useBankData } from '@/src/context/BankDataContext';
import StudentLedgerView from './StudentLedgerView';
import DailyReportView from './DailyReportView';
import ClassroomSummaryView from './ClassroomSummaryView';

interface ReportsMainContentProps {
  showToast: (message: string, type?: string) => void;
  userSession: any;
}

export default function ReportsMainContent({ showToast, userSession }: ReportsMainContentProps) {
  const { students, accounts, loading } = useBankData();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  
  // Phase 12 Tab State
  const [reportsTab, setReportsTab] = useState<'individual' | 'daily' | 'classroom'>('individual');

  // Construct lookup map for DailyReportView
  const allStudentsMap = useMemo(() => {
    const map: Record<string, Student> = {};
    students.forEach((s) => {
      map[s.studentId] = s;
    });
    return map;
  }, [students]);

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
      
      // Audit Log
      writeAuditLog(
        'ExportData',
        'system/csv_export',
        null,
        { filename, headersCount: headers.length, rowsCount: rows.length },
        `ส่งออกข้อมูลระบบเป็นไฟล์ CSV: ${filename} (จำนวน ${rows.length} แถว)`,
        userSession.userId
      );
    } catch (error) {
      console.error("Export error:", error);
      showToast("ล้มเหลวในการส่งออกข้อมูล", "error");
    }
  };

  // Filter students based on search query (ONLY Active students for individual ledger printing)
  const activeStudents = useMemo(() => {
    return students.filter(student => student.status === 'Active');
  }, [students]);

  const filteredStudents = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return activeStudents.filter(student => {
      return student.fullName.toLowerCase().includes(q) || 
             student.studentNumber.includes(searchQuery) ||
             student.studentId.toLowerCase().includes(q);
    });
  }, [activeStudents, searchQuery]);

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
          type="button"
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
          type="button"
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
          type="button"
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[500px] overflow-y-auto p-1 font-sans">
              {filteredStudents.map((student) => {
                const acc = accounts[student.studentId];
                return (
                  <button
                    key={student.studentId}
                    type="button"
                    onClick={() => setSelectedStudent(student)}
                    className="text-left p-4 rounded-xl border border-slate-800 bg-slate-950/40 hover:bg-slate-800/40 hover:border-slate-700 transition-all flex justify-between items-start cursor-pointer group w-full"
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
