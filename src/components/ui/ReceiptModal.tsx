"use client";

import React from 'react';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subTitle?: string;
  amount: number;
  amountLabel?: string;
  referenceNumber: string;
  createdAt: string;
  studentName: string;
  accountNumber: string;
  balanceBefore: number;
  balanceAfter: number;
  themeColor?: 'emerald' | 'rose';
  footerNotice?: string;
}

export function ReceiptModal({
  isOpen,
  onClose,
  title,
  subTitle = "ใบเสร็จรับเงินอิเล็กทรอนิกส์",
  amount,
  amountLabel = "จำนวนเงิน",
  referenceNumber,
  createdAt,
  studentName,
  accountNumber,
  balanceBefore,
  balanceAfter,
  themeColor = 'emerald',
  footerNotice = "บันทึกประวัติความปลอดภัยบน Firestore สมบูรณ์"
}: ReceiptModalProps) {
  if (!isOpen) return null;

  const headerColors = {
    emerald: 'bg-emerald-600/10 border-emerald-500/20 text-emerald-450',
    rose: 'bg-rose-600/10 border-rose-500/20 text-rose-455'
  };

  const amountTextColors = {
    emerald: 'text-emerald-400',
    rose: 'text-rose-455'
  };

  const iconTextColors = {
    emerald: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/20',
    rose: 'text-rose-400 border-rose-500/30 bg-rose-500/20'
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900/85 backdrop-blur-2xl border border-white/20 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-scaleUp">
        {/* Header Status */}
        <div className={`${headerColors[themeColor]} border-b px-6 py-5 text-center relative`}>
          <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2 text-xl font-bold border ${iconTextColors[themeColor]}`}>
            ✓
          </div>
          <h3 className="font-extrabold text-white text-base">{title}</h3>
          <p className="text-[10px] text-slate-400 mt-0.5">{subTitle}</p>
        </div>

        {/* Receipt Body */}
        <div className="p-6 space-y-4">
          <div className="text-center pb-2 border-b border-dashed border-slate-850">
            <span className="text-xs text-slate-500 block">{amountLabel}</span>
            <span className="text-2xl font-extrabold text-white font-mono block mt-1">
              ฿{amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-500">รหัสอ้างอิง (Ref No.)</span>
              <span className="text-white font-mono font-semibold">{referenceNumber}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">วันเวลาทำรายการ</span>
              <span className="text-white font-mono">
                {new Date(createdAt).toLocaleString('th-TH', {
                  year: 'numeric', month: 'short', day: 'numeric',
                  hour: '2-digit', minute: '2-digit', second: '2-digit'
                })}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">ชื่อนักเรียน</span>
              <span className="text-white font-bold font-sans">{studentName}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">เลขที่บัญชี</span>
              <span className="text-white font-mono">{accountNumber}</span>
            </div>
            <div className="flex justify-between items-center border-t border-slate-855 pt-2.5">
              <span className="text-slate-500">ยอดก่อนทำรายการ</span>
              <span className="text-slate-300 font-mono">
                ฿{balanceBefore.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">ยอดคงเหลือสุทธิ</span>
              <span className={`font-bold font-mono ${amountTextColors[themeColor]}`}>
                ฿{balanceAfter.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Audit Badge */}
          {footerNotice && (
            <div className="p-2 bg-slate-950/30 rounded-lg text-center border border-slate-850">
              <span className="text-[9px] text-slate-500 font-mono block">{footerNotice}</span>
            </div>
          )}
        </div>

        {/* Receipt Actions */}
        <div className="px-6 py-4 bg-slate-950/40 border-t border-white/10 flex justify-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-400 hover:to-cyan-400 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-all cursor-pointer shadow-md shadow-sky-500/25 active:scale-95"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
}
