import { InvalidAmountError } from './errors';

/**
 * ปัดเศษจำนวนเงินเป็นทศนิยม 2 ตำแหน่ง
 */
export function roundMoney(amount: number): number {
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * 100) / 100;
}

/**
 * ตรวจสอบความถูกต้องและปรับค่าจำนวนเงิน (Financial Normalization)
 * - ต้องเป็นตัวเลข Number.isFinite
 * - ต้องมากกว่า 0
 * - ปัดเศษทศนิยม 2 ตำแหน่ง
 * @throws {InvalidAmountError} หากจำนวนเงินไม่ถูกต้อง
 */
export function normalizeAmount(n: unknown): number {
  if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) {
    throw new InvalidAmountError(n);
  }
  return roundMoney(n);
}
