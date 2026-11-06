// lib/config/permissions.ts

export const ROLES = {
  OWNER: 'Owner',
  PM: 'Project Manager',
  SITE_ADMIN: 'Site Admin',
  DCC: 'DCC/Logistic',
  QC: 'Quality Control (QC)',
  HSE: 'HSE (K3)',
};

// Matriks Hak Akses
export const PERMISSIONS = {
  // Material & Info
  VIEW_MATERIAL_INFO: [ROLES.OWNER, ROLES.PM, ROLES.SITE_ADMIN, ROLES.DCC, ROLES.QC, ROLES.HSE],
  VIEW_PRICE: [ROLES.OWNER, ROLES.PM], // Hanya Owner & PM yang bisa lihat harga
  
  // Aksi PO
  CREATE_PO: [ROLES.OWNER, ROLES.PM, ROLES.SITE_ADMIN, ROLES.DCC],
  EDIT_PO: [ROLES.OWNER, ROLES.PM, ROLES.SITE_ADMIN, ROLES.DCC],
  DELETE_PO: [ROLES.OWNER], // Hanya Owner
  RECEIVE_PO: [ROLES.OWNER, ROLES.PM, ROLES.SITE_ADMIN, ROLES.DCC],

  VOID_PAYMENT: [ROLES.OWNER, ROLES.PM],
  
  // Aksi Progress (DD/DCC bisa edit)
  EDIT_PROGRESS: [ROLES.OWNER, ROLES.PM, ROLES.SITE_ADMIN, ROLES.DCC],

  // ===== TERMIN / CASH IN MODULE =====
  TERMIN_VIEW: [ROLES.OWNER, ROLES.PM, ROLES.SITE_ADMIN, ROLES.DCC],
  TERMIN_CREATE: [ROLES.OWNER, ROLES.PM, ROLES.SITE_ADMIN, ROLES.DCC],
  TERMIN_EDIT_DRAFT: [ROLES.OWNER, ROLES.PM, ROLES.SITE_ADMIN, ROLES.DCC],
  TERMIN_SUBMIT: [ROLES.OWNER, ROLES.PM],
  TERMIN_APPROVE: [ROLES.OWNER, ROLES.PM],
  INVOICE_ISSUE: [ROLES.OWNER, ROLES.PM],
  CASH_IN_RECORD: [ROLES.OWNER, ROLES.PM],
  CASH_IN_VOID: [ROLES.OWNER], // Hanya Owner
  RETENTION_VIEW: [ROLES.OWNER, ROLES.PM],
  RETENTION_RELEASE: [ROLES.OWNER], // Hanya Owner
  BAPP_UPLOAD: [ROLES.OWNER, ROLES.PM, ROLES.SITE_ADMIN, ROLES.DCC],

    // ===== DOCUMENT & PHOTO VAULT =====
  VAULT_VIEW: [ROLES.OWNER, ROLES.PM, ROLES.SITE_ADMIN, ROLES.DCC, ROLES.QC, ROLES.HSE],
  VAULT_UPLOAD_DOC: [ROLES.OWNER, ROLES.PM, ROLES.SITE_ADMIN, ROLES.DCC],
  VAULT_UPLOAD_PHOTO: [ROLES.OWNER, ROLES.PM, ROLES.SITE_ADMIN, ROLES.DCC, ROLES.QC, ROLES.HSE],
  VAULT_DELETE: [ROLES.OWNER, ROLES.PM],

    // ===== SUBCONTRACTOR MODULE =====
  SUBCON_VIEW: [ROLES.OWNER, ROLES.PM, ROLES.SITE_ADMIN, ROLES.DCC],
  SUBCON_CREATE: [ROLES.OWNER, ROLES.PM],
  SUBCON_PAY: [ROLES.OWNER, ROLES.PM],
  SUBCON_RETENTION_RELEASE: [ROLES.OWNER],

};

// Fungsi Pengecekan Hak Akses (Case-Insensitive)
export function checkPermission(userRole: string | null | undefined, permissionKey: keyof typeof PERMISSIONS): boolean {
  if (!userRole) return false;
  
  // Normalisasi input role user
  let currentRole = userRole.toLowerCase().trim();
  
  // Handle alias (PM vs Project Manager, DCC vs Logistic, dll)
  if (currentRole === 'pm') currentRole = 'project manager';
  if (currentRole === 'dcc' || currentRole === 'logistic') currentRole = 'dcc/logistic';

  // Owner selalu bisa semuanya
  if (currentRole === 'owner') return true;

  const allowedRoles = PERMISSIONS[permissionKey];
  
  return allowedRoles.some(role => {
    let allowed = role.toLowerCase().trim();
    if (allowed === 'project manager') allowed = 'project manager'; // standar
    if (allowed === 'pm') allowed = 'project manager';
    return currentRole === allowed;
  });
}