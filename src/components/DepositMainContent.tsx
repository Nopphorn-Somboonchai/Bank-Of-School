import React, { useState, useMemo } from 'react';
import { Search, ArrowDownToLine, RefreshCw, AlertCircle, X } from 'lucide-react';
import { runTransaction, doc } from 'firebase/firestore';
import { db } from '@/src/config/firebase';
import { getPublicCollection, getPublicDoc } from '@/src/utils/dbPaths';
import { Student, Account, Transaction } from '@/src/types';
import { writeAuditLog, getLocalDateString } from '@/src/utils/bankUtils';
import { useBankData } from '@/src/context/BankDataContext';

interface DepositMainContentProps {
  showToast: (message: string, type?: string) => void;
  userSession: any;
}

export default function DepositMainContent({ showToast, userSession }: DepositMainContentProps) {
  const { students, accounts, loading } = useBankData();
  const [searchQuery, setSearchQuery] = useState('');
  
  // Selected Student & Deposit Amount
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [amount, setAmount] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Modals state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Completed transaction for receipt
  const [currentTx, setCurrentTx] = useState<any | null>(null);

  // Filter students based on search query (ONLY Active students)
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

  const selectedAccount = selectedStudent ? accounts[selectedStudent.studentId] : null;

  // Validation function
  const validateAmount = (val: string): boolean => {
    setValidationError(null);
    if (!val) {
      setValidationError("กรุณาระบุจำนวนเงิน");
      return false;
    }
    const num = Number(val);
    if (isNaN(num)) {
      setValidationError("จำนวนเงินต้องเป็นตัวเลขเท่านั้น");
      return false;
    }
    if (num <= 0) {
      setValidationError("จำนวนเงินต้องมากกว่า 0 บาท");
      return false;
    }
    // Check decimal places (max 2)
    const decimalMatch = val.match(/^\d+(\.\d{1,2})?$/);
    if (!decimalMatch) {
      setValidationError("จำนวนเงินทศนิยมต้องไม่เกิน 2 ตำแหน่ง");
      return false;
    }
    return true;
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setAmount(val);
    if (val === '') {
      setValidationError(null);
    } else {
      validateAmount(val);
    }
  };

  const handleOpenConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) {
      showToast("กรุณาเลือกนักเรียน", "error");
      return;
    }
    if (!validateAmount(amount)) {
      showToast(validationError || "ข้อมูลไม่ถูกต้อง", "error");
      return;
    }
    
    // Check account status
    if (!selectedAccount) {
      showToast("ไม่พบข้อมูลบัญชีเงินออมสำหรับนักเรียนท่านนี้", "error");
      return;
    }
    if (selectedAccount.status !== 'Active') {
      showToast("บัญชีของนักเรียนถูกระงับชั่วคราว ไม่สามารถรับฝากเงินได้", "error");
      return;
    }

    setShowConfirmModal(true);
  };

  const handleConfirmTransaction = async () => {
    if (!selectedStudent || submitting) return;
    const account = accounts[selectedStudent.studentId];
    if (!account) return;

    setSubmitting(true);
    const depositAmount = parseFloat(amount);
    const currentYear = new Date().getFullYear();

    try {
      // Run atomic transaction
      const transactionResult = await runTransaction(db, async (transaction) => {
        // Prepare document references
        const accountDocRef = getPublicDoc('accounts', selectedStudent.studentId);
        const counterDocRef = getPublicDoc('counter', currentYear.toString());
        const summaryDocRef = getPublicDoc('settings', 'dashboard_summary');

        // 1. Execute all reads before any writes (Firestore requirement)
        const freshAccountSnap = await transaction.get(accountDocRef);
        const counterSnap = await transaction.get(counterDocRef);
        const freshSummarySnap = await transaction.get(summaryDocRef);

        if (!freshAccountSnap.exists()) {
          throw new Error("ไม่พบข้อมูลบัญชีเงินออมในระบบขณะทำธุรกรรม");
        }
        
        const freshAccountData = freshAccountSnap.data() as Account;
        if (freshAccountData.status !== 'Active') {
          throw new Error("บัญชีไม่ได้อยู่ในสถานะพร้อมใช้งาน (Suspended)");
        }

        const freshBalanceBefore = Number(freshAccountData.currentBalance || 0);
        const freshBalanceAfter = freshBalanceBefore + depositAmount;

        let newSeq = 1;
        if (counterSnap.exists()) {
          const counterData = counterSnap.data();
          newSeq = (counterData.lastSequenceNumber || 0) + 1;
        }

        // 2. Write operations
        // Write YearCounter update
        transaction.set(counterDocRef, {
          year: currentYear,
          lastSequenceNumber: newSeq
        }, { merge: true });

        // Update Student's Account Balance
        transaction.update(accountDocRef, {
          currentBalance: freshBalanceAfter,
          lastTransactionAt: new Date().toISOString()
        });

        // 2.5 Update Dashboard Summary atomically
        const todayStr = getLocalDateString();
        let totalSavings = depositAmount;
        let todayDeposits = depositAmount;
        let todayWithdrawals = 0;
        let dailyStats: Record<string, { deposits: number; withdrawals: number }> = {};
        
        if (freshSummarySnap.exists()) {
          const sData = freshSummarySnap.data();
          totalSavings = (sData.totalSavings || 0) + depositAmount;
          dailyStats = sData.dailyStats || {};
          
          if (sData.currentDate === todayStr) {
            todayDeposits = (sData.todayDeposits || 0) + depositAmount;
            todayWithdrawals = sData.todayWithdrawals || 0;
          } else {
            // Rollover: shift old today values into dailyStats before resetting
            if (sData.currentDate) {
              dailyStats[sData.currentDate] = {
                deposits: sData.todayDeposits || 0,
                withdrawals: sData.todayWithdrawals || 0
              };
            }
            todayDeposits = depositAmount;
            todayWithdrawals = 0;
          }
        }
        
        // Update dailyStats for today too
        dailyStats[todayStr] = {
          deposits: todayDeposits,
          withdrawals: todayWithdrawals
        };
        
        // Clean up dailyStats to keep last 10 days
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

        // 3. Create Transaction Document
        const txCol = getPublicCollection('transactions');
        const txDocRef = doc(txCol); 
        
        // Pattern: DEP + Year + 6 digit padded seq (e.g. DEP2026000001)
        const refNo = `DEP${currentYear}${newSeq.toString().padStart(6, '0')}`;
        
        const newTransaction: Transaction = {
          transactionId: txDocRef.id,
          referenceNumber: refNo,
          studentId: selectedStudent.studentId,
          accountId: account.accountId,
          transactionType: 'Deposit',
          amount: depositAmount,
          balanceBefore: freshBalanceBefore,
          balanceAfter: freshBalanceAfter,
          createdAt: new Date().toISOString(),
          createdBy: userSession.userId,
          remark: `ฝากเงินเข้าบัญชี ${account.accountNumber}`,
          status: 'Completed',
          voidDetails: {
            voidedBy: null,
            voidedAt: null,
            voidRemark: null,
            reversalReferenceNumber: null
          }
        };

        transaction.set(txDocRef, newTransaction);

        // 4. Create Audit Log
        const logsCol = getPublicCollection('audit_logs');
        const logDocRef = doc(logsCol);
        const newAudit = {
          logId: logDocRef.id,
          timestamp: new Date().toISOString(),
          userId: userSession.userId,
          actionType: 'Deposit',
          targetDocument: `transactions/${txDocRef.id}`,
          oldValue: null,
          newValue: newTransaction,
          remarks: `ครู ${userSession.fullName} ทำรายการฝากเงิน ฿${depositAmount.toLocaleString(undefined, {minimumFractionDigits: 2})} ให้กับ ${selectedStudent.fullName} (Ref: ${refNo})`,
          deviceInfo: typeof window !== 'undefined' ? navigator.userAgent : 'Unknown'
        };

        transaction.set(logDocRef, newAudit);

        return newTransaction;
      });

      // Clear form inputs
      setAmount('');
      setSelectedStudent(null);
      setValidationError(null);
      setShowConfirmModal(false);

      // Open Success receipt modal
      setCurrentTx(transactionResult);
      setShowReceiptModal(true);
      showToast("บันทึกธุรกรรมการฝากเงินสำเร็จ");

    } catch (err: any) {
      console.error("Transaction failed: ", err);
      showToast("ธุรกรรมล้มเหลว: " + err.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fadeIn">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
          <ArrowDownToLine className="w-7 h-7 text-emerald-400" />
          ทำรายการฝากเงิน (Deposit)
        </h2>
        <p className="text-sm text-slate-400 mt-1">ทำรายการฝากเงินเข้าบัญชีออมทรัพย์ของนักเรียนอย่างปลอดภัย</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Left/Middle Column: Search and Select Student */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <h3 className="text-md font-bold text-white flex items-center gap-2">
              <Search className="w-4 h-4 text-emerald-400" />
              1. ค้นหาและเลือกรายชื่อนักเรียน
            </h3>
            
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input 
                type="text" 
                placeholder="พิมพ์ชื่อนักเรียน, รหัสประจำตัว หรือ ID ระบบ..." 
                value={searchQuery}
                disabled={submitting}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-700/60 rounded-xl py-3 pl-10 pr-4 text-sm text-slate-200 focus:outline-none focus:border-emerald-500 transition-colors focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
              />
            </div>

            {/* Students List Box */}
            <div className="border border-slate-800 bg-slate-950/50 rounded-xl overflow-hidden max-h-[350px] overflow-y-auto divide-y divide-slate-850">
              {loading ? (
                <div className="p-8 text-center text-slate-500 flex flex-col items-center gap-2">
                  <RefreshCw className="w-6 h-6 animate-spin text-emerald-500" />
                  <span className="text-xs">กำลังโหลดรายชื่อนักเรียน...</span>
                </div>
              ) : filteredStudents.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  <span className="text-sm">ไม่พบนักเรียนตามเงื่อนไขการค้นหา</span>
                </div>
              ) : (
                filteredStudents.map((student) => {
                  const isSelected = selectedStudent?.studentId === student.studentId;
                  const acc = accounts[student.studentId];
                  return (
                    <button
                      key={student.studentId}
                      type="button"
                      disabled={submitting}
                      onClick={() => {
                        setSelectedStudent(student);
                        setValidationError(null);
                      }}
                      className={`w-full text-left px-5 py-3.5 transition-all flex items-center justify-between hover:bg-slate-800/30 ${
                        isSelected ? 'bg-emerald-500/10 hover:bg-emerald-500/15 border-l-4 border-emerald-500' : ''
                      }`}
                    >
                      <div>
                        <p className="text-sm font-bold text-white">{student.fullName}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-slate-400 font-mono">
                          <span>เลขประจำตัว: {student.studentNumber}</span>
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-700"></span>
                          <span>ห้อง: {student.classRoom}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-500">ยอดเงินคงเหลือ</p>
                        <p className="text-sm font-bold text-emerald-400 font-mono">
                          ฿{acc ? acc.currentBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                        </p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Transaction Form */}
        <div className="space-y-6">
          
          {/* Student Profile Card (if selected) */}
          {selectedStudent ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl animate-scaleUp">
              <div className="bg-emerald-600/10 border-b border-emerald-500/20 px-6 py-4 flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">บัญชีที่เลือก</span>
                <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30">Active</span>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase">ชื่อ-นามสกุล</h4>
                  <p className="text-lg font-bold text-white mt-0.5">{selectedStudent.fullName}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-xs font-semibold text-slate-500 uppercase">ชั้นเรียน</h4>
                    <p className="text-sm font-semibold text-slate-200 mt-0.5">ชั้น {selectedStudent.classRoom}</p>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-slate-500 uppercase">เลขบัญชีออมทรัพย์</h4>
                    <p className="text-sm font-semibold text-slate-200 mt-0.5 font-mono">
                      {selectedAccount ? selectedAccount.accountNumber : 'ไม่มีบัญชี'}
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800">
                  <h4 className="text-xs font-semibold text-slate-500 uppercase">ยอดเงินปัจจุบัน</h4>
                  <p className="text-2xl font-extrabold text-emerald-400 font-mono mt-1">
                    ฿{selectedAccount ? selectedAccount.currentBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center text-slate-500 space-y-2 py-12 shadow-xl">
              <span className="text-4xl block">👤</span>
              <p className="text-sm font-medium text-slate-400">กรุณาเลือกนักเรียนทางซ้ายมือ</p>
              <p className="text-xs text-slate-600">เพื่อเริ่มกรอกยอดทำรายการฝากเงิน</p>
            </div>
          )}

          {/* Form */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <h3 className="text-md font-bold text-white flex items-center gap-2">
              💵
              2. ระบุจำนวนเงินฝาก
            </h3>
            
            <form onSubmit={handleOpenConfirm} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase">จำนวนเงิน (บาท)</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500 font-bold text-sm">฿</span>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    disabled={!selectedStudent || submitting}
                    value={amount}
                    onChange={handleAmountChange}
                    className="w-full bg-slate-950/80 border border-slate-700/60 rounded-xl py-3 pl-8 pr-4 text-emerald-400 text-lg font-bold font-mono placeholder-slate-750 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
                {validationError && (
                  <p className="text-xs text-rose-400 font-semibold flex items-center gap-1.5 mt-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    {validationError}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={!selectedStudent || submitting || !!validationError || !amount}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-emerald-950/20 active:scale-95 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
              >
                <span>ทำรายการฝากเงิน</span>
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && selectedStudent && selectedAccount && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-scaleUp">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/20">
              <h3 className="font-bold text-white text-lg flex items-center gap-2">
                <span>⚠️ ตรวจสอบรายละเอียดการฝากเงิน</span>
              </h3>
              <button 
                onClick={() => !submitting && setShowConfirmModal(false)} 
                disabled={submitting}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Details */}
            <div className="p-6 space-y-4">
              <div className="p-4 bg-slate-950/40 rounded-xl space-y-3 border border-slate-850">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">นักเรียน</span>
                  <span className="text-white font-bold">{selectedStudent.fullName}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">รหัสประจำตัว</span>
                  <span className="text-slate-300 font-mono">{selectedStudent.studentNumber}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">เลขบัญชี</span>
                  <span className="text-slate-300 font-mono">{selectedAccount.accountNumber}</span>
                </div>
              </div>

              {/* Math Equation for Transparency */}
              <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-850 text-center space-y-2">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">สมการการทำรายการฝากเงิน</p>
                <div className="flex items-center justify-center gap-2 flex-wrap text-sm md:text-base font-mono font-bold">
                  <span className="text-slate-300" title="ยอดคงเหลือก่อนฝาก">฿{selectedAccount.currentBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  <span className="text-emerald-500 font-extrabold" title="บวก">+</span>
                  <span className="text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20" title="ยอดฝาก">฿{parseFloat(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  <span className="text-slate-400" title="เท่ากับ">=</span>
                  <span className="text-white underline decoration-emerald-500 decoration-2" title="ยอดคงเหลือหลังฝาก">฿{(selectedAccount.currentBalance + parseFloat(amount)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>

              {submitting && (
                <div className="text-center p-3 bg-slate-950/20 rounded-xl flex items-center justify-center gap-2 border border-slate-850">
                  <RefreshCw className="w-4 h-4 text-emerald-500 animate-spin" />
                  <span className="text-xs text-slate-400 font-semibold">ระบบกำลังประมวลผลธุรกรรมทางการเงินอย่างปลอดภัย...</span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="px-6 py-4 bg-slate-950/30 border-t border-slate-800 flex justify-end gap-3">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white bg-slate-800 rounded-lg hover:bg-slate-750 cursor-pointer disabled:opacity-50"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleConfirmTransaction}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-5 py-2.5 rounded-lg text-xs flex items-center justify-center gap-1.5 transition-all shadow-md disabled:opacity-50 cursor-pointer"
              >
                {submitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>ยืนยันทำรายการฝากเงิน</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Receipt Modal */}
      {showReceiptModal && currentTx && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-scaleUp">
            {/* Header Status */}
            <div className="bg-emerald-600/10 border-b border-emerald-500/20 px-6 py-5 text-center relative">
              <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto mb-2 text-xl font-bold">
                ✓
              </div>
              <h3 className="font-extrabold text-white text-base">ทำรายการฝากเงินสำเร็จ</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">ใบเสร็จรับเงินอิเล็กทรอนิกส์</p>
            </div>

            {/* Receipt Body */}
            <div className="p-6 space-y-4">
              
              <div className="text-center pb-2 border-b border-dashed border-slate-850">
                <span className="text-xs text-slate-500 block">จำนวนเงินฝาก</span>
                <span className="text-2xl font-extrabold text-white font-mono block mt-1">
                  ฿{currentTx.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">รหัสอ้างอิง (Ref No.)</span>
                  <span className="text-white font-mono font-semibold">{currentTx.referenceNumber}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">วันเวลาทำรายการ</span>
                  <span className="text-white font-mono">
                    {new Date(currentTx.createdAt).toLocaleString('th-TH', {
                      year: 'numeric', month: 'short', day: 'numeric',
                      hour: '2-digit', minute: '2-digit', second: '2-digit'
                    })}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">ชื่อนักเรียน</span>
                  <span className="text-white font-bold font-sans">
                    {students.find(s => s.studentId === currentTx.studentId)?.fullName || 'นักเรียนในระบบ'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">เลขที่บัญชี</span>
                  <span className="text-white font-mono">{accounts[currentTx.studentId]?.accountNumber || ''}</span>
                </div>
                <div className="flex justify-between items-center border-t border-slate-855 pt-2.5">
                  <span className="text-slate-500">ยอดก่อนฝาก</span>
                  <span className="text-slate-300 font-mono">
                    ฿{currentTx.balanceBefore.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">ยอดคงเหลือสุทธิ</span>
                  <span className="text-emerald-400 font-bold font-mono">
                    ฿{currentTx.balanceAfter.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Audit Badge */}
              <div className="p-2 bg-slate-950/30 rounded-lg text-center border border-slate-850">
                <span className="text-[9px] text-slate-500 font-mono block">บันทึกประวัติความปลอดภัยบน Firestore สมบูรณ์</span>
              </div>
            </div>

            {/* Receipt Actions */}
            <div className="px-6 py-4 bg-slate-950/30 border-t border-slate-800 flex justify-center gap-3">
              <button
                type="button"
                onClick={() => setShowReceiptModal(false)}
                className="w-full bg-slate-800 hover:bg-slate-750 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-all cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
