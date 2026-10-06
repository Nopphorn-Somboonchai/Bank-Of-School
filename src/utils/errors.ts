/**
 * คลาสข้อผิดพลาดหลักของระบบการเงินธนาคารโรงเรียน
 */
export class BankError extends Error {
  public code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'BankError';
    this.code = code;
    
    // Maintain proper stack trace in V8 (e.g. Chrome, Node, Next.js runtime)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * ยอดเงินคงเหลือในบัญชีไม่พอสำหรับการทำรายการถอนเงิน
 */
export class InsufficientFundsError extends BankError {
  constructor(balance: number, amount: number) {
    const formattedBalance = balance.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const formattedAmount = amount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    super(
      `ยอดเงินคงเหลือไม่เพียงพอสำหรับการถอนเงิน (ยอดเงินคงเหลือปัจจุบัน: ฿${formattedBalance} แต่ต้องการถอน: ฿${formattedAmount})`,
      'INSUFFICIENT_FUNDS'
    );
    this.name = 'InsufficientFundsError';
  }
}

/**
 * บัญชีเงินออมอยู่ในสถานะระงับการใช้งาน
 */
export class InvalidAccountStatusError extends BankError {
  constructor(status: string) {
    super(
      `บัญชีเงินออมอยู่ในสถานะระงับการใช้งาน (${status === 'Suspended' ? 'Suspended' : status}) ไม่สามารถทำธุรกรรมได้`,
      'INVALID_ACCOUNT_STATUS'
    );
    this.name = 'InvalidAccountStatusError';
  }
}

/**
 * ไม่พบข้อมูลบัญชีเงินออมของนักเรียน
 */
export class AccountNotFoundError extends BankError {
  constructor() {
    super(
      "ไม่พบข้อมูลบัญชีเงินออมสำหรับนักเรียนท่านนี้ในระบบ",
      'ACCOUNT_NOT_FOUND'
    );
    this.name = 'AccountNotFoundError';
  }
}

/**
 * จำนวนเงินไม่ถูกต้อง (ต้องเป็นตัวเลขที่ถูกต้องและมากกว่า 0)
 */
export class InvalidAmountError extends BankError {
  constructor(amount?: unknown) {
    super(
      `จำนวนเงินไม่ถูกต้อง (${amount !== undefined ? String(amount) : 'ค่าว่าง'}) ต้องเป็นตัวเลขมากกว่า 0`,
      'INVALID_AMOUNT'
    );
    this.name = 'InvalidAmountError';
  }
}

/**
 * รหัสนักเรียนซ้ำในระบบ
 */
export class DuplicateStudentError extends BankError {
  constructor(studentIdOrNumber?: string) {
    super(
      `รหัสนักเรียนนี้มีอยู่ในระบบแล้ว${studentIdOrNumber ? ` (${studentIdOrNumber})` : ''}`,
      'DUPLICATE_STUDENT'
    );
    this.name = 'DuplicateStudentError';
  }
}

/**
 * ไม่พบข้อมูลนักเรียนในระบบ
 */
export class StudentNotFoundError extends BankError {
  constructor(studentId?: string) {
    super(
      `ไม่พบข้อมูลนักเรียนในระบบ${studentId ? ` (ID: ${studentId})` : ''}`,
      'STUDENT_NOT_FOUND'
    );
    this.name = 'StudentNotFoundError';
  }
}

/**
 * ข้อผิดพลาดการไม่มีสิทธิ์เข้าถึงหรือดำเนินการ
 */
export class ForbiddenError extends BankError {
  constructor(message: string = 'ไม่มีสิทธิ์ในการดำเนินการนี้') {
    super(message, 'FORBIDDEN');
    this.name = 'ForbiddenError';
  }
}

