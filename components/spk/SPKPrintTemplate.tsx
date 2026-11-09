import React from 'react';
import { formatRupiah, terbilang } from '@/lib/utils/spk-helper';

interface SPKPrintProps {
  spk: any; 
  templates: any[]; 
  project: any; 
  subcontractor: any; 
}

const terbilangAngka = (n: number): string => {
  const angka = ["", "Satu", "Dua", "Tiga", "Empat", "Lima", "Enam", "Tujuh", "Delapan", "Sembilan", "Sepuluh", "Sebelas"];
  if (n < 12) return angka[n];
  if (n < 20) return terbilangAngka(n - 10) + " Belas";
  if (n < 100) return terbilangAngka(Math.floor(n / 10)) + " Puluh " + terbilangAngka(n % 10);
  if (n < 200) return "Seratus " + terbilangAngka(n - 100);
  if (n < 1000) return terbilangAngka(Math.floor(n / 100)) + " Ratus " + terbilangAngka(n % 100);
  if (n < 2000) return "Seribu " + terbilangAngka(n - 1000);
  if (n < 1000000) return terbilangAngka(Math.floor(n / 1000)) + " Ribu " + terbilangAngka(n % 1000);
  return "";
};

export default function SPKPrintTemplate({ spk, templates, project, subcontractor }: SPKPrintProps) {
  
  const formatIndoDate = (dateStr: string) => {
    const d = dateStr ? new Date(dateStr) : new Date();
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    return `${days[d.getDay()]} tanggal ${terbilangAngka(d.getDate())} bulan ${months[d.getMonth()]} tahun ${terbilangAngka(d.getFullYear())}`;
  };

  const formatShortDate = (dateStr: string) => {
    const d = dateStr ? new Date(dateStr) : new Date();
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    return `${d.getDate().toString().padStart(2, '0')} ${months[d.getMonth()]} ${d.getFullYear()}`;
  };

  const kotaTTD = project.location ? project.location.split(',')[0].trim() : 'Makassar';

  // LOGIKA TTD: Prioritas Form SPK -> Pengaturan Proyek -> Default
  const namaPihak1 = spk.signature_pihak_1 || project.contractor_pic_name || 'Nama Pihak 1';
  const jabatanPihak1 = spk.signature_pihak_1_title || project.contractor_pic_title || 'KaDiv Infra';
  
  const namaPihak2 = spk.signature_pihak_2 || subcontractor.contact_person || 'Nama Pihak 2';
  const jabatanPihak2 = spk.signature_pihak_2_title || 'Mandor';

  const parseContent = (content: string) => {
    let parsed = content.replace(/\\n/g, '\n').replace(/\t/g, ' ');

    const nilaiFormat = new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(spk.contract_value);
    const nominalStr = `Rp${nilaiFormat}`;
    
    parsed = parsed.replace(/{NILAI_BORONGAN}/g, nominalStr);
    parsed = parsed.replace(/{TERBILANG}/g, terbilang(spk.contract_value));
    
    const bankName = subcontractor.bank_name || 'Bank Rakyat Indonesia';
    const bankAcc = subcontractor.bank_account || '-';
    const bankOwner = subcontractor.contact_person || '-';

    parsed = parsed.replace(/{BANK_NAME}/g, bankName);
    parsed = parsed.replace(/{BANK_ACCOUNT}/g, bankAcc);
    parsed = parsed.replace(/{BANK_ACCOUNT_NAME}/g, bankOwner);
    parsed = parsed.replace(/{TANGGAL_MULAI}/g, spk.start_date || '09 November 2026');
    parsed = parsed.replace(/{TANGGAL_SELESAI}/g, spk.end_date || '25 Desember 2026');

    // Teks Pajak Baku
    const ppnRate = spk.ppn_pct ?? 11;
    const pphRate = spk.pph_pct ?? 2.5;
    let pajakParagraph = '';

    if (spk.tax_mode === 'EXCLUDE') {
      pajakParagraph = `<strong>2. Harga pekerjaan sebagaimana dimaksud dalam Pasal ini adalah sebesar ${nominalStr} (Exclude PPN).</strong> Nilai tersebut merupakan Dasar Pengenaan Pajak (DPP) yang belum termasuk Pajak Pertambahan Nilai (PPN) sebesar ${ppnRate}%. Nilai tersebut akan dikenakan pemotongan Pajak Penghasilan (PPh) Final Pasal 4 ayat (2) sebesar ${pphRate}% sesuai kualifikasi usaha penyedia jasa berdasarkan ketentuan perundang-undangan perpajakan yang berlaku.`;
    } else if (spk.tax_mode === 'INCLUDE') {
      pajakParagraph = `<strong>2. Harga pekerjaan sebagaimana dimaksud dalam Pasal ini adalah sebesar ${nominalStr} (Include PPN ${ppnRate}%).</strong> Nilai kontrak tersebut sudah mencakup unsur Pajak Pertambahan Nilai (PPN) sebesar ${ppnRate}%. Dasar Pengenaan Pajak (DPP) dihitung secara proporsional sebesar 100/${100 + ppnRate} dari nilai kontrak, dan pemotongan PPh Final Pasal 4 ayat (2) dihitung secara sah dari nilai DPP tersebut.`;
    } else {
      pajakParagraph = `<strong>2. Harga pekerjaan sebagaimana dimaksud dalam Pasal ini adalah sebesar ${nominalStr} (Non-PPN).</strong> Transaksi ini tidak dikenakan Pajak Pertambahan Nilai (PPN) dikarenakan Penyedia Jasa berstatus sebagai Non-Pengusaha Kena Pajak (Non-PKP). Nilai bruto tersebut sepenuhnya merupakan Dasar Pengenaan Pajak (DPP) yang tetap menjadi objek pemotongan Pajak Penghasilan (PPh) Final Pasal 4 ayat (2) sesuai ketentuan regulasi perpajakan.`;
    }

    let lines = parsed.split('\n');
    lines = lines.map(line => {
       if (line.includes('{PAJAK_TEXT}') || line.match(/^2\.\s*Harga pekerjaan/i)) {
           return pajakParagraph;
       }
       return line;
    });
    parsed = lines.join('\n');

    parsed = parsed.replace(/(=+.*?=+)/g, '\n$1\n');
    parsed = parsed.replace(/(\(Bill Of Quantity Terlampir\))/gi, '\n$1\n');
    parsed = parsed.replace(/(\(\s*Terbilang\s*:.*?\))/gi, '\n$1\n');
    parsed = parsed.replace(/\n{2,}/g, '\n'); 

    const finalParsed = parsed
      .replace(new RegExp(`(Bank\\s*:\\s*)(${bankName})`, 'gi'), '$1<strong>$2</strong>')
      .replace(new RegExp(`(Atas Nama\\s*:\\s*)(${bankOwner})`, 'gi'), '$1<strong>$2</strong>')
      .replace(new RegExp(`(Rekening Nomor\\s*:\\s*)(${bankAcc})`, 'gi'), '$1<strong>$2</strong>')
      .replace(/(PT\. BANGUN KONSTRUKSI PERSADA)/gi, '<strong>$1</strong>');

    return finalParsed.split('\n').map((line, i) => {
      const trimmed = line.trim();
      if (trimmed === '') return <div key={i} style={{ height: '8px' }}></div>;

      if (trimmed.includes('=======') || trimmed.includes('(Bill Of Quantity Terlampir)')) {
        return <div key={i} style={{ textAlign: 'center', marginBottom: '4px' }} dangerouslySetInnerHTML={{ __html: `<strong>${trimmed}</strong>` }} />;
      }
      if (trimmed.includes('Terbilang')) {
        return <div key={i} style={{ textAlign: 'left', paddingLeft: '25px', marginBottom: '12px' }} dangerouslySetInnerHTML={{ __html: trimmed }} />;
      }

      const bankMatch = trimmed.match(/^(Bank|Atas Nama|Rekening Nomor)\s*:?\s*(.*)/i);
      if (bankMatch) {
        return (
          <div key={i} style={{ display: 'flex', marginBottom: '4px', marginLeft: '25px', textAlign: 'left' }}>
            <div style={{ width: '120px', flexShrink: 0 }}>{bankMatch[1]}</div>
            <div style={{ width: '15px', flexShrink: 0 }}>:</div>
            <div style={{ flex: 1 }} dangerouslySetInnerHTML={{ __html: bankMatch[2] }} />
          </div>
        );
      }

      const numMatch = trimmed.match(/^(\d+\.)\s*(.*)/);
      if (numMatch) {
        return (
          <div key={i} style={{ display: 'flex', marginBottom: '6px', textAlign: 'justify' }}>
            <div style={{ width: '20px', flexShrink: 0 }}>{numMatch[1]}</div>
            <div style={{ flex: 1 }} dangerouslySetInnerHTML={{ __html: numMatch[2] }} />
          </div>
        );
      }

      const letterMatch = trimmed.match(/^([a-zA-Z]\.)\s*(.*)/);
      if (letterMatch) {
        return (
          <div key={i} style={{ display: 'flex', marginBottom: '4px', marginLeft: '25px', textAlign: 'justify' }}>
            <div style={{ width: '20px', flexShrink: 0 }}>{letterMatch[1]}</div>
            <div style={{ flex: 1 }} dangerouslySetInnerHTML={{ __html: letterMatch[2] }} />
          </div>
        );
      }

      const dashMatch = trimmed.match(/^([-•])\s*(.*)/);
      if (dashMatch) {
        return (
          <div key={i} style={{ display: 'flex', marginBottom: '4px', marginLeft: '40px', textAlign: 'justify' }}>
            <div style={{ width: '15px', flexShrink: 0 }}>{dashMatch[1]}</div>
            <div style={{ flex: 1 }} dangerouslySetInnerHTML={{ __html: dashMatch[2] }} />
          </div>
        );
      }

      if (trimmed.match(/^(Pembayaran Tagihan secara tunai|Pembayaran dengan Transfer)/i)) {
         return (
          <div key={i} style={{ marginBottom: '6px', marginLeft: '25px', textAlign: 'justify' }} dangerouslySetInnerHTML={{ __html: trimmed }} />
         );
      }

      return <div key={i} style={{ marginBottom: '6px', textAlign: 'justify' }} dangerouslySetInnerHTML={{ __html: trimmed }} />;
    });
  };

  return (
    <div style={{ 
      fontFamily: '"Arial Narrow", Arial, sans-serif',
      fontSize: '11pt', 
      lineHeight: '1.15', 
      color: '#000',
      backgroundColor: '#fff',
      padding: 0,
      margin: 0,
    }}>
      
      <style dangerouslySetInnerHTML={{__html: `
        table.bq-table { width: 100%; border-collapse: collapse; font-family: "Arial Narrow", Arial, sans-serif; font-size: 10pt; }
        table.bq-table th, table.bq-table td { border: 1px solid #000; padding: 4px 6px; vertical-align: middle; }
        table.bq-table th { text-align: center; background-color: #e5e7eb; font-weight: bold; }
        .empty-row td { border-left: 1px solid #000; border-right: 1px solid #000; border-bottom: 1px dotted #000; border-top: none; }
      `}} />

      {/* ================= BAGIAN 1: HALAMAN PASAL ================= */}
      
      <div style={{ textAlign: 'center', marginBottom: '25px' }}>
        <div style={{ fontWeight: 'bold', textDecoration: 'underline', fontSize: '11pt' }}>
          SURAT PERJANJIAN PELAKSANAAN PEKERJAAN PEMBORONGAN
        </div>
        <div style={{ fontSize: '11pt', fontStyle: 'italic', marginTop: '2px' }}>Antara</div>
        <div style={{ fontWeight: 'bold', fontSize: '11pt', textTransform: 'uppercase' }}>PT. BANGUN KONSTRUKSI PERSADA</div>
        <div style={{ fontSize: '11pt', fontStyle: 'italic', marginTop: '2px' }}>Dengan</div>
        <div style={{ fontWeight: 'bold', fontSize: '11pt', textTransform: 'uppercase' }}>{namaPihak2}</div>
      </div>

      <div style={{ borderBottom: '1px solid #000', paddingBottom: '5px', marginBottom: '15px' }}>
        <table style={{ border: 'none', width: '100%', fontSize: '11pt' }}>
          <tbody>
            <tr>
              <td style={{ border: 'none', width: '12%', padding: '1px 0' }}>Proyek</td>
              <td style={{ border: 'none', width: '2%', padding: '1px 0' }}>:</td>
              <td style={{ border: 'none', width: '86%', padding: '1px 0' }}>{project.name}</td>
            </tr>
            <tr>
              <td style={{ border: 'none', padding: '1px 0' }}>Pekerjaan</td>
              <td style={{ border: 'none', padding: '1px 0' }}>:</td>
              <td style={{ border: 'none', padding: '1px 0' }}>{spk.work_description}</td>
            </tr>
            <tr>
              <td style={{ border: 'none', padding: '1px 0' }}>No. SPK</td>
              <td style={{ border: 'none', padding: '1px 0' }}>:</td>
              <td style={{ border: 'none', fontWeight: 'bold', padding: '1px 0' }}>{spk.spk_number}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style={{ textAlign: 'justify', marginBottom: '15px' }}>
        Pada hari ini {formatIndoDate(spk.created_at)}, yang bertanda tangan dibawah ini :
      </div>
      
      <table style={{ border: 'none', marginBottom: '15px', fontSize: '11pt' }}>
        <tbody>
          <tr>
            <td style={{ border: 'none', width: '4%', verticalAlign: 'top', padding: '0 0 10px 0' }}>1.</td>
            <td style={{ border: 'none', width: '96%', textAlign: 'justify', padding: '0 0 10px 0' }}>
              <strong style={{ textTransform: 'uppercase' }}>{namaPihak1}</strong>
              <br/>
              <span>
                Dalam hal ini menjalankan Jabatannya selaku <strong>{jabatanPihak1}</strong> bertindak untuk dan atas nama PT. Bangun Konstruksi Persada, beralamat di {project.contractor_address}, untuk selanjutnya di disebut <strong>PIHAK PERTAMA</strong>.
              </span>
            </td>
          </tr>
          <tr>
            <td style={{ border: 'none', verticalAlign: 'top', padding: '0' }}>2.</td>
            <td style={{ border: 'none', textAlign: 'justify', padding: '0' }}>
              <strong style={{ textTransform: 'uppercase' }}>{namaPihak2}</strong>
              <br/>
              <span>
                Dalam hal ini menjalankan Jabatannya selaku {jabatanPihak2} bertindak untuk dan atas nama Pribadi, beralamat di {subcontractor.address} Untuk selanjutnya disebut <strong>PIHAK KEDUA</strong>.
              </span>
            </td>
          </tr>
        </tbody>
      </table>

      <div style={{ textAlign: 'justify', marginBottom: '4px' }}>Kedua belah pihak berdasarkan pada tetapi tidak terbatas :</div>
      <div style={{ textAlign: 'justify', marginBottom: '4px', paddingLeft: '20px' }}>a. Bill of Quantity, syarat-syarat kerja, spesifikasi teknik, Gambar-gambar, Berita Acara Aanwijzing/Klarifikasi atau dokumen-dokumen pendukung yang dikeluarkan oleh PIHAK PERTAMA atau dari Pemilik Proyek/Pemberi Tugas.</div>
      <div style={{ textAlign: 'justify', marginBottom: '15px', paddingLeft: '20px' }}>b. Dengan ini Kedua Belah Pihak menyatakan setuju dan sepakat untuk mengikat diri dalam suatu Perjanjian Pekerjaan Upah Jasa. dengan ketentuan dan syarat-syarat sebagaimana tercantum dalam Pasal-pasal berikut :</div>

      {templates.map((pasal, index) => (
        <div key={index} style={{ marginBottom: '15px' }}>
          <div style={{ border: '1px solid #000', padding: '4px', fontWeight: 'bold', textAlign: 'center', marginBottom: '10px', textTransform: 'uppercase', fontSize: '11pt' }}>
            {pasal.pasal_number} <br/> {pasal.title}
          </div>
          <div style={{ fontSize: '11pt' }}>
            {parseContent(pasal.content)}
          </div>
        </div>
      ))}

      <div style={{ marginTop: '50px', marginBottom: '50px', pageBreakInside: 'avoid' }}>
        <table style={{ border: 'none', textAlign: 'center', fontSize: '11pt', width: '100%' }}>
          <tbody>
            <tr>
              <td style={{ border: 'none', width: '50%', verticalAlign: 'top' }}>
                <div style={{ marginBottom: '5px' }}>PIHAK KEDUA,</div>
                <div style={{ height: '80px' }}></div>
                <div style={{ fontWeight: 'bold', textDecoration: 'underline', textTransform: 'uppercase' }}>
                  {namaPihak2}
                </div>
                <div style={{ marginTop: '2px' }}>{jabatanPihak2}</div>
              </td>
              <td style={{ border: 'none', width: '50%', verticalAlign: 'top' }}>
                <div style={{ marginBottom: '5px' }}>PIHAK PERTAMA,</div>
                <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>PT. BANGUN KONSTRUKSI PERSADA</div>
                <div style={{ height: '70px' }}></div>
                <div style={{ fontWeight: 'bold', textDecoration: 'underline', textTransform: 'uppercase' }}>
                  {namaPihak1}
                </div>
                <div style={{ marginTop: '2px' }}>{jabatanPihak1}</div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ================= BAGIAN 2: HALAMAN BILL OF QUANTITY ================= */}
      
      <div style={{ pageBreakBefore: 'always', marginTop: '0px' }}>
        
        <table style={{ width: '100%', border: 'none', marginBottom: '20px' }}>
          <tbody>
            <tr>
              <td style={{ border: 'none', width: '75%', verticalAlign: 'top' }}>
                <div style={{ fontWeight: 'bold', fontSize: '12pt' }}>PT. BANGUN KONSTRUKSI PERSADA</div>
                <div style={{ fontSize: '11pt', marginTop: '2px' }}>PROYEK {project.name}</div>
              </td>
              <td style={{ border: 'none', width: '25%', textAlign: 'right', verticalAlign: 'middle' }}>
                {project.logo_url ? (
                  <img src={project.logo_url} alt="Logo" style={{ maxHeight: '60px', maxWidth: '150px', objectFit: 'contain' }} />
                ) : (
                  <div style={{ border: '1px solid #000', padding: '10px', display: 'inline-block', color: '#000' }}>LOGO</div>
                )}
              </td>
            </tr>
          </tbody>
        </table>

        <div style={{ textAlign: 'center', fontWeight: 'bold', textDecoration: 'underline', fontSize: '12pt', marginBottom: '25px' }}>
          BILL OFF QUANTITY
        </div>

        <table style={{ width: '60%', border: 'none', marginBottom: '15px', fontSize: '10pt' }}>
          <tbody>
            <tr>
              <td style={{ border: 'none', width: '25%', padding: '2px 0' }}>Nomor SPK</td>
              <td style={{ border: 'none', width: '5%', padding: '2px 0' }}>:</td>
              <td style={{ border: 'none', width: '70%', padding: '2px 0' }}>{spk.spk_number}</td>
            </tr>
            <tr>
              <td style={{ border: 'none', padding: '2px 0' }}>Tanggal SPK</td>
              <td style={{ border: 'none', padding: '2px 0' }}>:</td>
              <td style={{ border: 'none', padding: '2px 0' }}>{formatShortDate(spk.created_at)}</td>
            </tr>
            <tr>
              <td style={{ border: 'none', padding: '2px 0' }}>Bidang Pekerjaan</td>
              <td style={{ border: 'none', padding: '2px 0' }}>:</td>
              <td style={{ border: 'none', padding: '2px 0' }}>{spk.work_description}</td>
            </tr>
          </tbody>
        </table>

        <table className="bq-table">
          <thead>
            <tr>
              <th rowSpan={2} style={{ width: '5%' }}>NO</th>
              <th rowSpan={2} style={{ width: '35%' }}>URAIAN PEKERJAAN</th>
              <th rowSpan={2} style={{ width: '10%' }}>SATUAN</th>
              <th rowSpan={2} style={{ width: '10%' }}>VOLUME</th>
              <th colSpan={2} style={{ width: '30%' }}>HARGA</th>
              <th rowSpan={2} style={{ width: '10%' }}>KETERANGAN</th>
            </tr>
            <tr>
              <th style={{ width: '15%' }}>SATUAN (Rp)</th>
              <th style={{ width: '15%' }}>JUMLAH HARGA (Rp)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={7} style={{ fontWeight: 'bold', textAlign: 'left', backgroundColor: '#f3f4f6' }}>NAMA SUB ITEM KONTRAK</td>
            </tr>
            
            {spk.bq_items?.map((item: any, i: number) => {
              const uraian = item.description || item.uraian || '-';
              const vol = item.volume || 0;
              const harga = item.unit_price || item.harga_satuan || 0;
              const satuan = item.unit || item.satuan || '-';
              const subtotal = vol * harga;

              return (
                <tr key={i}>
                  <td style={{ textAlign: 'center' }}>{i + 1}</td>
                  <td>{uraian}</td>
                  <td style={{ textAlign: 'center' }}>{satuan}</td>
                  <td style={{ textAlign: 'right' }}>{vol.toLocaleString('id-ID')}</td>
                  <td style={{ textAlign: 'right' }}>{harga.toLocaleString('id-ID')}</td>
                  <td style={{ textAlign: 'right' }}>{subtotal.toLocaleString('id-ID')}</td>
                  <td></td>
                </tr>
              );
            })}

            {[...Array(5)].map((_, i) => (
              <tr key={`empty-${i}`} className="empty-row">
                <td style={{ height: '20px' }}></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={5} style={{ textAlign: 'right', fontWeight: 'bold' }}>J U M L A H</td>
              <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{spk.contract_value.toLocaleString('id-ID')}</td>
              <td></td>
            </tr>
            <tr>
              <td colSpan={5} style={{ textAlign: 'right', fontWeight: 'bold' }}>DIBULATKAN</td>
              <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{spk.contract_value.toLocaleString('id-ID')}</td>
              <td></td>
            </tr>
            <tr>
              <td style={{ fontWeight: 'bold' }}>Terbilang</td>
              <td colSpan={6} style={{ fontStyle: 'italic', textTransform: 'capitalize' }}>{terbilang(spk.contract_value)}</td>
            </tr>
            <tr>
              <td colSpan={7} style={{ backgroundColor: '#fff' }}>
                <strong>Catatan :</strong><br/>
                <span style={{ fontStyle: 'italic' }}>Harga {spk.tax_mode === 'EXCLUDE' ? 'Exclude Pajak' : 'Include Pajak'}</span>
              </td>
            </tr>
          </tfoot>
        </table>

        <div style={{ marginTop: '15px', pageBreakInside: 'avoid' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', fontSize: '10pt' }}>
            <tbody>
              <tr>
                <td style={{ borderBottom: '1px solid #000', borderRight: '1px solid #000', textAlign: 'center', padding: '5px', width: '50%' }}>
                </td>
                <td style={{ borderBottom: '1px solid #000', textAlign: 'right', padding: '5px', width: '50%' }}>
                  {kotaTTD}, {formatShortDate(spk.created_at)}
                </td>
              </tr>
              
              <tr>
                <td style={{ borderBottom: '1px solid #000', borderRight: '1px solid #000', textAlign: 'center', padding: '5px' }}>
                  Mengetahui/Menyetujui,
                </td>
                <td style={{ borderBottom: '1px solid #000', textAlign: 'center', padding: '5px' }}>
                  Pihak Kedua (Penerima Tugas)
                </td>
              </tr>
              
              <tr>
                <td style={{ borderRight: '1px solid #000', height: '80px' }}></td>
                <td style={{ height: '80px' }}></td>
              </tr>
              
              <tr>
                <td style={{ borderRight: '1px solid #000', textAlign: 'center', padding: '5px', verticalAlign: 'top' }}>
                  <div style={{ fontWeight: 'bold', textDecoration: 'underline', textTransform: 'uppercase' }}>
                    {namaPihak1}
                  </div>
                  <div>{jabatanPihak1}</div>
                </td>
                <td style={{ textAlign: 'center', padding: '5px', verticalAlign: 'top' }}>
                  <div style={{ fontWeight: 'bold', textDecoration: 'underline', textTransform: 'uppercase' }}>
                    {namaPihak2}
                  </div>
                  <div>{jabatanPihak2}</div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        
      </div>

      {spk.ktp_url && (
        <div style={{ pageBreakBefore: 'always', paddingTop: '30px' }}>
          <div style={{ fontWeight: 'bold', fontSize: '14pt', marginBottom: '30px', textAlign: 'center' }}>LAMPIRAN (KTP PIHAK KEDUA)</div>
          <div style={{ textAlign: 'center' }}>
            <img src={spk.ktp_url} alt="KTP" style={{ maxHeight: '350px', maxWidth: '100%', objectFit: 'contain', border: '1px solid #000', padding: '5px' }} />
          </div>
        </div>
      )}

    </div>
  );
}