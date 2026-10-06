import { Role } from '@/src/types';

/**
 * Normalizes any legacy or untyped role string to a valid canonical Role.
 * Super Admin > Admin > Teacher (fallback).
 */
export function normalizeRole(rawRole: unknown): Role {
  if (typeof rawRole !== 'string') {
    return 'Teacher';
  }

  const trimmed = rawRole.trim();

  // Super Admin checks
  if (trimmed === 'Super Admin' || trimmed.toLowerCase().includes('super admin')) {
    return 'Super Admin';
  }

  // Admin checks (e.g. 'Admin', 'Admin (ผู้ดูแลระบบ)')
  if (trimmed === 'Admin' || trimmed.startsWith('Admin')) {
    return 'Admin';
  }

  // Teacher checks (e.g. 'Teacher', 'Teacher (คุณครู)', 'ครูผู้ดูแลระบบ (Teacher)', or contains 'ครู')
  if (
    trimmed === 'Teacher' ||
    trimmed.startsWith('Teacher') ||
    trimmed.includes('Teacher') ||
    trimmed.includes('ครู')
  ) {
    return 'Teacher';
  }

  // Fallback check for case-insensitive admin if not captured above
  if (trimmed.toLowerCase().includes('admin') && !trimmed.includes('ครูผู้ดูแลระบบ')) {
    return 'Admin';
  }

  // Default canonical fallback is 'Teacher' (matches security rules)
  return 'Teacher';
}
