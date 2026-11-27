'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  GitBranch,
  Plus,
  Edit3,
  Trash2,
  ShieldCheck,
  Loader2,
  SlidersHorizontal,
  CheckCircle2,
  ArrowRight,
  X,
  Lock,
} from 'lucide-react';
import { useProject } from '@/context/ProjectContext';
import { useRole } from '@/lib/hooks/useRole';
import {
  listApprovalRules,
  upsertApprovalRule,
  deleteApprovalRule,
} from '@/lib/services/approval-rules.service';
import {
  resolveApprovalMatrix,
  type ApprovalDocumentType,
  type ApprovalRuleRecord,
} from '@/lib/utils/budget-control';
import { ConfirmModal } from '@/components/ui/ConfirmModal';

const DOC_TYPES: ApprovalDocumentType[] = ['CASH_OUT', 'PO', 'PR', 'KASBON', 'SPK'];
const COST_CATEGORIES = ['ALL', 'Material', 'Subkon', 'Upah', 'Alat', 'Operasional', 'Lainnya'];
const APPROVER_OPTIONS = [
  'Project Manager',
  'Finance Manager',
  'Central Procurement',
  'Project Director',
  'Owner',
];

const formatRp = (val: number | null | undefined) => {
  if (val === null || val === undefined) return 'Tak Terbatas (∞)';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(val);
};

export default function ApprovalMatrixPage() {
  const { activeProjectId } = useProject();
  const { can, globalRole, loading: roleLoading } = useRole(activeProjectId || undefined);
  const canManageMatrix = can('APPROVE_FINANCE') || ['owner', 'super admin'].includes((globalRole || '').toLowerCase());

  const [rules, setRules] = useState<ApprovalRuleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDoc, setFilterDoc] = useState<string>('ALL');

  const [simDoc, setSimDoc] = useState<ApprovalDocumentType>('CASH_OUT');
  const [simCat, setSimCat] = useState<string>('Material');
  const [simAmount, setSimAmount] = useState<string>('25000000');

  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formScope, setFormScope] = useState<'GLOBAL' | 'PROJECT'>('GLOBAL');
  const [ruleName, setRuleName] = useState('');
  const [docType, setDocType] = useState<ApprovalDocumentType>('CASH_OUT');
  const [costCategory, setCostCategory] = useState('ALL');
  const [minAmount, setMinAmount] = useState('0');
  const [maxAmount, setMaxAmount] = useState('');
  const [approverRoles, setApproverRoles] = useState<string[]>(['Project Manager']);
  const [requireMfa, setRequireMfa] = useState(true);
  const [isActive, setIsActive] = useState(true);
  const [priority, setPriority] = useState('10');

  const [deleteTarget, setDeleteTarget] = useState<ApprovalRuleRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const emitToast = (type: 'success' | 'error' | 'info', message: string) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type, message } }));
    }
  };

  const fetchRules = async () => {
    setLoading(true);
    try {
      const data = await listApprovalRules(activeProjectId);
      setRules(data);
    } catch (err: any) {
      emitToast('error', err?.message || 'Gagal memuat matriks approval.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
  }, [activeProjectId]);

  const simulation = useMemo(() => {
    return resolveApprovalMatrix(rules, {
      documentType: simDoc,
      costCategory: simCat,
      amount: Number(simAmount) || 0,
      projectId: activeProjectId || null,
    });
  }, [rules, simDoc, simCat, simAmount, activeProjectId]);

  const filteredRules = useMemo(() => {
    if (filterDoc === 'ALL') return rules;
    return rules.filter((r) => r.document_type === filterDoc);
  }, [rules, filterDoc]);

  const openCreateModal = () => {
    setEditingId(null);
    setFormScope('GLOBAL');
    setRuleName('');
    setDocType('CASH_OUT');
    setCostCategory('ALL');
    setMinAmount('0');
    setMaxAmount('');
    setApproverRoles(['Project Manager']);
    setRequireMfa(true);
    setIsActive(true);
    setPriority('10');
    setModalOpen(true);
  };

  const openEditModal = (rule: ApprovalRuleRecord) => {
    setEditingId(rule.id || null);
    setFormScope(rule.project_id ? 'PROJECT' : 'GLOBAL');
    setRuleName(rule.rule_name);
    setDocType(rule.document_type);
    setCostCategory(rule.cost_category || 'ALL');
    setMinAmount(String(rule.min_amount ?? 0));
    setMaxAmount(rule.max_amount === null || rule.max_amount === undefined ? '' : String(rule.max_amount));
    setApproverRoles(rule.approver_roles?.length ? [...rule.approver_roles] : ['Project Manager']);
    setRequireMfa(rule.require_mfa !== false);
    setIsActive(rule.is_active !== false);
    setPriority(String(rule.priority ?? 100));
    setModalOpen(true);
  };

  const toggleRoleInChain = (roleName: string) => {
    if (approverRoles.includes(roleName)) {
      if (approverRoles.length === 1) return;
      setApproverRoles(approverRoles.filter((r) => r !== roleName));
    } else {
      setApproverRoles([...approverRoles, roleName]);
    }
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleName.trim()) return emitToast('error', 'Nama aturan wajib diisi.');
    if (approverRoles.length === 0) return emitToast('error', 'Pilih minimal 1 peran approver.');

    const minVal = Number(minAmount) || 0;
    const maxVal = maxAmount.trim() === '' ? null : Number(maxAmount);
    if (maxVal !== null && maxVal < minVal) {
      return emitToast('error', 'Nominal maksimum tidak boleh lebih kecil dari nominal minimum.');
    }

    setSaving(true);
    try {
      await upsertApprovalRule(
        {
          id: editingId || undefined,
          project_id: formScope === 'PROJECT' ? activeProjectId : null,
          rule_name: ruleName,
          document_type: docType,
          cost_category: costCategory,
          min_amount: minVal,
          max_amount: maxVal,
          approver_roles: approverRoles,
          require_mfa: requireMfa,
          is_active: isActive,
          priority: Number(priority) || 100,
        },
        activeProjectId
      );
      emitToast('success', editingId ? 'Aturan approval berhasil diperbarui.' : 'Aturan approval baru ditambahkan.');
      setModalOpen(false);
      await fetchRules();
    } catch (err: any) {
      emitToast('error', err?.message || 'Gagal menyimpan aturan approval.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget?.id) return;
    setDeleting(true);
    try {
      await deleteApprovalRule(deleteTarget.id, activeProjectId);
      emitToast('info', 'Aturan approval telah dihapus.');
      setDeleteTarget(null);
      await fetchRules();
    } catch (err: any) {
      emitToast('error', err?.message || 'Gagal menghapus aturan.');
    } finally {
      setDeleting(false);
    }
  };

  if (loading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-indigo-600" size={36} />
      </div>
    );
  }

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <GitBranch className="text-indigo-600" /> Dynamic Approval Matrix
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Konfigurasi aturan persetujuan berjenjang di database (<code>approval_rules</code>) berdasarkan jenis dokumen, kategori biaya, dan rentang nominal.
            </p>
          </div>
          {canManageMatrix ? (
            <button
              onClick={openCreateModal}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 shadow-sm shrink-0"
            >
              <Plus size={16} /> Tambah Aturan
            </button>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
              <Lock size={14} /> Mode Baca Saja
            </span>
          )}
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
            <SlidersHorizontal size={16} className="text-indigo-600" /> Simulator Uji Matriks Persetujuan
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Jenis Dokumen</label>
              <select
                value={simDoc}
                onChange={(e) => setSimDoc(e.target.value as ApprovalDocumentType)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
              >
                {DOC_TYPES.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Kategori Biaya</label>
              <select
                value={simCat}
                onChange={(e) => setSimCat(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
              >
                {COST_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Nominal Pengajuan (Rp)</label>
              <input
                type="number"
                min={0}
                value={simAmount}
                onChange={(e) => setSimAmount(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono font-bold"
              />
            </div>
            <div className="bg-indigo-50/80 border border-indigo-200 rounded-xl p-3">
              <p className="text-[10px] font-bold uppercase text-indigo-600 mb-1">
                Alur Persetujuan ({simulation.totalSteps} Tahap)
              </p>
              <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold text-slate-800">
                {simulation.approverRoles.map((r, i) => (
                  <span key={`${r}-${i}`} className="inline-flex items-center gap-1">
                    <span className="bg-white border border-indigo-200 px-2 py-0.5 rounded-md text-indigo-700">
                      {i + 1}. {r}
                    </span>
                    {i < simulation.approverRoles.length - 1 && (
                      <ArrowRight size={12} className="text-indigo-400" />
                    )}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70">
            <div className="flex flex-wrap gap-2">
              {['ALL', ...DOC_TYPES].map((doc) => (
                <button
                  key={doc}
                  onClick={() => setFilterDoc(doc)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    filterDoc === doc
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {doc === 'ALL' ? 'Semua Dokumen' : doc}
                </button>
              ))}
            </div>
            <span className="text-xs text-slate-500 font-medium">
              Total {filteredRules.length} aturan aktif/tersimpan
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-100 text-slate-600 text-xs uppercase border-b">
                <tr>
                  <th className="p-4 font-bold">Nama Aturan &amp; Cakupan</th>
                  <th className="p-4 font-bold">Dokumen</th>
                  <th className="p-4 font-bold">Kategori</th>
                  <th className="p-4 font-bold">Rentang Nominal</th>
                  <th className="p-4 font-bold">Jenjang Approver</th>
                  <th className="p-4 font-bold text-center">2FA</th>
                  <th className="p-4 font-bold text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRules.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400 italic">
                      Belum ada aturan approval. Pastikan migrasi SQL 04 telah dijalankan atau tambahkan aturan baru.
                    </td>
                  </tr>
                ) : (
                  filteredRules.map((rule) => (
                    <tr key={rule.id} className={`hover:bg-slate-50 ${!rule.is_active ? 'opacity-50' : ''}`}>
                      <td className="p-4">
                        <div className="font-bold text-slate-800">{rule.rule_name}</div>
                        <span
                          className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            rule.project_id
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {rule.project_id ? 'Khusus Proyek Ini' : 'Global Perusahaan'}
                        </span>
                      </td>
                      <td className="p-4 font-mono text-xs font-bold text-indigo-700">{rule.document_type}</td>
                      <td className="p-4 text-xs font-semibold text-slate-700">{rule.cost_category}</td>
                      <td className="p-4 text-xs font-mono text-slate-700 whitespace-nowrap">
                        <div>{formatRp(rule.min_amount)}</div>
                        <div className="text-slate-400">s/d {formatRp(rule.max_amount)}</div>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-wrap items-center gap-1">
                          {rule.approver_roles.map((r, idx) => (
                            <span key={`${rule.id}-${r}-${idx}`} className="inline-flex items-center gap-1">
                              <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
                                {idx + 1}. {r}
                              </span>
                              {idx < rule.approver_roles.length - 1 && (
                                <ArrowRight size={12} className="text-slate-400" />
                              )}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        {rule.require_mfa ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700">
                            <ShieldCheck size={11} /> Wajib
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">Opsional</span>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        {canManageMatrix ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => openEditModal(rule)}
                              className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg"
                              title="Edit Aturan"
                            >
                              <Edit3 size={16} />
                            </button>
                            <button
                              onClick={() => setDeleteTarget(rule)}
                              className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg"
                              title="Hapus Aturan"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden">
            <div className="px-6 py-4 border-b bg-slate-50 flex justify-between items-center">
              <h2 className="font-bold text-slate-800 flex items-center gap-2">
                <GitBranch className="text-indigo-600" size={18} />
                {editingId ? 'Edit Aturan Approval' : 'Tambah Aturan Approval'}
              </h2>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveRule} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Nama Aturan *</label>
                  <input
                    required
                    type="text"
                    value={ruleName}
                    onChange={(e) => setRuleName(e.target.value)}
                    placeholder="cth: PO Material > 50 Juta"
                    className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Cakupan Aturan</label>
                  <select
                    value={formScope}
                    onChange={(e) => setFormScope(e.target.value as 'GLOBAL' | 'PROJECT')}
                    className="w-full border border-slate-300 rounded-lg p-2 text-sm bg-white"
                  >
                    <option value="GLOBAL">Global Seluruh Proyek</option>
                    {activeProjectId && <option value="PROJECT">Override Khusus Proyek Aktif</option>}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Jenis Dokumen</label>
                  <select
                    value={docType}
                    onChange={(e) => setDocType(e.target.value as ApprovalDocumentType)}
                    className="w-full border border-slate-300 rounded-lg p-2 text-sm bg-white"
                  >
                    {DOC_TYPES.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Kategori Biaya</label>
                  <select
                    value={costCategory}
                    onChange={(e) => setCostCategory(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2 text-sm bg-white"
                  >
                    {COST_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Prioritas</label>
                  <input
                    type="number"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2 text-sm font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Nominal Minimum (Rp)</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={minAmount}
                    onChange={(e) => setMinAmount(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    Nominal Maksimum (Kosongkan = ∞)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={maxAmount}
                    onChange={(e) => setMaxAmount(e.target.value)}
                    placeholder="Tak terbatas"
                    className="w-full border border-slate-300 rounded-lg p-2 text-sm font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2">
                  Jenjang Approver (Klik berurutan dari Tahap 1 ke Tahap Akhir)
                </label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {APPROVER_OPTIONS.map((opt) => {
                    const selected = approverRoles.includes(opt);
                    return (
                      <button
                        type="button"
                        key={opt}
                        onClick={() => toggleRoleInChain(opt)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                          selected
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        {selected ? `✓ ${opt}` : `+ ${opt}`}
                      </button>
                    );
                  })}
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                  <span className="font-bold text-slate-500">Urutan Aktif: </span>
                  {approverRoles.map((r, i) => `${i + 1}. ${r}`).join(' → ')}
                </div>
              </div>

              <div className="flex items-center gap-6 pt-1">
                <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={requireMfa}
                    onChange={(e) => setRequireMfa(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  Wajib Verifikasi 2FA TOTP
                </label>
                <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  Aturan Aktif
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-sm font-bold text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg flex items-center gap-2 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
                  Simpan Aturan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        title="Hapus Aturan Approval?"
        message={`Anda yakin ingin menghapus aturan "${deleteTarget?.rule_name || ''}" dari matriks persetujuan?`}
        isLoading={deleting}
        onConfirm={handleDeleteConfirm}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
