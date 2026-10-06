import { runTransaction } from 'firebase/firestore';
import { db } from '@/src/config/firebase';
import { getPublicDoc } from '@/src/utils/dbPaths';
import { Student, StudentStatus, Account } from '@/src/types';
import { DuplicateStudentError, StudentNotFoundError } from '@/src/utils/errors';
import { roundMoney } from '@/src/utils/money';

export interface CreateStudentParams {
  studentNumber: string;
  fullName: string;
  classRoom: string;
}

export interface UpdateStudentParams {
  fullName: string;
  classRoom: string;
  status: StudentStatus;
}

/**
 * สร้างข้อมูลนักเรียนใหม่ พร้อมบัญชีเงินฝากออมทรัพย์, อัปเดต totalStudents ใน dashboard_summary
 * และบันทึก Audit Log รวมทั้งหมดใน Atomic Firestore Transaction เดียวกัน (Task 3.1)
 */
export const createStudent = async (
  params: CreateStudentParams,
  userId: string
): Promise<{ student: Student; account: Account }> => {
  const formattedNum = params.studentNumber.trim();
  const formattedName = params.fullName.trim();
  const formattedRoom = params.classRoom.trim();

  const studentId = 'STD' + formattedNum;
  const accountNumber = 'AC' + formattedNum;

  return await runTransaction(db, async (transaction) => {
    const studentDocRef = getPublicDoc('students', studentId);
    const accountDocRef = getPublicDoc('accounts', studentId);
    const summaryDocRef = getPublicDoc('settings', 'dashboard_summary');

    // 1. ตรวจสอบข้อมูลซ้ำจากฐานข้อมูลจริง (Firestore Reads ก่อน Writes ทั้งหมด)
    const [studentSnap, accountSnap, summarySnap] = await Promise.all([
      transaction.get(studentDocRef),
      transaction.get(accountDocRef),
      transaction.get(summaryDocRef)
    ]);

    if (studentSnap.exists() || accountSnap.exists()) {
      throw new DuplicateStudentError(formattedNum);
    }

    const now = new Date().toISOString();

    const studentData: Student = {
      studentId,
      studentNumber: formattedNum,
      fullName: formattedName,
      classRoom: formattedRoom,
      status: 'Active',
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    };

    const accountData: Account = {
      accountId: studentId,
      studentId,
      accountNumber,
      currentBalance: 0.00,
      status: 'Active',
      createdAt: now,
      lastTransactionAt: now
    };

    // คำนวณยอดรวมนักเรียน totalStudents แบบ delta
    const currentSummary = summarySnap.exists() ? summarySnap.data() : {};
    const currentTotalStudents = Number(currentSummary.totalStudents) || 0;
    const newTotalStudents = Math.max(0, currentTotalStudents + 1);

    // Audit Log Doc
    const logId = 'LOG_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7).toUpperCase();
    const logDocRef = getPublicDoc('audit_logs', logId);

    const auditData = {
      logId,
      timestamp: now,
      userId,
      actionType: 'CreateStudent',
      targetDocument: `students/${studentId}`,
      oldValue: null,
      newValue: studentData,
      remarks: `เพิ่มนักเรียนใหม่: ${formattedName} (รหัสประจำตัว: ${formattedNum}, ชั้น: ${formattedRoom})`,
      deviceInfo: typeof window !== 'undefined' ? navigator.userAgent : 'Unknown'
    };

    // 2. Writes ทั้งหมดเกิดขึ้นพร้อมกันแบบ Atomic
    transaction.set(studentDocRef, studentData);
    transaction.set(accountDocRef, accountData);
    transaction.set(summaryDocRef, {
      totalStudents: newTotalStudents,
      lastUpdated: now
    }, { merge: true });
    transaction.set(logDocRef, auditData);

    return { student: studentData, account: accountData };
  });
};

/**
 * แก้ไขข้อมูลนักเรียน พร้อมคำนวณ delta ปรับปรุง totalStudents และ totalSavings (ตาม D2)
 * และบันทึก Audit Log ใน Transaction เดียว (Task 3.2)
 */
export const updateStudent = async (
  studentId: string,
  params: UpdateStudentParams,
  userId: string
): Promise<Student> => {
  const formattedName = params.fullName.trim();
  const formattedRoom = params.classRoom.trim();

  return await runTransaction(db, async (transaction) => {
    const studentDocRef = getPublicDoc('students', studentId);
    const accountDocRef = getPublicDoc('accounts', studentId);
    const summaryDocRef = getPublicDoc('settings', 'dashboard_summary');

    // 1. Reads
    const [studentSnap, accountSnap, summarySnap] = await Promise.all([
      transaction.get(studentDocRef),
      transaction.get(accountDocRef),
      transaction.get(summaryDocRef)
    ]);

    if (!studentSnap.exists()) {
      throw new StudentNotFoundError(studentId);
    }

    const oldStudent = studentSnap.data() as Student;
    const now = new Date().toISOString();

    const wasActive = oldStudent.deletedAt == null;
    let newDeletedAt = oldStudent.deletedAt;

    if (params.status === 'Active' && !wasActive) {
      newDeletedAt = null;
    } else if (params.status !== 'Active' && wasActive) {
      newDeletedAt = now;
    }

    const willBeActive = newDeletedAt == null;

    // คำนวณ delta ตาม D2
    const accountBalance = accountSnap.exists()
      ? (Number(accountSnap.data().currentBalance) || 0)
      : 0;

    let totalStudentsDelta = 0;
    let totalSavingsDelta = 0;

    if (!wasActive && willBeActive) {
      totalStudentsDelta = 1;
      totalSavingsDelta = accountBalance;
    } else if (wasActive && !willBeActive) {
      totalStudentsDelta = -1;
      totalSavingsDelta = -accountBalance;
    }

    if (totalStudentsDelta !== 0 || totalSavingsDelta !== 0) {
      const currentSummary = summarySnap.exists() ? summarySnap.data() : {};
      const currentStudents = Number(currentSummary.totalStudents) || 0;
      const currentSavings = Number(currentSummary.totalSavings) || 0;

      const newTotalStudents = Math.max(0, currentStudents + totalStudentsDelta);
      const newTotalSavings = roundMoney(Math.max(0, currentSavings + totalSavingsDelta));

      transaction.set(summaryDocRef, {
        totalStudents: newTotalStudents,
        totalSavings: newTotalSavings,
        lastUpdated: now
      }, { merge: true });
    }

    const updatedData: Partial<Student> = {
      fullName: formattedName,
      classRoom: formattedRoom,
      status: params.status,
      updatedAt: now,
      deletedAt: newDeletedAt
    };

    transaction.update(studentDocRef, updatedData);

    // Audit Log
    const logId = 'LOG_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7).toUpperCase();
    const logDocRef = getPublicDoc('audit_logs', logId);

    transaction.set(logDocRef, {
      logId,
      timestamp: now,
      userId,
      actionType: 'EditStudent',
      targetDocument: `students/${studentId}`,
      oldValue: oldStudent,
      newValue: { ...oldStudent, ...updatedData },
      remarks: `แก้ไขข้อมูลนักเรียน: ${formattedName} (ชั้น: ${formattedRoom}, สถานะ: ${params.status})`,
      deviceInfo: typeof window !== 'undefined' ? navigator.userAgent : 'Unknown'
    });

    return { ...oldStudent, ...updatedData } as Student;
  });
};

/**
 * ลบข้อมูลนักเรียนแบบ Soft Delete พร้อมหักยอด totalStudents และ totalSavings (ตาม D2)
 * และบันทึก Audit Log ใน Transaction เดียว (Task 3.2)
 */
export const softDeleteStudent = async (
  studentId: string,
  deleteStatus: StudentStatus,
  userId: string
): Promise<Student> => {
  return await runTransaction(db, async (transaction) => {
    const studentDocRef = getPublicDoc('students', studentId);
    const accountDocRef = getPublicDoc('accounts', studentId);
    const summaryDocRef = getPublicDoc('settings', 'dashboard_summary');

    // 1. Reads
    const [studentSnap, accountSnap, summarySnap] = await Promise.all([
      transaction.get(studentDocRef),
      transaction.get(accountDocRef),
      transaction.get(summaryDocRef)
    ]);

    if (!studentSnap.exists()) {
      throw new StudentNotFoundError(studentId);
    }

    const oldStudent = studentSnap.data() as Student;
    const now = new Date().toISOString();
    const wasActive = oldStudent.deletedAt == null;

    if (wasActive) {
      const accountBalance = accountSnap.exists()
        ? (Number(accountSnap.data().currentBalance) || 0)
        : 0;

      const currentSummary = summarySnap.exists() ? summarySnap.data() : {};
      const currentStudents = Number(currentSummary.totalStudents) || 0;
      const currentSavings = Number(currentSummary.totalSavings) || 0;

      const newTotalStudents = Math.max(0, currentStudents - 1);
      const newTotalSavings = roundMoney(Math.max(0, currentSavings - accountBalance));

      transaction.set(summaryDocRef, {
        totalStudents: newTotalStudents,
        totalSavings: newTotalSavings,
        lastUpdated: now
      }, { merge: true });
    }

    const updatedData: Partial<Student> = {
      status: deleteStatus,
      updatedAt: now,
      deletedAt: now
    };

    transaction.update(studentDocRef, updatedData);

    // Audit Log
    const logId = 'LOG_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7).toUpperCase();
    const logDocRef = getPublicDoc('audit_logs', logId);

    transaction.set(logDocRef, {
      logId,
      timestamp: now,
      userId,
      actionType: 'EditStudent',
      targetDocument: `students/${studentId}`,
      oldValue: oldStudent,
      newValue: { ...oldStudent, ...updatedData },
      remarks: `ลบนักเรียนแบบ Soft Delete: ${oldStudent.fullName} (เปลี่ยนสถานะเป็น ${deleteStatus})`,
      deviceInfo: typeof window !== 'undefined' ? navigator.userAgent : 'Unknown'
    });

    return { ...oldStudent, ...updatedData } as Student;
  });
};

/**
 * กู้คืนข้อมูลนักเรียน (Restore) พร้อมบวกยอด totalStudents และ totalSavings (ตาม D2)
 * และบันทึก Audit Log ใน Transaction เดียว (Task 3.2)
 */
export const restoreStudent = async (
  studentId: string,
  userId: string
): Promise<Student> => {
  return await runTransaction(db, async (transaction) => {
    const studentDocRef = getPublicDoc('students', studentId);
    const accountDocRef = getPublicDoc('accounts', studentId);
    const summaryDocRef = getPublicDoc('settings', 'dashboard_summary');

    // 1. Reads
    const [studentSnap, accountSnap, summarySnap] = await Promise.all([
      transaction.get(studentDocRef),
      transaction.get(accountDocRef),
      transaction.get(summaryDocRef)
    ]);

    if (!studentSnap.exists()) {
      throw new StudentNotFoundError(studentId);
    }

    const oldStudent = studentSnap.data() as Student;
    const now = new Date().toISOString();
    const wasDeleted = oldStudent.deletedAt != null;

    if (wasDeleted) {
      const accountBalance = accountSnap.exists()
        ? (Number(accountSnap.data().currentBalance) || 0)
        : 0;

      const currentSummary = summarySnap.exists() ? summarySnap.data() : {};
      const currentStudents = Number(currentSummary.totalStudents) || 0;
      const currentSavings = Number(currentSummary.totalSavings) || 0;

      const newTotalStudents = Math.max(0, currentStudents + 1);
      const newTotalSavings = roundMoney(Math.max(0, currentSavings + accountBalance));

      transaction.set(summaryDocRef, {
        totalStudents: newTotalStudents,
        totalSavings: newTotalSavings,
        lastUpdated: now
      }, { merge: true });
    }

    const updatedData: Partial<Student> = {
      status: 'Active',
      updatedAt: now,
      deletedAt: null
    };

    transaction.update(studentDocRef, updatedData);

    // Audit Log
    const logId = 'LOG_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7).toUpperCase();
    const logDocRef = getPublicDoc('audit_logs', logId);

    transaction.set(logDocRef, {
      logId,
      timestamp: now,
      userId,
      actionType: 'EditStudent',
      targetDocument: `students/${studentId}`,
      oldValue: oldStudent,
      newValue: { ...oldStudent, ...updatedData },
      remarks: `กู้คืนข้อมูลนักเรียน: ${oldStudent.fullName}`,
      deviceInfo: typeof window !== 'undefined' ? navigator.userAgent : 'Unknown'
    });

    return { ...oldStudent, ...updatedData } as Student;
  });
};
