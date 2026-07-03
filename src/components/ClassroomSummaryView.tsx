import React, { useMemo } from 'react';
import { Printer, Download, TrendingUp, Building, Users } from 'lucide-react';
import { Student, Account } from '@/src/types';
import { writeAuditLog } from '@/src/utils/bankUtils';

interface ClassroomSummaryViewProps {
  students: Student[];
  accounts: Record<string, Account>;
  userSession: any;
  onExportCSV: (filename: string, headers: string[], rows: any[][]) => void;
}

export default function ClassroomSummaryView({
  students,
  accounts,
  userSession,
  onExportCSV
}: ClassroomSummaryViewProps) {
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
    writeAuditLog(
      'PrintReport',
      'reports/classroom_summary',
      null,
      null,
      `พิมพ์รายงานสรุปเงินออมแยกตามห้องเรียน`,
      userSession.userId
    );
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
            type="button"
            onClick={handlePrint}
            className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
          >
            <Printer className="w-4 h-4 text-slate-300" />
            <span>พิมพ์รายงาน</span>
          </button>
          
          <button
            type="button"
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
