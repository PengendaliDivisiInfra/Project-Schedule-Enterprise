'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import SPKPrintTemplate from '@/components/spk/SPKPrintTemplate';
import { ArrowLeft, Download, FileText, ShieldCheck, Loader2, Maximize } from 'lucide-react';

export default function PrintClientWrapper({ 
  spk, templates, project, subcontractor, filename 
}: { 
  spk: any, templates: any[], project: any, subcontractor: any, filename: string 
}) {
  const [isGenerating, setIsGenerating] = useState(true);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [error, setError] = useState('');
  const router = useRouter();
  const hasFetched = useRef(false);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;

    const generatePreview = async () => {
      try {
        const element = document.getElementById('spk-render-target');
        if (!element) throw new Error('Elemen render tidak ditemukan');
        
        const htmlContent = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <style>
                body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; background: #fff; }
              </style>
            </head>
            <body>${element.innerHTML}</body>
          </html>
        `;

        // 👇 DESAIN PARAF & NOMOR (100% Murni Inline Style) 👇
        const footerHtml = `
          <div style="width: 100%; font-family: 'Arial Narrow', Arial, sans-serif; padding: 0 20mm; margin-top: 5mm; box-sizing: border-box; color: #000;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="width: 50%; vertical-align: bottom; font-size: 9pt; padding: 0; text-align: left;">
                  Halaman <span class="pageNumber"></span> dari <span class="totalPages"></span>
                </td>
                <td style="width: 50%; text-align: right; padding: 0;">
                  <table style="width: 90mm; border-collapse: collapse; font-size: 8.5pt; text-align: center; margin-left: auto; background-color: #fff;">
                    <tr>
                      <th style="border: 1px solid #000; padding: 6px 4px; font-weight: bold; background-color: #fff;">Sub Kont.</th>
                      <th style="border: 1px solid #000; padding: 6px 4px; font-weight: bold; background-color: #fff;">Site Manager</th>
                      <th style="border: 1px solid #000; padding: 6px 4px; font-weight: bold; background-color: #fff;">Man. Procurement</th>
                      <th style="border: 1px solid #000; padding: 6px 4px; font-weight: bold; background-color: #fff;">Procurement</th>
                    </tr>
                    <tr>
                      <td style="border: 1px solid #000; height: 25px;"></td>
                      <td style="border: 1px solid #000;"></td>
                      <td style="border: 1px solid #000;"></td>
                      <td style="border: 1px solid #000;"></td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </div>
        `;

        const response = await fetch('/api/generate-pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            html: htmlContent,
            format: 'A4',
            isLandscape: false, 
            scale: 1,
            footerTemplate: footerHtml
          })
        });

        if (!response.ok) throw new Error('Gagal generate PDF');

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        setPdfUrl(url);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsGenerating(false);
      }
    };

    generatePreview();

    return () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDownload = () => {
    if (!pdfUrl) return;
    const a = document.createElement('a');
    a.href = pdfUrl;
    a.download = filename;
    a.click();
  };

  return (
    <div className="flex h-screen w-full bg-[#e2e8f0] overflow-hidden font-sans">
      <div className="w-[380px] flex-shrink-0 bg-white border-r border-slate-300 shadow-2xl z-20 flex flex-col">
        <div className="p-6 border-b border-slate-100 bg-slate-50">
          <button onClick={() => router.back()} className="flex items-center text-sm font-medium text-slate-500 hover:text-indigo-600 mb-6 transition-colors group">
            <ArrowLeft size={16} className="mr-2 group-hover:-translate-x-1 transition-transform" /> Kembali ke Daftar
          </button>
          <h1 className="text-2xl font-extrabold text-slate-800 flex items-center gap-3 tracking-tight">
            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg"><FileText size={24} /></div>
            Dokumen SPK
          </h1>
          <p className="text-sm text-slate-500 mt-2">Pratinjau PDF Per Halaman (A4).</p>
        </div>

        <div className="p-6 flex-1 overflow-y-auto space-y-6">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Metadata Dokumen</h3>
            <div className="space-y-4 text-sm">
              <div>
                <span className="block text-slate-500 text-xs mb-1">Nomor SPK</span>
                <span className="font-semibold text-slate-800 font-mono text-base">{spk.spk_number}</span>
              </div>
              <div>
                <span className="block text-slate-500 text-xs mb-1">Pihak Kedua (Mandor)</span>
                <span className="font-semibold text-slate-800">{subcontractor.company_name} ({subcontractor.contact_person})</span>
              </div>
              <div>
                <span className="block text-slate-500 text-xs mb-1">Nilai Kontrak (Fix)</span>
                <span className="font-bold text-indigo-600 text-lg">Rp {spk.contract_value.toLocaleString('id-ID')}</span>
              </div>
            </div>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl text-xs flex gap-3 shadow-sm">
            <ShieldCheck size={20} className="flex-shrink-0 text-emerald-600" />
            <p className="leading-relaxed">Pratinjau di samping di-generate langsung oleh mesin PDF. Tampilan 100% sama dengan hasil unduhan.</p>
          </div>

          {error && <div className="text-red-600 text-sm bg-red-50 border border-red-200 p-3 rounded-lg font-medium">{error}</div>}
        </div>

        <div className="p-6 border-t border-slate-200 bg-slate-50">
          <button onClick={handleDownload} disabled={isGenerating || !pdfUrl} className="w-full py-3.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:bg-slate-400 flex items-center justify-center gap-2 font-bold shadow-lg shadow-indigo-600/30 transition-all active:scale-95">
            {isGenerating ? (
              <span className="animate-pulse flex items-center gap-2"><Loader2 size={20} className="animate-spin" /> Menyiapkan Dokumen...</span>
            ) : (
              <><Download size={20} /> Download PDF A4</>
            )}
          </button>
        </div>
      </div>

      <div className="flex-1 bg-[#525659] relative flex flex-col items-center">
        <div className="w-full bg-[#323639] text-white text-xs px-4 py-2 flex justify-between items-center shadow-md z-10">
          <div className="flex items-center gap-2"><FileText size={14} className="text-slate-400" /><span>{filename}</span></div>
          <div className="flex items-center gap-2 text-slate-300"><Maximize size={14} /> Mode PDF Viewer</div>
        </div>

        <div className="w-full flex-1 p-4 flex justify-center overflow-hidden">
          {isGenerating ? (
             <div className="flex flex-col items-center justify-center h-full text-slate-300">
                <Loader2 size={48} className="animate-spin mb-4 text-indigo-400" />
                <p className="text-lg font-medium">Menyusun Halaman PDF...</p>
             </div>
          ) : pdfUrl ? (
             <iframe src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=0`} className="w-full h-full max-w-5xl rounded shadow-2xl border-0 bg-white" title="SPK PDF Preview" />
          ) : (
             <div className="flex items-center justify-center h-full text-red-400">Gagal memuat pratinjau. Silakan coba lagi.</div>
          )}
        </div>
      </div>

      <div id="spk-render-target" style={{ display: 'none' }}>
        <SPKPrintTemplate spk={spk} templates={templates} project={project} subcontractor={subcontractor} />
      </div>
    </div>
  );
}