'use client';

import { useEffect, useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Award,
  Ban,
  CheckCircle2,
  Plus,
  Search,
  Loader2,
  Edit3,
  Star,
  X,
  Building2,
} from 'lucide-react';
import { useProject } from '@/context/ProjectContext';
import { useRole } from '@/lib/hooks/useRole';
import {
  listCentralizedVendors,
  toggleVendorBlacklist,
  updateVendorComplianceDocs,
  listVendorScorecards,
  createVendorScorecard,
} from '@/lib/services/vendor-compliance.service';
import { createVendor } from '@/lib/services/vendor-service';
import { ConfirmModal } from '@/components/ui/ConfirmModal';

export default function VendorCompliancePage() {
  const { activeProjectId } = useProject();
  const { can, globalRole } = useRole(activeProjectId || undefined);
  const canManageCompliance =
    can('APPROVE_PROCUREMENT') ||
    can('APPROVE_FINANCE') ||
    ['owner', 'super admin', 'central procurement'].includes((globalRole || '').toLowerCase());

  const [tab, setTab] = useState<'master' | 'scorecard'>('master');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [vendors, setVendors] = useState<any[]>([]);
  const [scorecards, setScorecards] = useState<any[]>([]);

  // Modal Blacklist / Unblacklist
  const [blacklistTarget, setBlacklistTarget] = useState<any | null>(null);
  const [blacklistReason, setBlacklistReason] = useState('');
  const [processingBlacklist, setProcessingBlacklist] = useState(false);

  // Modal Edit Kepatuhan / Tambah Vendor Terpusat
  const [docModal, setDocModal] = useState(false);
  const [editingVendor, setEditingVendor] = useState<any | null>(null);
  const [vName, setVName] = useState('');
  const [vCode, setVCode] = useState('');
  const [vPhone, setVPhone] = useState('');
  const [vNpwp, setVNpwp] = useState('');
  const [vPkpStatus, setVPkpStatus] = useState<'PKP' | 'NON_PKP'>('NON_PKP');
  const [vPkpExpiry, setVPkpExpiry] = useState('');
  const [vLegalExpiry, setVLegalExpiry] = useState('');
  const [savingDoc, setSavingDoc] = useState(false);

  // Modal Nilai Scorecard
  const [scoreModal, setScoreModal] = useState(false);
  const [scVendorId, setScVendorId] = useState('');
  const [scDelivery, setScDelivery] = useState('4');
  const [scQuality, setScQuality] = useState('4');
  const [scSafety, setScSafety] = useState('4');
  const [scNotes, setScNotes] = useState('');
  const [savingScore, setSavingScore] = useState(false);

  const emitToast = (type: 'success' | 'error' | 'info', message: string) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type, message } }));
    }
  };

  const loadAll = async () => {
    setLoading(true);
    try {
      const [vList, scList] = await Promise.all([
        listCentralizedVendors(activeProjectId),
        listVendorScorecards(),
      ]);
      setVendors(vList || []);
      setScorecards(scList || []);
    } catch (err: any) {
      emitToast('error', err?.message || 'Gagal memuat data kepatuhan vendor.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, [activeProjectId]);

  const openEditDocs = (vendor?: any) => {
    if (vendor) {
      setEditingVendor(vendor);
      setVName(vendor.name || '');
      setVCode(vendor.vendor_code || '');
      setVPhone(vendor.phone || '');
      setVNpwp(vendor.npwp_number || '');
      setVPkpStatus((vendor.pkp_status as any) === 'PKP' ? 'PKP' : 'NON_PKP');
      setVPkpExpiry(vendor.pkp_expiry_date || '');
      setVLegalExpiry(vendor.legal_expiry_date || '');
    } else {
      setEditingVendor(null);
      setVName('');
      setVCode(`VND-${Math.floor(1000 + Math.random() * 9000)}`);
      setVPhone('');
      setVNpwp('');
      setVPkpStatus('PKP');
      setVPkpExpiry('');
      setVLegalExpiry('');
    }
    setDocModal(true);
  };

  const handleSaveVendorDocs = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingDoc(true);
    try {
      if (editingVendor) {
        await updateVendorComplianceDocs({
          vendorId: editingVendor.id,
          projectId: activeProjectId,
          vendor_code: vCode || null,
          npwp_number: vNpwp || null,
          pkp_status: vPkpStatus,
          pkp_expiry_date: vPkpExpiry || null,
          legal_expiry_date: vLegalExpiry || null,
          is_centralized: true,
        });
        emitToast('success', `Dokumen kepatuhan ${editingVendor.name} diperbarui.`);
      } else {
        await createVendor({
          project_id: activeProjectId || (null as any),
          name: vName.trim(),
          phone: vPhone || null,
          is_active: true,
          is_centralized: true,
          vendor_code: vCode || null,
          npwp_number: vNpwp || null,
          pkp_status: vPkpStatus,
          pkp_expiry_date: vPkpExpiry || null,
          legal_expiry_date: vLegalExpiry || null,
        } as any);
        emitToast('success', `Vendor terpusat "${vName}" berhasil ditambahkan.`);
      }
      setDocModal(false);
      loadAll();
    } catch (err: any) {
      emitToast('error', err?.message || 'Gagal menyimpan data vendor.');
    } finally {
      setSavingDoc(false);
    }
  };

  const handleConfirmBlacklist = async () => {
    if (!blacklistTarget) return;
    setProcessingBlacklist(true);
    try {
      const nextState = !blacklistTarget.is_blacklisted;
      await toggleVendorBlacklist({
        vendorId: blacklistTarget.id,
        projectId: activeProjectId,
        blacklist: nextState,
        reason: blacklistReason,
      });
      emitToast(
        nextState ? 'info' : 'success',
        nextState
          ? `Vendor "${blacklistTarget.name}" di-BLACKLIST. Seluruh PM otomatis diblokir membuat PO.`
          : `Blacklist vendor "${blacklistTarget.name}" dicabut.`
      );
      setBlacklistTarget(null);
      setBlacklistReason('');
      loadAll();
    } catch (err: any) {
      emitToast('error', err?.message || 'Gagal mengubah status Blacklist.');
    } finally {
      setProcessingBlacklist(false);
    }
  };

  const handleSaveScorecard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProjectId) return emitToast('error', 'Pilih proyek aktif terlebih dahulu untuk memberi evaluasi.');
    const v = vendors.find((x) => x.id === scVendorId);
    if (!v) return emitToast('error', 'Pilih vendor yang dievaluasi.');

    setSavingScore(true);
    try {
      await createVendorScorecard({
        project_id: activeProjectId,
        entity_type: 'VENDOR',
        vendor_id: v.id,
        vendor_name: v.name,
        delivery_score: Number(scDelivery),
        quality_score: Number(scQuality),
        safety_score: Number(scSafety),
        notes: scNotes,
      });
      emitToast('success', `Scorecard evaluasi untuk "${v.name}" berhasil disimpan!`);
      setScoreModal(false);
      setScVendorId('');
      setScNotes('');
      loadAll();
    } catch (err: any) {
      emitToast('error', err?.message || 'Gagal menyimpan scorecard.');
    } finally {
      setSavingScore(false);
    }
  };

  const filteredVendors = vendors.filter(
    (v) =>
      (v.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (v.npwp_number || '').toLowerCase().includes(search.toLowerCase()) ||
      (v.vendor_code || '').toLowerCase().includes(search.toLowerCase())
  );

  const blacklistedCount = vendors.filter((v) => v.is_blacklisted).length;
  const expiredDocCount = vendors.filter(
    (v) => !v.is_blacklisted && v.compliance && !v.compliance.allowed
  ).length;

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Building2 className="text-indigo-600" /> Centralized Vendor Compliance &amp; Scorecard
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Database vendor terpusat lintas proyek. Vendor berstatus <b>Blacklist</b> atau <b>PKP/Legal Kedaluwarsa</b> otomatis terblokir dari pembuatan PO/SPK di seluruh akun PM.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canManageCompliance && (
              <button
                onClick={() => openEditDocs()}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-sm"
              >
                <Plus className="w-4 h-4" /> Tambah Vendor Terpusat
              </button>
            )}
            <button
              onClick={() => setScoreModal(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-sm"
            >
              <Award className="w-4 h-4" /> Input Scorecard Evaluasi
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-[11px] font-bold uppercase text-slate-400">Total Vendor Terpusat</p>
            <p className="text-2xl font-extrabold text-slate-800 mt-1">{vendors.length}</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-rose-200 shadow-sm">
            <p className="text-[11px] font-bold uppercase text-rose-500">Vendor Di-Blacklist (Terblokir)</p>
            <p className="text-2xl font-extrabold text-rose-600 mt-1">{blacklistedCount}</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-amber-200 shadow-sm">
            <p className="text-[11px] font-bold uppercase text-amber-600">PKP / Legalitas Kedaluwarsa</p>
            <p className="text-2xl font-extrabold text-amber-600 mt-1">{expiredDocCount}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            <button
              onClick={() => setTab('master')}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 ${
                tab === 'master' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white border text-slate-600'
              }`}
            >
              <ShieldCheck className="w-4 h-4" /> 1. Master Vendor &amp; Blacklist
            </button>
            <button
              onClick={() => setTab('scorecard')}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 ${
                tab === 'scorecard' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white border text-slate-600'
              }`}
            >
              <Award className="w-4 h-4" /> 2. Riwayat Performance Scorecard ({scorecards.length})
            </button>
          </div>

          {tab === 'master' && (
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari vendor, kode, atau NPWP..."
                className="pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs w-64 bg-white"
              />
            </div>
          )}
        </div>

        {loading ? (
          <div className="bg-white p-12 rounded-2xl border text-center text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" /> Memuat data vendor...
          </div>
        ) : tab === 'master' ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-100 text-slate-600 text-xs uppercase border-b">
                <tr>
                  <th className="p-4 font-bold">Vendor &amp; Kode</th>
                  <th className="p-4 font-bold">NPWP &amp; Pajak (PKP)</th>
                  <th className="p-4 font-bold text-center">Scorecard</th>
                  <th className="p-4 font-bold text-center">Status Kepatuhan</th>
                  <th className="p-4 font-bold text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredVendors.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-400 italic">
                      Tidak ada vendor ditemukan.
                    </td>
                  </tr>
                ) : (
                  filteredVendors.map((v) => {
                    const status = v.compliance?.status || 'COMPLIANT';
                    return (
                      <tr key={v.id} className={`hover:bg-slate-50 ${v.is_blacklisted ? 'bg-rose-50/40' : ''}`}>
                        <td className="p-4">
                          <div className="font-bold text-slate-800">{v.name}</div>
                          <div className="text-[11px] font-mono text-slate-400">
                            {v.vendor_code || 'CENTRAL'} {v.phone ? `• ${v.phone}` : ''}
                          </div>
                        </td>
                        <td className="p-4 text-xs">
                          <div className="font-mono text-slate-700">NPWP: {v.npwp_number || '-'}</div>
                          <div className="text-slate-500 mt-0.5">
                            <b>{v.pkp_status || 'NON_PKP'}</b>
                            {v.pkp_expiry_date ? ` (Exp: ${v.pkp_expiry_date})` : ''}
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          {v.avg_score !== null ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold">
                              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                              {v.avg_score.toFixed(2)} (Grade {v.score_grade})
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400 italic">Belum dinilai</span>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          {status === 'COMPLIANT' ? (
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700 inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Compliant
                            </span>
                          ) : (
                            <div className="space-y-1">
                              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-700 inline-flex items-center gap-1">
                                <ShieldAlert className="w-3.5 h-3.5" /> {status}
                              </span>
                              {v.blacklist_reason && (
                                <p className="text-[10px] text-rose-600 max-w-[180px] mx-auto truncate" title={v.blacklist_reason}>
                                  {v.blacklist_reason}
                                </p>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          {canManageCompliance ? (
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => openEditDocs(v)}
                                className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg border border-indigo-200"
                                title="Edit NPWP/PKP & Legalitas"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setBlacklistTarget(v);
                                  setBlacklistReason(v.blacklist_reason || '');
                                }}
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1 border ${
                                  v.is_blacklisted
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                    : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                                }`}
                              >
                                <Ban className="w-3.5 h-3.5" />
                                {v.is_blacklisted ? 'Cabut Blacklist' : 'Blacklist'}
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">Procurement Only</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-100 text-slate-600 text-xs uppercase border-b">
                <tr>
                  <th className="p-4 font-bold">Tanggal &amp; Proyek</th>
                  <th className="p-4 font-bold">Vendor</th>
                  <th className="p-4 font-bold text-center">Waktu (35%)</th>
                  <th className="p-4 font-bold text-center">Mutu (35%)</th>
                  <th className="p-4 font-bold text-center">K3 (30%)</th>
                  <th className="p-4 font-bold text-center">Skor Akhir</th>
                  <th className="p-4 font-bold">Catatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {scorecards.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400 italic">
                      Belum ada evaluasi Performance Scorecard.
                    </td>
                  </tr>
                ) : (
                  scorecards.map((sc) => (
                    <tr key={sc.id} className="hover:bg-slate-50">
                      <td className="p-4 text-xs">
                        <div className="font-mono font-bold text-slate-700">{sc.evaluation_date}</div>
                        <div className="text-slate-500">{sc.project?.name || '-'}</div>
                      </td>
                      <td className="p-4 font-bold text-slate-800">{sc.vendor_name}</td>
                      <td className="p-4 text-center font-mono">{sc.delivery_score}/5</td>
                      <td className="p-4 text-center font-mono">{sc.quality_score}/5</td>
                      <td className="p-4 text-center font-mono">{sc.safety_score}/5</td>
                      <td className="p-4 text-center">
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {Number(sc.overall_score).toFixed(2)} • Grade {sc.grade}
                        </span>
                      </td>
                      <td className="p-4 text-xs text-slate-600 max-w-xs truncate">{sc.notes || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Tambah / Edit Kepatuhan Vendor */}
      {docModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <form onSubmit={handleSaveVendorDocs} className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-slate-800">
                {editingVendor ? `Kepatuhan Pajak & Legal: ${editingVendor.name}` : 'Tambah Vendor Terpusat Baru'}
              </h3>
              <button type="button" onClick={() => setDocModal(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            {!editingVendor && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Nama Vendor *</label>
                  <input required value={vName} onChange={(e) => setVName(e.target.value)} className="w-full border rounded-lg p-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">No. Telepon</label>
                  <input value={vPhone} onChange={(e) => setVPhone(e.target.value)} className="w-full border rounded-lg p-2 text-sm" />
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Kode Vendor Terpusat</label>
                <input value={vCode} onChange={(e) => setVCode(e.target.value)} placeholder="VND-001" className="w-full border rounded-lg p-2 text-sm font-mono" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">NPWP (15/16 Digit)</label>
                <input value={vNpwp} onChange={(e) => setVNpwp(e.target.value)} placeholder="01.234.567.8-901.000" className="w-full border rounded-lg p-2 text-sm font-mono" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Status PKP</label>
                <select value={vPkpStatus} onChange={(e) => setVPkpStatus(e.target.value as any)} className="w-full border rounded-lg p-2 text-sm bg-white">
                  <option value="PKP">PKP</option>
                  <option value="NON_PKP">NON-PKP</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Masa Berlaku PKP</label>
                <input type="date" value={vPkpExpiry} onChange={(e) => setVPkpExpiry(e.target.value)} className="w-full border rounded-lg p-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Masa Berlaku Legal/SBU</label>
                <input type="date" value={vLegalExpiry} onChange={(e) => setVLegalExpiry(e.target.value)} className="w-full border rounded-lg p-2 text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t">
              <button type="button" onClick={() => setDocModal(false)} className="px-4 py-2 border rounded-lg text-sm font-bold text-slate-600">Batal</button>
              <button type="submit" disabled={savingDoc} className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold disabled:opacity-50">
                {savingDoc ? 'Menyimpan...' : 'Simpan Kepatuhan'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Input Scorecard */}
      {scoreModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <form onSubmit={handleSaveScorecard} className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Award className="w-5 h-5 text-emerald-600" /> Evaluasi Vendor Performance Scorecard
              </h3>
              <button type="button" onClick={() => setScoreModal(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Pilih Vendor *</label>
              <select required value={scVendorId} onChange={(e) => setScVendorId(e.target.value)} className="w-full border rounded-lg p-2 text-sm bg-white">
                <option value="">-- Pilih Vendor --</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Ketepatan Waktu (1-5)</label>
                <input required type="number" min={1} max={5} step="0.5" value={scDelivery} onChange={(e) => setScDelivery(e.target.value)} className="w-full border rounded-lg p-2 text-sm font-mono font-bold text-center" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Mutu Barang (1-5)</label>
                <input required type="number" min={1} max={5} step="0.5" value={scQuality} onChange={(e) => setScQuality(e.target.value)} className="w-full border rounded-lg p-2 text-sm font-mono font-bold text-center" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Kepatuhan K3 (1-5)</label>
                <input required type="number" min={1} max={5} step="0.5" value={scSafety} onChange={(e) => setScSafety(e.target.value)} className="w-full border rounded-lg p-2 text-sm font-mono font-bold text-center" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Catatan Evaluasi Lapangan</label>
              <textarea rows={2} value={scNotes} onChange={(e) => setScNotes(e.target.value)} placeholder="cth: Pengiriman tepat waktu, surat jalan lengkap, APD sopir sesuai K3" className="w-full border rounded-lg p-2 text-sm" />
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t">
              <button type="button" onClick={() => setScoreModal(false)} className="px-4 py-2 border rounded-lg text-sm font-bold text-slate-600">Batal</button>
              <button type="submit" disabled={savingScore} className="px-5 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold disabled:opacity-50">
                {savingScore ? 'Menyimpan...' : 'Simpan Scorecard'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Blacklist dengan Alasan */}
      {blacklistTarget && !blacklistTarget.is_blacklisted ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h3 className="font-bold text-lg text-rose-700 flex items-center gap-2">
              <Ban className="w-5 h-5" /> Blacklist Vendor "{blacklistTarget.name}"?
            </h3>
            <p className="text-xs text-slate-600">
              Vendor yang di-blacklist akan <b>otomatis diblokir</b> di seluruh akun PM sehingga tidak bisa dibuatkan PO baru sampai status dicabut oleh Central Procurement.
            </p>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Alasan Blacklist *</label>
              <textarea
                rows={3}
                value={blacklistReason}
                onChange={(e) => setBlacklistReason(e.target.value)}
                placeholder="cth: Material tidak sesuai spesifikasi SNI, wanprestasi pengiriman, atau masalah legal/faktur pajak."
                className="w-full border border-rose-300 rounded-lg p-2 text-sm"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setBlacklistTarget(null)} className="px-4 py-2 border rounded-lg text-sm font-bold text-slate-600">Batal</button>
              <button
                type="button"
                disabled={processingBlacklist || !blacklistReason.trim()}
                onClick={handleConfirmBlacklist}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-bold disabled:opacity-50"
              >
                {processingBlacklist ? 'Memproses...' : 'Ya, Blacklist Vendor'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <ConfirmModal
          isOpen={Boolean(blacklistTarget && blacklistTarget.is_blacklisted)}
          title="Cabut Status Blacklist?"
          message={`Aktifkan kembali vendor "${blacklistTarget?.name || ''}" agar dapat digunakan di seluruh proyek?`}
          isLoading={processingBlacklist}
          onConfirm={handleConfirmBlacklist}
          onClose={() => setBlacklistTarget(null)}
        />
      )}
    </div>
  );
}
