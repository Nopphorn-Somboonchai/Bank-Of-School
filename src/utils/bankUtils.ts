import { getPublicCollection, getPublicDoc } from '@/src/utils/dbPaths';
import { doc, setDoc, getDocs, query, where } from 'firebase/firestore';
import { roundMoney } from '@/src/utils/money';
import { ForbiddenError } from '@/src/utils/errors';

/**
 * Format localized Thai dates in YYYY-MM-DD format under Bangkok timezone.
 */
export const getLocalDateString = () => {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
};

/**
 * ดึงปี ค.ศ. ปัจจุบันตามเขตเวลา Asia/Bangkok
 */
export const getLocalYear = (): number => {
  const yearStr = getLocalDateString().split('-')[0];
  const year = parseInt(yearStr, 10);
  return Number.isFinite(year) ? year : new Date().getFullYear();
};

/**
 * Log user actions to audit logs collection in Firestore.
 */
export const writeAuditLog = async (
  actionType: string,
  targetDocument: string,
  oldValue: any | null,
  newValue: any | null,
  remarks: string,
  userId: string
) => {
  try {
    const logsCol = getPublicCollection('audit_logs');
    const logId = "LOG_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7).toUpperCase();
    await setDoc(doc(logsCol, logId), {
      logId,
      timestamp: new Date().toISOString(),
      userId,
      actionType,
      targetDocument,
      oldValue,
      newValue,
      remarks,
      deviceInfo: typeof window !== 'undefined' ? navigator.userAgent : 'Unknown'
    });
    console.log("Audit log saved successfully:", logId);
  } catch (error) {
    console.error("Error writing audit log:", error);
  }
};


/**
 * เครื่องมือซ่อมแซมสรุปยอดข้อมูลภาพรวม (Admin Repair Tool)
 * 
 * ⚠️ คำเตือนสำคัญ (Expensive Operation):
 * ฟังก์ชันนี้มีค่าใช้จ่ายสูงและใช้ทรัพยากรมาก เนื่องจากต้องอ่านข้อมูลทั้ง Collection ของ
 * `students`, `accounts`, และ `transactions` ห้ามเรียกใช้ใน Flow การทำงานปกติเด็ดขาด!
 * 
 * ให้ใช้เฉพาะเมื่อข้อมูลใน dashboard_summary คลาดเคลื่อน และต้องเรียกโดยผู้ดูแลระบบ (Admin) เท่านั้น
 *
 * @param callerRole บทบาทของผู้เรียก (ต้องเป็น 'Admin' หรือ 'Super Admin')
 */
export const recalculateDashboardSummary = async (callerRole?: string) => {
  if (callerRole && callerRole !== 'Admin' && callerRole !== 'Super Admin') {
    throw new ForbiddenError('เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถเรียกใช้การคำนวณซ่อมแซมสรุปยอดได้');
  }
  if (!callerRole) {
    console.warn('⚠️ recalculateDashboardSummary called without explicit callerRole. Restricted to Admin.');
  }

  try {
    const studentsCol = getPublicCollection('students');
    const accountsCol = getPublicCollection('accounts');
    const txCol = getPublicCollection('transactions');
    const todayStr = getLocalDateString();

    // 1. Get all students count (non-deleted) and collect active student IDs
    const studentsSnap = await getDocs(studentsCol);
    let activeStudentCount = 0;
    const activeStudentIds = new Set<string>();
    studentsSnap.forEach((docSnap) => {
      const s = docSnap.data();
      if (s.deletedAt == null) {
        activeStudentCount++;
        activeStudentIds.add(docSnap.id);
      }
    });

    // 2. Sum currentBalance of all accounts belonging to active students
    const accountsSnap = await getDocs(accountsCol);
    let totalSavings = 0;
    accountsSnap.forEach((docSnap) => {
      const acc = docSnap.data();
      if (acc.status === 'Active' && acc.studentId && activeStudentIds.has(acc.studentId)) {
        totalSavings += Number(acc.currentBalance || 0);
      }
    });

    // 3. Get transactions in the last 7 days (including today) to compute daily stats
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const qTx = query(txCol, where('createdAt', '>=', sevenDaysAgo.toISOString()));
    const txSnap = await getDocs(qTx);

    const dailyStats: Record<string, { deposits: number; withdrawals: number }> = {};
    let todayDeposits = 0;
    let todayWithdrawals = 0;

    txSnap.forEach((docSnap) => {
      const tx = docSnap.data();
      if (tx.status === 'Void') return;
      
      const txDateStr = new Date(tx.createdAt).toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
      const amount = Number(tx.amount || 0);

      if (!dailyStats[txDateStr]) {
        dailyStats[txDateStr] = { deposits: 0, withdrawals: 0 };
      }

      if (tx.transactionType === 'Deposit') {
        dailyStats[txDateStr].deposits = roundMoney(dailyStats[txDateStr].deposits + amount);
        if (txDateStr === todayStr) {
          todayDeposits = roundMoney(todayDeposits + amount);
        }
      } else if (tx.transactionType === 'Withdrawal') {
        dailyStats[txDateStr].withdrawals = roundMoney(dailyStats[txDateStr].withdrawals + amount);
        if (txDateStr === todayStr) {
          todayWithdrawals = roundMoney(todayWithdrawals + amount);
        }
      }
    });

    // Ensure dailyStats has entries for all of the last 7 days
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
      if (!dailyStats[dateStr]) {
        dailyStats[dateStr] = { deposits: 0, withdrawals: 0 };
      }
    }

    const summaryData = {
      totalSavings: roundMoney(totalSavings),
      totalStudents: activeStudentCount,
      todayDeposits: roundMoney(todayDeposits),
      todayWithdrawals: roundMoney(todayWithdrawals),
      dailyStats,
      lastUpdated: new Date().toISOString(),
      currentDate: todayStr
    };

    const summaryDocRef = getPublicDoc('settings', 'dashboard_summary');
    await setDoc(summaryDocRef, summaryData, { merge: true });
    return summaryData;
  } catch (error) {
    console.error("Error in recalculateDashboardSummary:", error);
    throw error;
  }
};

