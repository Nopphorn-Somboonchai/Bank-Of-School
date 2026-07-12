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
