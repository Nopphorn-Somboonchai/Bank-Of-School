"use client";

import React from 'react';
import { RefreshCw } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  confirmText: string;
  cancelText?: string;
  submitting: boolean;
  themeColor?: 'emerald' | 'rose' | 'indigo';
  children: React.ReactNode;
}

export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  confirmText,
  cancelText = "ยกเลิก",
  submitting,
  themeColor = 'emerald',
  children
}: ConfirmationModalProps) {
  if (!isOpen) return null;

  const headerColors = {
    emerald: 'bg-emerald-600/10 border-emerald-500/20 text-emerald-450',
    rose: 'bg-rose-600/10 border-rose-500/20 text-rose-455',
    indigo: 'bg-indigo-600/10 border-indigo-500/20 text-indigo-400'
  };

  const buttonColors = {
    emerald: 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/20',
    rose: 'bg-rose-600 hover:bg-rose-505 text-white shadow-rose-950/20',
    indigo: 'bg-indigo-600 hover:bg-indigo-505 text-white shadow-indigo-950/20'
  };

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-scaleUp">
        {/* Header */}
        <div className={`border-b px-6 py-4 flex items-center justify-between ${headerColors[themeColor]}`}>
          <h3 className="font-extrabold text-white text-sm">{title}</h3>
          <button 
            type="button" 
            disabled={submitting} 
            onClick={onClose} 
            className="text-slate-400 hover:text-white cursor-pointer disabled:opacity-50"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {children}

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
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white bg-slate-800 rounded-lg hover:bg-slate-750 cursor-pointer disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={onConfirm}
            className={`${buttonColors[themeColor]} font-bold px-5 py-2.5 rounded-lg text-xs flex items-center justify-center gap-1.5 transition-all shadow-md disabled:opacity-50 cursor-pointer`}
          >
            {submitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
            <span>{confirmText}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
