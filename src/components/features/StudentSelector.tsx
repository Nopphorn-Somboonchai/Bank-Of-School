"use client";

import React, { useState, useMemo } from 'react';
import { Search, RefreshCw } from 'lucide-react';
import { Student } from '@/src/types';
import { useStudents } from '@/src/hooks/useStudents';
import { useAccounts } from '@/src/hooks/useAccounts';

interface StudentSelectorProps {
  selectedStudent: Student | null;
  onSelectStudent: (student: Student) => void;
  submitting: boolean;
  themeColor?: 'emerald' | 'rose';
  onlyActive?: boolean;
}

export function StudentSelector({
  selectedStudent,
  onSelectStudent,
  submitting,
  themeColor = 'emerald',
  onlyActive = true
}: StudentSelectorProps) {
  const { students, loading: studentsLoading } = useStudents();
  const { accounts, loading: accountsLoading } = useAccounts();
  const loading = studentsLoading || accountsLoading;
  const [searchQuery, setSearchQuery] = useState('');

  const filteredStudents = useMemo(() => {
    // Filter active students first if required
    const list = onlyActive ? students.filter(s => s.status === 'Active') : students;
    
    const q = searchQuery.toLowerCase().trim();
    if (!q) return list;
    return list.filter(
      (s) =>
        (s.fullName || '').toLowerCase().includes(q) ||
        (s.studentNumber || '').includes(q) ||
        (s.studentId || '').toLowerCase().includes(q)
    );
  }, [students, searchQuery, onlyActive]);

  const borderFocusClasses = {
    emerald: 'focus:border-emerald-500 focus:ring-emerald-500',
    rose: 'focus:border-rose-500 focus:ring-rose-500'
  };

  const selectedBorderClasses = {
    emerald: 'bg-emerald-500/10 hover:bg-emerald-500/15 border-l-4 border-emerald-500',
    rose: 'bg-rose-500/10 hover:bg-rose-505/15 border-l-4 border-rose-500'
  };

  const activeTextColors = {
    emerald: 'text-emerald-400',
    rose: 'text-rose-455'
  };

  const activeIconColors = {
    emerald: 'text-emerald-500',
    rose: 'text-rose-500'
  };

  return (
    <div className="bg-slate-900/38 backdrop-blur-md border border-white/15 rounded-2xl p-6 shadow-xl space-y-4">
      <h3 className="text-md font-bold text-white flex items-center gap-2">
        <Search className={`w-4 h-4 ${activeIconColors[themeColor]}`} />
        1. ค้นหาและเลือกรายชื่อนักเรียน
      </h3>
      
      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input 
          type="text" 
          placeholder="พิมพ์ชื่อนักเรียน, รหัสประจำตัว หรือ ID ระบบ..." 
          value={searchQuery}
          disabled={submitting}
          onChange={(e) => setSearchQuery(e.target.value)}
          className={`w-full bg-slate-950/40 border border-white/15 rounded-xl py-3 pl-10 pr-4 text-sm text-slate-100 placeholder-slate-400 focus:outline-none transition-colors focus:ring-1 disabled:opacity-50 ${borderFocusClasses[themeColor]}`}
        />
      </div>

      {/* Students List Box */}
      <div className="border border-white/10 bg-slate-950/30 rounded-xl overflow-hidden max-h-[350px] overflow-y-auto divide-y divide-white/5">
        {loading ? (
          <div className="p-8 text-center text-slate-400 flex flex-col items-center gap-2">
            <RefreshCw className={`w-6 h-6 animate-spin ${activeIconColors[themeColor]}`} />
            <span className="text-xs">กำลังโหลดรายชื่อนักเรียน...</span>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
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
                onClick={() => onSelectStudent(student)}
                className={`w-full text-left px-5 py-3.5 transition-all flex items-center justify-between hover:bg-white/5 ${
                  isSelected ? selectedBorderClasses[themeColor] : ''
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
                  <p className={`text-sm font-bold font-mono ${isSelected ? activeTextColors[themeColor] : 'text-slate-300'}`}>
                    ฿{acc ? acc.currentBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                  </p>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
