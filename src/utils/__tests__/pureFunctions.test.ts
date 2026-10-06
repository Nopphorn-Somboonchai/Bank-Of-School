import { describe, it, expect } from 'vitest';
import { roundMoney, normalizeAmount } from '../money';
import { InvalidAmountError } from '../errors';
import { getLocalDateString, getLocalYear, trimDailyStats } from '../bankUtils';
import { normalizeRole } from '../roleUtils';

describe('money.ts pure functions', () => {
  describe('roundMoney', () => {
    it('should round numbers to 2 decimal places', () => {
      expect(roundMoney(100.555)).toBe(100.56);
      expect(roundMoney(100.554)).toBe(100.55);
      expect(roundMoney(50)).toBe(50);
      expect(roundMoney(0.001)).toBe(0);
    });

    it('should return 0 for non-finite values', () => {
      expect(roundMoney(NaN)).toBe(0);
      expect(roundMoney(Infinity)).toBe(0);
      expect(roundMoney(-Infinity)).toBe(0);
    });
  });

  describe('normalizeAmount', () => {
    it('should normalize and round valid positive amounts', () => {
      expect(normalizeAmount(100)).toBe(100);
      expect(normalizeAmount(50.256)).toBe(50.26);
      expect(normalizeAmount(0.01)).toBe(0.01);
    });

    it('should throw InvalidAmountError for zero or negative values', () => {
      expect(() => normalizeAmount(0)).toThrow(InvalidAmountError);
      expect(() => normalizeAmount(-10)).toThrow(InvalidAmountError);
    });

    it('should throw InvalidAmountError for invalid types or non-finite numbers', () => {
      expect(() => normalizeAmount('100')).toThrow(InvalidAmountError);
      expect(() => normalizeAmount(null)).toThrow(InvalidAmountError);
      expect(() => normalizeAmount(undefined)).toThrow(InvalidAmountError);
      expect(() => normalizeAmount(NaN)).toThrow(InvalidAmountError);
      expect(() => normalizeAmount(Infinity)).toThrow(InvalidAmountError);
    });
  });
});

describe('bankUtils.ts pure functions', () => {
  it('getLocalDateString should return date string in YYYY-MM-DD format', () => {
    const dateStr = getLocalDateString();
    expect(dateStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('getLocalYear should return a 4-digit valid year number', () => {
    const year = getLocalYear();
    expect(typeof year).toBe('number');
    expect(Number.isInteger(year)).toBe(true);
    expect(year).toBeGreaterThanOrEqual(2024);
  });

  describe('trimDailyStats', () => {
    it('should keep all entries if total days <= maxDays', () => {
      const stats = {
        '2026-03-01': { deposits: 100, withdrawals: 0 },
        '2026-03-02': { deposits: 50, withdrawals: 20 },
      };
      const trimmed = trimDailyStats(stats, 5);
      expect(Object.keys(trimmed)).toHaveLength(2);
      expect(trimmed).toEqual(stats);
    });

    it('should trim oldest dates when total days exceed maxDays', () => {
      const stats = {
        '2026-03-01': { deposits: 10, withdrawals: 0 },
        '2026-03-02': { deposits: 20, withdrawals: 0 },
        '2026-03-03': { deposits: 30, withdrawals: 0 },
        '2026-03-04': { deposits: 40, withdrawals: 0 },
      };
      const trimmed = trimDailyStats(stats, 2);
      const keys = Object.keys(trimmed).sort();
      expect(keys).toEqual(['2026-03-03', '2026-03-04']);
      expect(trimmed['2026-03-01']).toBeUndefined();
      expect(trimmed['2026-03-02']).toBeUndefined();
    });

    it('should not mutate original stats object', () => {
      const stats = {
        '2026-03-01': { deposits: 10, withdrawals: 0 },
        '2026-03-02': { deposits: 20, withdrawals: 0 },
      };
      const trimmed = trimDailyStats(stats, 1);
      expect(Object.keys(stats)).toHaveLength(2);
      expect(Object.keys(trimmed)).toHaveLength(1);
    });
  });
});

describe('roleUtils.ts pure functions', () => {
  it('should normalize Super Admin variants to "Super Admin"', () => {
    expect(normalizeRole('Super Admin')).toBe('Super Admin');
    expect(normalizeRole(' super admin ')).toBe('Super Admin');
  });

  it('should normalize Admin variants to "Admin"', () => {
    expect(normalizeRole('Admin')).toBe('Admin');
    expect(normalizeRole('Admin (ผู้ดูแลระบบ)')).toBe('Admin');
  });

  it('should normalize Teacher and Thai variants to "Teacher"', () => {
    expect(normalizeRole('Teacher')).toBe('Teacher');
    expect(normalizeRole('Teacher (คุณครู)')).toBe('Teacher');
    expect(normalizeRole('ครูผู้ดูแลระบบ (Teacher)')).toBe('Teacher');
    expect(normalizeRole('คุณครูประจำชั้น')).toBe('Teacher');
  });

  it('should fallback to "Teacher" for unknown or non-string values', () => {
    expect(normalizeRole(null)).toBe('Teacher');
    expect(normalizeRole(undefined)).toBe('Teacher');
    expect(normalizeRole(123)).toBe('Teacher');
    expect(normalizeRole('')).toBe('Teacher');
    expect(normalizeRole('unknown_role')).toBe('Teacher');
  });
});
