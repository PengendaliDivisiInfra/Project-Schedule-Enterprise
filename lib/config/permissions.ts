// lib/config/permissions.ts

export const GLOBAL_ROLES = {
  SUPER_ADMIN: 'Super Admin',
  OWNER: 'Owner',
  FINANCE_MANAGER: 'Finance Manager',
  CENTRAL_PROCUREMENT: 'Central Procurement',
  AUDITOR: 'Auditor',
  USER: 'User',
} as const;

export const ROLES = {
  OWNER: 'Owner',
  PM: 'Project Manager',
  SITE_ENGINEER: 'Site Engineer',
  SITE_ADMIN: 'Site Admin',
  DCC: 'DCC/Logistic',
  WAREHOUSE_SITE: 'Warehouse Site',
  QC: 'Quality Control (QC)',
  HSE: 'HSE (K3)',
  VIEWER: 'Viewer',
} as const;

export type GlobalRole = (typeof GLOBAL_ROLES)[keyof typeof GLOBAL_ROLES];
export type ProjectRole = (typeof ROLES)[keyof typeof ROLES];

// Matriks Hak Akses Project Role
export const PERMISSIONS = {
  // Material & Info
  VIEW_MATERIAL_INFO: [
    ROLES.OWNER, ROLES.PM, ROLES.SITE_ENGINEER, ROLES.SITE_ADMIN,
    ROLES.DCC, ROLES.WAREHOUSE_SITE, ROLES.QC, ROLES.HSE, ROLES.VIEWER,
  ],
  VIEW_PRICE: [ROLES.OWNER, ROLES.PM],

  // Aksi PO & Pengadaan
  CREATE_PO: [ROLES.OWNER, ROLES.PM, ROLES.SITE_ENGINEER, ROLES.SITE_ADMIN, ROLES.DCC],
  EDIT_PO: [ROLES.OWNER, ROLES.PM, ROLES.SITE_ENGINEER, ROLES.SITE_ADMIN, ROLES.DCC],
  DELETE_PO: [ROLES.OWNER],
  RECEIVE_PO: [ROLES.OWNER, ROLES.PM, ROLES.SITE_ENGINEER, ROLES.SITE_ADMIN, ROLES.DCC, ROLES.WAREHOUSE_SITE],
  APPROVE_PROCUREMENT: [ROLES.OWNER, ROLES.PM],

  // Keuangan & Approval
  APPROVE_FINANCE: [ROLES.OWNER, ROLES.PM],
  VOID_PAYMENT: [ROLES.OWNER, ROLES.PM],

  // Aksi Progress
  EDIT_PROGRESS: [ROLES.OWNER, ROLES.PM, ROLES.SITE_ENGINEER, ROLES.SITE_ADMIN, ROLES.DCC],
  INPUT_PROGRESS: [ROLES.OWNER, ROLES.PM, ROLES.SITE_ENGINEER, ROLES.SITE_ADMIN, ROLES.DCC],

  // ===== TERMIN / CASH IN MODULE =====
  TERMIN_VIEW: [ROLES.OWNER, ROLES.PM, ROLES.SITE_ENGINEER, ROLES.SITE_ADMIN, ROLES.DCC, ROLES.VIEWER],
  TERMIN_CREATE: [ROLES.OWNER, ROLES.PM, ROLES.SITE_ENGINEER, ROLES.SITE_ADMIN, ROLES.DCC],
  TERMIN_EDIT_DRAFT: [ROLES.OWNER, ROLES.PM, ROLES.SITE_ENGINEER, ROLES.SITE_ADMIN, ROLES.DCC],
  TERMIN_SUBMIT: [ROLES.OWNER, ROLES.PM],
  TERMIN_APPROVE: [ROLES.OWNER, ROLES.PM],
  INVOICE_ISSUE: [ROLES.OWNER, ROLES.PM],
  CASH_IN_RECORD: [ROLES.OWNER, ROLES.PM],
  CASH_IN_VOID: [ROLES.OWNER],
  RETENTION_VIEW: [ROLES.OWNER, ROLES.PM, ROLES.VIEWER],
  RETENTION_RELEASE: [ROLES.OWNER],
  BAPP_UPLOAD: [ROLES.OWNER, ROLES.PM, ROLES.SITE_ENGINEER, ROLES.SITE_ADMIN, ROLES.DCC],

  // ===== DOCUMENT & PHOTO VAULT =====
  VAULT_VIEW: [
    ROLES.OWNER, ROLES.PM, ROLES.SITE_ENGINEER, ROLES.SITE_ADMIN,
    ROLES.DCC, ROLES.WAREHOUSE_SITE, ROLES.QC, ROLES.HSE, ROLES.VIEWER,
  ],
  VAULT_UPLOAD_DOC: [ROLES.OWNER, ROLES.PM, ROLES.SITE_ENGINEER, ROLES.SITE_ADMIN, ROLES.DCC],
  VAULT_UPLOAD_PHOTO: [
    ROLES.OWNER, ROLES.PM, ROLES.SITE_ENGINEER, ROLES.SITE_ADMIN,
    ROLES.DCC, ROLES.WAREHOUSE_SITE, ROLES.QC, ROLES.HSE,
  ],
  VAULT_DELETE: [ROLES.OWNER, ROLES.PM],

  // ===== SUBCONTRACTOR MODULE =====
  SUBCON_VIEW: [ROLES.OWNER, ROLES.PM, ROLES.SITE_ENGINEER, ROLES.SITE_ADMIN, ROLES.DCC, ROLES.VIEWER],
  SUBCON_CREATE: [ROLES.OWNER, ROLES.PM],
  SUBCON_PAY: [ROLES.OWNER, ROLES.PM],
  SUBCON_RETENTION_RELEASE: [ROLES.OWNER],

  // ===== FINANCE / ACCOUNTING & GOVERNANCE =====
  MANAGE_COA: [ROLES.OWNER, ROLES.PM],
  MANAGE_TEAM: [ROLES.OWNER, ROLES.PM],
  VIEW_AUDIT_LOGS: [ROLES.OWNER, ROLES.PM],
} as const;

export type PermissionKey = keyof typeof PERMISSIONS;

const READ_ONLY_PERMISSIONS = new Set<PermissionKey>([
  'VIEW_MATERIAL_INFO',
  'VIEW_PRICE',
  'TERMIN_VIEW',
  'RETENTION_VIEW',
  'VAULT_VIEW',
  'SUBCON_VIEW',
  'VIEW_AUDIT_LOGS',
]);

const FINANCE_MANAGER_PERMISSIONS = new Set<PermissionKey>([
  'VIEW_MATERIAL_INFO',
  'VIEW_PRICE',
  'APPROVE_FINANCE',
  'VOID_PAYMENT',
  'TERMIN_VIEW',
  'TERMIN_APPROVE',
  'INVOICE_ISSUE',
  'CASH_IN_RECORD',
  'CASH_IN_VOID',
  'RETENTION_VIEW',
  'RETENTION_RELEASE',
  'VAULT_VIEW',
  'SUBCON_VIEW',
  'SUBCON_PAY',
  'SUBCON_RETENTION_RELEASE',
  'MANAGE_COA',
  'VIEW_AUDIT_LOGS',
]);

const CENTRAL_PROCUREMENT_PERMISSIONS = new Set<PermissionKey>([
  'VIEW_MATERIAL_INFO',
  'VIEW_PRICE',
  'CREATE_PO',
  'EDIT_PO',
  'RECEIVE_PO',
  'APPROVE_PROCUREMENT',
  'VAULT_VIEW',
  'VAULT_UPLOAD_DOC',
  'SUBCON_VIEW',
  'SUBCON_CREATE',
]);

export function normalizeRoleName(role?: string | null): string {
  const r = (role || '').toLowerCase().trim();
  if (r === 'pm') return 'project manager';
  if (r === 'dcc' || r === 'logistic') return 'dcc/logistic';
  if (r === 'site_admin') return 'site admin';
  if (r === 'site_engineer') return 'site engineer';
  if (r === 'warehouse_site') return 'warehouse site';
  if (r === 'super_admin') return 'super admin';
  if (r === 'finance_manager') return 'finance manager';
  if (r === 'central_procurement') return 'central procurement';
  return r;
}

/**
 * Menentukan apakah pengguna memiliki wewenang approval keuangan/pengadaan
 * yang wajib mengaktifkan 2FA TOTP (Authenticator).
 */
export function isApproverRole(
  globalRole?: string | null,
  projectRole?: string | null
): boolean {
  const g = normalizeRoleName(globalRole);
  const p = normalizeRoleName(projectRole);

  if (['super admin', 'owner', 'finance manager', 'central procurement'].includes(g)) {
    return true;
  }
  if (['owner', 'project manager'].includes(p)) {
    return true;
  }
  return false;
}

/**
 * Pengecekan Hak Akses Hybrid RBAC (Global Role + Project Role).
 * Kompatibel dengan pemanggilan lama 2 argumen `checkPermission(role, key)`.
 */
export function checkPermission(
  userRole: string | null | undefined,
  permissionKey: PermissionKey,
  globalRole?: string | null
): boolean {
  const normGlobal = normalizeRoleName(globalRole || userRole);
  const normProject = normalizeRoleName(userRole);

  // 1. Auditor selalu Read-Only mutlak lintas proyek
  if (normGlobal === 'auditor') {
    return READ_ONLY_PERMISSIONS.has(permissionKey);
  }

  // 2. Super Admin & Owner memiliki akses penuh
  if (normGlobal === 'super admin' || normGlobal === 'owner' || normProject === 'owner') {
    return true;
  }

  // 3. Global Role Korporat (Finance Manager & Central Procurement)
  if (normGlobal === 'finance manager' && FINANCE_MANAGER_PERMISSIONS.has(permissionKey)) {
    return true;
  }
  if (normGlobal === 'central procurement' && CENTRAL_PROCUREMENT_PERMISSIONS.has(permissionKey)) {
    return true;
  }

  // 4. Evaluasi Project Role spesifik
  if (!normProject || normProject === 'guest') return false;
  const allowedRoles = PERMISSIONS[permissionKey] || [];
  return allowedRoles.some((allowed) => normalizeRoleName(allowed) === normProject);
}
