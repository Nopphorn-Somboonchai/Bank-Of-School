// ==========================================
// 1. ระบบตั้งค่าแอปพลิเคชัน (Settings)
// ==========================================
export interface SystemSettings {
    schoolName: string;
    academicYear: string;
    currency: string;
    currencySymbol: string;
    minDeposit: number;
    minWithdrawal: number;
    transactionPrefix: {
        deposit: string;
        withdrawal: string;
        adjustment: string;
        reversal: string;
    };
    statementHeader: string;
    reportFooter: string;
}

// ==========================================
// 2. ข้อมูลโปรไฟล์นักเรียน (Students)
// ==========================================
export type StudentStatus = 'Active' | 'Inactive' | 'Graduated' | 'Transferred';

export interface Student {
    studentId: string;       // ID ที่กำหนดขึ้นเอง หรือ Auto-generated ID
    studentNumber: string;   // รหัสนักเรียนของโรงเรียน (เช่น 10245)
    fullName: string;        // ชื่อ-นามสกุล
    classRoom: string;       // ชั้นเรียน/ห้องเรียน (เช่น ม.1/2)
    status: StudentStatus;   // สถานะบัญชีนักเรียน
    createdAt: string;       // ISO 8601 Timestamp UTC
    updatedAt: string;       // ISO 8601 Timestamp UTC
    deletedAt: string | null;// สำหรับทำ Soft Delete
}

// ==========================================
// 3. บัญชีเงินออมนักเรียน (Accounts)
// ==========================================
export type AccountStatus = 'Active' | 'Suspended';

export interface Account {
    accountId: string;         // ID บัญชี (มักจะจับคู่ 1:1 กับ studentId)
    studentId: string;         // อ้างอิงรหัสนักเรียน
    accountNumber: string;     // เลขที่บัญชีออมทรัพย์ที่สร้างจากระบบ
    currentBalance: number;    // ยอดเงินคงเหลือ ณ ปัจจุบัน
    status: AccountStatus;     // สถานะการใช้งานบัญชีเงินฝาก
    createdAt: string;         // วันเปิดบัญชี
    lastTransactionAt: string; // วันที่ทำธุรกรรมล่าสุด
}

// ==========================================
// 4. รายการธุรกรรมทางการเงิน (Transactions)
// ==========================================
export type TransactionType = 'Deposit' | 'Withdrawal' | 'Adjustment' | 'Reversal';
export type TransactionStatus = 'Completed' | 'Void';

export interface VoidDetails {
    voidedBy: string | null;            // รหัสครูผู้ทำรายการ Void
    voidedAt: string | null;            // วันเวลาที่ยกเลิกรายการ
    voidRemark: string | null;          // เหตุผลการกดยกเลิก
    reversalReferenceNumber: string | null; // เลขที่รหัสรายการ Reversal ที่ถูกสร้างขึ้นคู่กัน
}

export interface Transaction {
    transactionId: string;        // ID เอกสารของ Firestore (Auto-generated)
    referenceNumber: string;      // เลขรันนิ่งอ้างอิงแบบมีแพทเทิร์น (เช่น DEP2026000001)
    studentId: string;            // รหัสนักเรียนที่ผูกพัน
    accountId: string;            // รหัสบัญชีที่ผูกพัน
    transactionType: TransactionType; // ประเภทรายการฝาก ถอน ปรับปรุง หักล้าง
    amount: number;               // จำนวนเงินที่ทำรายการ ($Amount > 0$)
    balanceBefore: number;        // ยอดเงินคงเหลือก่อนทำรายการ
    balanceAfter: number;         // ยอดเงินคงเหลือหลังทำรายการ
    createdAt: string;            // วันเวลาที่สร้างรายการสำเร็จ
    createdBy: string;            // รหัสครูผู้ทำรายการนี้
    remark: string | null;        // หมายเหตุเพิ่มเติม
    status: TransactionStatus;    // สถานะรายการปัจจุบัน
    voidDetails: VoidDetails;     // รายละเอียดการยกเลิกกรณีรายการผิดพลาด
}

// ==========================================
// 5. บันทึกประวัติการใช้งานระบบ (Audit Logs)
// ==========================================
export type AuditActionType =
    | 'Login'
    | 'Logout'
    | 'CreateStudent'
    | 'EditStudent'
    | 'Deposit'
    | 'Withdraw'
    | 'Void'
    | 'PrintReport'
    | 'ExportData';

export interface AuditLog {
    logId: string;             // ID บันทึกประวัติ
    timestamp: string;         // วันเวลาที่ทำพฤติกรรม
    userId: string;            // รหัสคุณครูที่ทำรายการ
    actionType: AuditActionType; // ประเภทการกระทำ
    targetDocument: string;    // เส้นทางอ้างอิงเอกสารที่ได้รับผลกระทบ (เช่น "students/STD69001")
    oldValue: any | null;      // ค่าเดิมก่อนเปลี่ยนแปลง
    newValue: any | null;      // ค่าใหม่หลังเปลี่ยนแปลง
    remarks: string;           // คำอธิบายพฤติกรรมแบบอ่านง่าย
    deviceInfo: string;        // ข้อมูลอุปกรณ์และเบราว์เซอร์
}

// ==========================================
// 6. ตัวนับจำนวนรหัสรันนิ่ง (Counters)
// ==========================================
export interface YearCounter {
    year: number;              // ปี ค.ศ. คีย์หลัก (เช่น 2026)
    lastSequenceNumber: number;// ตัวเลขลำดับล่าสุดที่ถูกใช้งานไป
}
