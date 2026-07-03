import React, { useState } from 'react';
import { Users, UserPlus, Search, Filter, FileText, Edit2, Trash2, X, RefreshCw } from 'lucide-react';
import { setDoc, updateDoc, getDoc, increment } from 'firebase/firestore';
import { db } from '@/src/config/firebase';
import { getPublicCollection, getPublicDoc } from '@/src/utils/dbPaths';
import { Student, StudentStatus, Account } from '@/src/types';
import { writeAuditLog, recalculateDashboardSummary } from '@/src/utils/bankUtils';
import { useBankData } from '@/src/context/BankDataContext';
import StudentLedgerView from './StudentLedgerView';

const TableSkeleton = () => (
  <div className="animate-pulse space-y-4">
    <div className="h-10 bg-slate-800/80 rounded-lg w-full"></div>
    <div className="h-12 bg-slate-800/40 rounded-lg w-full"></div>
    <div className="h-12 bg-slate-800/40 rounded-lg w-full"></div>
    <div className="h-12 bg-slate-800/40 rounded-lg w-full"></div>
    <div className="h-12 bg-slate-800/40 rounded-lg w-full"></div>
  </div>
);

interface StudentsMainContentProps {
  showToast: (message: string, type?: string) => void;
  userSession: any;
}

export default function StudentsMainContent({ showToast, userSession }: StudentsMainContentProps) {
  const { students, accounts, loading } = useBankData();
  const [searchQuery, setSearchQuery] = useState('');
  const [classFilter, setClassFilter] = useState('All');
  const [hideInactive, setHideInactive] = useState(false);
  const [viewingLedgerStudent, setViewingLedgerStudent] = useState<Student | null>(null);

  // Form Modal state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);

  // Form Fields
  const [studentNumber, setStudentNumber] = useState('');
  const [fullName, setFullName] = useState('');
  const [classRoom, setClassRoom] = useState('');
  const [status, setStatus] = useState<StudentStatus>('Active');
  const [submitting, setSubmitting] = useState(false);

  // Soft Delete Confirmation state
  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null);
  const [deleteStatus, setDeleteStatus] = useState<StudentStatus>('Inactive');

  // Handle open add modal
  const handleOpenAdd = () => {
    setFormMode('create');
    setEditingStudentId(null);
    setStudentNumber('');
    setFullName('');
    setClassRoom('');
    setStatus('Active');
    setIsFormOpen(true);
  };

  // Handle open edit modal
  const handleOpenEdit = (student: Student) => {
    setFormMode('edit');
    setEditingStudentId(student.studentId);
    setStudentNumber(student.studentNumber);
    setFullName(student.fullName);
    setClassRoom(student.classRoom);
    setStatus(student.status);
    setIsFormOpen(true);
  };

  // Handle Form Submission (Create or Edit)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentNumber.trim() || !fullName.trim() || !classRoom.trim()) {
      showToast("กรุณากรอกข้อมูลสำคัญให้ครบถ้วน", "error");
      return;
    }

    // Number check
    if (!/^\d+$/.test(studentNumber.trim())) {
      showToast("รหัสนักเรียนต้องเป็นตัวเลขเท่านั้น", "error");
      return;
    }

    setSubmitting(true);

    try {
      const formattedNum = studentNumber.trim();
      const formattedName = fullName.trim();
      const formattedRoom = classRoom.trim();

      if (formMode === 'create') {
        const studentId = "STD" + formattedNum;

        // Check duplicate
        const exists = students.some(s => s.studentId === studentId);
        if (exists) {
          showToast("รหัสนักเรียนนี้มีอยู่ในระบบแล้ว", "error");
          setSubmitting(false);
          return;
        }

        const studentDocRef = getPublicDoc('students', studentId);
        const studentData: Student = {
          studentId,
          studentNumber: formattedNum,
          fullName: formattedName,
          classRoom: formattedRoom,
          status: 'Active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          deletedAt: null
        };

        // Write student
        await setDoc(studentDocRef, studentData);

        // Auto create savings account for the student
        const accountDocRef = getPublicDoc('accounts', studentId);
        await setDoc(accountDocRef, {
          accountId: studentId,
          studentId: studentId,
          accountNumber: "AC" + formattedNum,
          currentBalance: 0.00,
          status: 'Active',
          createdAt: new Date().toISOString(),
          lastTransactionAt: new Date().toISOString()
        });

        // Audit Log
        await writeAuditLog(
          'CreateStudent',
          `students/${studentId}`,
          null,
          studentData,
          `เพิ่มนักเรียนใหม่: ${formattedName} (รหัสประจำตัว: ${formattedNum}, ชั้น: ${formattedRoom})`,
          userSession.userId
        );

        // Increment totalStudents in dashboard summary
        const summaryDocRef = getPublicDoc('settings', 'dashboard_summary');
        await setDoc(summaryDocRef, {
          totalStudents: increment(1)
        }, { merge: true });

        showToast("เพิ่มข้อมูลนักเรียนใหม่เรียบร้อยแล้ว");
      } else {
        // Edit Mode
        if (!editingStudentId) return;
        const studentDocRef = getPublicDoc('students', editingStudentId);

        // Fetch old data for audit trail
        const oldSnap = await getDoc(studentDocRef);
        const oldData = oldSnap.exists() ? oldSnap.data() : null;

        const updatedData = {
          fullName: formattedName,
          classRoom: formattedRoom,
          status,
          updatedAt: new Date().toISOString(),
          ...(status === 'Active' ? { deletedAt: null } : {})
        };

        await updateDoc(studentDocRef, updatedData);

        // Audit Log
        await writeAuditLog(
          'EditStudent',
          `students/${editingStudentId}`,
          oldData,
          { ...oldData, ...updatedData },
          `แก้ไขข้อมูลนักเรียน: ${formattedName} (ชั้น: ${formattedRoom}, สถานะ: ${status})`,
          userSession.userId
        );

        showToast("แก้ไขข้อมูลนักเรียนเรียบร้อยแล้ว");
        // Recalculate dashboard summary to reflect student status changes and total savings updates
        await recalculateDashboardSummary();
      }
      setIsFormOpen(false);
    } catch (err: any) {
      console.error(err);
      showToast("เกิดข้อผิดพลาด: " + err.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Soft Delete
  const handleSoftDelete = async () => {
    if (!deleteTarget) return;
    setSubmitting(true);

    try {
      const studentDocRef = getPublicDoc('students', deleteTarget.studentId);
      const oldSnap = await getDoc(studentDocRef);
      const oldData = oldSnap.exists() ? oldSnap.data() : null;

      const updatedData = {
        status: deleteStatus,
        updatedAt: new Date().toISOString(),
        deletedAt: new Date().toISOString()
      };

      await updateDoc(studentDocRef, updatedData);

      // Audit Log
      await writeAuditLog(
        'EditStudent',
        `students/${deleteTarget.studentId}`,
        oldData,
        { ...oldData, ...updatedData },
        `ลบนักเรียนแบบ Soft Delete: ${deleteTarget.fullName} (เปลี่ยนสถานะเป็น ${deleteStatus})`,
        userSession.userId
      );

      // Recalculate dashboard summary to reflect student status changes and total savings updates
      await recalculateDashboardSummary();

      showToast(`เปลี่ยนสถานะนักเรียนเป็น ${deleteStatus} เรียบร้อยแล้ว`);
      setDeleteTarget(null);
    } catch (err: any) {
      console.error(err);
      showToast("เกิดข้อผิดพลาดในการเปลี่ยนสถานะ: " + err.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Get distinct classes for classroom filter dropdown
  const classList = ['All', ...Array.from(new Set(students.map(s => s.classRoom)))];

  // Filtering Logic (Client side, real-time)
  const filteredStudents = students.filter(student => {
    const matchesSearch = student.fullName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          student.studentNumber.includes(searchQuery) ||
                          student.studentId.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesClass = classFilter === 'All' || student.classRoom === classFilter;
    const matchesHideInactive = !hideInactive || student.status === 'Active';

    return matchesSearch && matchesClass && matchesHideInactive;
  });

  if (viewingLedgerStudent) {
    return (
      <StudentLedgerView
        student={viewingLedgerStudent}
        account={accounts[viewingLedgerStudent.studentId]}
        onBack={() => setViewingLedgerStudent(null)}
        showToast={showToast}
        userSession={userSession}
      />
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fadeIn">
      {/* Header section */}
      <div className="flex justify-between items-end flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <Users className="w-7 h-7 text-emerald-400" />
            จัดการข้อมูลนักเรียน (Students)
          </h2>
          <p className="text-sm text-slate-400 mt-1">ทะเบียนประวัตินักเรียนและสถานะบัญชีเงินฝากในระบบ</p>
        </div>
        <button 
          onClick={handleOpenAdd}
          className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 shadow-lg shadow-emerald-950/20 active:scale-95 cursor-pointer animate-fadeIn"
        >
          <UserPlus className="w-4 h-4" /> เพิ่มนักเรียนใหม่
        </button>
      </div>

      {/* Filters and Search Bar section */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input 
            type="text" 
            placeholder="ค้นหาด้วย ชื่อ, รหัสนักเรียน หรือ ID..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950/80 border border-slate-700/60 rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-200 focus:outline-none focus:border-emerald-500 transition-colors focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 w-full md:w-auto justify-end flex-wrap">
          {/* Class Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500" />
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="bg-slate-950/80 border border-slate-700/60 text-slate-200 rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              {classList.map(cls => (
                <option key={cls} value={cls}>{cls === 'All' ? 'ทุกระดับชั้น' : `ชั้น ${cls}`}</option>
              ))}
            </select>
          </div>

          {/* Hide Inactive Toggle */}
          <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-400 hover:text-slate-200">
            <input 
              type="checkbox" 
              checked={hideInactive} 
              onChange={(e) => setHideInactive(e.target.checked)}
              className="rounded border-slate-700 bg-slate-950/80 text-emerald-600 focus:ring-0 focus:ring-offset-0 cursor-pointer w-4 h-4"
            />
            ซ่อนสถานะ Inactive
          </label>
        </div>
      </div>

      {/* Main Table section */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="p-8">
            <TableSkeleton />
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="p-20 text-center text-slate-500 space-y-2">
            <p className="text-lg font-medium">ไม่พบข้อมูลนักเรียน</p>
            <p className="text-xs text-slate-600">กรุณาลองเปลี่ยนคำค้นหา หรือกรองระดับชั้นใหม่</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-950/40 text-slate-400 text-xs uppercase border-b border-slate-800">
                <tr>
                  <th className="px-6 py-4 font-medium">ID ระบบ</th>
                  <th className="px-6 py-4 font-medium">รหัสประจำตัว</th>
                  <th className="px-6 py-4 font-medium">ชื่อ-นามสกุล</th>
                  <th className="px-6 py-4 font-medium">ชั้นเรียน</th>
                  <th className="px-6 py-4 font-medium">เลขที่บัญชี</th>
                  <th className="px-6 py-4 font-medium text-right">ยอดเงินคงเหลือ</th>
                  <th className="px-6 py-4 font-medium">สถานะ</th>
                  <th className="px-6 py-4 font-medium">วันที่ลงทะเบียน</th>
                  <th className="px-6 py-4 font-medium text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {filteredStudents.map((student) => {
                  const account = accounts[student.studentId];
                  return (
                    <tr key={student.studentId} className="hover:bg-slate-800/20 transition-colors">
                      <td className="px-6 py-4 text-slate-400 font-mono text-xs">{student.studentId}</td>
                      <td className="px-6 py-4 font-mono font-semibold text-slate-300">{student.studentNumber}</td>
                      <td className="px-6 py-4 font-bold text-white">{student.fullName}</td>
                      <td className="px-6 py-4 text-slate-300">{student.classRoom}</td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-300">
                        {account ? account.accountNumber : (
                          <span className="text-slate-600 italic">ไม่มีบัญชี</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-bold text-emerald-400">
                        {account ? `฿${account.currentBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '฿0.00'}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          student.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                          student.status === 'Inactive' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                          student.status === 'Graduated' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                          'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        }`}>
                          {student.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-500 text-xs">
                        {new Date(student.createdAt).toLocaleDateString('th-TH', {
                          year: 'numeric', month: 'short', day: 'numeric',
                          hour: '2-digit', minute: '2-digit'
                        })}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button 
                            onClick={() => setViewingLedgerStudent(student)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-slate-800 transition-all cursor-pointer"
                            title="ดูสมุดบัญชี (Statement)"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleOpenEdit(student)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-slate-800 transition-all cursor-pointer"
                            title="แก้ไขข้อมูล"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => setDeleteTarget(student)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-all cursor-pointer"
                            title="ลบข้อมูล (Soft Delete)"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal - Add / Edit Student */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-scaleUp">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/20">
              <h3 className="font-bold text-white text-lg">
                {formMode === 'create' ? 'เพิ่มข้อมูลนักเรียนใหม่' : 'แก้ไขข้อมูลนักเรียน'}
              </h3>
              <button onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit}>
              <div className="p-6 space-y-4">
                {/* Student Number */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400 uppercase">รหัสประจำตัวนักเรียน</label>
                  <input
                    type="text"
                    required
                    placeholder="เช่น 10245"
                    disabled={formMode === 'edit' || submitting}
                    value={studentNumber}
                    onChange={(e) => setStudentNumber(e.target.value)}
                    className="w-full bg-slate-950/80 border border-slate-700/60 rounded-xl py-2.5 px-3.5 text-sm text-white placeholder-slate-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
                  />
                </div>

                {/* Full Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400 uppercase">ชื่อ - นามสกุล</label>
                  <input
                    type="text"
                    required
                    placeholder="เช่น เด็กชายสมชาย ใจดี"
                    disabled={submitting}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full bg-slate-950/80 border border-slate-700/60 rounded-xl py-2.5 px-3.5 text-sm text-white placeholder-slate-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                {/* Classroom */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400 uppercase">ชั้นเรียน / ห้องเรียน</label>
                  <input
                    type="text"
                    required
                    placeholder="เช่น ม.1/2"
                    disabled={submitting}
                    value={classRoom}
                    onChange={(e) => setClassRoom(e.target.value)}
                    className="w-full bg-slate-950/80 border border-slate-700/60 rounded-xl py-2.5 px-3.5 text-sm text-white placeholder-slate-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                {/* Status (Edit only) */}
                {formMode === 'edit' && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-400 uppercase">สถานะนักเรียน</label>
                    <select
                      value={status}
                      disabled={submitting}
                      onChange={(e) => setStatus(e.target.value as StudentStatus)}
                      className="w-full bg-slate-950/80 border border-slate-700/60 text-white rounded-xl py-2.5 px-3.5 text-sm focus:border-emerald-500 focus:outline-none"
                    >
                      <option value="Active" className="bg-slate-900 text-white">Active (ปกติ)</option>
                      <option value="Inactive" className="bg-slate-900 text-white">Inactive (ปิดใช้งาน)</option>
                      <option value="Graduated" className="bg-slate-900 text-white">Graduated (จบการศึกษา)</option>
                      <option value="Transferred" className="bg-slate-900 text-white">Transferred (ย้ายสถานศึกษา)</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Actions Footer */}
              <div className="px-6 py-4 bg-slate-950/30 border-t border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white transition-all bg-slate-800 rounded-lg hover:bg-slate-750 cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-lg text-xs flex items-center justify-center gap-1.5 transition-all shadow-md disabled:opacity-50 cursor-pointer"
                >
                  {submitting && <RefreshCw className="w-3 h-3 animate-spin" />}
                  <span>{formMode === 'create' ? 'เพิ่มนักเรียน' : 'บันทึกการแก้ไข'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal - Soft Delete Confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-scaleUp">
            <div className="p-6 text-center space-y-4">
              <div className="w-12 h-12 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-full flex items-center justify-center mx-auto mb-2 text-xl font-bold">
                ⚠️
              </div>
              <div className="space-y-1">
                <h3 className="font-extrabold text-white text-lg">ต้องการทำ Soft Delete หรือไม่?</h3>
                <p className="text-xs text-slate-400">
                  นักเรียน <strong className="text-white font-bold">"{deleteTarget.fullName}"</strong> จะไม่ถูกลบออกจากฐานข้อมูลถาวร แต่จะเปลี่ยนสถานะบัญชี
                </p>
              </div>

              {/* Status Select for soft delete */}
              <div className="space-y-1.5 text-left max-w-xs mx-auto">
                <label className="text-[10px] font-semibold text-slate-400 uppercase">เลือกสถานะปลายทาง</label>
                <select
                  value={deleteStatus}
                  onChange={(e) => setDeleteStatus(e.target.value as StudentStatus)}
                  className="w-full bg-slate-950/80 border border-slate-700/60 rounded-xl py-2 px-3 text-xs text-white focus:border-emerald-500 focus:outline-none"
                >
                  <option value="Inactive" className="bg-slate-900 text-white">Inactive (ปิดใช้งานชั่วคราว)</option>
                  <option value="Graduated" className="bg-slate-900 text-white">Graduated (จบการศึกษา)</option>
                  <option value="Transferred" className="bg-slate-900 text-white">Transferred (ย้ายสถานศึกษา)</option>
                </select>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-950/30 border-t border-slate-800 flex justify-end gap-3">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white bg-slate-800 rounded-lg hover:bg-slate-750 cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleSoftDelete}
                className="bg-rose-600 hover:bg-rose-500 text-white font-bold px-4 py-2 rounded-lg text-xs flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {submitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>ยืนยันการลบ (Soft Delete)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
