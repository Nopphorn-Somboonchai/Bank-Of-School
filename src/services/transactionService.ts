import { runTransaction } from 'firebase/firestore';
import { db } from '@/src/config/firebase';
import { getPublicDoc } from '@/src/utils/dbPaths';
import { Student, Account, Transaction } from '@/src/types';
import { getLocalDateString } from '@/src/utils/bankUtils';
import { InsufficientFundsError, InvalidAccountStatusError, AccountNotFoundError } from '../utils/errors';

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

/**
 * ทำรายการฝากเงินเข้าบัญชีนักเรียน (Atomic Firestore Transaction)
 * เป็นไปตามกฎเหล็ก Strict Paths ผ่าน dbPaths.ts
 */
export async function performDeposit({
  studentId,
  studentFullName,
  amount,
  userId,
  userFullName
}: DepositParams): Promise<Transaction> {
  const currentYear = new Date().getFullYear();

  return await runTransaction(db, async (transaction) => {
    // 1. กำหนดอ้างอิงเอกสารโดยใช้ dbPaths (Strict Paths) เท่านั้น
    const accountDocRef = getPublicDoc('accounts', studentId);
    const counterDocRef = getPublicDoc('counter', currentYear.toString());
    const summaryDocRef = getPublicDoc('settings', 'dashboard_summary');

    // 2. ดึงข้อมูลล่าสุด (Firestore Reads ก่อน Writes)
    const freshAccountSnap = await transaction.get(accountDocRef);
    const counterSnap = await transaction.get(counterDocRef);
    const freshSummarySnap = await transaction.get(summaryDocRef);

    if (!freshAccountSnap.exists()) {
      throw new AccountNotFoundError();
    }
    
    const freshAccountData = freshAccountSnap.data() as Account;
    if (freshAccountData.status !== 'Active') {
      throw new InvalidAccountStatusError(freshAccountData.status);
    }

    const freshBalanceBefore = Number(freshAccountData.currentBalance || 0);
    const freshBalanceAfter = freshBalanceBefore + amount;

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
    let totalSavings = amount;
    let todayDeposits = amount;
    let todayWithdrawals = 0;
    let dailyStats: Record<string, { deposits: number; withdrawals: number }> = {};
    
    if (freshSummarySnap.exists()) {
      const sData = freshSummarySnap.data();
      totalSavings = (sData.totalSavings || 0) + amount;
      dailyStats = sData.dailyStats || {};
      
      if (sData.currentDate === todayStr) {
        todayDeposits = (sData.todayDeposits || 0) + amount;
        todayWithdrawals = sData.todayWithdrawals || 0;
      } else {
        if (sData.currentDate) {
          dailyStats[sData.currentDate] = {
            deposits: sData.todayDeposits || 0,
            withdrawals: sData.todayWithdrawals || 0
          };
        }
        todayDeposits = amount;
        todayWithdrawals = 0;
      }
    }
    
    dailyStats[todayStr] = {
      deposits: todayDeposits,
      withdrawals: todayWithdrawals
    };
    
    const sortedKeys = Object.keys(dailyStats).sort();
    if (sortedKeys.length > 10) {
      const keysToDelete = sortedKeys.slice(0, sortedKeys.length - 10);
      keysToDelete.forEach(k => delete dailyStats[k]);
    }
    
    transaction.set(summaryDocRef, {
      totalSavings,
      todayDeposits,
      todayWithdrawals,
      dailyStats,
      currentDate: todayStr,
      lastUpdated: new Date().toISOString()
    }, { merge: true });

    // สร้างเอกสารธุรกรรม (Transaction Doc)
    const refNo = `DEP${currentYear}${newSeq.toString().padStart(6, '0')}`;
    const txId = "TX_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7).toUpperCase();
    const txDocRef = getPublicDoc('transactions', txId); 
    
    const newTransaction: Transaction = {
      transactionId: txId,
      referenceNumber: refNo,
      studentId: studentId,
      accountId: freshAccountData.accountId,
      transactionType: 'Deposit',
      amount: amount,
      balanceBefore: freshBalanceBefore,
      balanceAfter: freshBalanceAfter,
      createdAt: new Date().toISOString(),
      createdBy: userId,
      remark: `ฝากเงินเข้าบัญชี ${freshAccountData.accountNumber}`,
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
    
    const newAudit = {
      logId: logId,
      timestamp: new Date().toISOString(),
      userId: userId,
      actionType: 'Deposit',
      targetDocument: `transactions/${txId}`,
      oldValue: null,
      newValue: newTransaction,
      remarks: `ครู ${userFullName} ทำรายการฝากเงิน ฿${amount.toLocaleString(undefined, {minimumFractionDigits: 2})} ให้กับ ${studentFullName} (Ref: ${refNo})`,
      deviceInfo: typeof window !== 'undefined' ? navigator.userAgent : 'Unknown'
    };

    transaction.set(logDocRef, newAudit);

    return newTransaction;
  });
}

/**
 * ทำรายการถอนเงินออกจากบัญชีนักเรียน (Atomic Firestore Transaction)
 * เป็นไปตามกฎเหล็ก Strict Paths ผ่าน dbPaths.ts
 */
export async function performWithdrawal({
  studentId,
  studentFullName,
  amount,
  userId,
  userFullName
}: WithdrawalParams): Promise<Transaction> {
  const currentYear = new Date().getFullYear();

  return await runTransaction(db, async (transaction) => {
    // 1. กำหนดอ้างอิงเอกสารโดยใช้ dbPaths (Strict Paths) เท่านั้น
    const accountDocRef = getPublicDoc('accounts', studentId);
    const counterDocRef = getPublicDoc('counter', currentYear.toString());
    const summaryDocRef = getPublicDoc('settings', 'dashboard_summary');

    // 2. ดึงข้อมูลล่าสุด (Firestore Reads ก่อน Writes)
    const freshAccountSnap = await transaction.get(accountDocRef);
    const counterSnap = await transaction.get(counterDocRef);
    const freshSummarySnap = await transaction.get(summaryDocRef);

    if (!freshAccountSnap.exists()) {
      throw new AccountNotFoundError();
    }
    
    const freshAccountData = freshAccountSnap.data() as Account;
    if (freshAccountData.status !== 'Active') {
      throw new InvalidAccountStatusError(freshAccountData.status);
    }

    const freshBalanceBefore = Number(freshAccountData.currentBalance || 0);
    // Overdraft protection ใน transaction
    if (freshBalanceBefore < amount) {
      throw new InsufficientFundsError(freshBalanceBefore, amount);
    }

    const freshBalanceAfter = freshBalanceBefore - amount;

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
    let totalSavings = -amount;
    let todayDeposits = 0;
    let todayWithdrawals = amount;
    let dailyStats: Record<string, { deposits: number; withdrawals: number }> = {};
    
    if (freshSummarySnap.exists()) {
      const sData = freshSummarySnap.data();
      totalSavings = (sData.totalSavings || 0) - amount;
      dailyStats = sData.dailyStats || {};
      
      if (sData.currentDate === todayStr) {
        todayDeposits = sData.todayDeposits || 0;
        todayWithdrawals = (sData.todayWithdrawals || 0) + amount;
      } else {
        if (sData.currentDate) {
          dailyStats[sData.currentDate] = {
            deposits: sData.todayDeposits || 0,
            withdrawals: sData.todayWithdrawals || 0
          };
        }
        todayDeposits = 0;
        todayWithdrawals = amount;
      }
    }
    
    dailyStats[todayStr] = {
      deposits: todayDeposits,
      withdrawals: todayWithdrawals
    };
    
    const sortedKeys = Object.keys(dailyStats).sort();
    if (sortedKeys.length > 10) {
      const keysToDelete = sortedKeys.slice(0, sortedKeys.length - 10);
      keysToDelete.forEach(k => delete dailyStats[k]);
    }
    
    transaction.set(summaryDocRef, {
      totalSavings,
      todayDeposits,
      todayWithdrawals,
      dailyStats,
      currentDate: todayStr,
      lastUpdated: new Date().toISOString()
    }, { merge: true });

    // สร้างเอกสารธุรกรรม (Transaction Doc)
    const refNo = `WDL${currentYear}${newSeq.toString().padStart(6, '0')}`;
    const txId = "TX_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7).toUpperCase();
    const txDocRef = getPublicDoc('transactions', txId); 
    
    const newTransaction: Transaction = {
      transactionId: txId,
      referenceNumber: refNo,
      studentId: studentId,
      accountId: freshAccountData.accountId,
      transactionType: 'Withdrawal',
      amount: amount,
      balanceBefore: freshBalanceBefore,
      balanceAfter: freshBalanceAfter,
      createdAt: new Date().toISOString(),
      createdBy: userId,
      remark: `ถอนเงินออกจากบัญชี ${freshAccountData.accountNumber}`,
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
    
    const newAudit = {
      logId: logId,
      timestamp: new Date().toISOString(),
      userId: userId,
      actionType: 'Withdraw',
      targetDocument: `transactions/${txId}`,
      oldValue: null,
      newValue: newTransaction,
      remarks: `ครู ${userFullName} ทำรายการถอนเงิน ฿${amount.toLocaleString(undefined, {minimumFractionDigits: 2})} จาก ${studentFullName} (Ref: ${refNo})`,
      deviceInfo: typeof window !== 'undefined' ? navigator.userAgent : 'Unknown'
    };

    transaction.set(logDocRef, newAudit);

    return newTransaction;
  });
}
