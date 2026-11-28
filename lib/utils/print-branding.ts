// lib/utils/print-branding.ts
// Single Source of Truth untuk Kop Surat (Logo, Nama Perusahaan, Alamat)
// & Format Tanda Tangan Profesional di seluruh dokumen cetak / PDF.

export interface ProjectBranding {
  logoUrl: string;
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  companyInitials: string;
  projectName: string;
  projectLocation: string;
  contractNumber: string;
  consultantName: string;
  ownerName: string;
  picName: string;
  picTitle: string;
}

export interface EnterpriseSignatureCell {
  roleLabel?: string;
  title?: string;
  name?: string;
  subtitle?: string;
  meta?: string;
  accentColor?: string;
}

export function escapePrintHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function deriveCompanyInitials(companyName: string): string {
  const cleaned = String(companyName || '')
    .replace(/\b(PT|CV|UD|FIRMA|TBK|PERSERO)\b\.?/gi, '')
    .trim();
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'PRJ';
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words
    .slice(0, 3)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

export function resolveStorageLogoUrl(
  rawLogo: string | null | undefined,
  supabaseUrl?: string
): string {
  const clean = String(rawLogo || '').trim();
  if (!clean) return '';
  if (/^https?:\/\//i.test(clean) || clean.startsWith('data:image/') || clean.startsWith('/')) {
    return clean;
  }
  const baseUrl = String(
    supabaseUrl ||
      (typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_SUPABASE_URL : '') ||
      ''
  ).replace(/\/+$/, '');
  if (!baseUrl) return clean;
  const normalizedPath = clean.replace(/^\/+/, '').replace(/^project-assets\//i, '');
  return `${baseUrl}/storage/v1/object/public/project-assets/${normalizedPath}`;
}

export function resolveProjectBranding(
  project: Record<string, any> | null | undefined,
  supabaseUrl?: string
): ProjectBranding {
  const p = project || {};
  const companyName = String(
    p.company_name || p.contractor_name || 'NAMA PERUSAHAAN BELUM DIATUR'
  ).trim();
  const companyAddress = String(
    p.contractor_address || p.address || 'Alamat Perusahaan Belum Diatur di Pengaturan Proyek'
  ).trim();
  const logoUrl = resolveStorageLogoUrl(p.logo_url || p.logo || '', supabaseUrl);

  return {
    logoUrl,
    companyName,
    companyAddress,
    companyPhone: String(p.company_phone || '').trim(),
    companyEmail: String(p.company_email || '').trim(),
    companyInitials: deriveCompanyInitials(companyName),
    projectName: String(p.name || p.project_name || '-').trim(),
    projectLocation: String(p.location || '-').trim(),
    contractNumber: String(p.contract_number || '-').trim(),
    consultantName: String(p.consultant_name || 'Konsultan Pengawas').trim(),
    ownerName: String(p.owner_name || 'Pemilik Proyek / PPK').trim(),
    picName: String(p.contractor_pic_name || '').trim(),
    picTitle: String(p.contractor_pic_title || 'Project Manager').trim(),
  };
}

export function buildEnterpriseSignatureHtml(
  items: EnterpriseSignatureCell[],
  options?: {
    spaceHeightPx?: number;
    minLineWidthPx?: number;
    marginTopPx?: number;
  }
): string {
  const list = Array.isArray(items) && items.length > 0 ? items : [];
  if (list.length === 0) return '';

  const spacePx = options?.spaceHeightPx ?? 64;
  const minLinePx = options?.minLineWidthPx ?? (list.length >= 5 ? 110 : 155);
  const marginTopPx = options?.marginTopPx ?? 24;
  const colWidth = (100 / list.length).toFixed(2);

  const cells = list
    .map((sig) => {
      const topRole = sig.roleLabel
        ? `<div style="font-size:8.5pt;color:#475569;margin-bottom:2px;line-height:1.3;">${escapePrintHtml(sig.roleLabel)}</div>`
        : '';
      const titleHtml = sig.title
        ? `<div style="font-size:8.5pt;font-weight:700;color:#1e293b;white-space:pre-line;line-height:1.35;">${escapePrintHtml(sig.title)}</div>`
        : '';
      const nameColor = sig.accentColor || '#0f172a';
      const displayName = (sig.name || '').trim() || '( .................................... )';
      const subHtml = sig.subtitle
        ? `<div style="font-size:8pt;color:#475569;margin-top:3px;line-height:1.25;">${escapePrintHtml(sig.subtitle)}</div>`
        : '';
      const metaHtml = sig.meta
        ? `<div style="font-size:7.5pt;color:#64748b;margin-top:2px;">${escapePrintHtml(sig.meta)}</div>`
        : '';

      return `
        <td style="width:${colWidth}%;text-align:center;vertical-align:bottom;padding:0 8px;border:none;">
          ${topRole}
          ${titleHtml}
          <div style="height:${spacePx}px;"></div>
          <div style="display:inline-block;min-width:${minLinePx}px;padding:0 10px 2px 10px;border-bottom:1.25px solid #0f172a;font-weight:700;font-size:9pt;color:${nameColor};text-transform:uppercase;letter-spacing:0.2px;">
            ${escapePrintHtml(displayName)}
          </div>
          ${subHtml}
          ${metaHtml}
        </td>
      `;
    })
    .join('');

  return `
    <div style="margin-top:${marginTopPx}px;page-break-inside:avoid;break-inside:avoid;width:100%;">
      <table style="width:100%;border-collapse:collapse;table-layout:fixed;border:none;">
        <tbody>
          <tr>${cells}</tr>
        </tbody>
      </table>
    </div>
  `;
}
