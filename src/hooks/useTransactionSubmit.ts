import { useState, useRef, useCallback } from 'react';
import { BankError } from '../utils/errors';

export type ToastType = 'success' | 'error' | 'warning' | string;

export function useTransactionSubmit(showToast: (msg: string, type?: ToastType) => void) {
  const [submitting, setSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);

  const execute = useCallback(
    async <T>(
      action: () => Promise<T>,
      successMessage?: string
    ): Promise<T | null> => {
      // 1. Idempotency Check: ล็อกแบบ Synchronous ด้วย useRef ทันที ป้องกันการคลิกซ้ำซ้อนระดับเสี้ยววินาที
      if (isSubmittingRef.current) {
        showToast("ระบบกำลังประมวลผลธุรกรรมทางการเงิน กรุณารอสักครู่...", "warning");
        return null;
      }

      isSubmittingRef.current = true;
      setSubmitting(true);

      try {
        const result = await action();
        if (successMessage) {
          showToast(successMessage, 'success');
        }
        return result;
      } catch (err: unknown) {
        console.error("Transaction execution failed:", err);

        // 2. จัดกลุ่ม Error Handling อย่างเป็นระบบผ่าน Type Guard
        if (err instanceof BankError) {
          showToast(err.message, 'error');
        } else if (err instanceof Error) {
          if (err.message.includes("permission-denied")) {
            showToast("คุณไม่มีสิทธิ์ในการเขียนข้อมูลธุรกรรมนี้ลงบนฐานข้อมูลระบบ (Permission Denied)", "error");
          } else {
            showToast(err.message || "เกิดข้อผิดพลาดที่ไม่คาดคิดในการประมวลผลธุรกรรม", 'error');
          }
        } else {
          showToast("เกิดข้อผิดพลาดที่ไม่คาดคิดในการประมวลผลธุรกรรม", 'error');
        }
        return null;
      } finally {
        isSubmittingRef.current = false;
        setSubmitting(false);
      }
    },
    [showToast]
  );

  return {
    submitting,
    execute
  };
}
