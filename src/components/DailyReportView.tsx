import React, { useState, useEffect } from 'react';
import { Calendar, Printer, Download, TrendingUp, TrendingDown, Clock, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';
import { query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { getPublicCollection } from '@/src/utils/dbPaths';
import { Student, Transaction, UserSession } from '@/src/types';
import { writeAuditLog } from '@/src/utils/bankUtils';
import DatePicker from './DatePicker';

interface DailyReportViewProps {
  allStudentsMap: Record<string, Student>;
  userSession: UserSession;
  onExportCSV: (filename: string, headers: string[], rows: any[][]) => void;
  showToast: (message: string, type?: string) => void;
}

export default function DailyReportView({
  allStudentsMap,
  userSession,
  onExportCSV,
  showToast
}: DailyReportViewProps) {
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
    writeAuditLog(
      'PrintReport',
      `reports/daily/${reportDate}`,
      null,
      { reportDate },
      `พิมพ์รายงานธุรกรรมประจำวันที่ ${new Date(reportDate).toLocaleDateString('th-TH')}`,
      userSession.userId
    );
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/38 backdrop-blur-md border border-white/15 rounded-2xl p-5 shadow-lg no-print">
        <div className="flex items-center gap-3">
          <div className="bg-sky-500/15 p-2.5 rounded-xl text-sky-400">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">เลือกวันที่เรียกรายงาน</label>
            <DatePicker
              value={reportDate}
              onChange={setReportDate}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            onClick={handlePrint}
            className="bg-slate-950/40 hover:bg-white/10 border border-white/15 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
          >
            <Printer className="w-4 h-4 text-slate-300" />
            <span>พิมพ์รายงาน</span>
          </button>
          
          <button
            type="button"
            onClick={handleExport}
            className="bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-400 hover:to-cyan-400 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 shadow-md shadow-sky-500/25"
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
        <div className="bg-slate-900/38 backdrop-blur-md border border-white/15 rounded-2xl p-5 shadow-md flex items-center gap-4 print-card-box">
          <div className="bg-emerald-500/15 p-3 rounded-2xl text-emerald-400 no-print">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block print-card-title">ยอดเงินฝากรวม (Total Deposits)</span>
            <span className="text-2xl font-black text-emerald-300 font-mono mt-1 block print-text-green print-card-value">
              ฿{totalDeposits.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Withdrawals Summary */}
        <div className="bg-slate-900/38 backdrop-blur-md border border-white/15 rounded-2xl p-5 shadow-md flex items-center gap-4 print-card-box">
          <div className="bg-rose-500/15 p-3 rounded-2xl text-rose-400 no-print">
            <TrendingDown className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block print-card-title">ยอดเงินถอนรวม (Total Withdrawals)</span>
            <span className="text-2xl font-black text-rose-300 font-mono mt-1 block print-text-red print-card-value">
              ฿{totalWithdrawals.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Net Cash Flow (Reconciliation) */}
        <div className="bg-slate-900/38 backdrop-blur-md border border-white/15 rounded-2xl p-5 shadow-md flex items-center gap-4 print-card-box">
          <div className="bg-sky-500/15 p-3 rounded-2xl text-sky-400 no-print">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block print-card-title">ยอดเงินสดสุทธิในลิ้นชัก (Net Cash Flow)</span>
            <span className={`text-2xl font-black font-mono mt-1 block print-card-value ${netCashFlow >= 0 ? 'text-sky-300 print-text-blue' : 'text-rose-300 print-text-red'}`}>
              {netCashFlow >= 0 ? '+' : ''}฿{netCashFlow.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      {/* Informative tips box */}
      <div className="bg-slate-950/80 backdrop-blur-xl border border-sky-400/40 rounded-2xl p-4.5 text-xs shadow-xl shadow-black/30 space-y-2.5 no-print">
        <p className="font-bold text-sky-300 text-sm flex items-center gap-2 drop-shadow-sm">
          <span className="p-1 rounded-lg bg-sky-500/20 text-sky-300 border border-sky-400/30">
            <AlertCircle className="w-4 h-4" />
          </span>
          คำแนะนำสำหรับการตรวจสอบยอดเงินสด (Cash drawer check):
        </p>
        <div className="space-y-1.5 pl-7 text-slate-100 font-medium leading-relaxed">
          <p className="flex items-start gap-2">
            <span className="text-sky-400 font-bold select-none">•</span>
            <span>
              <strong className="text-emerald-300 font-semibold">ยอดเงินฝาก:</strong> เพิ่มเงินสดเข้ากระปุก/ลิ้นชัก
              <span className="mx-2 text-slate-400">|</span>
              <strong className="text-rose-300 font-semibold">ยอดเงินถอน:</strong> นำเงินสดออกจากลิ้นชัก
            </span>
          </p>
          <p className="flex items-start gap-2">
            <span className="text-sky-400 font-bold select-none">•</span>
            <span>
              ยอดเงินสดสุทธิในลิ้นชักวันนี้ควรเพิ่มขึ้น/ลดลงตรงกับ{" "}
              <strong className="text-sky-300 font-semibold">ยอดเงินสดสุทธิ (Net Cash Flow)</strong> ข้างต้น
            </span>
          </p>
          <p className="flex items-start gap-2">
            <span className="text-sky-400 font-bold select-none">•</span>
            <span>
              รายการที่ถูกยกเลิก{" "}
              <strong className="text-amber-300 font-semibold">(Void)</strong>{" "}
              จะแสดงอยู่ในตารางสำหรับเก็บประวัติการตรวจสอบ แต่ยอดเงินจะถูกหักออกไม่นำมารวมในสรุปยอดเงินสด
            </span>
          </p>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-slate-900/38 backdrop-blur-md border border-white/15 rounded-2xl overflow-hidden shadow-xl">
        <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center no-print">
          <h3 className="text-sm font-bold text-white">รายละเอียดรายการธุรกรรมประจำวัน ({transactions.length} รายการ)</h3>
        </div>

        {loading ? (
          <div className="p-16 text-center text-slate-400 flex flex-col items-center gap-2">
            <RefreshCw className="w-8 h-8 animate-spin text-sky-400" />
            <span className="text-sm">กำลังค้นหาข้อมูลธุรกรรม...</span>
          </div>
        ) : transactions.length === 0 ? (
          <div className="p-16 text-center text-slate-400">
            <Calendar className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-sm font-semibold">ไม่มีข้อมูลการทำรายการในวันที่เลือก</p>
            <p className="text-xs text-slate-500 mt-1">ยังไม่มีคุณครูทำรายการฝากหรือถอนเงินในระบบของวันนี้</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse print-table">
              <thead>
                <tr className="bg-slate-950/40 border-b border-white/10">
                  <th className="px-6 py-3.5 text-xs font-bold text-slate-300 uppercase tracking-wider text-center">เวลา</th>
                  <th className="px-6 py-3.5 text-xs font-bold text-slate-300 uppercase tracking-wider">เลขที่อ้างอิง</th>
                  <th className="px-6 py-3.5 text-xs font-bold text-slate-300 uppercase tracking-wider">ชื่อ-นามสกุล</th>
                  <th className="px-6 py-3.5 text-xs font-bold text-slate-300 uppercase tracking-wider text-center">ชั้นเรียน</th>
                  <th className="px-6 py-3.5 text-xs font-bold text-slate-300 uppercase tracking-wider text-center">ประเภท</th>
                  <th className="px-6 py-3.5 text-xs font-bold text-slate-300 uppercase tracking-wider text-right">จำนวนเงิน</th>
                  <th className="px-6 py-3.5 text-xs font-bold text-slate-300 uppercase tracking-wider text-center">สถานะ</th>
                  <th className="px-6 py-3.5 text-xs font-bold text-slate-300 tracking-wider text-center no-print">ครูผู้บันทึก</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
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
