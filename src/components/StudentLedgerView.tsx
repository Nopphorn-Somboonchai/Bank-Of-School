import React, { useState, useEffect } from 'react';
import { ChevronLeft, Printer, Filter, ArrowDownToLine, ArrowUpFromLine, RefreshCw } from 'lucide-react';
import { query, where, onSnapshot } from 'firebase/firestore';
import { getPublicCollection } from '@/src/utils/dbPaths';
import { Student, Account, Transaction, UserSession } from '@/src/types';
import { writeAuditLog } from '@/src/utils/bankUtils';

interface StudentLedgerViewProps {
  student: Student;
  account: Account | undefined;
  onBack: () => void;
  showToast: (message: string, type?: string) => void;
  userSession: UserSession;
}

export default function StudentLedgerView({
  student,
  account,
  onBack,
  showToast,
  userSession
}: StudentLedgerViewProps) {
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
    writeAuditLog(
      'PrintReport',
      `students/${student.studentId}/statement`,
      null,
      { studentId: student.studentId, studentName: student.fullName },
      `พิมพ์สมุดบัญชีเงินออมของ ${student.fullName} (รหัสประจำตัว: ${student.studentNumber})`,
      userSession.userId
    );
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
      <div className="glass-header-banner rounded-2xl p-4 shadow-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-slate-200 hover:text-white transition-colors text-sm font-bold cursor-pointer w-fit drop-shadow-sm"
        >
          <ChevronLeft className="w-5 h-5 text-sky-400" />
          <span>กลับไปหน้ารายชื่อนักเรียน</span>
        </button>

        <button
          onClick={handlePrint}
          className="bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-400 hover:to-cyan-400 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 shadow-lg shadow-sky-500/25 active:scale-95 cursor-pointer self-end sm:self-auto"
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
      <div className="bg-slate-900/38 backdrop-blur-md border border-white/15 rounded-2xl overflow-hidden shadow-xl ledger-container">
        {/* Card Header (B&W/Gray style on print) */}
        <div className="bg-gradient-to-r from-sky-500/20 to-teal-500/20 border-b border-white/10 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 print:bg-none print:border-b-2 print:border-slate-300 print:px-0">
          <div>
            <span className="text-xs font-bold text-sky-400 uppercase tracking-wider print:text-slate-700">ประวัติบัญชีออมทรัพย์</span>
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
      <div className="bg-slate-900/38 backdrop-blur-md border border-white/15 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 no-print shadow-md">
        <h4 className="font-bold text-white flex items-center gap-2 text-sm shrink-0">
          <Filter className="w-4 h-4 text-sky-400" />
          ตัวกรองข้อมูล (Filters)
        </h4>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
          {/* Month Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-300 font-medium">เดือน:</span>
            <select
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="bg-slate-950/40 border border-white/15 text-slate-100 rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-sky-400 cursor-pointer backdrop-blur-md"
            >
              <option value="All">ทุกเดือน</option>
              {monthsThai.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          {/* Year Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-300 font-medium">ปี:</span>
            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className="bg-slate-950/40 border border-white/15 text-slate-100 rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-sky-400 cursor-pointer backdrop-blur-md"
            >
              <option value="All">ทุกปี</option>
              {uniqueYears.map((yr) => (
                <option key={yr} value={yr.toString()}>{yr + 543} (ค.ศ. {yr})</option>
              ))}
            </select>
          </div>

          {/* Sort Order */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-300 font-medium">เรียงลำดับ:</span>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as 'newest' | 'oldest')}
              className="bg-slate-950/40 border border-white/15 text-slate-100 rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-sky-400 cursor-pointer backdrop-blur-md"
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
              className="text-xs text-sky-400 hover:text-sky-300 underline cursor-pointer"
            >
              ล้างค่า
            </button>
          )}
        </div>
      </div>

      {/* Summary statistics bar on screen (Hidden on print) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 no-print">
        <div className="bg-slate-900/38 backdrop-blur-md border border-white/15 rounded-xl p-4 text-center">
          <span className="text-xs font-semibold text-slate-400 uppercase block">รายการทั้งหมด</span>
          <span className="text-xl font-bold text-white mt-1 block font-mono">
            {filteredAndSortedTransactions.length} รายการ
          </span>
        </div>
        <div className="bg-slate-900/38 backdrop-blur-md border border-white/15 rounded-xl p-4 text-center">
          <span className="text-xs font-semibold text-slate-400 uppercase block">ยอดฝากรวม (ช่วงเวลาที่กรอง)</span>
          <span className="text-xl font-bold text-emerald-300 mt-1 block font-mono">
            ฿{totalDeposits.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <div className="bg-slate-900/38 backdrop-blur-md border border-white/15 rounded-xl p-4 text-center">
          <span className="text-xs font-semibold text-slate-400 uppercase block">ยอดถอนรวม (ช่วงเวลาที่กรอง)</span>
          <span className="text-xl font-bold text-rose-300 mt-1 block font-mono">
            ฿{totalWithdrawals.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <div className="bg-slate-900/38 backdrop-blur-md border border-white/15 rounded-xl p-4 text-center">
          <span className="text-xs font-semibold text-slate-400 uppercase block">ยอดต่างฝาก-ถอน</span>
          <span className={`text-xl font-bold mt-1 block font-mono ${
            (totalDeposits - totalWithdrawals) >= 0 ? 'text-emerald-300' : 'text-rose-300'
          }`}>
            ฿{(totalDeposits - totalWithdrawals).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* Ledger Table Section */}
      <div className="bg-slate-900/38 backdrop-blur-md border border-white/15 rounded-2xl overflow-hidden shadow-xl ledger-container">
        {loading ? (
          <div className="p-12 text-center text-slate-400 space-y-3">
            <RefreshCw className="w-8 h-8 animate-spin text-sky-400 mx-auto" />
            <p className="text-sm font-medium">กำลังโหลดประวัติธุรกรรม...</p>
          </div>
        ) : filteredAndSortedTransactions.length === 0 ? (
          <div className="p-20 text-center text-slate-400 space-y-2">
            <p className="text-lg font-medium">ไม่พบรายการธุรกรรม</p>
            <p className="text-xs text-slate-500 no-print">ไม่มีธุรกรรมตามช่วงเวลาที่กำหนด หรือนักเรียนยังไม่ได้ทำรายการฝาก-ถอน</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm print:text-xs">
              <thead className="bg-slate-950/40 text-slate-200 text-xs uppercase border-b border-white/10 print:bg-slate-100 print:text-slate-900">
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
