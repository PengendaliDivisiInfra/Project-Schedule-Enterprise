'use client';

import { useState, useEffect } from 'react';
import { useRole } from '@/lib/hooks/useRole';
import {
  createKasbonRequest,
  updateKasbonRequest,
  getAllKasbonHistory,
  softDeleteSubconPayment,
} from '@/lib/services/subcon.service';
import { MoneyText } from '@/components/ui/MoneyText';
import { SignatureSettings } from '@/components/shared/SignatureSettings';
import { SignatureItem } from '@/lib/types/subcon';
import {
  Wallet,
  Settings,
  Save,
  Printer,
  Pencil,
  Trash2,
  Loader2,
  AlertTriangle,
  X,
  RotateCcw,
} from 'lucide-react';

interface KasbonViewProps {
  projectId: string;
  projectData: any;
  spks: any[];
  showToast: (msg: string, type: 'success' | 'error') => void;
}

function terbilang(angka: number): string {
  if (!angka || angka === 0) return 'Nol';
  angka = Math.floor(Math.abs(angka));
  const huruf = [
    '',
    'Satu',
    'Dua',
    'Tiga',
    'Empat',
    'Lima',
    'Enam',
    'Tujuh',
    'Delapan',
    'Sembilan',
    'Sepuluh',
    'Sebelas',
  ];
  let hasil = '';
  if (angka < 12) hasil = huruf[angka];
  else if (angka < 20) hasil = terbilang(angka - 10) + ' Belas';
  else if (angka < 100)
    hasil = terbilang(Math.floor(angka / 10)) + ' Puluh ' + terbilang(angka % 10);
  else if (angka < 200) hasil = 'Seratus ' + terbilang(angka - 100);
  else if (angka < 1000)
    hasil = terbilang(Math.floor(angka / 100)) + ' Ratus ' + terbilang(angka % 100);
  else if (angka < 2000) hasil = 'Seribu ' + terbilang(angka - 1000);
  else if (angka < 1000000)
    hasil = terbilang(Math.floor(angka / 1000)) + ' Ribu ' + terbilang(angka % 1000);
  else if (angka < 1000000000)
    hasil = terbilang(Math.floor(angka / 1000000)) + ' Juta ' + terbilang(angka % 1000000);
  else if (angka < 1000000000000)
    hasil =
      terbilang(Math.floor(angka / 1000000000)) + ' Milyar ' + terbilang(angka % 1000000000);
  return hasil.replace(/\s+/g, ' ').trim();
}

export function KasbonView({ projectId, projectData, spks, showToast }: KasbonViewProps) {
  const { can } = useRole(projectId);

  const currentMonthUpper = new Date()
    .toLocaleString('id-ID', { month: 'long' })
    .toUpperCase();
  const currentYear = new Date().getFullYear();
  const todayStr = new Date().toISOString().split('T')[0];

  const defaultForm = {
    contract_id: '',
    payment_number: `REQ-KL/PLBJ/${currentMonthUpper}/${currentYear}`,
    payment_date: todayStr,
    payment_method: 'Transfer Bank',
    amount: 0,
    description:
      '1. Pembayaran Upah Tenaga Kerja Mingguan\n2. Pembelian Material Darurat & Mobilisasi Alat Bantu',
    bank_account: '',
  };

  const [form, setForm] = useState(defaultForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [saving, setSaving] = useState(false);
  const [printingId, setPrintingId] = useState<string | null>(null);

  const [showSigSettings, setShowSigSettings] = useState(false);
  const [signatures, setSignatures] = useState<SignatureItem[]>([
    { title: 'Pemohon (Mandor)', name: 'MANDOR LAPANGAN' },
    { title: 'Diperiksa (Site Engineer)', name: 'SAIFUDDIN FAMI' },
    { title: 'Disetujui (Project Manager)', name: 'MEI SUNARKO' },
    { title: 'Keuangan / Kasir', name: 'ADMIN KEUANGAN' },
  ]);

  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadHistory = async () => {
    if (!projectId) return;
    setLoadingHistory(true);
    try {
      const data = await getAllKasbonHistory(projectId);
      setHistory(data || []);
    } catch (err: any) {
      showToast(err.message || 'Gagal memuat riwayat kasbon', 'error');
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [projectId]);

  const handleSelectSPK = (contractId: string) => {
    const selected = spks.find((s) => s.id === contractId);
    let bankInfo = '';
    if (selected?.bank_name || selected?.bank_account) {
      bankInfo = `${selected.bank_name || ''} - ${selected.bank_account || ''} a.n. ${
        selected.contact_person || selected.subcontractor_name || ''
      }`;
    }

    setForm((prev) => ({
      ...prev,
      contract_id: contractId,
      bank_account: bankInfo || prev.bank_account,
    }));

    const signerName = selected?.contact_person || selected?.subcontractor_name;
    if (signerName) {
      setSignatures((prev) => {
        const updated = [...prev];
        updated[0] = { ...updated[0], name: signerName.toUpperCase() };
        return updated;
      });
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setForm(defaultForm);
  };

  const handleEdit = (item: any) => {
    if ((item.status || '').toLowerCase() === 'paid') {
      showToast('Kasbon yang sudah dibayar (Paid) tidak dapat diedit', 'error');
      return;
    }

    const sub = item.subcontractor_contracts?.subcontractors;
    const bankInfo = sub?.bank_name
      ? `${sub.bank_name} - ${sub.bank_account || ''} a.n. ${
          sub.contact_person || sub.company_name || ''
        }`
      : '';

    setEditingId(item.id);
    if (Array.isArray(item.signatures) && item.signatures.length > 0) {
      setSignatures(item.signatures);
    }

    setForm({
      contract_id: item.contract_id || '',
      payment_number: item.payment_number || '',
      payment_date: item.payment_date ? item.payment_date.split('T')[0] : todayStr,
      payment_method: item.payment_method || 'Transfer Bank',
      amount: Number(item.amount || 0),
      description: item.description || '',
      bank_account: bankInfo,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.contract_id) {
      showToast('Silakan pilih Mandor / SPK terlebih dahulu', 'error');
      return;
    }
    if (!form.amount || form.amount <= 0) {
      showToast('Jumlah nominal kasbon harus lebih dari Rp 0', 'error');
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await updateKasbonRequest(editingId, {
          contract_id: form.contract_id,
          payment_number: form.payment_number.trim(),
          payment_date: form.payment_date,
          amount: Number(form.amount),
          description: form.description,
          signatures,
        });
        showToast('Pengajuan kasbon berhasil diperbarui', 'success');
      } else {
        await createKasbonRequest({
          project_id: projectId,
          contract_id: form.contract_id,
          payment_number: form.payment_number.trim(),
          payment_date: form.payment_date,
          amount: Number(form.amount),
          description: form.description,
          payment_method: form.payment_method,
          bank_account: form.bank_account,
          signatures,
        });
        showToast('Pengajuan kasbon berhasil disimpan ke antrean pembayaran', 'success');
      }

      resetForm();
      await loadHistory();
    } catch (err: any) {
      showToast(err.message || 'Gagal menyimpan pengajuan kasbon', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await softDeleteSubconPayment(
        deleteTarget.id,
        'Dihapus dari riwayat pengajuan kasbon'
      );

      setHistory((prev) => prev.filter((row) => row.id !== deleteTarget.id));
      if (editingId === deleteTarget.id) resetForm();

      showToast('Riwayat kasbon berhasil dihapus', 'success');
      setDeleteTarget(null);
      await loadHistory();
    } catch (err: any) {
      showToast(err.message || 'Gagal menghapus riwayat kasbon', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handlePrintPDF = async (record?: any) => {
    const targetData = record
      ? (() => {
          const sub = record.subcontractor_contracts?.subcontractors;
          const bankInfo = sub?.bank_name
            ? `${sub.bank_name} - ${sub.bank_account || ''} a.n. ${
                sub.contact_person || sub.company_name || ''
              }`
            : '-';
          return {
            payment_number: record.payment_number,
            payment_date: record.payment_date,
            payment_method: record.payment_method || 'Transfer Bank',
            amount: Number(record.amount || 0),
            description: record.description || '-',
            bank_account: bankInfo,
            spk_number: record.subcontractor_contracts?.spk_number || '-',
            work_description: record.subcontractor_contracts?.work_description || '-',
            mandor_name: sub?.contact_person || sub?.company_name || '-',
            signatures:
              Array.isArray(record.signatures) && record.signatures.length > 0
                ? record.signatures
                : signatures,
          };
        })()
      : (() => {
          const selectedSpk = spks.find((s) => s.id === form.contract_id);
          return {
            payment_number: form.payment_number,
            payment_date: form.payment_date,
            payment_method: form.payment_method,
            amount: Number(form.amount || 0),
            description: form.description || '-',
            bank_account: form.bank_account || '-',
            spk_number: selectedSpk?.spk_number || '-',
            work_description: selectedSpk?.work_description || '-',
            mandor_name:
              selectedSpk?.contact_person || selectedSpk?.subcontractor_name || '-',
            signatures,
          };
        })();

    if (!targetData.amount || targetData.amount <= 0) {
      showToast('Isi nominal kasbon terlebih dahulu sebelum mencetak PDF', 'error');
      return;
    }

    setPrintingId(record?.id || 'FORM');
    try {
      const formattedAmount = new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
      }).format(targetData.amount);

      const formattedDate = targetData.payment_date
        ? new Date(targetData.payment_date).toLocaleDateString('id-ID', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
          })
        : '-';

      const descHtml = (targetData.description || '-')
        .split('\n')
        .map((line: string) => `<div>${line}</div>`)
        .join('');

      const sigCells = targetData.signatures
        .map(
          (sig: SignatureItem) => `
          <td style="width: ${
            100 / targetData.signatures.length
          }%; text-align: center; vertical-align: bottom; padding: 0 6px;">
            <div style="font-size: 8.5pt; color: #334155; margin-bottom: 52px;">${sig.title}</div>
            <div style="font-weight: bold; text-decoration: underline; font-size: 9pt;">${sig.name}</div>
          </td>
        `
        )
        .join('');

      const fullHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <style>
              @page { size: A4 portrait; margin: 12mm 15mm; }
              body {
                margin: 0;
                padding: 0;
                font-family: Arial, Helvetica, sans-serif;
                font-size: 9.5pt;
                color: #000;
                background: #fff;
                -webkit-print-color-adjust: exact;
              }
              table { width: 100%; border-collapse: collapse; }
              .kop-table { border-bottom: 3px double #000; margin-bottom: 14px; }
              .kop-table td { padding-bottom: 8px; text-align: center; }
              .title-box { text-align: center; margin-bottom: 14px; }
              .info-table td { padding: 5px 7px; vertical-align: top; border: 1px solid #cbd5e1; }
              .label-cell { width: 28%; background-color: #f8fafc; font-weight: bold; }
              .amount-box { border: 1.5px solid #0f766e; background-color: #f0fdfa; margin: 12px 0; }
              .amount-box td { padding: 10px 12px; }
              .sig-wrapper { margin-top: 30px; page-break-inside: avoid; }
            </style>
          </head>
          <body>
            <table class="kop-table">
              <tr>
                <td>
                  <div style="font-size: 13pt; font-weight: bold; text-transform: uppercase;">
                    ${projectData?.company_name || 'PT BANGUN KONSTRUKSI PERSADA'}
                  </div>
                  <div style="font-size: 8.5pt; color: #334155;">
                    ${projectData?.contractor_address || 'GENERAL CONTRACTOR & SUPPLIER'}
                  </div>
                </td>
              </tr>
            </table>

            <div class="title-box">
              <div style="font-size: 12pt; font-weight: bold; text-decoration: underline;">
                FORMULIR PENGAJUAN KASBON MANDOR / SUBKONTRAKTOR
              </div>
              <div style="font-size: 9.5pt; font-weight: bold; margin-top: 3px;">
                NO. FORM: ${targetData.payment_number}
              </div>
            </div>

            <table class="info-table">
              <tr>
                <td class="label-cell">Nama Proyek</td>
                <td>${projectData?.name || '-'}</td>
              </tr>
              <tr>
                <td class="label-cell">Tanggal Pengajuan</td>
                <td>${formattedDate}</td>
              </tr>
              <tr>
                <td class="label-cell">Nomor SPK</td>
                <td>${targetData.spk_number}</td>
              </tr>
              <tr>
                <td class="label-cell">Nama Mandor / Vendor</td>
                <td><strong>${targetData.mandor_name}</strong></td>
              </tr>
              <tr>
                <td class="label-cell">Uraian Pekerjaan</td>
                <td>${targetData.work_description}</td>
              </tr>
              <tr>
                <td class="label-cell">Metode Pembayaran</td>
                <td>${targetData.payment_method}</td>
              </tr>
              <tr>
                <td class="label-cell">Detail Rekening Penerima</td>
                <td>${targetData.bank_account || '-'}</td>
              </tr>
              <tr>
                <td class="label-cell">Tujuan Penggunaan Dana</td>
                <td>${descHtml}</td>
              </tr>
            </table>

            <table class="amount-box">
              <tr>
                <td style="width: 35%; font-weight: bold; color: #0f766e;">JUMLAH PENGAJUAN KASBON</td>
                <td style="width: 65%; text-align: right; font-size: 13pt; font-weight: bold; color: #0f766e;">
                  ${formattedAmount}
                </td>
              </tr>
              <tr>
                <td colspan="2" style="border-top: 1px dashed #99f6e4; font-style: italic; font-size: 8.5pt; color: #115e59;">
                  Terbilang: ${terbilang(targetData.amount)} Rupiah
                </td>
              </tr>
            </table>

            <div style="font-size: 8.5pt; color: #475569; margin-top: 6px;">
              Catatan: Nilai kasbon ini akan diperhitungkan sebagai pemotong pembayaran termin / opname (BAPP) periode berikutnya.
            </div>

            <div class="sig-wrapper">
              <table>
                <tr>${sigCells}</tr>
              </table>
            </div>
          </body>
        </html>
      `;

      const res = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: fullHtml, format: 'A4', isLandscape: false }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Gagal generate PDF Kasbon');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `KASBON_${targetData.payment_number.replace(/\//g, '_')}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
      showToast('PDF Kasbon berhasil diunduh', 'success');
    } catch (err: any) {
      showToast(err.message || 'Gagal mencetak PDF', 'error');
    } finally {
      setPrintingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const s = (status || 'Pending').toLowerCase();
    if (s === 'paid') {
      return (
        <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 uppercase">
          PAID
        </span>
      );
    }
    if (s === 'approved') {
      return (
        <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-blue-100 text-blue-700 border border-blue-200 uppercase">
          APPROVED
        </span>
      );
    }
    if (s === 'void') {
      return (
        <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-rose-100 text-rose-700 border border-rose-200 uppercase">
          VOID
        </span>
      );
    }
    return (
      <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-amber-100 text-amber-700 border border-amber-200 uppercase">
        PENDING
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* FORMULIR PENGAJUAN KASBON */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-4">
          <h3 className="font-extrabold text-lg text-slate-800 flex items-center gap-2">
            <Wallet className="text-emerald-600" size={20} />
            {editingId ? 'Edit Pengajuan Kasbon Mandor' : 'Formulir Pengajuan Kasbon Mandor'}
          </h3>

          <div className="flex items-center gap-2">
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg border border-slate-200 transition-colors"
              >
                <RotateCcw size={14} /> Batal Edit
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowSigSettings(!showSigSettings)}
              className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg border border-slate-200 transition-colors"
            >
              <Settings size={15} /> Pengaturan TTD
            </button>
          </div>
        </div>

        {showSigSettings && (
          <SignatureSettings signatures={signatures} onChange={setSignatures} colorTheme="teal" />
        )}

        <form onSubmit={handleSave} className="space-y-5">
          {/* Baris 1 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Pilih Mandor / SPK
              </label>
              <select
                required
                value={form.contract_id}
                onChange={(e) => handleSelectSPK(e.target.value)}
                className="w-full border border-slate-300 rounded-xl p-2.5 text-sm font-medium text-slate-800 outline-none focus:border-emerald-500 bg-white"
              >
                <option value="">-- Pilih Mandor --</option>
                {spks.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.subcontractor_name} - {s.spk_number}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                No. Form
              </label>
              <input
                type="text"
                required
                value={form.payment_number}
                onChange={(e) => setForm({ ...form, payment_number: e.target.value })}
                className="w-full border border-slate-300 rounded-xl p-2.5 text-sm font-mono font-bold text-slate-800 outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Tanggal Pengajuan
              </label>
              <input
                type="date"
                required
                value={form.payment_date}
                onChange={(e) => setForm({ ...form, payment_date: e.target.value })}
                className="w-full border border-slate-300 rounded-xl p-2.5 text-sm font-medium text-slate-800 outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Baris 2 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Metode Pembayaran
              </label>
              <select
                value={form.payment_method}
                onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
                className="w-full border border-slate-300 rounded-xl p-2.5 text-sm font-medium text-slate-800 outline-none focus:border-emerald-500 bg-white"
              >
                <option value="Transfer Bank">Transfer Bank</option>
                <option value="Tunai / Cash">Tunai / Cash</option>
                <option value="Cek / Giro">Cek / Giro</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Jumlah Nominal Kasbon (Rp)
              </label>
              <input
                type="number"
                required
                min={1}
                value={form.amount || ''}
                placeholder="0"
                onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
                className="w-full border-2 border-amber-300 bg-amber-50/60 rounded-xl p-2.5 text-base font-extrabold text-amber-800 outline-none focus:border-amber-500 tabular-nums"
              />
              <div className="mt-1.5">
                <span className="inline-block bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-md text-xs font-bold italic">
                  Terbilang: {terbilang(form.amount)} Rupiah
                </span>
              </div>
            </div>
          </div>

          {/* Baris 3 */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Tujuan Penggunaan Dana
            </label>
            <textarea
              rows={2}
              required
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full border border-slate-300 rounded-xl p-3 text-sm text-slate-800 outline-none focus:border-emerald-500"
            />
          </div>

          {/* Baris 4 */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Detail Rekening Penerima
            </label>
            <input
              type="text"
              value={form.bank_account}
              onChange={(e) => setForm({ ...form, bank_account: e.target.value })}
              placeholder="Otomatis terisi dari Master Vendor atau isi manual..."
              className="w-full border border-slate-300 rounded-xl p-2.5 text-sm text-slate-800 outline-none focus:border-emerald-500"
            />
          </div>

          {/* Tombol Aksi Form */}
          <div className="flex justify-end gap-3 pt-2">
            {can('SUBCON_CREATE') && (
              <button
                type="submit"
                disabled={saving}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 text-white px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 shadow-sm transition-colors"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {editingId ? 'Simpan Perubahan' : 'Simpan Pengajuan'}
              </button>
            )}

            <button
              type="button"
              onClick={() => handlePrintPDF()}
              disabled={printingId === 'FORM'}
              className="bg-teal-600 hover:bg-teal-700 disabled:bg-slate-400 text-white px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 shadow-sm transition-colors"
            >
              {printingId === 'FORM' ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Printer size={16} />
              )}
              Cetak PDF
            </button>
          </div>
        </form>
      </div>

      {/* TABEL RIWAYAT SELURUH PENGAJUAN KASBON PROYEK */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/70 flex justify-between items-center">
          <h4 className="font-bold text-sm text-slate-800">
            Riwayat Seluruh Pengajuan Kasbon Proyek
          </h4>
          <span className="text-xs font-bold text-slate-500">
            Total Aktif: {history.length} pengajuan
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[950px]">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="p-4 font-bold">No. Form</th>
                <th className="p-4 font-bold">Tanggal</th>
                <th className="p-4 font-bold">Mandor</th>
                <th className="p-4 font-bold">Tujuan</th>
                <th className="p-4 font-bold text-right">Nominal</th>
                <th className="p-4 font-bold text-center">Status</th>
                <th className="p-4 font-bold text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loadingHistory ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center">
                    <Loader2 className="animate-spin mx-auto text-emerald-600" size={24} />
                  </td>
                </tr>
              ) : history.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-slate-400 italic">
                    Belum ada riwayat pengajuan kasbon aktif.
                  </td>
                </tr>
              ) : (
                history.map((item) => {
                  const mandorName =
                    item.subcontractor_contracts?.subcontractors?.contact_person ||
                    item.subcontractor_contracts?.subcontractors?.company_name ||
                    '-';
                  const isPaid = (item.status || '').toLowerCase() === 'paid';

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-4 font-bold font-mono text-emerald-700 text-xs">
                        {item.payment_number}
                      </td>
                      <td className="p-4 text-slate-600 text-xs">
                        {item.payment_date
                          ? new Date(item.payment_date).toLocaleDateString('id-ID')
                          : '-'}
                      </td>
                      <td className="p-4 font-bold text-slate-800 uppercase text-xs">
                        {mandorName}
                      </td>
                      <td
                        className="p-4 text-slate-600 text-xs max-w-[300px] truncate"
                        title={item.description}
                      >
                        {item.description || '-'}
                      </td>
                      <td className="p-4 text-right font-bold text-slate-800 tabular-nums">
                        <MoneyText value={item.amount} />
                      </td>
                      <td className="p-4 text-center">{getStatusBadge(item.status)}</td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handlePrintPDF(item)}
                            disabled={printingId === item.id}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors"
                          >
                            {printingId === item.id ? '...' : 'Cetak'}
                          </button>

                          {can('SUBCON_CREATE') && !isPaid && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleEdit(item)}
                                className="p-1.5 rounded-lg text-amber-600 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-colors"
                                title="Edit Pengajuan Kasbon"
                              >
                                <Pencil size={14} />
                              </button>

                              <button
                                type="button"
                                onClick={() => setDeleteTarget(item)}
                                className="p-1.5 rounded-lg text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors"
                                title="Hapus Riwayat Kasbon"
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CUSTOM MODAL KONFIRMASI HAPUS (Tanpa window.confirm) */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h4 className="font-bold text-slate-800 flex items-center gap-2">
                <AlertTriangle size={18} className="text-rose-600" />
                Hapus Riwayat Kasbon
              </h4>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 text-sm text-slate-600 space-y-2">
              <p>
                Apakah Anda yakin ingin menghapus pengajuan kasbon{' '}
                <strong className="font-mono text-slate-900">
                  {deleteTarget.payment_number}
                </strong>
                ?
              </p>
              <p className="text-xs text-slate-500">
                Data akan dihapus dari daftar aktif dan antrean pembayaran (Soft Delete)
                namun tetap tersimpan di log audit database.
              </p>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl flex items-center gap-1.5 shadow-sm transition-colors"
              >
                {isDeleting ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Trash2 size={14} />
                )}
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}