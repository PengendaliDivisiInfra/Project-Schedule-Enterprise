jest.mock('@/lib/supabase', () => ({ supabase: { storage: { from: jest.fn() } } }));

import {
  checkPermission,
  isApproverRole,
  GLOBAL_ROLES,
  ROLES,
} from '@/lib/config/permissions';
import {
  SIGNED_URL_EXPIRY_SECONDS,
  extractStorageObjectPath,
} from '@/lib/utils/secure-storage';

describe('Wave A: Hybrid RBAC & Secure Storage Policy', () => {
  test('Super Admin dan Owner memiliki akses penuh lintas modul', () => {
    expect(checkPermission(null, 'APPROVE_FINANCE', GLOBAL_ROLES.SUPER_ADMIN)).toBe(true);
    expect(checkPermission(null, 'DELETE_PO', GLOBAL_ROLES.OWNER)).toBe(true);
    expect(checkPermission(null, 'VIEW_AUDIT_LOGS', GLOBAL_ROLES.SUPER_ADMIN)).toBe(true);
  });

  test('Auditor bersifat Read-Only mutlak (bisa lihat Audit Log & harga, tidak bisa mutasi)', () => {
    expect(checkPermission(null, 'VIEW_AUDIT_LOGS', GLOBAL_ROLES.AUDITOR)).toBe(true);
    expect(checkPermission(null, 'VIEW_PRICE', GLOBAL_ROLES.AUDITOR)).toBe(true);
    expect(checkPermission(ROLES.PM, 'APPROVE_FINANCE', GLOBAL_ROLES.AUDITOR)).toBe(false);
    expect(checkPermission(ROLES.PM, 'CREATE_PO', GLOBAL_ROLES.AUDITOR)).toBe(false);
    expect(checkPermission(ROLES.PM, 'DELETE_PO', GLOBAL_ROLES.AUDITOR)).toBe(false);
  });

  test('Finance Manager dan Central Procurement memiliki batas wewenang korporat sesuai fungsi', () => {
    expect(checkPermission(null, 'APPROVE_FINANCE', GLOBAL_ROLES.FINANCE_MANAGER)).toBe(true);
    expect(checkPermission(null, 'SUBCON_PAY', GLOBAL_ROLES.FINANCE_MANAGER)).toBe(true);
    expect(checkPermission(null, 'CREATE_PO', GLOBAL_ROLES.FINANCE_MANAGER)).toBe(false);

    expect(checkPermission(null, 'CREATE_PO', GLOBAL_ROLES.CENTRAL_PROCUREMENT)).toBe(true);
    expect(checkPermission(null, 'APPROVE_PROCUREMENT', GLOBAL_ROLES.CENTRAL_PROCUREMENT)).toBe(true);
    expect(checkPermission(null, 'SUBCON_PAY', GLOBAL_ROLES.CENTRAL_PROCUREMENT)).toBe(false);
  });

  test('isApproverRole mengidentifikasi peran wajib 2FA TOTP dengan akurat', () => {
    expect(isApproverRole(GLOBAL_ROLES.OWNER, null)).toBe(true);
    expect(isApproverRole(GLOBAL_ROLES.FINANCE_MANAGER, null)).toBe(true);
    expect(isApproverRole(null, ROLES.PM)).toBe(true);
    expect(isApproverRole(GLOBAL_ROLES.AUDITOR, null)).toBe(false);
    expect(isApproverRole(null, ROLES.SITE_ENGINEER)).toBe(false);
    expect(isApproverRole(null, ROLES.VIEWER)).toBe(false);
  });

  test('Signed URL expiry dikunci tepat 10 menit (600 detik) & ekstraktor path bekerja untuk data lama/baru', () => {
    expect(SIGNED_URL_EXPIRY_SECONDS).toBe(600);
    expect(extractStorageObjectPath('ktp_documents', 'proj-1/ktp.jpg')).toBe('proj-1/ktp.jpg');
    expect(
      extractStorageObjectPath(
        'evidence',
        'https://abc.supabase.co/storage/v1/object/public/evidence/proj-1/nota.png'
      )
    ).toBe('proj-1/nota.png');
  });
});
