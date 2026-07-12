import { useState, useCallback } from 'react';
import { BankError } from '../utils/errors';

export function useTransactionSubmit(showToast: (msg: string, type?: string) => void) {
  const [submitting, setSubmitting] = useState(false);

  const execute = useCallback(
    async <T>(
      action: () => Promise<T>,
      successMessage?: string
    ): Promise<T | null> => {
      // 1. Idempotency Check: ป้องกันการส่งคำขอซ้อนกันในระยะเวลาเดียวกัน
      if (submitting) {
        showToast("ระบบกำลังประมวลผลธุรกรรมทางการเงิน กรุณารอสักครู่...", "warning");
        return null;
      }

      setSubmitting(true);
      try {
        const result = await action();
        if (successMessage) {
          showToast(successMessage, 'success');
        }
        return result;
      } catch (err: any) {
        console.error("Transaction execution failed:", err);
        
        // 2. จัดกลุ่ม Error Handling อย่างเป็นระบบ
        if (err instanceof BankError) {
          // โยลตาม Custom Error Class ของระบบ
          showToast(err.message, 'error');
        } else if (err.message && err.message.includes("permission-denied")) {
          showToast("คุณไม่มีสิทธิ์ในการเขียนข้อมูลธุรกรรมนี้ลงบนฐานข้อมูลระบบ (Permission Denied)", "error");
        } else {
          showToast(err.message || "เกิดข้อผิดพลาดที่ไม่คาดคิดในการประมวลผลธุรกรรม", 'error');
        }
        return null;
      } finally {
        setSubmitting(false);
      }
    },
    [submitting, showToast]
  );

  return {
    submitting,
    execute
  };
}
