import React, { useState, useEffect } from 'react';
import { TrendingUp, Clock, Building, Users, ArrowDownToLine, ArrowUpFromLine, RefreshCw, CheckCircle, Shield } from 'lucide-react';
import { onSnapshot, query, orderBy, limit, getDoc } from 'firebase/firestore';
import { getPublicDoc, getPublicCollection } from '@/src/utils/dbPaths';
import { getLocalDateString } from '@/src/utils/bankUtils';
import { UserSession } from '@/src/types';

interface DashboardMainContentProps {
  showToast: (message: string, type?: string) => void;
  userSession: UserSession;
}

const MetricCard = ({
  title,
  value,
  icon: Icon,
  colorClass,
  trendText
}: {
  title: string;
  value: string | number;
  icon: React.ComponentType<any>;
  colorClass: string;
  trendText: string;
}) => (
  <div className="bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-lg shadow-sky-950/20 hover:border-emerald-500/30 transition-all animate-fadeIn">
    <div className="flex justify-between items-start">
      <div>
        <p className="text-sm text-slate-300 font-medium mb-1">{title}</p>
        <h3 className="text-2xl font-bold text-white mb-2">{value}</h3>
        <p className={`text-xs flex items-center gap-1 ${trendText.includes('+') ? 'text-emerald-400' : 'text-slate-400'}`}>
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

export default function DashboardMainContent({ showToast, userSession }: DashboardMainContentProps) {
  const [summary, setSummary] = useState<any>(null);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [studentNames, setStudentNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // 1. Listen to Dashboard summary & Transactions
  useEffect(() => {
    const summaryDocRef = getPublicDoc('settings', 'dashboard_summary');

    const unsubscribeSummary = onSnapshot(summaryDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const todayStr = getLocalDateString();
        const isToday = data.currentDate === todayStr;

        setSummary({
          ...data,
          todayDeposits: isToday ? (data.todayDeposits || 0) : 0,
          todayWithdrawals: isToday ? (data.todayWithdrawals || 0) : 0
        });
      } else {
        setSummary({
          totalSavings: 0,
          totalStudents: 0,
          todayDeposits: 0,
          todayWithdrawals: 0,
          dailyStats: {}
        });
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

  // 3. Manual refresh handler
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const summaryDocRef = getPublicDoc('settings', 'dashboard_summary');
      const snap = await getDoc(summaryDocRef);
      if (snap.exists()) {
        const data = snap.data();
        const todayStr = getLocalDateString();
        const isToday = data.currentDate === todayStr;
        setSummary({
          ...data,
          todayDeposits: isToday ? (data.todayDeposits || 0) : 0,
          todayWithdrawals: isToday ? (data.todayWithdrawals || 0) : 0
        });
      }
      showToast("รีเฟรชข้อมูลแดชบอร์ดเรียบร้อยแล้ว");
    } catch (err: unknown) {
      console.error("Manual refresh error:", err);
      const msg = err instanceof Error ? err.message : String(err);
      showToast("ไม่สามารถรีเฟรชข้อมูลได้: " + msg, "error");
    } finally {
      setRefreshing(false);
    }
  };

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
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 hover:text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50 active:scale-95"
            title="รีเฟรชข้อมูลแดชบอร์ดล่าสุด"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            รีเฟรช
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
        <div className="lg:col-span-2 bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-lg shadow-sky-950/20 flex flex-col justify-between h-[340px]">
          <div>
            <h3 className="font-semibold text-white flex items-center gap-2 mb-1">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
              แนวโน้มการออมและการถอนในรอบสัปดาห์ (Weekly Savings Trend)
            </h3>
            <p className="text-xs text-slate-300">เปรียบเทียบยอดฝากและยอดถอนสะสมย้อนหลัง 7 วันในระบบ</p>
          </div>

          <div className="relative flex-grow flex items-end justify-between gap-2 mt-6 h-40 border-b border-white/10 pb-2">
            {chartData.map((data) => {
              const depHeight = (data.deposits / maxAmount) * 100;
              const wdHeight = (data.withdrawals / maxAmount) * 100;

              return (
                <div key={data.dateStr} className="flex-1 flex flex-col items-center group relative">

                  {/* Tooltip */}
                  <div className="absolute bottom-full mb-2 bg-slate-950/90 border border-white/15 rounded-xl p-2.5 shadow-2xl text-[10px] font-medium pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10 w-36 -translate-x-1/2 left-1/2 backdrop-blur-md">
                    <p className="text-slate-300 font-bold text-center border-b border-white/10 pb-1 mb-1.5">{data.dateLabel} {data.isToday ? '(วันนี้)' : ''}</p>
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
                    <span className={`block font-semibold ${data.isToday ? 'text-emerald-400' : 'text-slate-300'}`}>
                      {data.dayLabel}
                    </span>
                    <span className="block text-[8px] text-slate-400 mt-0.5">
                      {data.dateLabel.split(' ')[0]}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-4 text-xs mt-4 justify-center">
            <div className="flex items-center gap-1.5 text-slate-300">
              <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full inline-block"></span>
              <span>ยอดฝาก (Deposits)</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-300">
              <span className="w-2.5 h-2.5 bg-rose-500 rounded-full inline-block"></span>
              <span>ยอดถอน (Withdrawals)</span>
            </div>
          </div>
        </div>

        {/* System Status on Right Column */}
        <div className="bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-lg shadow-sky-950/20 flex flex-col justify-between h-[340px]">
          <div>
            <h3 className="font-semibold text-white mb-4">สถานะระบบ (System Status)</h3>

            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 flex items-start gap-3 backdrop-blur-md">
                <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-emerald-400">Database Connected</p>
                  <p className="text-xs text-slate-300 mt-1">เชื่อมต่อข้อมูลแบบเรียลไทม์กับ Firestore เรียบร้อย</p>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-sky-500/30 bg-sky-500/10 flex items-start gap-3 backdrop-blur-md">
                <Shield className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-sky-400">Secure Session Active</p>
                  <p className="text-xs text-slate-300 mt-1">ใช้งานโดย: {userSession.fullName}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Transactions Table */}
      <div className="bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-lg shadow-sky-950/20 font-sans">
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
                      <td className="px-5 py-3 font-medium text-slate-205">{studentName}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${isVoid ? 'bg-slate-950 text-slate-500 border-slate-800' :
                          tx.transactionType === 'Deposit' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                          }`}>
                          {tx.transactionType === 'Deposit' ? <ArrowDownToLine className="w-3 h-3" /> : <ArrowUpFromLine className="w-3 h-3" />}
                          {tx.transactionType}
                        </span>
                      </td>
                      <td className={`px-5 py-3 text-right font-bold font-mono ${isVoid ? 'text-slate-500' :
                        tx.transactionType === 'Deposit' ? 'text-emerald-400' : 'text-rose-400'
                        }`}>
                        {isVoid ? '' : tx.transactionType === 'Deposit' ? '+' : '-'}฿{tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-5 py-3 text-center text-slate-400 text-xs font-mono">
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
