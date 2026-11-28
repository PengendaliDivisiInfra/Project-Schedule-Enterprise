'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import LoadingSpinner from '../../components/LoadingSpinner';
import { saveToCache, getFromCache, invalidateCache } from '../../lib/utils/cache'; // IMPORT CACHE
import { Wallet, ArrowDownCircle, ArrowUpCircle, Plus, X, Loader2, Save, CheckCircle2, UploadCloud, AlertTriangle, ShieldCheck, Trash2, Activity, TrendingUp, TrendingDown, Banknote, FileText, Users, Info, KeyRound } from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { useRole } from '@/lib/hooks/useRole';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer 
} from 'recharts';
import CashFlowStatementView from '@/components/finances/CashFlowStatementView';
import CashFlowForecastView from '@/components/finances/CashFlowForecastView'; // <-- NEW IMPORT
import {
  getProjectBudgetSummary,
  getWbsBudget3Layer,
  submitBudgetedCashFlow,
} from '@/lib/services/budget-control.service';
import { listApprovalRules, processTieredApproval } from '@/lib/services/approval-rules.service';
import { getMfaStatus, verifyTotpCode } from '@/lib/services/mfa.service';
import { recordAuditEvent } from '@/lib/services/logs.service';
import { resolveApprovalMatrix, canRoleApproveStep } from '@/lib/utils/budget-control';
import {
  getRingFencedCashflow,
  listContractChangeOrders,
  listUnapprovedVariationWork,
} from '@/lib/services/contractor-controls.service';
import { evaluateRingFencedCashflow } from '@/lib/utils/contractor-controls';

export default function CashFlowPage() {
  const { userRole, activeProjectId } = useProject(); 
  const projectId = activeProjectId; 

  const { can, globalRole, projectRole, role } = useRole(projectId || undefined);
  const canAddTransaction = can('CREATE_PO');
  const canApprove = can('APPROVE_FINANCE');
  const canVoid = can('VOID_PAYMENT') || can('APPROVE_FINANCE');
  
  const [flows, setFlows] = useState([]);
  const [tasks, setTasks] = useState([]); 
  const [chartData, setChartData] = useState([]);
  const [projectData, setProjectData] = useState(null);
  
  // STATE UNTUK AGING (AR/AP)
  const [arData, setArData] = useState([]);
  const [apData, setApData] = useState([]);
  const [totalAr, setTotalAr] = useState(0);
  const [totalAp, setTotalAp] = useState(0);

  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedWbsBudget, setSelectedWbsBudget] = useState(null);
  const [selectedWbsRow, setSelectedWbsRow] = useState(null);
  const [budgetSummary, setBudgetSummary] = useState(null);
  const [approvalRules, setApprovalRules] = useState([]);
  const [ringFenced, setRingFenced] = useState(null);
  const [ccoList, setCcoList] = useState([]);
  const [unapprovedWork, setUnapprovedWork] = useState([]);
  
  // TABS
  const [activeTab, setActiveTab] = useState('ledger');
  const [costControlData, setCostControlData] = useState([]);

  // VOID STATE
  const [voidTarget, setVoidTarget] = useState(null);
  const [voidReason, setVoidReason] = useState('');
  const [isVoiding, setIsVoiding] = useState(false);

  // MFA 2FA Approver Challenge State (konsisten dengan /approvals)
  const [mfaStatus, setMfaStatus] = useState(null);
  const [mfaModalOpen, setMfaModalOpen] = useState(false);
  const [mfaOtp, setMfaOtp] = useState('');
  const [verifyingMfa, setVerifyingMfa] = useState(false);
  const [pendingApprovalAction, setPendingApprovalAction] = useState(null);

  const [formData, setFormData] = useState({
    type: 'OUT', category: 'Material', description: '', amount: 0, 
    transaction_date: new Date().toISOString().split('T')[0],
    payment_method: 'Transfer', vendor_or_ref: '', wbs_code: '',
    approval_status: 'Pending', overbudget_reason: '', is_variation_work: false, cco_id: ''
  });

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  const getAgingBucket = (dateString) => {
    if (!dateString) return '0-30 Hari';
    const diffTime = Math.abs(new Date() - new Date(dateString));
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 30) return '0-30 Hari';
    if (diffDays <= 60) return '31-60 Hari';
    if (diffDays <= 90) return '61-90 Hari';
    return '> 90 Hari';
  };

  const fetchData = async () => {
    if (!projectId) { setLoading(false); return; }
    
    setLoading(true);
    const cacheKey = `finances_${projectId}`;

    // 1. TAMPILKAN DARI CACHE (Agar instan saat offline)
    const cached = getFromCache(cacheKey);
    if (cached) {
      setFlows(cached.flows || []);
      setTasks(cached.tasks || []);
      setCostControlData(cached.tasks || []);
      setProjectData(cached.projectData || null);
      setArData(cached.arData || []);
      setApData(cached.apData || []);
      setTotalAr(cached.totalAr || 0);
      setTotalAp(cached.totalAp || 0);
      setChartData(cached.chartData || []);
    }

    // 2. CEK KONEKSI
    if (typeof window !== 'undefined' && !navigator.onLine) {
      setLoading(false); // Langsung hilangkan loading!
      if (!cached) {
        showToast('warning', 'Anda offline dan belum ada data cache untuk halaman ini.');
      }
      return;
    }

    // 3. FETCH ONLINE (Kode asli Anda)
    try {
      // 1. Ambil data Cash Flows
      const { data: flowData } = await supabase
        .from('cash_flows')
        .select('*')
        .eq('project_id', projectId)
        .eq('is_deleted', false)
        .order('transaction_date', { ascending: false });
      if (flowData) setFlows(flowData);

      // 2. Ambil data WBS 3-Lapisan Anggaran (Pagu RAB, Committed PO/SPK/Pending, Actual, Available)
      const [wbs3Layer, projBudgetSum, rulesList, rfData, ccosData, unappData] = await Promise.all([
        getWbsBudget3Layer(projectId),
        getProjectBudgetSummary(projectId),
        listApprovalRules(projectId).catch(() => []),
        getRingFencedCashflow(projectId).catch(() => null),
        listContractChangeOrders(projectId).catch(() => []),
        listUnapprovedVariationWork(projectId).catch(() => []),
      ]);
      const taskData = (wbs3Layer || []).map((item) => ({
        ...item,
        pagu_anggaran_rap: item.pagu_rab,
        total_pengeluaran_aktual: item.actual_cost,
        sisa_anggaran_plafon: item.available_budget,
      }));
      setTasks(taskData);
      setCostControlData(taskData);
      setBudgetSummary(projBudgetSum);
      setApprovalRules(rulesList || []);
      setRingFenced(rfData);
      setCcoList(ccosData || []);
      setUnapprovedWork(unappData || []);

      // 3. Ambil Nilai Kontrak Proyek
      const { data: projData } = await supabase
        .from('projects')
        .select('contract_value, name')
        .eq('id', projectId)
        .single();
      if (projData) setProjectData(projData);

      // 4. Ambil Data AR
      const { data: invData } = await supabase
        .from('client_invoices')
        .select('*')
        .eq('project_id', projectId)
        .neq('status', 'Paid')
        .neq('status', 'Void')
        .order('invoice_date', { ascending: true });
        
      let newArTotal = 0;
      let newArData = [];
      if (invData) {
        newArData = invData.map(inv => {
          const outstanding = Number(inv.net_payable_amount) - Number(inv.paid_amount);
          if (outstanding > 0) newArTotal += outstanding;
          return { ...inv, outstanding, aging: getAgingBucket(inv.invoice_date) };
        }).filter(item => item.outstanding > 0); 
      }
      setArData(newArData);
      setTotalAr(newArTotal);

      // 5. Ambil Data AP
      const { data: subconPayData } = await supabase
        .from('subcontractor_payments')
        .select(`*, subcontractor_contracts ( subcontractors ( company_name ) )`)
        .eq('project_id', projectId)
        .eq('is_deleted', false)
        .is('voided_at', null)
        .in('status', ['Pending', 'Approved'])
        .order('payment_date', { ascending: true });

      let newApTotal = 0;
      let newApData = [];
      if (subconPayData) {
        newApData = subconPayData.map(pay => {
          newApTotal += Number(pay.amount);
          return {
            ...pay,
            vendor_name: pay.subcontractor_contracts?.subcontractors?.company_name || 'Vendor Subkon',
            aging: getAgingBucket(pay.payment_date)
          };
        });
      }
      setApData(newApData);
      setTotalAp(newApTotal);

      // 6. Ambil data Chart
      let newChartData = [];
      const { data: viewData } = await supabase.from('v_dashboard_cashflow').select('*').eq('project_id', projectId);
      if (viewData) {
        const monthlyData = {};
        viewData.forEach(item => {
          if (!item.transaction_date) return;
          const date = new Date(item.transaction_date);
          const monthYear = date.toLocaleString('id-ID', { month: 'short', year: 'numeric' });
          if (!monthlyData[monthYear]) monthlyData[monthYear] = { month: monthYear, Inflow: 0, Outflow: 0 };
          
          if (item.category && (item.category.includes('Termin') || item.category.includes('Pendapatan') || item.category === 'Retur')) {
            monthlyData[monthYear].Inflow += Number(item.amount);
          } else {
            monthlyData[monthYear].Outflow += Number(item.amount);
          }
        });
        newChartData = Object.values(monthlyData).reverse();
        setChartData(newChartData);
      }

      // 4. SIMPAN KE CACHE
      saveToCache(cacheKey, {
        flows: flowData || [],
        tasks: taskData || [],
        projectData: projData || null,
        arData: newArData,
        apData: newApData,
        totalAr: newArTotal,
        totalAp: newApTotal,
        chartData: newChartData
      });

    } catch (err) {
      console.error("Error fetching finances:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    if (projectId) fetchData();
    getMfaStatus().then(setMfaStatus).catch(() => {});
  }, [projectId]);

  const handleWbsChange = (e) => {
    const wbsCode = e.target.value;
    setFormData({ ...formData, wbs_code: wbsCode });
    const wbsData = tasks.find(t => t.wbs_code === wbsCode);
    setSelectedWbsRow(wbsData || null);
    setSelectedWbsBudget(wbsData ? wbsData.sisa_anggaran_plafon : null);
  };

  const executeTieredDecision = async (id, decision) => {
    if (!projectId) return;
    const prevRow = flows.find((row) => row.id === id) || null;
    try {
      const res = await processTieredApproval({
        recordId: id,
        projectId,
        decision,
        reason: decision === 'Rejected' ? 'Ditolak dari Ledger Arus Kas' : null,
      });

      await recordAuditEvent({
        projectId,
        tableName: 'cash_flows',
        action: decision === 'Approved' ? 'APPROVE' : 'REJECT',
        recordId: id,
        oldData: prevRow
          ? {
              approval_status: prevRow.approval_status,
              current_approval_step: prevRow.current_approval_step || 1,
              amount: prevRow.amount,
            }
          : null,
        newData: res,
      });

      invalidateCache(`finances_${projectId}`);
      if (res.approval_status === 'Pending' && res.next_required_role) {
        showToast(
          'success',
          `Tahap disetujui! Dilanjutkan ke Tahap ${res.current_approval_step}/${res.required_approval_steps} (${res.next_required_role}).`
        );
      } else {
        showToast(decision === 'Approved' ? 'success' : 'danger', `Transaksi berhasil di-${res.approval_status}!`);
      }
      fetchData();
    } catch (err) {
      showToast('danger', err?.message || 'Gagal memproses persetujuan berjenjang.');
    }
  };

  const triggerApprovalDecision = async (id, decision) => {
    if (!navigator.onLine) return showToast('danger', 'Tidak bisa memproses persetujuan saat offline.');
    if (!canApprove) return showToast('danger', 'Akses ditolak: Hanya Approver yang berwenang.');

    if (mfaStatus?.needsChallenge && mfaStatus.verifiedFactors?.[0]?.id) {
      setPendingApprovalAction({ id, decision });
      setMfaOtp('');
      setMfaModalOpen(true);
      return;
    }

    await executeTieredDecision(id, decision);
  };

  const handleVerifyMfaAndApprove = async (e) => {
    e.preventDefault();
    const factorId = mfaStatus?.verifiedFactors?.[0]?.id;
    if (!factorId || !pendingApprovalAction) return;

    setVerifyingMfa(true);
    try {
      await verifyTotpCode(factorId, mfaOtp);
      const updated = await getMfaStatus();
      setMfaStatus(updated);
      setMfaModalOpen(false);
      await executeTieredDecision(pendingApprovalAction.id, pendingApprovalAction.decision);
      setPendingApprovalAction(null);
    } catch (err) {
      showToast('danger', err?.message || 'Verifikasi 2FA gagal.');
    } finally {
      setVerifyingMfa(false);
    }
  };

  const handleApprove = (id) => triggerApprovalDecision(id, 'Approved');
  const handleReject = (id) => triggerApprovalDecision(id, 'Rejected');

  const handleVoid = async () => {
    if (!navigator.onLine) return showToast('danger', 'Tidak bisa void saat offline.');
    if (!voidTarget || !voidReason.trim()) return showToast('danger', 'Alasan VOID wajib diisi!');
    setIsVoiding(true);
    try {
      const voidedAt = new Date().toISOString();
      const { error } = await supabase.from('cash_flows')
        .update({ voided_at: voidedAt, void_reason: voidReason })
        .eq('id', voidTarget.id)
        .eq('project_id', projectId);
      if (error) throw error;

      await recordAuditEvent({
        projectId,
        tableName: 'cash_flows',
        action: 'VOID',
        recordId: voidTarget.id,
        oldData: { amount: voidTarget.amount, approval_status: voidTarget.approval_status },
        newData: { voided_at: voidedAt, void_reason: voidReason },
      });

      invalidateCache(`finances_${projectId}`);
      showToast('success', 'Transaksi berhasil dibatalkan (VOID).');
      setVoidTarget(null); setVoidReason(''); fetchData();
    } catch (err) { showToast('danger', err.message); } finally { setIsVoiding(false); }
  };

  const effectiveAvailableBudget =
    formData.type === 'OUT'
      ? (selectedWbsBudget !== null ? selectedWbsBudget : (budgetSummary && budgetSummary.pagu_rab > 0 ? budgetSummary.available_budget : null))
      : null;
  const hardStopEnabled = budgetSummary?.budget_hard_stop !== false;
  const isOverbudget = effectiveAvailableBudget !== null && Number(formData.amount) > effectiveAvailableBudget;
  const ringFencedCheck =
    formData.type === 'OUT' && ringFenced
      ? evaluateRingFencedCashflow({
          clientInflow: ringFenced.total_client_inflow,
          hqDropping: ringFenced.total_hq_dropping,
          actualOutflow: ringFenced.total_actual_outflow,
          pendingOutflow: ringFenced.total_pending_outflow,
          requestedOutflow: Number(formData.amount) || 0,
          ringFencedEnabled: ringFenced.ring_fenced_cashflow,
          hqDroppingLimit: ringFenced.hq_dropping_limit,
        })
      : null;
  const isCashDeficitBlocked = Boolean(ringFencedCheck && !ringFencedCheck.allowed);
  const isHardBlocked = (hardStopEnabled && isOverbudget) || isCashDeficitBlocked;

  const matchedApprovalPlan = resolveApprovalMatrix(approvalRules, {
    documentType: (formData.category || '').toLowerCase().includes('kasbon') ? 'KASBON' : 'CASH_OUT',
    costCategory: formData.category || 'ALL',
    amount: Number(formData.amount) || 0,
    projectId,
  });

  const handleSave = async (e) => {
    e.preventDefault();
    if (!projectId) return showToast('danger', "ID Proyek tidak ditemukan.");
    if (!navigator.onLine) return showToast('danger', 'Tidak bisa menyimpan data finansial saat offline.');

    const isUploadRequired = formData.type === 'OUT' && (formData.payment_method === 'Petty Cash' || formData.payment_method === 'Tunai');
    if (isUploadRequired && !file) return showToast('danger', "Wajib unggah bukti untuk Tunai/Petty Cash!");
    if (isCashDeficitBlocked) {
      return showToast('danger', ringFencedCheck?.message || "Ring-Fenced Cashflow: Saldo kas proyek tidak mencukupi (defisit).");
    }
    if (hardStopEnabled && isOverbudget) {
      return showToast('danger', "Hard-Stop Aktif: Nominal melebihi Available Budget (Pagu - Committed - Actual). Ajukan Addendum/CCO terlebih dahulu.");
    }
    if (isOverbudget && !formData.overbudget_reason) return showToast('danger', "Wajib isi alasan overbudget!");
    
    setIsSaving(true);
    let finalAttachmentUrl = null;

    try {
      if (file) {
        setIsUploading(true);
        const fileExt = file.name.split('.').pop();
        const fileName = `${projectId}/fin_${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('evidence').upload(fileName, file);
        if (uploadError) throw new Error("Gagal upload: " + uploadError.message);
        finalAttachmentUrl = fileName;
      }

      const rpcRes = await submitBudgetedCashFlow({
        project_id: projectId,
        type: formData.type,
        category: formData.category,
        description: formData.description,
        amount: Number(formData.amount),
        transaction_date: formData.transaction_date,
        payment_method: formData.payment_method,
        vendor_or_ref: formData.vendor_or_ref || null,
        wbs_code: formData.wbs_code || null,
        attachment_url: finalAttachmentUrl,
        overbudget_reason: formData.overbudget_reason || null,
      });

      // Tandai bila transaksi terkait pekerjaan tambah / CCO (untuk Unapproved Work Alert)
      if (rpcRes?.id && (formData.is_variation_work || formData.cco_id)) {
        await supabase
          .from('cash_flows')
          .update({
            is_variation_work: Boolean(formData.is_variation_work || formData.cco_id),
            cco_id: formData.cco_id || null,
          })
          .eq('id', rpcRes.id);
      }

      const stepsCount = rpcRes?.required_approval_steps || 1;
      setIsModalOpen(false);
      showToast('success', `Transaksi diajukan dengan penguncian anggaran (${stepsCount} tahap approval)!`);
      setFormData({ type: 'OUT', category: 'Material', description: '', amount: 0, transaction_date: new Date().toISOString().split('T')[0], payment_method: 'Transfer', vendor_or_ref: '', wbs_code: '', approval_status: 'Pending', overbudget_reason: '', is_variation_work: false, cco_id: '' });
      setFile(null); setSelectedWbsBudget(null); setSelectedWbsRow(null); fetchData();
    } catch (error) { showToast('danger', error.message); } 
    finally { setIsSaving(false); setIsUploading(false); }
  };

  // --- KALKULASI KPI ---
  const validFlows = flows.filter(f => !f.voided_at);
  const totalIn = validFlows.filter(f => ['IN', 'Income'].includes(f.type) && f.approval_status === 'Approved').reduce((sum, f) => sum + Number(f.amount), 0);
  const totalOut = validFlows.filter(f => ['OUT', 'Expense'].includes(f.type) && f.approval_status === 'Approved').reduce((sum, f) => sum + Number(f.amount), 0);  
  const netCash = totalIn - totalOut;

  const totalActualCost = costControlData.filter(c => c.wbs_code.includes('.')).reduce((sum, c) => sum + Number(c.total_pengeluaran_aktual), 0);
  const contractValue = Number(projectData?.contract_value || 0);
  const estimatedProfit = contractValue - totalActualCost;

  let burnRate = 0;
  if (chartData.length > 0) {
    const last3Months = chartData.slice(-3);
    const totalOut3Months = last3Months.reduce((sum, d) => sum + d.Outflow, 0);
    burnRate = totalOut3Months / last3Months.length;
  }
  const runway = burnRate > 0 ? (netCash / burnRate) : 0;

  const formatRp = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num || 0);

  // Cek apakah ada transaksi hari ini untuk SOP Alert
  const todayStr = new Date().toISOString().split('T')[0];
  const hasTodayTransaction = flows.some(f => f.transaction_date === todayStr && f.approval_status === 'Approved');

  if (loading) return <LoadingSpinner text="Memuat Data Keuangan..." />;

  return (
    <div className="p-6 bg-slate-50 min-h-screen relative">
      
      {toast && (
        <div className={`fixed top-6 right-6 z-[9999] px-6 py-3 rounded-lg shadow-xl text-white font-bold animate-fade-in-up flex items-center gap-2 ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          <CheckCircle2 size={18} /> {toast.message}
        </div>
      )}

      <div className="w-full space-y-6">
        
        <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Wallet className="text-indigo-600" /> Cash Flow Management
            </h1>
            <p className="text-sm text-slate-500 mt-1">Pantau arus kas aktual (Approved) dan pengajuan transaksi baru.</p>
          </div>
          {canAddTransaction && (
            <button onClick={() => setIsModalOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold text-sm shadow transition-colors flex items-center gap-2">
              <Plus size={16} /> Tambah Transaksi
            </button>
          )}
        </div>

        {/* RING-FENCED CASHFLOW & UNAPPROVED WORK ALERTS */}
        {ringFenced && ringFenced.is_deficit && (
          <div className="bg-rose-50 border border-rose-300 text-rose-800 p-4 rounded-lg flex items-start gap-3 shadow-sm">
            <AlertTriangle className="mt-0.5 flex-shrink-0 text-rose-600" size={18} />
            <div className="text-sm">
              <p className="font-bold">Ring-Fenced Cashflow Alert: Proyek Dalam Kondisi Defisit Kas ({formatRp(ringFenced.ringfenced_cash_balance)})</p>
              <p className="text-xs mt-0.5">
                Kas Masuk Klien: <b>{formatRp(ringFenced.total_client_inflow)}</b> • Dropping Pusat: <b>{formatRp(ringFenced.total_hq_dropping)}</b> • Total Keluar+Pending: <b>{formatRp(ringFenced.total_actual_outflow + ringFenced.total_pending_outflow)}</b>. Segera tagih termin atau ajukan Dropping Kantor Pusat.
              </p>
            </div>
          </div>
        )}
        {unapprovedWork.length > 0 && (
          <div className="bg-orange-50 border border-orange-300 text-orange-900 p-4 rounded-lg flex items-center justify-between gap-3 shadow-sm">
            <div className="flex items-start gap-3 text-sm">
              <AlertTriangle className="mt-0.5 flex-shrink-0 text-orange-600" size={18} />
              <div>
                <p className="font-bold">Unapproved Work Alert: {unapprovedWork.length} Pengeluaran Pekerjaan Tambah Tanpa Addendum Resmi</p>
                <p className="text-xs mt-0.5">
                  Total biaya terpapar: <b>{formatRp(unapprovedWork.reduce((s, r) => s + Number(r.incurred_cost || 0), 0))}</b>.
                </p>
              </div>
            </div>
            <a href="/change-orders" className="shrink-0 bg-orange-600 hover:bg-orange-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold">
              Kelola CCO / Addendum
            </a>
          </div>
        )}

        {/* CONTEXTUAL SOP ALERT: CASH FLOW */}
        {!hasTodayTransaction && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-lg flex items-start gap-3 shadow-sm">
            <Info className="mt-0.5 flex-shrink-0" size={18} />
            <div>
              <p className="font-bold mb-1">Pengingat SOP (Kas Harian):</p>
              <p className="text-sm">Belum ada transaksi Kas Keluar / Kasbon yang diinput untuk hari ini. Sesuai SOP, pastikan seluruh nota kontan (Petty Cash) dan pemberian Kasbon Mandor sudah direkap dan diinput sebelum pukul 16.00 WITA.</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200 border-l-4 border-l-emerald-500 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase mb-1">Total Kas Masuk</p>
              <p className="text-xl font-bold text-emerald-600">{formatRp(totalIn)}</p>
            </div>
            <ArrowDownCircle className="text-emerald-500 opacity-50" size={40} />
          </div>
          <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200 border-l-4 border-l-red-500 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase mb-1">Total Kas Keluar</p>
              <p className="text-xl font-bold text-red-600">{formatRp(totalOut)}</p>
            </div>
            <ArrowUpCircle className="text-red-500 opacity-50" size={40} />
          </div>
          <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200 border-l-4 border-l-indigo-500 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase mb-1">Saldo Bersih (Net)</p>
              <p className={`text-xl font-bold ${netCash >= 0 ? 'text-indigo-600' : 'text-red-600'}`}>{formatRp(netCash)}</p>
            </div>
            <Wallet className="text-indigo-500 opacity-50" size={40} />
          </div>
        </div>        
                
        <div className="flex space-x-6 mb-4 border-b border-slate-200 mt-6 overflow-x-auto">
          <button onClick={() => setActiveTab('ledger')} className={`pb-3 font-medium transition-colors whitespace-nowrap ${activeTab === 'ledger' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>
            Riwayat Transaksi (Ledger)
          </button>
          <button onClick={() => setActiveTab('cost_control')} className={`pb-3 font-medium transition-colors whitespace-nowrap ${activeTab === 'cost_control' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>
            Kontrol Anggaran (Cost Control)
          </button>
          <button onClick={() => setActiveTab('health')} className={`pb-3 font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${activeTab === 'health' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>
            <Activity size={16} /> Dashboard Health
          </button>
          <button onClick={() => setActiveTab('aging')} className={`pb-3 font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${activeTab === 'aging' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>
            <FileText size={16} /> Aging & Liabilitas
          </button>
          {/* TAB BARU: CASH FLOW FORECAST */}
          <button onClick={() => setActiveTab('forecast')} className={`pb-3 font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${activeTab === 'forecast' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>
            <TrendingUp size={16} /> Cash Flow Forecast
          </button>
          <button onClick={() => setActiveTab('cash_flow_statement')} className={`pb-3 font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${activeTab === 'cash_flow_statement' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>
            <FileText size={16} /> Laporan Arus Kas
          </button>
        </div>

        {/* TAB LEDGER */}
        {activeTab === 'ledger' && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3 w-24">Tanggal</th>
                  <th className="p-3 w-20 text-center">Tipe</th>
                  <th className="p-3 w-36">Kategori</th>
                  <th className="p-3">Keterangan / Referensi</th>
                  <th className="p-3 w-24 text-center">Status</th>
                  <th className="p-3 text-right">Nominal (Rp)</th>
                  <th className="p-3 text-center w-28">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {flows.length === 0 && (
                  <tr><td colSpan={7} className="p-10 text-center text-slate-500 italic">Belum ada data transaksi.</td></tr>
                )}
                {flows.map((f) => (
                  <tr key={f.id} className={`hover:bg-slate-50 ${f.voided_at ? 'opacity-50 bg-slate-50' : ''}`}>
                    <td className="p-3 text-slate-600 text-xs">{new Date(f.transaction_date).toLocaleDateString('id-ID')}</td>
                    <td className="p-3 text-center">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${['IN', 'Income'].includes(f.type) ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                        {['IN', 'Income'].includes(f.type) ? 'MASUK' : 'KELUAR'}
                      </span>
                    </td>
                    <td className="p-3 text-xs font-semibold text-slate-700">
                      {f.category}
                      {f.wbs_code && <span className="block text-[10px] text-slate-500 mt-1 font-mono">WBS: {f.wbs_code}</span>}
                    </td>
                    <td className="p-3 text-xs text-slate-600">
                      {f.description || f.vendor_or_ref || '-'}
                    </td>
                    <td className="p-3 text-center">
                      {f.voided_at ? (
                        <span className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase bg-slate-200 text-slate-600" title={f.void_reason}>VOID</span>
                      ) : (
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                          f.approval_status === 'Approved' ? 'bg-green-100 text-green-700' : 
                          f.approval_status === 'Rejected' ? 'bg-red-100 text-red-700' : 
                          'bg-amber-100 text-amber-700'
                        }`}>{f.approval_status}</span>
                      )}
                    </td>
                    <td className={`p-3 text-right font-bold ${f.voided_at ? 'line-through text-slate-400' : ['IN', 'Income'].includes(f.type) ? 'text-emerald-600' : 'text-red-600'}`}>
                      {formatRp(f.amount)}
                    </td>
                    <td className="p-3 text-center">
                      {f.voided_at ? (
                        <span className="text-xs text-slate-400 italic">Dibatalkan</span>
                      ) : ['Pending', 'Pending Overbudget'].includes(f.approval_status) && canApprove ? (
                        (() => {
                          const chain = Array.isArray(f.approval_chain) && f.approval_chain.length > 0 ? f.approval_chain : ['Project Manager'];
                          const totalSteps = f.required_approval_steps || chain.length;
                          const currStep = Math.min(Math.max(1, f.current_approval_step || 1), totalSteps);
                          const reqRole = chain[currStep - 1] || 'Project Manager';
                          const eligible = canRoleApproveStep(reqRole, { globalRole, projectRole: projectRole || role });
                          return eligible ? (
                            <div className="flex flex-col items-center gap-1">
                              <div className="flex gap-2 justify-center">
                                <button onClick={() => handleApprove(f.id)} className="bg-green-100 text-green-700 hover:bg-green-200 px-2 py-1 rounded text-xs font-bold" title={`Approve Tahap ${currStep}/${totalSteps} (${reqRole})`}><ShieldCheck size={14}/></button>
                                <button onClick={() => handleReject(f.id)} className="bg-red-100 text-red-700 hover:bg-red-200 px-2 py-1 rounded text-xs font-bold" title="Reject"><X size={14}/></button>
                              </div>
                              {totalSteps > 1 && (
                                <span className="text-[9px] font-bold text-indigo-600">Tahap {currStep}/{totalSteps}</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic" title={`Menunggu ${reqRole}`}>Tahap {currStep}/{totalSteps}</span>
                          );
                        })()
                      ) : f.approval_status === 'Approved' && canVoid ? (
                        <button onClick={() => setVoidTarget(f)} className="bg-slate-100 text-slate-500 hover:bg-red-100 hover:text-red-600 px-2 py-1 rounded text-xs font-bold transition-colors" title="Batalkan (VOID)"><Trash2 size={14}/></button>
                      ) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        )}

        {/* TAB COST CONTROL — 3 LAPISAN ANGGARAN (AVAILABLE / COMMITTED / ACTUAL) */}
        {activeTab === 'cost_control' && (
          <div className="space-y-4">
            {budgetSummary && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <p className="text-[11px] font-bold uppercase text-slate-500">1. Pagu Anggaran (RAB/RAP)</p>
                  <p className="text-lg font-extrabold text-slate-800 mt-1">{formatRp(budgetSummary.pagu_rab)}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Hard-Stop: {budgetSummary.budget_hard_stop ? 'Aktif (Locked)' : 'Soft Warning'}</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-amber-200 shadow-sm">
                  <p className="text-[11px] font-bold uppercase text-amber-600">2. Committed Budget</p>
                  <p className="text-lg font-extrabold text-amber-700 mt-1">{formatRp(budgetSummary.committed_budget)}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">PO: {formatRp(budgetSummary.committed_po)} • SPK: {formatRp(budgetSummary.committed_spk)}</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-rose-200 shadow-sm">
                  <p className="text-[11px] font-bold uppercase text-rose-600">3. Actual Cost (Terbayar)</p>
                  <p className="text-lg font-extrabold text-rose-700 mt-1">{formatRp(budgetSummary.actual_cost)}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Pending Kas: {formatRp(budgetSummary.committed_pending_cash)}</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-sm">
                  <p className="text-[11px] font-bold uppercase text-emerald-600">Available Budget (Sisa Bebas)</p>
                  <p className={`text-lg font-extrabold mt-1 ${budgetSummary.available_budget < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>{formatRp(budgetSummary.available_budget)}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Pagu - (Committed + Actual)</p>
                </div>
              </div>
            )}

            <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="p-4 font-semibold">Kode WBS</th>
                      <th className="p-4 font-semibold">Nama Pekerjaan</th>
                      <th className="p-4 font-semibold text-right">Pagu RAB/RAP</th>
                      <th className="p-4 font-semibold text-right">Committed (PO/SPK/Pending)</th>
                      <th className="p-4 font-semibold text-right">Actual Cost</th>
                      <th className="p-4 font-semibold text-right">Available Budget</th>
                      <th className="p-4 font-semibold text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {costControlData.map((item, index) => {
                      const isParent = !String(item.wbs_code || '').includes('.');
                      return (
                      <tr key={index} className={`transition-colors ${isParent ? 'bg-slate-50 border-t-2 border-slate-200' : 'hover:bg-slate-50'}`}>
                        <td className={`p-4 text-sm font-mono ${isParent ? 'text-slate-800 font-bold' : 'text-slate-600'}`}>{item.wbs_code}</td>
                        <td className={`p-4 text-sm ${isParent ? 'text-slate-900 font-bold' : 'text-slate-800 font-medium'}`}>{item.task_name}</td>
                        <td className={`p-4 text-sm text-right ${isParent ? 'font-bold text-slate-800' : 'text-slate-600'}`}>{formatRp(item.pagu_anggaran_rap)}</td>
                        <td className="p-4 text-sm text-right font-medium text-amber-700">{formatRp(item.committed_budget || 0)}</td>
                        <td className={`p-4 text-sm text-right ${isParent ? 'font-bold text-rose-700' : 'text-rose-600 font-medium'}`}>{formatRp(item.total_pengeluaran_aktual)}</td>
                        <td className={`p-4 text-sm text-right font-bold ${item.sisa_anggaran_plafon < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{formatRp(item.sisa_anggaran_plafon)}</td>
                        <td className="p-4 text-center">
                          {item.sisa_anggaran_plafon < 0 ? (
                            <span className="inline-flex items-center gap-1 px-3 py-1 bg-rose-100 text-rose-700 rounded-full text-xs font-bold"><AlertTriangle size={12} /> Overbudget</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold"><ShieldCheck size={12} /> Aman</span>
                          )}
                        </td>
                      </tr>
                    )})}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB DASHBOARD HEALTH */}
        {activeTab === 'health' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200">
                <div className="flex justify-between items-start mb-2">
                  <p className="text-xs font-bold text-slate-500 uppercase">Burn Rate (3 Bln)</p>
                  <TrendingDown size={18} className="text-red-500" />
                </div>
                <p className="text-xl font-bold text-slate-800">{formatRp(burnRate)} <span className="text-sm font-normal text-slate-500">/ bln</span></p>
                <p className="text-xs text-slate-500 mt-1">Rata-rata pengeluaran bulanan.</p>
              </div>
              
              <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200">
                <div className="flex justify-between items-start mb-2">
                  <p className="text-xs font-bold text-slate-500 uppercase">Runway (Ketahanan Kas)</p>
                  <Banknote size={18} className={runway > 3 ? 'text-emerald-500' : 'text-amber-500'} />
                </div>
                <p className={`text-xl font-bold ${runway > 3 ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {runway > 0 ? `${runway.toFixed(1)} Bulan` : '∞ (Aman)'}
                </p>
                <p className="text-xs text-slate-500 mt-1">Estimasi waktu sebelum kas habis.</p>
              </div>

              <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200">
                <div className="flex justify-between items-start mb-2">
                  <p className="text-xs font-bold text-slate-500 uppercase">Estimasi Profit Kotor</p>
                  <TrendingUp size={18} className={estimatedProfit > 0 ? 'text-emerald-500' : 'text-red-500'} />
                </div>
                <p className={`text-xl font-bold ${estimatedProfit > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {formatRp(estimatedProfit)}
                </p>
                <p className="text-xs text-slate-500 mt-1">Nilai Kontrak - Total Realisasi WBS.</p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200">
              <h3 className="text-lg font-bold text-slate-800 mb-4">Tren Arus Kas (Bulanan)</h3>
              <div className="h-80 w-full">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis tickFormatter={(value) => `Rp ${value / 1000000} Jt`} tick={{ fontSize: 12 }} width={90} />
                      <RechartsTooltip 
                        formatter={(value) => formatRp(value)}
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      />
                      <Legend wrapperStyle={{ paddingTop: '20px' }} />
                      <Bar dataKey="Inflow" name="Kas Masuk" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Outflow" name="Kas Keluar" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-slate-400 italic">Belum ada data transaksi untuk digrafikkan.</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB AGING & LIABILITAS */}
        {activeTab === 'aging' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200 border-l-4 border-l-emerald-500">
                <div className="flex justify-between items-start mb-1">
                  <p className="text-xs font-bold text-slate-500 uppercase">Total Piutang Klien (AR)</p>
                  <FileText size={18} className="text-emerald-500" />
                </div>
                <p className="text-xl font-bold text-emerald-600">{formatRp(totalAr)}</p>
                <p className="text-xs text-slate-500 mt-1">Tagihan termin/invoice yang belum dibayar.</p>
              </div>
              
              <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200 border-l-4 border-l-red-500">
                <div className="flex justify-between items-start mb-1">
                  <p className="text-xs font-bold text-slate-500 uppercase">Total Hutang Subkon (AP)</p>
                  <Users size={18} className="text-red-500" />
                </div>
                <p className="text-xl font-bold text-red-600">{formatRp(totalAp)}</p>
                <p className="text-xs text-slate-500 mt-1">Kewajiban pembayaran ke vendor/mandor.</p>
              </div>

              <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200 border-l-4 border-l-indigo-500">
                <div className="flex justify-between items-start mb-1">
                  <p className="text-xs font-bold text-slate-500 uppercase">Posisi Bersih (Net AR/AP)</p>
                  <Wallet size={18} className={totalAr - totalAp >= 0 ? 'text-indigo-500' : 'text-red-500'} />
                </div>
                <p className={`text-xl font-bold ${totalAr - totalAp >= 0 ? 'text-indigo-600' : 'text-red-600'}`}>
                  {formatRp(totalAr - totalAp)}
                </p>
                <p className="text-xs text-slate-500 mt-1">Selisih antara Piutang dan Hutang.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* TABEL AR */}
              <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2"><FileText size={18} className="text-emerald-600"/> Piutang Klien (AR)</h3>
                </div>
                <div className="overflow-x-auto flex-1 max-h-[400px]">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-white text-slate-600 font-semibold border-b border-slate-200 sticky top-0">
                      <tr>
                        <th className="p-3">No. Invoice</th>
                        <th className="p-3">Klien</th>
                        <th className="p-3 text-right">Sisa Tagihan (Rp)</th>
                        <th className="p-3 text-center">Umur</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {arData.length === 0 ? (
                        <tr><td colSpan="4" className="p-6 text-center text-slate-500 italic">Tidak ada piutang aktif.</td></tr>
                      ) : arData.map((inv, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-3 font-mono text-xs font-bold text-blue-600">{inv.invoice_number}</td>
                          <td className="p-3 text-xs">{inv.client_name || 'Klien Proyek'}</td>
                          <td className="p-3 text-right font-bold text-emerald-700">{formatRp(inv.outstanding)}</td>
                          <td className="p-3 text-center">
                            <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                              inv.aging === '> 90 Hari' ? 'bg-red-100 text-red-700' : 
                              inv.aging === '61-90 Hari' ? 'bg-orange-100 text-orange-700' : 
                              'bg-slate-100 text-slate-600'
                            }`}>{inv.aging}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* TABEL AP */}
              <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2"><Users size={18} className="text-red-600"/> Hutang Subkon (AP)</h3>
                </div>
                <div className="overflow-x-auto flex-1 max-h-[400px]">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-white text-slate-600 font-semibold border-b border-slate-200 sticky top-0">
                      <tr>
                        <th className="p-3">Tipe / No. Dok</th>
                        <th className="p-3">Vendor</th>
                        <th className="p-3 text-right">Nilai (Rp)</th>
                        <th className="p-3 text-center">Umur</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {apData.length === 0 ? (
                        <tr><td colSpan="4" className="p-6 text-center text-slate-500 italic">Tidak ada hutang tertunda.</td></tr>
                      ) : apData.map((ap, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-3">
                            <span className="text-[10px] font-bold px-1.5 py-0.5 bg-slate-100 rounded block mb-1 w-max">{ap.payment_type}</span>
                            <span className="font-mono text-xs text-slate-600">{ap.payment_number}</span>
                          </td>
                          <td className="p-3 text-xs">{ap.vendor_name}</td>
                          <td className="p-3 text-right font-bold text-red-700">{formatRp(ap.amount)}</td>
                          <td className="p-3 text-center">
                            <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                              ap.aging === '> 90 Hari' ? 'bg-red-100 text-red-700' : 
                              ap.aging === '61-90 Hari' ? 'bg-orange-100 text-orange-700' : 
                              'bg-slate-100 text-slate-600'
                            }`}>{ap.aging}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB CASH FLOW FORECAST (NEW) */}
        {activeTab === 'forecast' && (
          <CashFlowForecastView projectId={projectId} />
        )}

        {/* TAB LAPORAN ARUS KAS SAK ETAP */}
        {activeTab === 'cash_flow_statement' && (
          <CashFlowStatementView projectId={projectId} />
        )}

      </div>

      {/* MODAL VOID */}
      {voidTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-red-50 text-red-800">
              <h2 className="text-lg font-bold flex items-center gap-2"><AlertTriangle /> Batalkan Transaksi (VOID)</h2>
              <button onClick={() => setVoidTarget(null)} className="text-slate-400 hover:text-red-700"><X size={20}/></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-slate-50 p-3 rounded-lg text-sm border">
                <p><strong>Tipe:</strong> {voidTarget.type}</p>
                <p><strong>Nominal:</strong> {formatRp(voidTarget.amount)}</p>
                <p><strong>Keterangan:</strong> {voidTarget.description || '-'}</p>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Alasan Pembatalan (Wajib)</label>
                <textarea required rows="3" value={voidReason} onChange={e => setVoidReason(e.target.value)} placeholder="cth: Salah input nominal, duplikasi transaksi, dll." className="w-full border border-slate-300 p-2 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none resize-none" />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button onClick={() => setVoidTarget(null)} className="px-4 py-2 text-sm font-bold text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50">Batal</button>
                <button onClick={handleVoid} disabled={isVoiding || !voidReason.trim()} className="px-6 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-md transition-colors flex items-center gap-2 disabled:bg-red-400">
                  {isVoiding ? <Loader2 className="animate-spin" size={16}/> : <Trash2 size={16}/>} Konfirmasi VOID
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL TAMBAH TRANSAKSI */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-scale-in">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Wallet className="text-indigo-600"/> Ajukan Transaksi</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700"><X size={20}/></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Tipe Transaksi</label>
                  <select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value, category: e.target.value === 'IN' ? 'Termin' : 'Material'})} className="w-full border border-slate-300 p-2 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white">
                    <option value="IN">Kas Masuk (Pemasukan)</option>
                    <option value="OUT">Kas Keluar (Pengeluaran)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Tanggal</label>
                  <input required type="date" value={formData.transaction_date} onChange={e => setFormData({...formData, transaction_date: e.target.value})} className="w-full border border-slate-300 p-2 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Kategori</label>
                  <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full border border-slate-300 p-2 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white">
                    {formData.type === 'IN' ? (
                      <>
                        <option value="DP">Uang Muka (DP)</option>
                        <option value="Termin">Termin Pembayaran</option>
                        <option value="Dropping Kantor Pusat">Dropping Dana Kantor Pusat (HQ)</option>
                        <option value="Retensi">Pencairan Retensi</option>
                        <option value="Retur">Retur / Koreksi Pengembalian</option>
                        <option value="Lainnya">Lainnya</option>
                      </>
                    ) : (
                      <><option value="Material">Pembelian Material</option><option value="Upah">Upah Tenaga Kerja</option><option value="Alat">Sewa Alat Berat</option><option value="Operasional">Biaya Operasional</option><option value="Subkon">Pembayaran Subkon</option><option value="Lainnya">Lainnya</option></>
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Relasi WBS (Budget Link)</label>
                  <select value={formData.wbs_code} onChange={handleWbsChange} className="w-full border border-slate-300 p-2 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white">
                    <option value="">-- Tanpa Relasi WBS --</option>
                    {tasks.map(t => <option key={t.wbs_code} value={t.wbs_code}>[{t.wbs_code}] {t.task_name}</option>)}
                  </select>
                  {selectedWbsRow && (
                    <div className="mt-2 bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1 text-xs">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1"><ShieldCheck size={12}/> 3 Lapisan Anggaran WBS</p>
                      <div className="flex justify-between"><span>Pagu RAB:</span><strong>{formatRp(selectedWbsRow.pagu_rab)}</strong></div>
                      <div className="flex justify-between text-amber-700"><span>Committed (PO/SPK/Pending):</span><strong>{formatRp(selectedWbsRow.committed_budget || 0)}</strong></div>
                      <div className="flex justify-between text-rose-600"><span>Actual Cost:</span><strong>{formatRp(selectedWbsRow.actual_cost || 0)}</strong></div>
                      <div className="flex justify-between border-t pt-1 mt-1">
                        <span className="font-bold text-slate-700">Available Budget:</span>
                        <strong className={selectedWbsBudget < 0 ? 'text-red-600' : 'text-emerald-600'}>{formatRp(selectedWbsBudget)}</strong>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Vendor / No. Invoice (Opsional)</label>
                  <input type="text" value={formData.vendor_or_ref} onChange={e => setFormData({...formData, vendor_or_ref: e.target.value})} placeholder="cth: PT. Baja Perkasa / INV-001" className="w-full border border-slate-300 p-2 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Metode Pembayaran</label>
                  <select value={formData.payment_method} onChange={e => setFormData({...formData, payment_method: e.target.value})} className="w-full border border-slate-300 p-2 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white">
                    <option value="Transfer">Transfer Bank</option>
                    <option value="Petty Cash">Petty Cash (Kas Kecil)</option>
                    <option value="Giro">Giro / Cheque</option>
                    <option value="Tunai">Tunai</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Nominal (Rp)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">Rp</span>
                  <input required type="text" value={formData.amount ? Number(formData.amount).toLocaleString('id-ID') : ''} onChange={(e) => { const rawValue = e.target.value.replace(/\D/g, ''); setFormData({ ...formData, amount: rawValue }); }} className={`w-full border p-2 pl-10 rounded-lg text-sm focus:ring-2 outline-none font-bold text-lg ${isOverbudget ? 'border-red-500 bg-red-50 text-red-700 focus:ring-red-500' : 'border-slate-300 focus:ring-indigo-500'}`} placeholder="0" />
                </div>
                {isCashDeficitBlocked ? (
                  <div className="mt-2 bg-rose-50 p-3 rounded-lg border border-rose-300 text-rose-800 text-xs space-y-1">
                    <p className="font-bold flex items-center gap-1"><AlertTriangle size={13}/> RING-FENCED CASHFLOW BLOCK: Kas Mandiri Proyek Tidak Mencukupi!</p>
                    <p>{ringFencedCheck?.message}</p>
                  </div>
                ) : (hardStopEnabled && isOverbudget) ? (
                  <div className="mt-2 bg-rose-50 p-3 rounded-lg border border-rose-300 text-rose-800 text-xs space-y-1">
                    <p className="font-bold flex items-center gap-1"><AlertTriangle size={13}/> HARD-STOP ANGGARAN: Nominal melebihi Available Budget ({formatRp(effectiveAvailableBudget)})!</p>
                    <p>Pengajuan diblokir otomatis (Pagu - Committed - Actual tidak mencukupi). Lakukan revisi anggaran / CCO terlebih dahulu.</p>
                  </div>
                ) : isOverbudget && (
                  <>
                    <p className="text-xs text-red-600 font-bold mt-1 flex items-center gap-1"><AlertTriangle size={12}/> Nominal melebihi sisa anggaran WBS!</p>
                    <div className="mt-3 bg-red-50 p-3 rounded-lg border border-red-200">
                      <label className="block text-xs font-bold text-red-700 mb-1">Alasan Overbudget (Wajib Diisi)</label>
                      <textarea required rows="2" value={formData.overbudget_reason} onChange={e => setFormData({...formData, overbudget_reason: e.target.value})} placeholder="cth: Kenaikan harga material mendadak / perubahan spesifikasi di lapangan" className="w-full border border-red-300 p-2 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none resize-none bg-white text-slate-800" />
                    </div>
                  </>
                )}
                {formData.type === 'OUT' && Number(formData.amount) > 0 && (
                  <div className="mt-2 bg-indigo-50/70 border border-indigo-200 rounded-lg px-3 py-2 text-xs text-indigo-800">
                    <strong>Jenjang Approval Dinamis ({matchedApprovalPlan.totalSteps} Tahap):</strong>{' '}
                    {matchedApprovalPlan.approverRoles.map((r, i) => `${i + 1}. ${r}`).join(' → ')}
                  </div>
                )}
              </div>

              {formData.type === 'OUT' && (
                <div className="bg-amber-50/70 border border-amber-200 rounded-lg p-3 space-y-2">
                  <label className="inline-flex items-center gap-2 text-xs font-bold text-amber-900 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(formData.is_variation_work)}
                      onChange={(e) => setFormData({ ...formData, is_variation_work: e.target.checked })}
                      className="rounded border-amber-400"
                    />
                    Tandai sebagai Pekerjaan Tambah (Variation Work / CCO)
                  </label>
                  {formData.is_variation_work && (
                    <select
                      value={formData.cco_id || ''}
                      onChange={(e) => setFormData({ ...formData, cco_id: e.target.value })}
                      className="w-full border border-amber-300 rounded-lg p-2 text-xs bg-white"
                    >
                      <option value="">-- Belum Ada CCO Resmi (Akan Memicu Unapproved Work Alert) --</option>
                      {ccoList.map((c) => (
                        <option key={c.id} value={c.id}>
                          [{c.cco_number}] {c.title} ({c.status})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Keterangan Tambahan</label>
                <textarea rows="2" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="cth: Pembelian besi 10mm 50 batang" className="w-full border border-slate-300 p-2 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none" />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Upload Bukti Transaksi (Nota/Kuitansi) {(formData.type === 'OUT' && (formData.payment_method === 'Tunai' || formData.payment_method === 'Petty Cash')) && <span className="text-red-500">*</span>}</label>
                <div className="flex items-center gap-3">
                  <label className={`cursor-pointer border px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center gap-2 ${(formData.type === 'OUT' && (formData.payment_method === 'Tunai' || formData.payment_method === 'Petty Cash')) && !file ? 'bg-red-50 border-red-300 text-red-600 hover:bg-red-100' : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'}`}>
                    <UploadCloud size={16} /> Pilih File
                    <input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files[0])} className="hidden" />
                  </label>
                  <span className="text-xs text-slate-500 truncate max-w-[200px]">{file ? file.name : (formData.type === 'OUT' && (formData.payment_method === 'Tunai' || formData.payment_method === 'Petty Cash') ? 'Wajib diisi!' : 'Belum ada file (Opsional)')}</span>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-6">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-bold text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">Batal</button>
                <button type="submit" disabled={isSaving || isUploading || isHardBlocked} className={`px-6 py-2 text-sm font-bold text-white rounded-lg shadow-md transition-all flex items-center gap-2 ${(isSaving || isUploading || isHardBlocked) ? 'bg-slate-400 cursor-not-allowed' : isOverbudget ? 'bg-orange-500 hover:bg-orange-600' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
                  {(isSaving || isUploading) ? <><Loader2 size={16} className="animate-spin" /> Memproses...</> : isHardBlocked ? <><AlertTriangle size={16}/> Diblokir (Hard-Stop)</> : <><Save size={16}/> Ajukan Transaksi</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL VERIFIKASI 2FA TOTP APPROVER (LEDGER) */}
      {mfaModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <form onSubmit={handleVerifyMfaAndApprove} className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden p-6 space-y-4">
            <div className="text-center">
              <div className="w-12 h-12 mx-auto rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center mb-3">
                <KeyRound size={22} />
              </div>
              <h3 className="text-lg font-bold text-slate-800">Verifikasi 2FA Approver</h3>
              <p className="text-xs text-slate-500 mt-1">
                Masukkan 6 digit kode dari aplikasi Authenticator untuk menandatangani persetujuan transaksi kas ini.
              </p>
            </div>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              required
              autoFocus
              value={mfaOtp}
              onChange={(e) => setMfaOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              className="w-full border border-slate-300 rounded-xl py-3 text-center font-mono text-2xl tracking-[0.4em] focus:ring-2 focus:ring-indigo-500 outline-none"
            />
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setMfaModalOpen(false);
                  setPendingApprovalAction(null);
                }}
                className="flex-1 py-2.5 text-sm font-bold text-slate-600 border border-slate-300 rounded-xl hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={verifyingMfa || mfaOtp.length !== 6}
                className="flex-1 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {verifyingMfa ? <Loader2 className="animate-spin" size={16} /> : 'Verifikasi'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
