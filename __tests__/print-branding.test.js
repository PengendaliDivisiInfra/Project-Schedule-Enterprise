import {
  resolveProjectBranding,
  deriveCompanyInitials,
  resolveStorageLogoUrl,
  buildEnterpriseSignatureHtml,
  escapePrintHtml,
} from '@/lib/utils/print-branding';

describe('Enterprise Print Branding & Professional Signature Standard', () => {
  test('resolveProjectBranding mengambil logo, nama perusahaan, alamat & PIC otomatis dari pengaturan proyek', () => {
    const branding = resolveProjectBranding(
      {
        company_name: 'PT. Infrastruktur Nusantara Jaya',
        contractor_address: 'Jl. Jenderal Sudirman No. 45, Makassar',
        logo_url: 'proj-123-logo.png',
        name: 'Rehabilitasi D.I. Saddang',
        location: 'Kab. Pinrang, Sulawesi Selatan',
        contractor_pic_name: 'Saifuddin Fahmi',
        contractor_pic_title: 'Site Engineer',
      },
      'https://demo.supabase.co'
    );

    expect(branding.companyName).toBe('PT. Infrastruktur Nusantara Jaya');
    expect(branding.companyAddress).toBe('Jl. Jenderal Sudirman No. 45, Makassar');
    expect(branding.companyInitials).toBe('INJ');
    expect(branding.logoUrl).toBe(
      'https://demo.supabase.co/storage/v1/object/public/project-assets/proj-123-logo.png'
    );
    expect(branding.picName).toBe('Saifuddin Fahmi');
    expect(branding.picTitle).toBe('Site Engineer');
  });

  test('resolveProjectBranding tidak memakai nama perusahaan hardcoded saat data proyek kosong', () => {
    const empty = resolveProjectBranding(null);
    expect(empty.companyName).not.toMatch(/BANGUN KONSTRUKSI|SAKA GRAHA/i);
    expect(empty.logoUrl).toBe('');
    expect(deriveCompanyInitials('CV. Karya Mandiri')).toBe('KM');
    expect(resolveStorageLogoUrl('https://cdn.example.com/logo.png')).toBe(
      'https://cdn.example.com/logo.png'
    );
  });

  test('buildEnterpriseSignatureHtml menghasilkan blok TTD anti-page-break dengan ruang 64px dan escaping aman', () => {
    const html = buildEnterpriseSignatureHtml([
      { roleLabel: 'Dibuat Oleh,', name: 'Budi <Admin>', subtitle: 'Site Admin' },
      { roleLabel: 'Disetujui Oleh,', name: 'Mei Sunarko', subtitle: 'Project Manager' },
    ]);

    expect(html).toContain('page-break-inside:avoid');
    expect(html).toContain('break-inside:avoid');
    expect(html).toContain('height:64px');
    expect(html).toContain('width:50.00%');
    expect(html).toContain('Budi &lt;Admin&gt;');
    expect(escapePrintHtml('<script>')).toBe('&lt;script&gt;');
  });
});
