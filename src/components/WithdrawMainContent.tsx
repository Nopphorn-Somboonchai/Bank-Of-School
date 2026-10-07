"use client";

import React, { useState } from 'react';
import { ArrowUpFromLine, AlertCircle } from 'lucide-react';
import { Student, UserSession } from '@/src/types';
import { useAccounts } from '@/src/hooks/useAccounts';
import { performWithdrawal } from '@/src/services/transactionService';
import { useTransactionSubmit } from '@/src/hooks/useTransactionSubmit';

// Reusable Components
import { StudentSelector } from './features/StudentSelector';
import { ConfirmationModal } from './ui/ConfirmationModal';
import { ReceiptModal } from './ui/ReceiptModal';

interface WithdrawMainContentProps {
  showToast: (message: string, type?: string) => void;
  userSession: UserSession;
}

export default function WithdrawMainContent({ showToast, userSession }: WithdrawMainContentProps) {
  const { accounts } = useAccounts();
  const { submitting, execute } = useTransactionSubmit(showToast);
  
  // Selected Student & Withdraw Amount
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [amount, setAmount] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Modals state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  
  // Completed transaction for receipt
  const [currentTx, setCurrentTx] = useState<any | null>(null);

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
    // Overdraft protection
    const balance = selectedAccount ? selectedAccount.currentBalance : 0;
    if (num > balance) {
      setValidationError(`ยอดเงินคงเหลือไม่เพียงพอสำหรับการถอนเงิน (มียอดคงเหลือ ฿${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`);
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
      showToast("บัญชีของนักเรียนถูกระงับชั่วคราว ไม่สามารถถอนเงินได้", "error");
      return;
    }

    setShowConfirmModal(true);
  };

  const handleConfirmTransaction = async () => {
    if (!selectedStudent) return;
    const account = accounts[selectedStudent.studentId];
    if (!account) return;

    const withdrawAmount = parseFloat(amount);
    const studentName = selectedStudent.fullName;
    const accountNumber = account.accountNumber;

    const transactionResult = await execute(
      () => performWithdrawal({
        studentId: selectedStudent.studentId,
        studentFullName: selectedStudent.fullName,
        amount: withdrawAmount,
        userId: userSession.userId,
        userFullName: userSession.fullName
      }),
      "บันทึกธุรกรรมการถอนเงินสำเร็จ"
    );

    if (transactionResult) {
      // ล้างข้อมูลหน้าฟอร์ม
      setAmount('');
      setSelectedStudent(null);
      setValidationError(null);
      setShowConfirmModal(false);

      // เปิดแสดงใบเสร็จรับเงินสำเร็จ
      setCurrentTx({
        ...transactionResult,
        studentName,
        accountNumber
      });
      setShowReceiptModal(true);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fadeIn">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
          <ArrowUpFromLine className="w-7 h-7 text-rose-500" />
          ทำรายการถอนเงิน (Withdrawal)
        </h2>
        <p className="text-sm text-slate-400 mt-1">ทำรายการถอนเงินออกจากบัญชีออมทรัพย์ของนักเรียนอย่างปลอดภัย</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Left/Middle Column: Search and Select Student */}
        <div className="lg:col-span-2">
          <StudentSelector 
            selectedStudent={selectedStudent}
            onSelectStudent={(student) => {
              setSelectedStudent(student);
              setValidationError(null);
            }}
            submitting={submitting}
            themeColor="rose"
            onlyActive={true}
          />
        </div>

        {/* Right Column: Transaction Form */}
        <div className="space-y-6">
          
          {/* Student Profile Card (if selected) */}
          {selectedStudent ? (
            <div className="bg-slate-900/38 backdrop-blur-md border border-white/15 rounded-2xl overflow-hidden shadow-xl animate-scaleUp">
              <div className="bg-rose-500/15 border-b border-rose-400/20 px-6 py-4 flex items-center justify-between">
                <span className="text-xs font-bold text-rose-300 uppercase tracking-wider">บัญชีที่เลือก</span>
                <span className="text-xs bg-rose-500/20 text-rose-300 px-2.5 py-0.5 rounded-full border border-rose-400/30 font-medium">Active</span>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <h4 className="text-xs font-semibold text-slate-400 uppercase">ชื่อ-นามสกุล</h4>
                  <p className="text-lg font-bold text-white mt-0.5">{selectedStudent.fullName}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-xs font-semibold text-slate-400 uppercase">ชั้นเรียน</h4>
                    <p className="text-sm font-semibold text-slate-100 mt-0.5">ชั้น {selectedStudent.classRoom}</p>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-slate-400 uppercase">เลขบัญชีออมทรัพย์</h4>
                    <p className="text-sm font-semibold text-slate-100 mt-0.5 font-mono">
                      {selectedAccount ? selectedAccount.accountNumber : 'ไม่มีบัญชี'}
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/10">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase">ยอดเงินปัจจุบัน</h4>
                  <p className="text-2xl font-extrabold text-rose-400 font-mono mt-1">
                    ฿{selectedAccount ? selectedAccount.currentBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900/38 backdrop-blur-md border border-white/15 rounded-2xl p-6 text-center text-slate-400 space-y-2 py-12 shadow-xl">
              <span className="text-4xl block">👤</span>
              <p className="text-sm font-medium text-slate-300">กรุณาเลือกนักเรียนทางซ้ายมือ</p>
              <p className="text-xs text-slate-400">เพื่อเริ่มกรอกยอดทำรายการถอนเงิน</p>
            </div>
          )}

          {/* Form */}
          <div className="bg-slate-900/38 backdrop-blur-md border border-white/15 rounded-2xl p-6 shadow-xl space-y-4">
            <h3 className="text-md font-bold text-white flex items-center gap-2">
              💸
              2. ระบุจำนวนเงินถอน
            </h3>
            
            <form onSubmit={handleOpenConfirm} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 uppercase">จำนวนเงิน (บาท)</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 font-bold text-sm">฿</span>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    disabled={!selectedStudent || submitting}
                    value={amount}
                    onChange={handleAmountChange}
                    className="w-full bg-slate-950/40 border border-white/15 rounded-xl py-3 pl-8 pr-4 text-rose-400 text-lg font-bold font-mono placeholder-slate-500 focus:border-rose-400 focus:outline-none focus:ring-1 focus:ring-rose-400 disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-md transition-all"
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
                className="w-full bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-400 hover:to-pink-400 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-rose-500/25 active:scale-95 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
              >
                <span>ทำรายการถอนเงิน</span>
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && selectedStudent && selectedAccount && (
        <ConfirmationModal
          isOpen={showConfirmModal}
          onClose={() => setShowConfirmModal(false)}
          onConfirm={handleConfirmTransaction}
          title="⚠️ ตรวจสอบรายละเอียดการถอนเงิน"
          confirmText="ยืนยันทำรายการถอนเงิน"
          submitting={submitting}
          themeColor="rose"
        >
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
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">สมการการทำรายการถอนเงิน</p>
            <div className="flex items-center justify-center gap-2 flex-wrap text-sm md:text-base font-mono font-bold">
              <span className="text-slate-300" title="ยอดคงเหลือก่อนถอน">฿{selectedAccount.currentBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              <span className="text-rose-500 font-extrabold" title="ลบ">-</span>
              <span className="text-rose-455 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20" title="ยอดถอน">฿{parseFloat(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              <span className="text-slate-400" title="เท่ากับ">=</span>
              <span className="text-white underline decoration-rose-500 decoration-2" title="ยอดคงเหลือหลังถอน">฿{(selectedAccount.currentBalance - parseFloat(amount)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          </div>
        </ConfirmationModal>
      )}

      {/* Success Receipt Modal */}
      {showReceiptModal && currentTx && (
        <ReceiptModal
          isOpen={showReceiptModal}
          onClose={() => setShowReceiptModal(false)}
          title="ทำรายการถอนเงินสำเร็จ"
          amount={currentTx.amount}
          amountLabel="จำนวนเงินถอน"
          referenceNumber={currentTx.referenceNumber}
          createdAt={currentTx.createdAt}
          studentName={currentTx.studentName}
          accountNumber={currentTx.accountNumber}
          balanceBefore={currentTx.balanceBefore}
          balanceAfter={currentTx.balanceAfter}
          themeColor="rose"
        />
      )}
    </div>
  );
}
