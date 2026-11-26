import React from 'react';
import { terbilang } from '@/lib/utils/spk-helper';
import { terbilang as terbilangAngka } from '@/lib/utils/terbilang';

interface SPKPrintProps {
  spk: any;
  templates: any[];
  project: any;
  subcontractor: any;
}


export default function SPKPrintTemplate({
  spk,
  templates,
  project,
  subcontractor,
}: SPKPrintProps) {
  const formatIndoDate = (dateStr?: string) => {
    const d = dateStr ? new Date(dateStr) : new Date();
    const days = [
      'Minggu',
      'Senin',
      'Selasa',
      'Rabu',
      'Kamis',
      'Jumat',
      'Sabtu',
    ];
    const months = [
      'Januari',
      'Februari',
      'Maret',
      'April',
      'Mei',
      'Juni',
      'Juli',
      'Agustus',
      'September',
      'Oktober',
      'November',
      'Desember',
    ];
    return `${days[d.getDay()]} tanggal ${terbilangAngka(d.getDate()).trim()} bulan ${months[d.getMonth()]} tahun ${terbilangAngka(d.getFullYear()).trim()}`;
  };

  const formatShortDate = (dateStr?: string) => {
    const d = dateStr ? new Date(dateStr) : new Date();
    const months = [
      'Januari',
      'Februari',
      'Maret',
      'April',
      'Mei',
      'Juni',
      'Juli',
      'Agustus',
      'September',
      'Oktober',
      'November',
      'Desember',
    ];
    return `${d.getDate().toString().padStart(2, '0')} ${months[d.getMonth()]} ${d.getFullYear()}`;
  };

  const formatCurrency = (val: number, decimals = 2) => {
    return new Intl.NumberFormat('id-ID', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(Number(val || 0));
  };

  const contractorAddress =
    project?.contractor_address ||
    'Jl. Ketintang Baru Selatan VII No. 10, Kota Surabaya - Jawa Timur';
  const kotaTTD = project?.location
    ? project.location.split(',')[0].trim()
    : 'Kab. Pinrang';

  const namaPihak1 =
    spk.signature_pihak_1 || project?.contractor_pic_name || 'Nama Pihak 1';
  const jabatanPihak1 =
    spk.signature_pihak_1_title || project?.contractor_pic_title || 'KaDiv Infra';

  const namaPihak2 =
    spk.signature_pihak_2 || subcontractor?.contact_person || 'Nama Pihak 2';
  const jabatanPihak2 = spk.signature_pihak_2_title || 'Mandor';

  const rawCompanyPihak2 = (subcontractor?.company_name || '').trim();
  const isPribadi =
    !rawCompanyPihak2 || rawCompanyPihak2.toLowerCase() === 'pribadi';
  const entitasPihak2Label = isPribadi
    ? 'Pribadi'
    : `<strong>${rawCompanyPihak2}</strong>`;

  const contractValue = Number(spk.contract_value || 0);
  const terbilangText = terbilang(Math.round(contractValue));
  const retentionPct = spk.retention_pct ?? 5;
  const ppnRate = spk.ppn_pct ?? 11;
  const pphRate = spk.pph_pct ?? 1.75;

  const getTaxBadgeLabel = (mode?: string) => {
    if (mode === 'EXCLUDE') return `Exclude PPN (${ppnRate}%)`;
    if (mode === 'INCLUDE') return `Include PPN (${ppnRate}%)`;
    return 'Non Pajak (Non-PKP)';
  };

  const bqItems = Array.isArray(spk.bq_items) ? spk.bq_items : [];
  const subtotalBoQ = bqItems.reduce((acc: number, item: any) => {
    const vol = Number(item.volume || 0);
    const harga = Number(item.unit_price ?? item.harga_satuan ?? 0);
    return acc + vol * harga;
  }, 0);

  let dppBoQ = contractValue;
  let ppnBoQ = 0;
  if (spk.tax_mode === 'EXCLUDE') {
    dppBoQ = Math.floor(subtotalBoQ / 1000) * 1000 || contractValue;
    ppnBoQ = Math.floor(dppBoQ * (ppnRate / 100));
  } else if (spk.tax_mode === 'INCLUDE') {
    dppBoQ = contractValue / (1 + ppnRate / 100);
    ppnBoQ = contractValue - dppBoQ;
  }

  const parseContent = (content: string) => {
    let parsed = (content || '')
      .replace(/\\n/g, '\n')
      .replace(/\t/g, ' ')
      .replace(/^(\d+)\.\s+(\d+\.)/gm, '$1.$2')
      .replace(/([.;:])\s+(\d+\.\d+\.)\s+/g, '$1\n$2 ')
      .replace(
        /^\s*(Berita Acara Prestasi Pekerjaan|Berita acara pembayaran|Invoice\/kwitansi|Copy Kontrak)/gim,
        '• $1'
      );

    const nominalStr = `Rp ${formatCurrency(contractValue, 2)}`;

    parsed = parsed.replace(/{NILAI_BORONGAN}/g, nominalStr);
    parsed = parsed.replace(/{TERBILANG}/g, terbilangText);

    const bankName = subcontractor?.bank_name || 'Bank Rakyat Indonesia';
    const bankAcc = subcontractor?.bank_account || '-';
    const bankOwner = subcontractor?.contact_person || namaPihak2;

    parsed = parsed.replace(/{BANK_NAME}/g, bankName);
    parsed = parsed.replace(/{BANK_ACCOUNT}/g, bankAcc);
    parsed = parsed.replace(/{BANK_ACCOUNT_NAME}/g, bankOwner);
    parsed = parsed.replace(
      /{TANGGAL_MULAI}/g,
      spk.start_date ? formatShortDate(spk.start_date) : '09 November 2026'
    );
    parsed = parsed.replace(
      /{TANGGAL_SELESAI}/g,
      spk.end_date ? formatShortDate(spk.end_date) : '25 Desember 2026'
    );

    let pajakParagraph = '';
    if (spk.tax_mode === 'EXCLUDE') {
      pajakParagraph = `<strong>2.</strong> Harga pekerjaan sebagaimana dimaksud dalam Pasal ini adalah sebesar <strong>${nominalStr} (Exclude PPN)</strong>. Nilai tersebut merupakan Dasar Pengenaan Pajak (DPP) yang belum termasuk Pajak Pertambahan Nilai (PPN) sebesar ${ppnRate}%, dan akan dikenakan pemotongan Pajak Penghasilan (PPh) Final Pasal 4 ayat (2) sebesar ${pphRate}% sesuai ketentuan perundang-undangan perpajakan yang berlaku.`;
    } else if (spk.tax_mode === 'INCLUDE') {
      pajakParagraph = `<strong>2.</strong> Harga pekerjaan sebagaimana dimaksud dalam Pasal ini adalah sebesar <strong>${nominalStr} (Include PPN ${ppnRate}%)</strong>. Nilai kontrak tersebut sudah mencakup unsur Pajak Pertambahan Nilai (PPN) sebesar ${ppnRate}%, dengan Dasar Pengenaan Pajak (DPP) proporsional sebesar 100/${100 + ppnRate} dari nilai kontrak sebagai dasar pemotongan PPh Final Pasal 4 ayat (2).`;
    } else {
      pajakParagraph = `<strong>2.</strong> Harga pekerjaan sebagaimana dimaksud dalam Pasal ini adalah sebesar <strong>${nominalStr} (Non-PPN)</strong>. Transaksi ini tidak dikenakan Pajak Pertambahan Nilai (PPN) dikarenakan Penyedia Jasa berstatus sebagai Non-Pengusaha Kena Pajak (Non-PKP). Nilai bruto tersebut merupakan Dasar Pengenaan Pajak (DPP) yang tetap menjadi objek pemotongan Pajak Penghasilan (PPh) Final Pasal 4 ayat (2) sesuai ketentuan regulasi perpajakan.`;
    }

    let lines = parsed.split('\n');
    lines = lines.map((line) => {
      if (
        line.includes('{PAJAK_TEXT}') ||
        line.trim().match(/^2\.\s*Harga pekerjaan/i)
      ) {
        return pajakParagraph;
      }
      return line;
    });
    parsed = lines.join('\n');

    parsed = parsed.replace(/(=+.*?=+)/g, '\n__VALUE_BOX__$1\n');
    parsed = parsed.replace(/(\(Bill Of Quantity Terlampir\))/gi, '\n$1\n');
    parsed = parsed.replace(/(\(\s*Terbilang\s*:.*?\))/gi, '\n$1\n');
    parsed = parsed.replace(/\n{2,}/g, '\n');

    const finalParsed = parsed
      .replace(
        new RegExp(`(Bank\\s*:\\s*)(${bankName})`, 'gi'),
        '$1<strong>$2</strong>'
      )
      .replace(
        new RegExp(`(Atas Nama\\s*:\\s*)(${bankOwner})`, 'gi'),
        '$1<strong>$2</strong>'
      )
      .replace(
        new RegExp(`(Rekening Nomor\\s*:\\s*)(${bankAcc})`, 'gi'),
        '$1<strong>$2</strong>'
      )
      .replace(/(PT\. BANGUN KONSTRUKSI PERSADA)/gi, '<strong>$1</strong>');

    const rawLines = finalParsed.split('\n');
    const elements: React.ReactNode[] = [];
    let i = 0;

    while (i < rawLines.length) {
      const trimmed = rawLines[i].trim();

      if (trimmed === '') {
        elements.push(<div key={`sp-${i}`} style={{ height: '5px' }} />);
        i++;
        continue;
      }

      if (trimmed.startsWith('__VALUE_BOX__')) {
        let terbilangLine = '';
        let boqNoteLine = '(Bill of Quantity Terlampir)';
        let lookahead = i + 1;
        while (lookahead < rawLines.length && lookahead <= i + 3) {
          const nextTrim = rawLines[lookahead].trim();
          if (nextTrim.match(/Bill Of Quantity Terlampir/i)) {
            boqNoteLine = nextTrim;
            rawLines[lookahead] = '';
          } else if (nextTrim.match(/Terbilang/i)) {
            terbilangLine = nextTrim.replace(/^\(|\)$/g, '');
            rawLines[lookahead] = '';
          }
          lookahead++;
        }

        elements.push(
          <table
            key={`vbox-${i}`}
            style={{
              width: '92%',
              margin: '8px auto 12px auto',
              borderCollapse: 'collapse',
              backgroundColor: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderLeft: '4px solid #0f172a',
              pageBreakInside: 'avoid',
            }}
          >
            <tbody>
              <tr>
                <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                  <div
                    style={{
                      fontSize: '8.5pt',
                      textTransform: 'uppercase',
                      letterSpacing: '0.8px',
                      color: '#475569',
                      fontWeight: 'bold',
                      marginBottom: '3px',
                    }}
                  >
                    Nilai Harga Borongan {boqNoteLine}
                  </div>
                  <div
                    style={{
                      fontSize: '13.5pt',
                      fontWeight: 'bold',
                      color: '#0f172a',
                      letterSpacing: '0.3px',
                    }}
                  >
                    {nominalStr}
                  </div>
                  {terbilangLine && (
                    <div
                      style={{
                        fontSize: '9.5pt',
                        fontStyle: 'italic',
                        color: '#334155',
                        marginTop: '3px',
                      }}
                    >
                      {terbilangLine}
                    </div>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        );
        i++;
        continue;
      }

      const bankMatch = trimmed.match(
        /^(Bank|Atas Nama|Rekening Nomor)\s*:?\s*(.*)/i
      );
      if (bankMatch) {
        const bankRows: { label: string; value: string }[] = [];
        while (i < rawLines.length) {
          const bm = rawLines[i]
            .trim()
            .match(/^(Bank|Atas Nama|Rekening Nomor)\s*:?\s*(.*)/i);
          if (!bm) break;
          bankRows.push({ label: bm[1], value: bm[2] });
          i++;
        }

        elements.push(
          <table
            key={`bank-box-${i}`}
            style={{
              width: '88%',
              margin: '6px 0 8px 24px',
              borderCollapse: 'collapse',
              backgroundColor: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderLeft: '3px solid #1e3a8a',
              pageBreakInside: 'avoid',
            }}
          >
            <tbody>
              {bankRows.map((row, idx) => (
                <tr key={idx}>
                  <td
                    style={{
                      width: '130px',
                      padding:
                        idx === 0
                          ? '6px 8px 3px 12px'
                          : idx === bankRows.length - 1
                          ? '3px 8px 6px 12px'
                          : '3px 8px 3px 12px',
                      fontSize: '9.5pt',
                      color: '#334155',
                      verticalAlign: 'top',
                    }}
                  >
                    {row.label}
                  </td>
                  <td
                    style={{
                      width: '12px',
                      padding: '3px 0',
                      fontSize: '9.5pt',
                      color: '#334155',
                      verticalAlign: 'top',
                    }}
                  >
                    :
                  </td>
                  <td
                    style={{
                      padding:
                        idx === 0
                          ? '6px 12px 3px 4px'
                          : idx === bankRows.length - 1
                          ? '3px 12px 6px 4px'
                          : '3px 12px 3px 4px',
                      fontSize: '9.5pt',
                      color: '#0f172a',
                      verticalAlign: 'top',
                    }}
                    dangerouslySetInnerHTML={{ __html: row.value }}
                  />
                </tr>
              ))}
            </tbody>
          </table>
        );
        continue;
      }

      const subNumMatch = trimmed.match(/^(\d+\.\d+\.)\s*(.*)/);
      if (subNumMatch) {
        elements.push(
          <table
            key={`subnum-${i}`}
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              marginBottom: '4px',
              pageBreakInside: 'avoid',
            }}
          >
            <tbody>
              <tr>
                <td style={{ width: '22px', padding: 0 }} />
                <td
                  style={{
                    width: '32px',
                    verticalAlign: 'top',
                    padding: '0 4px 0 0',
                    fontWeight: 'bold',
                    color: '#1e293b',
                  }}
                >
                  {subNumMatch[1]}
                </td>
                <td
                  style={{
                    verticalAlign: 'top',
                    textAlign: 'justify',
                    padding: 0,
                  }}
                  dangerouslySetInnerHTML={{ __html: subNumMatch[2] }}
                />
              </tr>
            </tbody>
          </table>
        );
        i++;
        continue;
      }

      const numMatch = trimmed.match(
        /^(?:<strong>)?(\d+\.)(?:<\/strong>)?\s*(.*)/
      );
      if (numMatch) {
        elements.push(
          <table
            key={`num-${i}`}
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              marginBottom: '5px',
              pageBreakInside: 'avoid',
            }}
          >
            <tbody>
              <tr>
                <td
                  style={{
                    width: '22px',
                    verticalAlign: 'top',
                    padding: '0 4px 0 0',
                    fontWeight: 'bold',
                    color: '#0f172a',
                  }}
                >
                  {numMatch[1]}
                </td>
                <td
                  style={{
                    verticalAlign: 'top',
                    textAlign: 'justify',
                    padding: 0,
                  }}
                  dangerouslySetInnerHTML={{ __html: numMatch[2] }}
                />
              </tr>
            </tbody>
          </table>
        );
        i++;
        continue;
      }

      const letterMatch = trimmed.match(/^([a-zA-Z]\.)\s*(.*)/);
      if (letterMatch) {
        elements.push(
          <table
            key={`let-${i}`}
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              marginBottom: '4px',
              pageBreakInside: 'avoid',
            }}
          >
            <tbody>
              <tr>
                <td style={{ width: '22px', padding: 0 }} />
                <td
                  style={{
                    width: '20px',
                    verticalAlign: 'top',
                    padding: '0 4px 0 0',
                    fontWeight: 'bold',
                    color: '#1e293b',
                  }}
                >
                  {letterMatch[1]}
                </td>
                <td
                  style={{
                    verticalAlign: 'top',
                    textAlign: 'justify',
                    padding: 0,
                  }}
                  dangerouslySetInnerHTML={{ __html: letterMatch[2] }}
                />
              </tr>
            </tbody>
          </table>
        );
        i++;
        continue;
      }

      const dashMatch = trimmed.match(/^([-•])\s*(.*)/);
      if (dashMatch) {
        elements.push(
          <table
            key={`dash-${i}`}
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              marginBottom: '3px',
              pageBreakInside: 'avoid',
            }}
          >
            <tbody>
              <tr>
                <td style={{ width: '24px', padding: 0 }} />
                <td
                  style={{
                    width: '16px',
                    verticalAlign: 'top',
                    padding: '0 4px 0 0',
                    fontWeight: 'bold',
                    color: '#334155',
                  }}
                >
                  •
                </td>
                <td
                  style={{
                    verticalAlign: 'top',
                    textAlign: 'justify',
                    padding: 0,
                  }}
                  dangerouslySetInnerHTML={{ __html: dashMatch[2] }}
                />
              </tr>
            </tbody>
          </table>
        );
        i++;
        continue;
      }

      if (
        trimmed.match(
          /^(Pembayaran Tagihan secara tunai|Pembayaran dengan Tran)/i
        )
      ) {
        elements.push(
          <div
            key={`paynote-${i}`}
            style={{
              marginBottom: '4px',
              paddingLeft: '24px',
              textAlign: 'justify',
              fontSize: '9.5pt',
              color: '#1e293b',
            }}
            dangerouslySetInnerHTML={{ __html: trimmed }}
          />
        );
        i++;
        continue;
      }

      elements.push(
        <div
          key={`p-${i}`}
          style={{ marginBottom: '5px', textAlign: 'justify' }}
          dangerouslySetInnerHTML={{ __html: trimmed }}
        />
      );
      i++;
    }

    return elements;
  };

  return (
    <div
      style={{
        fontFamily: '"Arial", "Helvetica", sans-serif',
        fontSize: '10pt',
        lineHeight: '1.38',
        color: '#0f172a',
        backgroundColor: '#ffffff',
        padding: 0,
        margin: 0,
      }}
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
            table { border-collapse: collapse; }
            .pasal-block { margin-bottom: 14px; }
            .pasal-header {
              background-color: #f1f5f9;
              border-top: 1.5px solid #0f172a;
              border-bottom: 1.5px solid #0f172a;
              border-left: 4px solid #0f172a;
              padding: 6px 10px;
              font-weight: bold;
              text-align: center;
              margin-bottom: 10px;
              text-transform: uppercase;
              font-size: 10.5pt;
              letter-spacing: 0.4px;
              color: #0f172a;
              page-break-after: avoid;
              break-after: avoid;
            }
            table.meta-box {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 16px;
              border: 1px solid #cbd5e1;
              background-color: #f8fafc;
              font-size: 9pt;
            }
            table.meta-box td {
              padding: 5px 10px;
              border-bottom: 0.5px solid #e2e8f0;
              vertical-align: top;
            }
            table.bq-table {
              width: 100%;
              border-collapse: collapse;
              font-family: "Arial", "Helvetica", sans-serif;
              font-size: 9.5pt;
              font-variant-numeric: tabular-nums;
            }
            table.bq-table th,
            table.bq-table td {
              border: 0.75px solid #334155;
              padding: 6px 8px;
              vertical-align: middle;
            }
            table.bq-table th {
              text-align: center;
              background-color: #0f172a;
              color: #ffffff;
              font-weight: bold;
              font-size: 8.5pt;
              letter-spacing: 0.3px;
            }
            table.bq-table tr {
              page-break-inside: avoid;
              break-inside: avoid;
            }
          `,
        }}
      />

      {/* KOP SURAT ENTERPRISE (100% Pure Table) */}
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          borderBottom: '3px double #0f172a',
          marginBottom: '18px',
        }}
      >
        <tbody>
          <tr>
            <td
              style={{
                width: '92px',
                verticalAlign: 'middle',
                paddingBottom: '12px',
                textAlign: 'left',
              }}
            >
              {project?.logo_url ? (
                <img
                  src={project.logo_url}
                  alt="Logo"
                  style={{
                    height: '66px',
                    width: 'auto',
                    maxWidth: '85px',
                    objectFit: 'contain',
                    display: 'block',
                  }}
                />
              ) : (
                <div
                  style={{
                    height: '62px',
                    width: '62px',
                    border: '1.5px solid #0f172a',
                    textAlign: 'center',
                    lineHeight: '62px',
                    fontSize: '9pt',
                    fontWeight: 'bold',
                    color: '#0f172a',
                  }}
                >
                  BKP
                </div>
              )}
            </td>
            <td
              style={{
                verticalAlign: 'middle',
                textAlign: 'center',
                paddingBottom: '12px',
                paddingRight: '46px',
              }}
            >
              <div
                style={{
                  fontWeight: 'bold',
                  fontSize: '16.5pt',
                  textTransform: 'uppercase',
                  letterSpacing: '1.2px',
                  color: '#0f172a',
                  lineHeight: '1.15',
                }}
              >
                PT. BANGUN KONSTRUKSI PERSADA
              </div>
              <div
                style={{
                  fontSize: '9pt',
                  fontWeight: 'bold',
                  letterSpacing: '1.5px',
                  color: '#1e3a8a',
                  marginTop: '3px',
                  textTransform: 'uppercase',
                }}
              >
                GENERAL CONTRACTOR &amp; SUPPLIER — DIVISI INFRASTRUKTUR
              </div>
              <div
                style={{
                  fontSize: '8.5pt',
                  color: '#475569',
                  marginTop: '3px',
                }}
              >
                {contractorAddress}
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* JUDUL & NOMOR SURAT PERJANJIAN */}
      <div style={{ textAlign: 'center', marginBottom: '16px' }}>
        <div
          style={{
            fontWeight: 'bold',
            fontSize: '13pt',
            letterSpacing: '0.5px',
            color: '#0f172a',
            textDecoration: 'underline',
            textUnderlineOffset: '4px',
          }}
        >
          SURAT PERJANJIAN PELAKSANAAN PEKERJAAN PEMBORONGAN
        </div>
        <div
          style={{
            fontSize: '10pt',
            fontWeight: 'bold',
            color: '#1e293b',
            marginTop: '5px',
            letterSpacing: '0.3px',
          }}
        >
          Nomor: {spk.spk_number}
        </div>
      </div>

      {/* KOTAK RINGKASAN IDENTITAS PAKET PEKERJAAN */}
      <table className="meta-box">
        <tbody>
          <tr>
            <td style={{ width: '18%', fontWeight: 'bold', color: '#334155' }}>
              Nama Proyek
            </td>
            <td style={{ width: '2%', fontWeight: 'bold' }}>:</td>
            <td style={{ width: '44%', fontWeight: 'bold', color: '#0f172a' }}>
              {project?.name || '-'}
            </td>
            <td style={{ width: '15%', fontWeight: 'bold', color: '#334155' }}>
              Nilai Kontrak
            </td>
            <td style={{ width: '2%', fontWeight: 'bold' }}>:</td>
            <td style={{ width: '19%', fontWeight: 'bold', color: '#0f172a' }}>
              Rp {formatCurrency(contractValue, 2)}
            </td>
          </tr>
          <tr>
            <td style={{ fontWeight: 'bold', color: '#334155' }}>
              Paket Pekerjaan
            </td>
            <td style={{ fontWeight: 'bold' }}>:</td>
            <td style={{ color: '#0f172a' }}>{spk.work_description || '-'}</td>
            <td style={{ fontWeight: 'bold', color: '#334155' }}>
              Status Pajak
            </td>
            <td style={{ fontWeight: 'bold' }}>:</td>
            <td style={{ color: '#1e3a8a', fontWeight: 'bold' }}>
              {getTaxBadgeLabel(spk.tax_mode)}
            </td>
          </tr>
          <tr>
            <td style={{ fontWeight: 'bold', color: '#334155', borderBottom: 'none' }}>
              Lokasi Proyek
            </td>
            <td style={{ fontWeight: 'bold', borderBottom: 'none' }}>:</td>
            <td style={{ color: '#334155', borderBottom: 'none' }}>
              {project?.location || '-'}
            </td>
            <td style={{ fontWeight: 'bold', color: '#334155', borderBottom: 'none' }}>
              Retensi
            </td>
            <td style={{ fontWeight: 'bold', borderBottom: 'none' }}>:</td>
            <td style={{ color: '#334155', borderBottom: 'none' }}>
              {retentionPct}% dari Prestasi
            </td>
          </tr>
        </tbody>
      </table>

      {/* KOMPARISI PARA PIHAK */}
      <div style={{ textAlign: 'justify', marginBottom: '12px' }}>
        Pada hari ini <strong>{formatIndoDate(spk.created_at)}</strong>, yang
        bertanda tangan di bawah ini:
      </div>

      <table
        style={{
          border: 'none',
          marginBottom: '14px',
          fontSize: '10pt',
          width: '100%',
        }}
      >
        <tbody>
          <tr>
            <td
              style={{
                border: 'none',
                width: '22px',
                verticalAlign: 'top',
                padding: '0 0 10px 0',
                fontWeight: 'bold',
              }}
            >
              1.
            </td>
            <td
              style={{
                border: 'none',
                textAlign: 'justify',
                padding: '0 0 10px 0',
              }}
            >
              <strong style={{ textTransform: 'uppercase', fontSize: '10.5pt' }}>
                {namaPihak1}
              </strong>
              <br />
              <span>
                Dalam hal ini menjalankan jabatannya selaku{' '}
                <strong>{jabatanPihak1}</strong>, bertindak untuk dan atas nama{' '}
                <strong>PT. Bangun Konstruksi Persada</strong>, berkedudukan
                dan beralamat di {contractorAddress}, untuk selanjutnya disebut{' '}
                <strong>PIHAK PERTAMA</strong>.
              </span>
            </td>
          </tr>
          <tr>
            <td
              style={{
                border: 'none',
                verticalAlign: 'top',
                padding: '0',
                fontWeight: 'bold',
              }}
            >
              2.
            </td>
            <td style={{ border: 'none', textAlign: 'justify', padding: '0' }}>
              <strong style={{ textTransform: 'uppercase', fontSize: '10.5pt' }}>
                {namaPihak2}
              </strong>
              <br />
              <span>
                Dalam hal ini menjalankan jabatannya selaku{' '}
                <strong>{jabatanPihak2}</strong>, bertindak untuk dan atas nama{' '}
                <span
                  dangerouslySetInnerHTML={{ __html: entitasPihak2Label }}
                />
                , beralamat di {subcontractor?.address || '-'}, untuk
                selanjutnya disebut <strong>PIHAK KEDUA</strong>.
              </span>
            </td>
          </tr>
        </tbody>
      </table>

      <div style={{ textAlign: 'justify', marginBottom: '6px' }}>
        Kedua belah pihak sepakat mengikatkan diri berdasarkan pada tetapi tidak
        terbatas:
      </div>

      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          marginBottom: '16px',
        }}
      >
        <tbody>
          <tr>
            <td style={{ width: '20px', padding: 0 }} />
            <td
              style={{
                width: '20px',
                verticalAlign: 'top',
                fontWeight: 'bold',
                paddingBottom: '5px',
              }}
            >
              a.
            </td>
            <td style={{ textAlign: 'justify', paddingBottom: '5px' }}>
              Bill of Quantity (BoQ), syarat-syarat kerja, spesifikasi teknis,
              gambar-gambar kerja (<em>shop drawing</em>), Berita Acara
              Aanwijzing/Klarifikasi, serta dokumen-dokumen pendukung yang
              diterbitkan oleh <strong>PIHAK PERTAMA</strong> maupun Pemilik
              Proyek/Pemberi Tugas.
            </td>
          </tr>
          <tr>
            <td style={{ width: '20px', padding: 0 }} />
            <td
              style={{
                width: '20px',
                verticalAlign: 'top',
                fontWeight: 'bold',
              }}
            >
              b.
            </td>
            <td style={{ textAlign: 'justify' }}>
              Dengan ini Kedua Belah Pihak menyatakan setuju dan sepakat untuk
              mengikatkan diri dalam suatu Perjanjian Pelaksanaan Pekerjaan Upah
              Jasa dengan ketentuan dan syarat-syarat sebagaimana tercantum
              dalam Pasal-pasal berikut:
            </td>
          </tr>
        </tbody>
      </table>

      {/* DAFTAR PASAL */}
      {templates.map((pasal, index) => (
        <div key={index} className="pasal-block">
          <div className="pasal-header">
            {String(pasal.pasal_number || '').replace(/\s+/g, ' ').trim()} — {String(pasal.title || '').replace(/\s+/g, ' ').trim()}
          </div>
          <div style={{ fontSize: '10pt' }}>{parseContent(pasal.content)}</div>
        </div>
      ))}

      {/* BLOK PENGESAHAN & TANDA TANGAN UTAMA */}
      <div
        style={{
          marginTop: '24px',
          pageBreakInside: 'avoid',
          breakInside: 'avoid',
        }}
      >
        <div
          style={{
            textAlign: 'justify',
            marginBottom: '14px',
            fontSize: '9.5pt',
            color: '#1e293b',
            borderTop: '1px solid #cbd5e1',
            paddingTop: '12px',
          }}
        >
          Demikian Surat Perjanjian Pelaksanaan Pekerjaan Pemborongan ini
          dibuat dan ditandatangani oleh Kedua Belah Pihak dalam keadaan sadar,
          sehat jasmani dan rohani, serta tanpa paksaan dari pihak manapun,
          untuk dilaksanakan dengan penuh tanggung jawab.
        </div>

        <div
          style={{
            textAlign: 'center',
            fontWeight: 'bold',
            fontSize: '9.5pt',
            marginBottom: '16px',
            color: '#0f172a',
          }}
        >
          Ditetapkan dan ditandatangani di {kotaTTD}, pada tanggal{' '}
          {formatShortDate(spk.created_at)}
        </div>

        <table
          style={{
            borderCollapse: 'collapse',
            textAlign: 'center',
            fontSize: '10pt',
            width: '100%',
          }}
        >
          <tbody>
            <tr>
              <td
                style={{
                  width: '50%',
                  verticalAlign: 'top',
                  padding: '0 16px',
                }}
              >
                <div
                  style={{
                    fontSize: '8.5pt',
                    letterSpacing: '0.5px',
                    color: '#475569',
                    fontWeight: 'bold',
                  }}
                >
                  PIHAK KEDUA,
                </div>
                <div
                  style={{
                    fontWeight: 'bold',
                    fontSize: '9.5pt',
                    marginTop: '2px',
                    color: '#0f172a',
                  }}
                >
                  {isPribadi ? 'PENERIMA TUGAS / MANDOR' : rawCompanyPihak2}
                </div>

                <div
                  style={{
                    width: '88px',
                    height: '44px',
                    margin: '16px auto 18px auto',
                    border: '1px dashed #94a3b8',
                    color: '#64748b',
                    fontSize: '7pt',
                    lineHeight: '1.3',
                    paddingTop: '10px',
                    boxSizing: 'border-box',
                  }}
                >
                  MATERAI
                  <br />
                  Rp 10.000
                </div>

                <div
                  style={{
                    width: '210px',
                    margin: '0 auto',
                    borderBottom: '1.25px solid #0f172a',
                    fontWeight: 'bold',
                    textTransform: 'uppercase',
                    paddingBottom: '2px',
                  }}
                >
                  {namaPihak2}
                </div>
                <div
                  style={{
                    marginTop: '4px',
                    fontSize: '9pt',
                    color: '#334155',
                  }}
                >
                  {jabatanPihak2}
                </div>
              </td>

              <td
                style={{
                  width: '50%',
                  verticalAlign: 'top',
                  padding: '0 16px',
                }}
              >
                <div
                  style={{
                    fontSize: '8.5pt',
                    letterSpacing: '0.5px',
                    color: '#475569',
                    fontWeight: 'bold',
                  }}
                >
                  PIHAK PERTAMA,
                </div>
                <div
                  style={{
                    fontWeight: 'bold',
                    fontSize: '9.5pt',
                    marginTop: '2px',
                    color: '#0f172a',
                  }}
                >
                  PT. BANGUN KONSTRUKSI PERSADA
                </div>

                <div
                  style={{
                    width: '88px',
                    height: '44px',
                    margin: '16px auto 18px auto',
                    border: '1px dashed #cbd5e1',
                    color: '#94a3b8',
                    fontSize: '7pt',
                    lineHeight: '1.3',
                    paddingTop: '10px',
                    boxSizing: 'border-box',
                  }}
                >
                  STEMPEL &amp;
                  <br />
                  TTD ASLI
                </div>

                <div
                  style={{
                    width: '210px',
                    margin: '0 auto',
                    borderBottom: '1.25px solid #0f172a',
                    fontWeight: 'bold',
                    textTransform: 'uppercase',
                    paddingBottom: '2px',
                  }}
                >
                  {namaPihak1}
                </div>
                <div
                  style={{
                    marginTop: '4px',
                    fontSize: '9pt',
                    color: '#334155',
                  }}
                >
                  {jabatanPihak1}
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* LAMPIRAN I — BILL OF QUANTITY (BOQ) */}
      <div style={{ pageBreakBefore: 'always', marginTop: '0px' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            borderBottom: '2px solid #0f172a',
            marginBottom: '16px',
          }}
        >
          <tbody>
            <tr>
              <td style={{ paddingBottom: '8px', verticalAlign: 'bottom' }}>
                <div
                  style={{
                    fontSize: '8.5pt',
                    fontWeight: 'bold',
                    letterSpacing: '1px',
                    color: '#1e3a8a',
                    textTransform: 'uppercase',
                  }}
                >
                  LAMPIRAN I — SURAT PERJANJIAN PEMBORONGAN
                </div>
                <div
                  style={{
                    fontSize: '14pt',
                    fontWeight: 'bold',
                    color: '#0f172a',
                    marginTop: '2px',
                  }}
                >
                  BILL OF QUANTITY (BOQ)
                </div>
              </td>
              <td
                style={{
                  paddingBottom: '8px',
                  textAlign: 'right',
                  verticalAlign: 'bottom',
                }}
              >
                <div
                  style={{
                    fontWeight: 'bold',
                    fontSize: '10pt',
                    color: '#0f172a',
                  }}
                >
                  PT. BANGUN KONSTRUKSI PERSADA
                </div>
                <div style={{ fontSize: '8.5pt', color: '#475569' }}>
                  Divisi Infrastruktur
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <table className="meta-box">
          <tbody>
            <tr>
              <td style={{ width: '18%', fontWeight: 'bold', color: '#334155' }}>
                Nomor SPK
              </td>
              <td style={{ width: '2%', fontWeight: 'bold' }}>:</td>
              <td style={{ width: '42%', fontWeight: 'bold', color: '#0f172a' }}>
                {spk.spk_number}
              </td>
              <td style={{ width: '16%', fontWeight: 'bold', color: '#334155' }}>
                Tanggal SPK
              </td>
              <td style={{ width: '2%', fontWeight: 'bold' }}>:</td>
              <td style={{ width: '20%', color: '#0f172a' }}>
                {formatShortDate(spk.created_at)}
              </td>
            </tr>
            <tr>
              <td style={{ fontWeight: 'bold', color: '#334155' }}>
                Nama Proyek
              </td>
              <td style={{ fontWeight: 'bold' }}>:</td>
              <td colSpan={4} style={{ fontWeight: 'bold', color: '#0f172a' }}>
                {project?.name || '-'}
              </td>
            </tr>
            <tr>
              <td
                style={{
                  fontWeight: 'bold',
                  color: '#334155',
                  borderBottom: 'none',
                }}
              >
                Bidang Pekerjaan
              </td>
              <td style={{ fontWeight: 'bold', borderBottom: 'none' }}>:</td>
              <td style={{ color: '#0f172a', borderBottom: 'none' }}>
                {spk.work_description || '-'}
              </td>
              <td
                style={{
                  fontWeight: 'bold',
                  color: '#334155',
                  borderBottom: 'none',
                }}
              >
                Pihak Kedua
              </td>
              <td style={{ fontWeight: 'bold', borderBottom: 'none' }}>:</td>
              <td
                style={{
                  fontWeight: 'bold',
                  color: '#0f172a',
                  borderBottom: 'none',
                }}
              >
                {namaPihak2}
              </td>
            </tr>
          </tbody>
        </table>

        <table className="bq-table">
          <thead>
            <tr>
              <th rowSpan={2} style={{ width: '5%' }}>
                NO
              </th>
              <th rowSpan={2} style={{ width: '37%' }}>
                URAIAN PEKERJAAN
              </th>
              <th rowSpan={2} style={{ width: '8%' }}>
                SAT
              </th>
              <th rowSpan={2} style={{ width: '11%' }}>
                VOLUME
              </th>
              <th colSpan={2} style={{ width: '29%' }}>
                HARGA PENAWARAN
              </th>
              <th rowSpan={2} style={{ width: '10%' }}>
                KET.
              </th>
            </tr>
            <tr>
              <th style={{ width: '13%' }}>SATUAN (Rp)</th>
              <th style={{ width: '16%' }}>JUMLAH (Rp)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td
                colSpan={7}
                style={{
                  fontWeight: 'bold',
                  textAlign: 'left',
                  backgroundColor: '#e2e8f0',
                  color: '#0f172a',
                  fontSize: '8.5pt',
                  letterSpacing: '0.4px',
                }}
              >
                I. PEKERJAAN UTAMA
              </td>
            </tr>

            {bqItems.map((item: any, i: number) => {
              const uraian = item.description || item.uraian || '-';
              const vol = Number(item.volume || 0);
              const harga = Number(item.unit_price ?? item.harga_satuan ?? 0);
              const satuan = item.unit || item.satuan || '-';
              const subtotal = vol * harga;
              const hasDecimalSubtotal = Math.abs(subtotal % 1) > 0.001;

              return (
                <tr
                  key={i}
                  style={{
                    backgroundColor: i % 2 === 1 ? '#f8fafc' : '#ffffff',
                  }}
                >
                  <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                    {i + 1}
                  </td>
                  <td style={{ textAlign: 'left' }}>{uraian}</td>
                  <td style={{ textAlign: 'center' }}>{satuan}</td>
                  <td style={{ textAlign: 'right' }}>
                    {formatCurrency(vol, 2)}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {formatCurrency(harga, 0)}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                    {formatCurrency(subtotal, hasDecimalSubtotal ? 2 : 0)}
                  </td>
                  <td style={{ textAlign: 'center', fontSize: '8.5pt' }}>
                    {item.notes || ''}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td
                colSpan={5}
                style={{
                  textAlign: 'right',
                  fontWeight: 'bold',
                  backgroundColor: '#f1f5f9',
                  color: '#334155',
                }}
              >
                JUMLAH (SUBTOTAL)
              </td>
              <td
                style={{
                  textAlign: 'right',
                  fontWeight: 'bold',
                  backgroundColor: '#f1f5f9',
                }}
              >
                {formatCurrency(
                  subtotalBoQ,
                  Math.abs(subtotalBoQ % 1) > 0.001 ? 2 : 0
                )}
              </td>
              <td style={{ backgroundColor: '#f1f5f9' }} />
            </tr>

            {spk.tax_mode === 'EXCLUDE' && (
              <>
                <tr>
                  <td
                    colSpan={5}
                    style={{
                      textAlign: 'right',
                      fontWeight: 'bold',
                      backgroundColor: '#f8fafc',
                    }}
                  >
                    DASAR PENGENAAN PAJAK / DPP (DIBULATKAN)
                  </td>
                  <td
                    style={{
                      textAlign: 'right',
                      fontWeight: 'bold',
                      backgroundColor: '#f8fafc',
                    }}
                  >
                    {formatCurrency(dppBoQ, 0)}
                  </td>
                  <td style={{ backgroundColor: '#f8fafc' }} />
                </tr>
                <tr>
                  <td
                    colSpan={5}
                    style={{
                      textAlign: 'right',
                      fontWeight: 'bold',
                      backgroundColor: '#f8fafc',
                    }}
                  >
                    PPN ({ppnRate}%)
                  </td>
                  <td
                    style={{
                      textAlign: 'right',
                      fontWeight: 'bold',
                      backgroundColor: '#f8fafc',
                    }}
                  >
                    {formatCurrency(ppnBoQ, 0)}
                  </td>
                  <td style={{ backgroundColor: '#f8fafc' }} />
                </tr>
              </>
            )}

            <tr>
              <td
                colSpan={5}
                style={{
                  textAlign: 'right',
                  fontWeight: 'bold',
                  backgroundColor: '#e2e8f0',
                  color: '#0f172a',
                  fontSize: '9.5pt',
                }}
              >
                NILAI KONTRAK (DIBULATKAN)
              </td>
              <td
                style={{
                  textAlign: 'right',
                  fontWeight: 'bold',
                  backgroundColor: '#e2e8f0',
                  color: '#0f172a',
                  fontSize: '10pt',
                }}
              >
                {formatCurrency(contractValue, 0)}
              </td>
              <td style={{ backgroundColor: '#e2e8f0' }} />
            </tr>
            <tr>
              <td
                colSpan={2}
                style={{
                  fontWeight: 'bold',
                  backgroundColor: '#f8fafc',
                  color: '#334155',
                }}
              >
                Terbilang
              </td>
              <td
                colSpan={5}
                style={{
                  fontStyle: 'italic',
                  fontWeight: 'bold',
                  backgroundColor: '#f8fafc',
                  color: '#0f172a',
                }}
              >
                {terbilangText}
              </td>
            </tr>
            <tr>
              <td
                colSpan={7}
                style={{ backgroundColor: '#ffffff', padding: '8px 10px' }}
              >
                <strong>Catatan Perpajakan &amp; Ketentuan Harga:</strong>
                <br />
                <span style={{ fontStyle: 'italic', color: '#334155' }}>
                  • Harga {getTaxBadgeLabel(spk.tax_mode)} — Unit Fixed Price
                  (Harga Satuan Tetap &amp; Mengikat).
                </span>
              </td>
            </tr>
          </tfoot>
        </table>

        <div
          style={{
            marginTop: '28px',
            pageBreakInside: 'avoid',
            breakInside: 'avoid',
          }}
        >
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '9.5pt',
              textAlign: 'center',
            }}
          >
            <tbody>
              <tr>
                <td style={{ width: '50%', padding: '2px 12px', color: '#334155' }}>
                  Mengetahui / Menyetujui,
                </td>
                <td style={{ width: '50%', padding: '2px 12px', color: '#334155' }}>
                  {kotaTTD}, {formatShortDate(spk.created_at)}
                </td>
              </tr>
              <tr>
                <td
                  style={{
                    padding: '2px 12px',
                    fontWeight: 'bold',
                    color: '#0f172a',
                  }}
                >
                  Pihak Kedua (Penerima Tugas)
                </td>
                <td
                  style={{
                    padding: '2px 12px',
                    fontWeight: 'bold',
                    color: '#0f172a',
                  }}
                >
                  Pihak Pertama (Pemberi Tugas)
                </td>
              </tr>
              <tr>
                <td style={{ height: '68px' }} />
                <td style={{ height: '68px' }} />
              </tr>
              <tr>
                <td style={{ padding: '2px 12px', verticalAlign: 'top' }}>
                  <div
                    style={{
                      width: '200px',
                      margin: '0 auto',
                      borderBottom: '1.25px solid #0f172a',
                      fontWeight: 'bold',
                      textTransform: 'uppercase',
                      paddingBottom: '2px',
                    }}
                  >
                    {namaPihak2}
                  </div>
                  <div style={{ marginTop: '3px', color: '#334155' }}>
                    {jabatanPihak2}
                  </div>
                </td>
                <td style={{ padding: '2px 12px', verticalAlign: 'top' }}>
                  <div
                    style={{
                      width: '200px',
                      margin: '0 auto',
                      borderBottom: '1.25px solid #0f172a',
                      fontWeight: 'bold',
                      textTransform: 'uppercase',
                      paddingBottom: '2px',
                    }}
                  >
                    {namaPihak1}
                  </div>
                  <div style={{ marginTop: '3px', color: '#334155' }}>
                    {jabatanPihak1}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* LAMPIRAN II — IDENTITAS & KTP PIHAK KEDUA */}
      {spk.ktp_url && (
        <div style={{ pageBreakBefore: 'always', marginTop: '0px' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              borderBottom: '2px solid #0f172a',
              marginBottom: '16px',
            }}
          >
            <tbody>
              <tr>
                <td style={{ paddingBottom: '8px', verticalAlign: 'bottom' }}>
                  <div
                    style={{
                      fontSize: '8.5pt',
                      fontWeight: 'bold',
                      letterSpacing: '1px',
                      color: '#1e3a8a',
                      textTransform: 'uppercase',
                    }}
                  >
                    LAMPIRAN II — DOKUMEN LEGALITAS PELAKSANA
                  </div>
                  <div
                    style={{
                      fontSize: '14pt',
                      fontWeight: 'bold',
                      color: '#0f172a',
                      marginTop: '2px',
                    }}
                  >
                    IDENTITAS / KTP PIHAK KEDUA
                  </div>
                </td>
                <td
                  style={{
                    paddingBottom: '8px',
                    textAlign: 'right',
                    verticalAlign: 'bottom',
                  }}
                >
                  <div
                    style={{
                      fontWeight: 'bold',
                      fontSize: '9.5pt',
                      color: '#0f172a',
                    }}
                  >
                    Ref. SPK: {spk.spk_number}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          <table className="meta-box">
            <tbody>
              <tr>
                <td style={{ width: '24%', fontWeight: 'bold', color: '#334155' }}>
                  Nama Lengkap Pihak Kedua
                </td>
                <td style={{ width: '2%', fontWeight: 'bold' }}>:</td>
                <td style={{ fontWeight: 'bold', color: '#0f172a' }}>
                  {namaPihak2}
                </td>
              </tr>
              <tr>
                <td style={{ fontWeight: 'bold', color: '#334155' }}>
                  Jabatan / Badan Usaha
                </td>
                <td style={{ fontWeight: 'bold' }}>:</td>
                <td style={{ color: '#0f172a' }}>
                  {jabatanPihak2}{' '}
                  {!isPribadi ? `— ${rawCompanyPihak2}` : '(Perorangan)'}
                </td>
              </tr>
              <tr>
                <td
                  style={{
                    fontWeight: 'bold',
                    color: '#334155',
                    borderBottom: 'none',
                  }}
                >
                  Alamat Domisili
                </td>
                <td style={{ fontWeight: 'bold', borderBottom: 'none' }}>:</td>
                <td style={{ color: '#0f172a', borderBottom: 'none' }}>
                  {subcontractor?.address || '-'}
                </td>
              </tr>
            </tbody>
          </table>

          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              border: '1px solid #cbd5e1',
              backgroundColor: '#f8fafc',
              marginTop: '14px',
            }}
          >
            <tbody>
              <tr>
                <td style={{ padding: '24px', textAlign: 'center' }}>
                  <img
                    src={spk.ktp_url}
                    alt="KTP Pihak Kedua"
                    style={{
                      width: '340px',
                      maxHeight: '220px',
                      maxWidth: '88%',
                      objectFit: 'contain',
                      border: '1px solid #94a3b8',
                      padding: '6px',
                      backgroundColor: '#ffffff',
                    }}
                  />
                  <div
                    style={{
                      marginTop: '10px',
                      fontSize: '8.5pt',
                      color: '#475569',
                      fontStyle: 'italic',
                    }}
                  >
                    Dokumen identitas resmi Pihak Kedua yang dilampirkan sebagai
                    bagian tidak terpisahkan dari SPK Nomor {spk.spk_number}.
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}