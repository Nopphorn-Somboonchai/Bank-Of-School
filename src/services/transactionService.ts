import { runTransaction } from 'firebase/firestore';
import { db } from '@/src/config/firebase';
import { getPublicDoc } from '@/src/utils/dbPaths';
import { Student, Account, Transaction } from '@/src/types';
import { getLocalDateString, getLocalYear, trimDailyStats } from '@/src/utils/bankUtils';
import { InsufficientFundsError, InvalidAccountStatusError, AccountNotFoundError } from '../utils/errors';
import { normalizeAmount, roundMoney } from '../utils/money';

export interface DepositParams {
  studentId: string;
  studentFullName: string;
  amount: number;
  userId: string;
  userFullName: string;
}

export interface WithdrawalParams {
  studentId: string;
  studentFullName: string;
  amount: number;
  userId: string;
  userFullName: string;
}

interface LedgerEntryParams {
  type: 'Deposit' | 'Withdrawal';
  studentId: string;
  studentFullName: string;
  amount: number;
  userId: string;
  userFullName: string;
}

/**
 * ดำเนินการบันทึกรายการบัญชี (Atomic Financial Ledger Entry)
 * รวบรวมตรรกะร่วมของทั้งฝากและถอน เพื่อความปลอดภัย ความถูกต้องของยอดเงิน และลดความซ้ำซ้อน
 */
async function executeLedgerEntry({
  type,
  studentId,
  studentFullName,
  amount,
  userId,
  userFullName
}: LedgerEntryParams): Promise<Transaction> {
  const cleanAmount = normalizeAmount(amount);
  const currentYear = getLocalYear();

  return await runTransaction(db, async (transaction) => {
    // 1. กำหนดอ้างอิงเอกสารโดยใช้ dbPaths (Strict Paths) เท่านั้น
    const studentDocRef = getPublicDoc('students', studentId);
    const accountDocRef = getPublicDoc('accounts', studentId);
    const counterDocRef = getPublicDoc('counter', currentYear.toString());
    const summaryDocRef = getPublicDoc('settings', 'dashboard_summary');

    // 2. ดึงข้อมูลล่าสุด (Firestore Reads ทั้งหมดก่อน Writes)
    const freshStudentSnap = await transaction.get(studentDocRef);
    const freshAccountSnap = await transaction.get(accountDocRef);
    const counterSnap = await transaction.get(counterDocRef);
    const freshSummarySnap = await transaction.get(summaryDocRef);

    // ตรวจสอบสถานะนักเรียนใน transaction เดียวกัน (Task 2.3)
    if (!freshStudentSnap.exists()) {
      throw new AccountNotFoundError();
    }
    const freshStudentData = freshStudentSnap.data() as Student;
    if (freshStudentData.deletedAt != null || freshStudentData.status !== 'Active') {
      throw new InvalidAccountStatusError(freshStudentData.status || 'Suspended');
    }

    // ตรวจสอบสถานะบัญชีเงินฝาก
    if (!freshAccountSnap.exists()) {
      throw new AccountNotFoundError();
    }
    const freshAccountData = freshAccountSnap.data() as Account;
    if (freshAccountData.status !== 'Active') {
      throw new InvalidAccountStatusError(freshAccountData.status);
    }

    const freshBalanceBefore = roundMoney(Number(freshAccountData.currentBalance || 0));

    // Overdraft protection ใน transaction สำหรับการถอนเงิน
    if (type === 'Withdrawal' && freshBalanceBefore < cleanAmount) {
      throw new InsufficientFundsError(freshBalanceBefore, cleanAmount);
    }

    const freshBalanceAfter = type === 'Deposit'
      ? roundMoney(freshBalanceBefore + cleanAmount)
      : roundMoney(freshBalanceBefore - cleanAmount);

    let newSeq = 1;
    if (counterSnap.exists()) {
      const counterData = counterSnap.data();
      newSeq = (counterData.lastSequenceNumber || 0) + 1;
    }

    // 3. บันทึกข้อมูลและปรับปรุงยอด (Writes)
    // อัปเดตเลขอ้างอิงปี
    transaction.set(counterDocRef, {
      year: currentYear,
      lastSequenceNumber: newSeq
    }, { merge: true });

    // อัปเดตยอดเงินในบัญชี
    transaction.update(accountDocRef, {
      currentBalance: freshBalanceAfter,
      lastTransactionAt: new Date().toISOString()
    });

    // อัปเดตข้อมูลสรุปของแดชบอร์ด
    const todayStr = getLocalDateString();
    const delta = type === 'Deposit' ? cleanAmount : -cleanAmount;
    let totalSavings = delta;
    let todayDeposits = type === 'Deposit' ? cleanAmount : 0;
    let todayWithdrawals = type === 'Withdrawal' ? cleanAmount : 0;
    let dailyStats: Record<string, { deposits: number; withdrawals: number }> = {};

    if (freshSummarySnap.exists()) {
      const sData = freshSummarySnap.data();
      totalSavings = roundMoney((sData.totalSavings || 0) + delta);
      dailyStats = sData.dailyStats || {};

      if (sData.currentDate === todayStr) {
        todayDeposits = roundMoney((sData.todayDeposits || 0) + (type === 'Deposit' ? cleanAmount : 0));
        todayWithdrawals = roundMoney((sData.todayWithdrawals || 0) + (type === 'Withdrawal' ? cleanAmount : 0));
      } else {
        if (sData.currentDate) {
          dailyStats[sData.currentDate] = {
            deposits: roundMoney(sData.todayDeposits || 0),
            withdrawals: roundMoney(sData.todayWithdrawals || 0)
          };
        }
        todayDeposits = type === 'Deposit' ? cleanAmount : 0;
        todayWithdrawals = type === 'Withdrawal' ? cleanAmount : 0;
      }
    }

    dailyStats[todayStr] = {
      deposits: todayDeposits,
      withdrawals: todayWithdrawals
    };

    dailyStats = trimDailyStats(dailyStats, 10);

    transaction.set(summaryDocRef, {
      totalSavings,
      todayDeposits,
      todayWithdrawals,
      dailyStats,
      currentDate: todayStr,
      lastUpdated: new Date().toISOString()
    }, { merge: true });

    // สร้างเอกสารธุรกรรม (Transaction Doc)
    const prefix = type === 'Deposit' ? 'DEP' : 'WDL';
    const refNo = `${prefix}${currentYear}${newSeq.toString().padStart(6, '0')}`;
    const txId = "TX_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7).toUpperCase();
    const txDocRef = getPublicDoc('transactions', txId);

    const newTransaction: Transaction = {
      transactionId: txId,
      referenceNumber: refNo,
      studentId: studentId,
      accountId: freshAccountData.accountId,
      transactionType: type,
      amount: cleanAmount,
      balanceBefore: freshBalanceBefore,
      balanceAfter: freshBalanceAfter,
      createdAt: new Date().toISOString(),
      createdBy: userId,
      remark: type === 'Deposit'
        ? `ฝากเงินเข้าบัญชี ${freshAccountData.accountNumber}`
        : `ถอนเงินออกจากบัญชี ${freshAccountData.accountNumber}`,
      status: 'Completed',
      voidDetails: {
        voidedBy: null,
        voidedAt: null,
        voidRemark: null,
        reversalReferenceNumber: null
      }
    };

    transaction.set(txDocRef, newTransaction);

    // บันทึกประวัติการใช้ระบบ (Audit Log Doc)
    const logId = "LOG_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7).toUpperCase();
    const logDocRef = getPublicDoc('audit_logs', logId);

    const actionType = type === 'Deposit' ? 'Deposit' : 'Withdraw';
    const remarks = type === 'Deposit'
      ? `ครู ${userFullName} ทำรายการฝากเงิน ฿${cleanAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} ให้กับ ${studentFullName} (Ref: ${refNo})`
      : `ครู ${userFullName} ทำรายการถอนเงิน ฿${cleanAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} จาก ${studentFullName} (Ref: ${refNo})`;

    const newAudit = {
      logId: logId,
      timestamp: new Date().toISOString(),
      userId: userId,
      actionType,
      targetDocument: `transactions/${txId}`,
      oldValue: null,
      newValue: newTransaction,
      remarks,
      deviceInfo: typeof window !== 'undefined' ? navigator.userAgent : 'Unknown'
    };

    transaction.set(logDocRef, newAudit);

    return newTransaction;
  });
}

/**
 * ทำรายการฝากเงินเข้าบัญชีนักเรียน (Atomic Firestore Transaction)
 * เป็นไปตามกฎเหล็ก Strict Paths ผ่าน dbPaths.ts
 */
export async function performDeposit(params: DepositParams): Promise<Transaction> {
  return executeLedgerEntry({
    type: 'Deposit',
    ...params
  });
}

/**
 * ทำรายการถอนเงินออกจากบัญชีนักเรียน (Atomic Firestore Transaction)
 * เป็นไปตามกฎเหล็ก Strict Paths ผ่าน dbPaths.ts
 */
export async function performWithdrawal(params: WithdrawalParams): Promise<Transaction> {
  return executeLedgerEntry({
    type: 'Withdrawal',
    ...params
  });
}
