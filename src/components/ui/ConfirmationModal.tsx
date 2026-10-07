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
    emerald: 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white shadow-lg shadow-emerald-500/25',
    rose: 'bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-400 hover:to-pink-400 text-white shadow-lg shadow-rose-500/25',
    indigo: 'bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-400 hover:to-cyan-400 text-white shadow-lg shadow-sky-500/25'
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900/85 backdrop-blur-2xl border border-white/20 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-scaleUp">
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
        <div className="px-6 py-4 bg-slate-950/40 border-t border-white/10 flex justify-end gap-3">
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-300 hover:text-white bg-white/10 rounded-lg hover:bg-white/15 border border-white/10 cursor-pointer disabled:opacity-50 transition-colors"
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
