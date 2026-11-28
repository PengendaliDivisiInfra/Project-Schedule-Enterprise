'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Landmark,
  HardHat,
  Package,
  Coins,
  Loader2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useProject } from '@/context/ProjectContext';

interface ComplianceItem {
  id: string;
  label: string;
  href: string;
  status: 'ok' | 'warning' | 'danger';
  badgeText: string;
  detail: string;
  Icon: any;
}

export default function ComplianceWidget() {
  const { activeProjectId } = useProject();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ComplianceItem[]>([]);

  useEffect(() => {
    if (!activeProjectId) {
      setItems([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const loadCompliance = async () => {
      setLoading(true);
      try {
        const todayIso = new Date().toISOString().split('T')[0];
        const in30Days = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

        const [poRes, cashTodayRes, pendingCfRes, pendingPoRes, bgRes, hseRes] = await Promise.all([
          supabase
            .from('purchase_orders')
            .select('id', { count: 'exact', head: true })
            .eq('project_id', activeProjectId)
            .in('status', ['Ordered', 'Partial']),
          supabase
            .from('cash_flows')
            .select('id', { count: 'exact', head: true })
            .eq('project_id', activeProjectId)
            .eq('transaction_date', todayIso)
            .is('voided_at', null),
          supabase
            .from('cash_flows')
            .select('id', { count: 'exact', head: true })
            .eq('project_id', activeProjectId)
            .in('approval_status', ['Pending', 'Pending Overbudget'])
            .is('voided_at', null),
          supabase
            .from('purchase_orders')
            .select('id', { count: 'exact', head: true })
            .eq('project_id', activeProjectId)
            .in('status', ['Pending', 'Pending Overbudget']),
          supabase
            .from('bank_guarantees')
            .select('id', { count: 'exact', head: true })
            .eq('project_id', activeProjectId)
            .eq('status', 'ACTIVE')
            .lte('expiry_date', in30Days),
          supabase
            .from('hse_work_permits')
            .select('id', { count: 'exact', head: true })
            .eq('project_id', activeProjectId)
            .eq('status', 'ACTIVE')
            .lte('valid_until', todayIso),
        ]);

        if (cancelled) return;

        const openPoGrn = poRes.count || 0;
        const cashToday = cashTodayRes.count || 0;
        const pendingApprovals = (pendingCfRes.count || 0) + (pendingPoRes.count || 0);
        const expiringBg = bgRes.count || 0;
        const expiredHse = hseRes.count || 0;

        setItems([
          {
            id: 'grn',
            label: 'Penerimaan Barang (GRN)',
            href: '/materials',
            status: openPoGrn > 0 ? 'warning' : 'ok',
            badgeText: openPoGrn > 0 ? `${openPoGrn} PO Menunggu GRN` : 'Semua PO Diterima',
            detail: 'Verifikasi surat jalan & GPS penerimaan material',
            Icon: Package,
          },
          {
            id: 'cash_today',
            label: 'Input Kas Harian Hari Ini',
            href: '/finances',
            status: cashToday > 0 ? 'ok' : 'warning',
            badgeText: cashToday > 0 ? `${cashToday} Transaksi Tercatat` : 'Belum Ada Input Hari Ini',
            detail: 'Kepatuhan pencatatan kas & lampiran nota harian',
            Icon: Coins,
          },
          {
            id: 'approvals',
            label: 'Antrean Persetujuan (Approval Matrix)',
            href: '/approvals',
            status: pendingApprovals > 0 ? 'danger' : 'ok',
            badgeText: pendingApprovals > 0 ? `${pendingApprovals} Menunggu Approval` : 'Antrean Bersih',
            detail: 'Verifikasi berjenjang Kas Keluar & Purchase Order',
            Icon: ShieldCheck,
          },
          {
            id: 'bank_guarantee',
            label: 'Jatuh Tempo Bank Garansi (≤ 30 Hari)',
            href: `/projects/${activeProjectId}/termin`,
            status: expiringBg > 0 ? 'danger' : 'ok',
            badgeText: expiringBg > 0 ? `${expiringBg} Jaminan Mendekati Expired` : 'Seluruh Jaminan Aman',
            detail: 'Jaminan Uang Muka, Pelaksanaan & Pemeliharaan',
            Icon: Landmark,
          },
          {
            id: 'hse_permits',
            label: 'Izin Kerja K3 (JSA & Work Permit Gate)',
            href: '/qhse',
            status: expiredHse > 0 ? 'danger' : 'ok',
            badgeText: expiredHse > 0 ? `${expiredHse} Permit Kedaluwarsa` : 'Kepatuhan K3 Aktif',
            detail: 'Syarat wajib sebelum input progres item risiko tinggi',
            Icon: HardHat,
          },
        ]);
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadCompliance();
    return () => {
      cancelled = true;
    };
  }, [activeProjectId]);

  const okCount = items.filter((i) => i.status === 'ok').length;
  const complianceScore = items.length > 0 ? Math.round((okCount / items.length) * 100) : 100;

  return (
    <div className="card-executive rounded-2xl p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div
            className="p-2.5 rounded-xl bg-executive-gradient shadow-sm"
            style={{ boxShadow: '0 6px 16px -4px var(--brand-glow)' }}
          >
            <ShieldCheck size={20} />
          </div>
          <div>
            <h3 className="font-extrabold text-slate-900 tracking-tight">
              Radar Kepatuhan &amp; Governance Proyek (Live)
            </h3>
            <p className="text-xs text-slate-500">
              Terhubung langsung ke database SOP, Approval Matrix, Bank Garansi &amp; HSE Gate
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-3 py-1 rounded-full text-xs font-extrabold border border-slate-200 bg-slate-50 text-slate-700 font-mono tabular-nums">
            Skor Kepatuhan: <span className={complianceScore >= 80 ? 'text-emerald-600' : 'text-amber-600'}>{complianceScore}%</span>
          </div>
          <Link
            href="/sop"
            className="text-xs font-bold hover:underline transition-colors"
            style={{ color: 'var(--brand-accent)' }}
          >
            Baca SOP Lengkap &rarr;
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="py-8 flex items-center justify-center gap-2 text-xs font-semibold text-slate-400">
          <Loader2 size={16} className="animate-spin" /> Memeriksa kepatuhan proyek secara real-time...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {items.map((item) => {
            const IconComp = item.Icon;
            const styleMap = {
              ok: {
                dot: 'bg-emerald-500',
                badge: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
                BadgeIcon: CheckCircle2,
              },
              warning: {
                dot: 'bg-amber-500',
                badge: 'bg-amber-50 text-amber-800 border-amber-200/80',
                BadgeIcon: Clock,
              },
              danger: {
                dot: 'bg-rose-500',
                badge: 'bg-rose-50 text-rose-700 border-rose-200/80',
                BadgeIcon: AlertCircle,
              },
            }[item.status];
            const BadgeIcon = styleMap.BadgeIcon;

            return (
              <Link
                key={item.id}
                href={item.href}
                className="group flex flex-col justify-between gap-2.5 p-3.5 bg-white hover:bg-slate-50/90 rounded-xl border border-slate-200/80 hover:border-slate-300 transition-all shadow-[0_1px_2px_rgba(15,23,42,0.02)]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${styleMap.dot}`} />
                    <IconComp size={15} className="text-slate-400 group-hover:text-slate-700 shrink-0 transition-colors" />
                    <span className="text-xs font-bold text-slate-800 truncate">{item.label}</span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 leading-snug">{item.detail}</p>
                <div className="pt-1">
                  <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-lg border ${styleMap.badge}`}>
                    <BadgeIcon size={12} /> {item.badgeText}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
