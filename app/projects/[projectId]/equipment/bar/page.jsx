'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { FileText, Printer, Loader2, CheckCircle2, AlertTriangle, Droplets, TrendingUp } from 'lucide-react';
import { generateBarData, saveBarToDB } from '@/lib/services/equipment.service';

export default function BarPage({ params }) {
  const projectId = params.projectId;
  const [contracts, setContracts] = useState([]);
  const [projectData, setProjectData] = useState(null);
  const [userData, setUserData] = useState(null); 
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  
  const [form, setForm] = useState({ contract_id: '', start_date: '', end_date: '' });
  const [previewData, setPreviewData] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 4000); };

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setUserData(user);

        const { data: contractsData } = await supabase.from('equipment_contracts').select('id, contract_number, vendor_name, rental_basis, contract_quota').eq('project_id', projectId).eq('is_active', true);
        const { data: projData } = await supabase.from('projects').select('*').eq('id', projectId).single();
        
        setContracts(contractsData || []);
        setProjectData(projData);
      } catch (err) {
        console.error("Gagal memuat data master:", err);
      } finally { setLoadingData(false); }
    };
    fetchInitialData();
  }, [projectId]);

  const handlePreview = async () => {
    if (!form.contract_id || !form.start_date || !form.end_date) return showToast("Lengkapi Kontrak dan Periode Tanggal.", "error");
    setLoading(true);
    try {
      const result = await generateBarData(form.contract_id, form.start_date, form.end_date);
      setPreviewData(result);
    } catch (err) { showToast(err.message, "error"); setPreviewData(null); } finally { setLoading(false); }
  };

  const handlePrintPDF = async () => {
    if (!previewData) return; setLoading(true);
    try {
      if (!userData) throw new Error("Sesi login tidak ditemukan.");
      await saveBarToDB(projectId, previewData, userData.id);
      
      const htmlContent = generateBarHTML(previewData, projectData, userData);
      
      const res = await fetch('/api/generate-pdf', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ html: htmlContent, format: 'A4', isLandscape: false, scale: 1 }) 
      });
      
      if (!res.ok) throw new Error('Gagal generate PDF');
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a'); 
      a.href = url; 
      
      // 🟢 NAMA FILE PDF YANG PROFESIONAL
      const safeStartDate = form.start_date.replace(/-/g, '');
      const safeEndDate = form.end_date.replace(/-/g, '');
      a.download = `BAR_Alat_${previewData.contract.contract_number}_${safeStartDate}_${safeEndDate}.pdf`;
      
      a.click();
      window.URL.revokeObjectURL(url);
      showToast('BAR disimpan & PDF diunduh.', 'success'); setPreviewData(null);
    } catch (err) { showToast(err.message, 'error'); } finally { setLoading(false); }
  };

  const generateBarHTML = (data, proj, user) => {
    const formatIDR = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num);
    const formatNum = (num) => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(num);
    const unitLabel = data.contract.rental_basis === 'Hourly' ? 'Jam' : 'Hari';
    
    const now = new Date();
    const docNumber = `BAR/${data.contract.contract_number}/${now.getFullYear()}/${String(now.getMonth()+1).padStart(2,'0')}/${String(now.getDate()).padStart(2,'0')}-${now.getTime().toString().slice(-4)}`;
    const printTime = now.toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' });
    const printBy = user?.email || 'System Admin';

    const logoHtml = proj?.logo_url 
      ? `<img src="${proj.logo_url}" style="max-height: 75px; max-width: 180px; object-fit: contain;" />`
      : `<div style="width: 120px; height: 60px; background-color: #E2E8F0; display: flex; align-items: center; justify-content: center; border: 1px dashed #94A3B8; color: #64748B; font-size: 10px;">LOGO</div>`;

    const cleanVendorName = data.contract.vendor_name.replace(/TEst/g, 'Test');
    const companyName = proj?.company_name || "PT BANGUN KONSTRUKSI PERSADA";
    const companyAddress = proj?.contractor_address || "Alamat Perusahaan";
    const projectName = proj?.name || "NAMA PROYEK";
    const projectLocation = proj?.location || "Lokasi Proyek";

    const itemsHtml = data.items.map((item, idx) => `
      <tr style="border-bottom: 1px solid #E2E8F0;">
        <td style="padding: 6px; text-align: center; color: #475569;">${idx + 1}</td>
        <td style="padding: 6px; text-align: center; color: #475569;">${new Date(item.log_date).toLocaleDateString('id-ID')}</td>
        <td style="padding: 6px; text-align: center; font-weight: bold; color: #1E293B;">${item.unit_code}</td>
        <td style="padding: 6px; text-align: right; color: #475569;">${item.actual_hours.toFixed(1)}</td>
        <td style="padding: 6px; text-align: right; color: #475569;">${item.regular_volume.toFixed(1)}</td>
        <td style="padding: 6px; text-align: right; color: #D97706;">${item.overtime_volume.toFixed(1)}</td>
        <td style="padding: 6px; text-align: right; color: #0284C7;">${formatNum(item.fuel_liters)} L</td>
        <td style="padding: 6px; text-align: right; color: #475569;">${formatIDR(item.regular_amount)}</td>
        <td style="padding: 6px; text-align: right; color: #D97706;">${formatIDR(item.overtime_amount)}</td>
        <td style="padding: 6px; text-align: right; font-weight: bold; color: #0F172A;">${formatIDR(item.billing_amount)}</td>
      </tr>
    `).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          @page { size: A4 portrait; margin: 15mm 15mm; }
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 11px; margin: 0; padding: 0; color: #334155; }
          table { width: 100%; border-collapse: collapse; }
          .signature-block { page-break-inside: avoid; margin-top: 30px; }
        </style>
      </head>
      <body>
        <table style="margin-bottom: 5px;">
          <tr>
            <td style="width: 130px; text-align: left; vertical-align: middle;">${logoHtml}</td>
            <td style="text-align: center; vertical-align: middle;">
              <h2 style="margin: 0; font-size: 18px; color: #0F172A; text-transform: uppercase; letter-spacing: 0.5px;">${companyName}</h2>
              <p style="margin: 2px 0; font-size: 11px; color: #64748B;">${companyAddress}</p>
              <h3 style="margin: 8px 0 2px 0; font-size: 13px; color: #1E293B; text-transform: uppercase;">${projectName}</h3>
              <p style="margin: 0; font-size: 11px; color: #64748B;">${projectLocation}</p>
            </td>
          </tr>
        </table>
        
        <div style="border-top: 2px solid #1E3A8A; border-bottom: 1px solid #1E3A8A; height: 2px; margin-bottom: 20px;"></div>

        <div style="text-align: center; margin-bottom: 20px;">
          <h3 style="margin: 0; font-size: 15px; color: #0F172A; text-transform: uppercase; letter-spacing: 1px;">BERITA ACARA REKONSILIASI ALAT</h3>
          <p style="margin: 5px 0 0 0; font-size: 10px; color: #64748B; font-family: monospace;">No. Dokumen: ${docNumber}</p>
        </div>
        
        <table style="margin-bottom: 20px; font-size: 11px; background-color: #F8FAFC; border-radius: 4px;">
          <tr>
            <td style="padding: 10px;">
              <table style="width: 100%;">
                <tr>
                  <td style="width: 18%; font-weight: bold; color: #475569;">No. Kontrak</td><td style="width: 32%; color: #0F172A;">: ${data.contract.contract_number}</td>
                  <td style="width: 18%; font-weight: bold; color: #475569;">Periode Sewa</td><td style="width: 32%; color: #0F172A;">: ${new Date(data.period_start).toLocaleDateString('id-ID')} s/d ${new Date(data.period_end).toLocaleDateString('id-ID')}</td>
                </tr>
                <tr>
                  <td style="font-weight: bold; color: #475569; padding-top: 6px;">Nama Vendor</td><td style="color: #0F172A; padding-top: 6px;">: ${cleanVendorName}</td>
                  <td style="font-weight: bold; color: #475569; padding-top: 6px;">Jenis Alat</td><td style="color: #0F172A; padding-top: 6px;">: ${data.contract.equipment_categories?.name || '-'}</td>
                </tr>
                <tr>
                  <td style="font-weight: bold; color: #475569; padding-top: 6px;">Basis Sewa</td><td style="color: #0F172A; padding-top: 6px;">: ${data.contract.rental_basis}</td>
                  <td style="font-weight: bold; color: #475569; padding-top: 6px;">Sisa Kuota</td><td style="color: #0F172A; padding-top: 6px;">: ${data.sisa_kuota_akhir.toFixed(1)} ${unitLabel}</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <table style="margin-bottom: 20px; font-size: 10px;">
          <thead>
            <tr style="background-color: #F1F5F9; color: #1E293B; border-bottom: 2px solid #CBD5E1;">
              <th style="padding: 8px; text-align: center; font-weight: bold;">No</th>
              <th style="padding: 8px; text-align: center; font-weight: bold;">Tanggal</th>
              <th style="padding: 8px; text-align: center; font-weight: bold;">Unit</th>
              <th style="padding: 8px; text-align: right; font-weight: bold;">Jam Kerja</th>
              <th style="padding: 8px; text-align: right; font-weight: bold;">Reguler</th>
              <th style="padding: 8px; text-align: right; font-weight: bold;">Lembur</th>
              <th style="padding: 8px; text-align: right; font-weight: bold;">BBM (L)</th>
              <th style="padding: 8px; text-align: right; font-weight: bold;">Rp Reguler</th>
              <th style="padding: 8px; text-align: right; font-weight: bold;">Rp Lembur</th>
              <th style="padding: 8px; text-align: right; font-weight: bold;">Total Rp</th>
            </tr>
          </thead>
          <tbody>${itemsHtml}</tbody>
        </table>
        
        <table style="margin-bottom: 30px; font-size: 11px;">
          <tr>
            <td style="vertical-align: top; width: 50%;">
              <table style="border: 1px solid #E2E8F0; border-radius: 4px;">
                <tr><td style="padding: 8px; border-bottom: 1px solid #E2E8F0; font-weight: bold; color: #1E293B; background-color: #F8FAFC;" colspan="2">Rekap BBM</td></tr>
                <tr><td style="padding: 8px; color: #475569;">Total Pemakaian</td><td style="padding: 8px; text-align: right; font-weight: bold; color: #0F172A;">${formatNum(data.total_fuel_liters)} Liter</td></tr>
                <tr><td style="padding: 8px; color: #475569;">Rata-rata / Hari</td><td style="padding: 8px; text-align: right; font-weight: bold; color: #0F172A;">${formatNum(data.avg_daily_fuel)} Liter/Hari</td></tr>
                <tr style="border-top: 1px solid #E2E8F0;"><td style="padding: 8px; color: #DC2626; font-weight: bold;">Potongan Tagihan</td><td style="padding: 8px; text-align: right; color: #DC2626; font-weight: bold;">- ${formatIDR(data.total_fuel_deduction)}</td></tr>
              </table>
            </td>
            <td style="vertical-align: top; width: 50%; padding-left: 20px;">
              <table>
                <tr><td style="padding: 6px 8px; color: #475569;">Total Tagihan Reguler</td><td style="padding: 6px 8px; text-align: right; color: #0F172A;">${formatIDR(data.total_regular_amount)}</td></tr>
                <tr><td style="padding: 6px 8px; color: #475569;">Total Tagihan Lembur</td><td style="padding: 6px 8px; text-align: right; color: #0F172A;">${formatIDR(data.total_overtime_amount)}</td></tr>
                <tr style="border-top: 1px solid #CBD5E1;"><td style="padding: 6px 8px; font-weight: bold; color: #1E293B;">Subtotal Alat</td><td style="padding: 6px 8px; text-align: right; font-weight: bold; color: #1E293B;">${formatIDR(data.total_billing_amount)}</td></tr>
                <tr style="border-bottom: 1px solid #CBD5E1;"><td style="padding: 6px 8px; color: #DC2626;">Potongan BBM</td><td style="padding: 6px 8px; text-align: right; color: #DC2626;">- ${formatIDR(data.total_fuel_deduction)}</td></tr>
                <tr style="background-color: #EFF6FF;">
                  <td style="padding: 10px; font-weight: bold; font-size: 13px; color: #1E3A8A;">GRAND TOTAL</td>
                  <td style="padding: 10px; text-align: right; font-weight: bold; font-size: 13px; color: #1E3A8A;">${formatIDR(data.grand_total)}</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <div class="signature-block">
          <table style="text-align: center; font-size: 11px;">
            <tr>
              <td style="width: 33%;"><p style="color: #475569; margin-bottom: 60px;">Dibuat Oleh,</p><p style="border-top: 1px solid #475569; display: inline-block; padding-top: 5px; font-weight: bold; color: #1E293B; min-width: 150px;">Admin Logistik</p></td>
              <td style="width: 33%;"><p style="color: #475569; margin-bottom: 60px;">Diperiksa Oleh,</p><p style="border-top: 1px solid #475569; display: inline-block; padding-top: 5px; font-weight: bold; color: #1E293B; min-width: 150px;">Site Manager</p></td>
              <td style="width: 34%;"><p style="color: #475569; margin-bottom: 60px;">Disetujui Oleh,</p><p style="border-top: 1px solid #475569; display: inline-block; padding-top: 5px; font-weight: bold; color: #1E293B; min-width: 150px;">Perwakilan Vendor</p></td>
            </tr>
          </table>
        </div>

        <div style="margin-top: 40px; padding-top: 10px; border-top: 1px solid #E2E8F0; text-align: center; font-size: 9px; color: #94A3B8;">
          Dokumen ini dihasilkan secara otomatis oleh InfraControl PRO pada ${printTime} oleh ${printBy}.<br/>
          Sah dan berlaku tanpa memerlukan tanda tangan basah apabila telah diverifikasi melalui sistem.
        </div>
      </body>
      </html>
    `;
  };

  const formatCurrency = (val) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);
  const formatNumber = (val) => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(val);
  const percentageUsed = previewData ? Math.min(100, (previewData.total_quota_used / previewData.contract.contract_quota) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2 mb-6"><FileText className="text-indigo-600" /> Berita Acara Rekonsiliasi (BAR)</h1>
        <div className="flex gap-4 items-end bg-slate-50 p-4 rounded-lg border border-slate-200">
          <div className="flex-1">
            <label className="block text-sm font-bold text-slate-700 mb-1">Pilih Kontrak</label>
            <select value={form.contract_id} onChange={e => setForm({...form, contract_id: e.target.value})} className="w-full border rounded-lg p-2.5 bg-white">
              <option value="">-- Pilih Kontrak --</option>
              {contracts.map(c => <option key={c.id} value={c.id}>{c.contract_number} - {c.vendor_name} ({c.rental_basis})</option>)}
            </select>
          </div>
          <div><label className="block text-sm font-bold text-slate-700 mb-1">Periode Awal</label><input type="date" value={form.start_date} onChange={e => setForm({...form, start_date: e.target.value})} className="border rounded-lg p-2.5" /></div>
          <div><label className="block text-sm font-bold text-slate-700 mb-1">Periode Akhir</label><input type="date" value={form.end_date} onChange={e => setForm({...form, end_date: e.target.value})} className="border rounded-lg p-2.5" /></div>
          <button onClick={handlePreview} disabled={loading} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-6 rounded-lg transition-all flex items-center gap-2 h-[42px]">{loading ? <Loader2 className="animate-spin" size={18} /> : 'Preview'}</button>
        </div>
      </div>

      {previewData && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in">
          <div className="p-5 border-b bg-slate-800 text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="w-full md:w-1/2">
              <h3 className="font-bold text-lg mb-1">Preview Perhitungan</h3>
              <div className="flex justify-between text-xs text-slate-300 font-bold mb-1">
                <span>Terpakai: {previewData.total_quota_used.toFixed(1)} {previewData.contract.rental_basis === 'Hourly' ? 'Jam' : 'Hari'}</span>
                <span>Sisa: {previewData.sisa_kuota_akhir.toFixed(1)} {previewData.contract.rental_basis === 'Hourly' ? 'Jam' : 'Hari'}</span>
              </div>
              <div className="w-full bg-slate-600 rounded-full h-2">
                <div className="bg-emerald-400 h-2 rounded-full" style={{ width: `${percentageUsed}%` }}></div>
              </div>
            </div>
            <button onClick={handlePrintPDF} disabled={loading} className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2 px-6 rounded-lg flex items-center gap-2 shadow-lg shrink-0">{loading ? <Loader2 className="animate-spin" size={18} /> : <><Printer size={18} /> Cetak PDF</>}</button>
          </div>

          <div className="p-6 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 border-b">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
              <p className="text-[10px] font-bold text-blue-600 mb-1 uppercase">Total Reguler</p>
              <p className="text-lg font-mono font-bold text-blue-800">{formatCurrency(previewData.total_regular_amount)}</p>
            </div>
            <div className="bg-amber-50 p-4 rounded-lg border border-amber-100">
              <p className="text-[10px] font-bold text-amber-600 mb-1 uppercase">Total Lembur</p>
              <p className="text-lg font-mono font-bold text-amber-800">{formatCurrency(previewData.total_overtime_amount)}</p>
            </div>
            <div className="bg-cyan-50 p-4 rounded-lg border border-cyan-100">
              <p className="text-[10px] font-bold text-cyan-600 mb-1 uppercase flex items-center gap-1"><Droplets size={12}/> Total BBM</p>
              <p className="text-lg font-mono font-bold text-cyan-800">{formatNumber(previewData.total_fuel_liters)} <span className="text-xs">Liter</span></p>
            </div>
            <div className="bg-teal-50 p-4 rounded-lg border border-teal-100">
              <p className="text-[10px] font-bold text-teal-600 mb-1 uppercase flex items-center gap-1"><TrendingUp size={12}/> Rata-rata / Hari</p>
              <p className="text-lg font-mono font-bold text-teal-800">{formatNumber(previewData.avg_daily_fuel)} <span className="text-xs">L/Hari</span></p>
            </div>
            <div className="bg-red-50 p-4 rounded-lg border border-red-100">
              <p className="text-[10px] font-bold text-red-600 mb-1 uppercase">Potongan BBM (Rp)</p>
              <p className="text-lg font-mono font-bold text-red-800">- {formatCurrency(previewData.total_fuel_deduction)}</p>
            </div>
            <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-100 shadow-sm ring-1 ring-emerald-200">
              <p className="text-[10px] font-bold text-emerald-600 mb-1 uppercase">Grand Total</p>
              <p className="text-lg font-mono font-bold text-emerald-800">{formatCurrency(previewData.grand_total)}</p>
            </div>
          </div>

          <div className="p-6 overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-100 text-slate-600 border-b">
                <tr>
                  <th className="p-3">Tanggal</th>
                  <th className="p-3">Unit</th>
                  <th className="p-3 text-right">Jam Kerja</th>
                  <th className="p-3 text-center">Reguler</th>
                  <th className="p-3 text-center">Lembur</th>
                  <th className="p-3 text-right text-cyan-700">Liter BBM</th>
                  <th className="p-3 text-right">Rp Reguler</th>
                  <th className="p-3 text-right">Rp Lembur</th>
                  <th className="p-3 text-right">Total</th>
                  <th className="p-3">Keterangan</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {previewData.items.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="p-3 font-medium">{new Date(item.log_date).toLocaleDateString('id-ID')}</td>
                    <td className="p-3 font-bold text-indigo-700">{item.unit_code}</td>
                    <td className="p-3 text-right font-mono">{item.actual_hours.toFixed(1)}</td>
                    <td className="p-3 text-center font-mono text-emerald-600">{item.regular_volume.toFixed(1)}</td>
                    <td className="p-3 text-center font-mono text-amber-600">{item.overtime_volume.toFixed(1)}</td>
                    <td className="p-3 text-right font-mono text-cyan-700 font-bold bg-cyan-50/30">{formatNumber(item.fuel_liters)} L</td>
                    <td className="p-3 text-right font-mono">{formatCurrency(item.regular_amount)}</td>
                    <td className="p-3 text-right font-mono text-amber-600">{formatCurrency(item.overtime_amount)}</td>
                    <td className="p-3 text-right font-mono font-bold">{formatCurrency(item.billing_amount)}</td>
                    <td className="p-3 text-xs text-slate-500">{item.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed top-6 right-6 z-[9999] px-6 py-4 rounded-lg shadow-xl text-white font-bold flex items-center gap-3 ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'}`}>
          {toast.type === 'success' ? <CheckCircle2 size={24} /> : <AlertTriangle size={24} />}<p className="text-sm">{toast.msg}</p>
        </div>
      )}
    </div>
  );
}