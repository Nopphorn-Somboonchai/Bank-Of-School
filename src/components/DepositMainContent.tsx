"use client";

import React, { useState } from 'react';
import { ArrowDownToLine, AlertCircle } from 'lucide-react';
import { Student, UserSession } from '@/src/types';
import { useAccounts } from '@/src/hooks/useAccounts';
import { performDeposit } from '@/src/services/transactionService';
import { useTransactionSubmit } from '@/src/hooks/useTransactionSubmit';

// Reusable Components
import { StudentSelector } from './features/StudentSelector';
import { ConfirmationModal } from './ui/ConfirmationModal';
import { ReceiptModal } from './ui/ReceiptModal';

interface DepositMainContentProps {
  showToast: (message: string, type?: string) => void;
  userSession: UserSession;
}

export default function DepositMainContent({ showToast, userSession }: DepositMainContentProps) {
  const { accounts } = useAccounts();
  const { submitting, execute } = useTransactionSubmit(showToast);
  
  // Selected Student & Deposit Amount
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
    return true;
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setAmount(val);
    validateAmount(val);
  };

  const handleOpenConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;
    if (!selectedAccount) {
      showToast("ไม่พบข้อมูลบัญชีของนักเรียนคนนี้", "error");
      return;
    }
    if (!validateAmount(amount)) return;
    if (selectedAccount.status !== 'Active') {
      showToast("บัญชีของนักเรียนถูกระงับชั่วคราว ไม่สามารถรับฝากเงินได้", "error");
      return;
    }

    setShowConfirmModal(true);
  };

  const handleConfirmTransaction = async () => {
    if (!selectedStudent) return;
    const account = accounts[selectedStudent.studentId];
    if (!account) return;

    const depositAmount = parseFloat(amount);
    const studentName = selectedStudent.fullName;
    const accountNumber = account.accountNumber;

    const transactionResult = await execute(
      () => performDeposit({
        studentId: selectedStudent.studentId,
        studentFullName: selectedStudent.fullName,
        amount: depositAmount,
        userId: userSession.userId,
        userFullName: userSession.fullName
      }),
      "บันทึกธุรกรรมการฝากเงินสำเร็จ"
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
          <ArrowDownToLine className="w-7 h-7 text-emerald-400" />
          ทำรายการฝากเงิน (Deposit)
        </h2>
        <p className="text-sm text-slate-400 mt-1">ทำรายการฝากเงินเข้าบัญชีออมทรัพย์ของนักเรียนอย่างปลอดภัย</p>
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
            themeColor="emerald"
            onlyActive={true}
          />
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
        <ConfirmationModal
          isOpen={showConfirmModal}
          onClose={() => setShowConfirmModal(false)}
          onConfirm={handleConfirmTransaction}
          title="⚠️ ตรวจสอบรายละเอียดการฝากเงิน"
          confirmText="ยืนยันทำรายการฝากเงิน"
          submitting={submitting}
          themeColor="emerald"
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
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">สมการการทำรายการฝากเงิน</p>
            <div className="flex items-center justify-center gap-2 flex-wrap text-sm md:text-base font-mono font-bold">
              <span className="text-slate-300" title="ยอดคงเหลือก่อนฝาก">฿{selectedAccount.currentBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              <span className="text-emerald-500 font-extrabold" title="บวก">+</span>
              <span className="text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20" title="ยอดฝาก">฿{parseFloat(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              <span className="text-slate-400" title="เท่ากับ">=</span>
              <span className="text-white underline decoration-emerald-500 decoration-2" title="ยอดคงเหลือหลังฝาก">฿{(selectedAccount.currentBalance + parseFloat(amount)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          </div>
        </ConfirmationModal>
      )}

      {/* Success Receipt Modal */}
      {showReceiptModal && currentTx && (
        <ReceiptModal
          isOpen={showReceiptModal}
          onClose={() => setShowReceiptModal(false)}
          title="ทำรายการฝากเงินสำเร็จ"
          amount={currentTx.amount}
          amountLabel="จำนวนเงินฝาก"
          referenceNumber={currentTx.referenceNumber}
          createdAt={currentTx.createdAt}
          studentName={currentTx.studentName}
          accountNumber={currentTx.accountNumber}
          balanceBefore={currentTx.balanceBefore}
          balanceAfter={currentTx.balanceAfter}
          themeColor="emerald"
        />
      )}
    </div>
  );
}
