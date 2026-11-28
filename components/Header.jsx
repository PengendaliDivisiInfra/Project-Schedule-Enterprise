'use client';
import Link from 'next/link';
import {
  Menu,
  Search,
  Bell,
  ChevronDown,
  Building2,
  HelpCircle,
  WifiOff,
  RefreshCw,
  Palette,
  Check,
  AlertTriangle,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useProject } from '../context/ProjectContext';
import { useRole } from '@/lib/hooks/useRole';
import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import {
  processSyncQueue,
  getPendingOfflineCount,
  getFailedSyncItems,
  retryFailedSyncItems,
} from '../lib/services/sync-service';
import {
  EXECUTIVE_THEMES,
  EXECUTIVE_THEME_STORAGE_KEY,
  EXECUTIVE_CUSTOM_HEX_STORAGE_KEY,
  applyExecutiveThemeToDom,
  getAutoGradientContrast,
} from '@/lib/utils/theme-contrast';

export default function Header({ toggleSidebar, currentUser, openSearch }) {
  const { activeProjectId, selectProject } = useProject();
  const { globalRole, projectRole, role } = useRole(activeProjectId || undefined);
  const [projects, setProjects] = useState([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Adaptive Executive Theme State
  const [isThemeOpen, setIsThemeOpen] = useState(false);
  const [activeThemeId, setActiveThemeId] = useState('indigo');
  const [customHex, setCustomHex] = useState('#4f46e5');
  const [contrastInfo, setContrastInfo] = useState({ textColor: '#ffffff', contrastRatio: 7.4 });

  // Live Enterprise Notification Center State
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [notifSummary, setNotifSummary] = useState({
    pendingApprovals: 0,
    expiringGuarantees: 0,
    expiringPermits: 0,
    total: 0,
  });

  // State PWA Offline & Failed Sync Recovery
  const [isOnline, setIsOnline] = useState(true);
  const [pendingSyncs, setPendingSyncs] = useState(0);
  const [failedSyncs, setFailedSyncs] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  const headerRef = useRef(null);

  // Restore saved Executive Theme on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const savedId = localStorage.getItem(EXECUTIVE_THEME_STORAGE_KEY) || 'indigo';
      const savedHex = localStorage.getItem(EXECUTIVE_CUSTOM_HEX_STORAGE_KEY) || '#4f46e5';
      setActiveThemeId(savedId);
      setCustomHex(savedHex);
      const res = applyExecutiveThemeToDom(savedId, savedHex);
      setContrastInfo(res.contrast);
    } catch {
      const res = applyExecutiveThemeToDom('indigo');
      setContrastInfo(res.contrast);
    }
  }, []);

  // Close popovers on outside click
  useEffect(() => {
    const onDocClick = (e) => {
      if (headerRef.current && !headerRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
        setIsThemeOpen(false);
        setIsNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  // PWA Online/Offline + Failed Queue Monitor
  useEffect(() => {
    setIsOnline(navigator.onLine);

    const updateSyncCounts = async () => {
      try {
        const [counts, failed] = await Promise.all([
          getPendingOfflineCount(),
          getFailedSyncItems(),
        ]);
        setPendingSyncs(counts.total);
        setFailedSyncs(Array.isArray(failed) ? failed.length : 0);
      } catch {
        setPendingSyncs(0);
        setFailedSyncs(0);
      }
    };

    const handleOnline = () => {
      setIsOnline(true);
      setIsSyncing(true);
      processSyncQueue().finally(() => {
        setIsSyncing(false);
        updateSyncCounts();
      });
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    updateSyncCounts();
    const interval = setInterval(updateSyncCounts, 6000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  // Fetch Projects List
  useEffect(() => {
    const fetchProjects = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('project_members')
          .select('role, projects(id, name)')
          .eq('user_id', user.id);

        if (data) {
          const formatted = data
            .filter((i) => i.projects)
            .map((i) => ({
              id: i.projects.id,
              name: i.projects.name,
              role: i.role,
            }));
          setProjects(formatted);
        }
      }
    };
    fetchProjects();
  }, [currentUser]);

  // Fetch Live Governance Notifications for Active Project
  useEffect(() => {
    if (!activeProjectId || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      setNotifSummary({ pendingApprovals: 0, expiringGuarantees: 0, expiringPermits: 0, total: 0 });
      return;
    }

    let cancelled = false;
    const fetchAlerts = async () => {
      try {
        const in30Days = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
        const todayIso = new Date().toISOString().split('T')[0];

        const [cfRes, poRes, bgRes, hseRes] = await Promise.all([
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
        const pendingApprovals = (cfRes.count || 0) + (poRes.count || 0);
        const expiringGuarantees = bgRes.count || 0;
        const expiringPermits = hseRes.count || 0;
        setNotifSummary({
          pendingApprovals,
          expiringGuarantees,
          expiringPermits,
          total: pendingApprovals + expiringGuarantees + expiringPermits,
        });
      } catch {
        // Silent fallback when offline or table unavailable
      }
    };

    fetchAlerts();
    const timer = setInterval(fetchAlerts, 45000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [activeProjectId]);

  const activeProject = projects.find((p) => p.id === activeProjectId);
  const displayName =
    currentUser?.full_name ||
    currentUser?.user_metadata?.full_name ||
    (currentUser?.email ? currentUser.email.split('@')[0] : 'Pengguna');
  const displayRole =
    (globalRole && globalRole.toLowerCase() !== 'user' ? globalRole : null) ||
    projectRole ||
    activeProject?.role ||
    role ||
    'Member';

  const userInitials =
    displayName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase() || 'U';

  const handleSelectProject = (proj) => {
    selectProject(proj.id, proj.role);
    setIsDropdownOpen(false);
    window.location.href = '/dashboard';
  };

  const handleChooseTheme = (themeId, hexOverride) => {
    setActiveThemeId(themeId);
    if (hexOverride) setCustomHex(hexOverride);
    const res = applyExecutiveThemeToDom(themeId, hexOverride || customHex);
    setContrastInfo(res.contrast);
    window.dispatchEvent(
      new CustomEvent('app-toast', {
        detail: {
          type: 'info',
          title: 'Tema & Auto Warna Font Aktif',
          message: `${res.preset.name} diterapkan • Kontras WCAG ${res.contrast.contrastRatio}:1 (${res.contrast.isLightBackground ? 'Font Gelap Otomatis' : 'Font Putih Otomatis'}).`,
        },
      })
    );
  };

  const handleRetryFailedSync = async () => {
    setIsSyncing(true);
    try {
      await retryFailedSyncItems();
      const [counts, failed] = await Promise.all([
        getPendingOfflineCount(),
        getFailedSyncItems(),
      ]);
      setPendingSyncs(counts.total);
      setFailedSyncs(Array.isArray(failed) ? failed.length : 0);
      window.dispatchEvent(
        new CustomEvent('app-toast', {
          detail: { type: 'success', message: 'Sinkronisasi ulang antrean gagal selesai diproses.' },
        })
      );
    } catch {
      window.dispatchEvent(
        new CustomEvent('app-toast', {
          detail: { type: 'error', message: 'Sebagian antrean gagal belum dapat disinkronkan. Cek koneksi Anda.' },
        })
      );
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <header
      ref={headerRef}
      className="h-[72px] bg-white/88 backdrop-blur-xl border-b border-slate-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.03)] flex items-center justify-between px-6 sticky top-0 z-40 print:hidden transition-all"
    >
      <div className="flex items-center gap-4">
        <button
          onClick={toggleSidebar}
          className="p-2.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all"
          title="Buka/Tutup Menu Samping"
        >
          <Menu size={20} />
        </button>

        {/* PROJECT SWITCHER */}
        <div className="relative">
          <button
            onClick={() => {
              setIsDropdownOpen(!isDropdownOpen);
              setIsThemeOpen(false);
              setIsNotifOpen(false);
            }}
            className="flex items-center gap-2.5 px-3.5 py-2 bg-slate-50/90 hover:bg-white border border-slate-200/85 hover:border-slate-300 rounded-full transition-all group shadow-sm"
          >
            <div
              className="relative p-1.5 rounded-full transition-colors"
              style={{ backgroundColor: 'var(--brand-soft-bg)', color: 'var(--brand-accent)' }}
            >
              <Building2 size={14} />
              {activeProject && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-500 rounded-full ring-2 ring-white" />
              )}
            </div>
            <span className="text-sm font-bold text-slate-800 max-w-[210px] truncate">
              {activeProject ? activeProject.name : 'Pilih Proyek'}
            </span>
            <ChevronDown
              size={14}
              className={`text-slate-400 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {isDropdownOpen && (
            <div className="absolute left-0 mt-3 w-80 bg-white/98 backdrop-blur-xl rounded-2xl shadow-modal border border-slate-200/90 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="px-4 py-2 border-b border-slate-100 flex justify-between items-center">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Daftar Proyek Anda</span>
                <Link
                  href="/projects"
                  onClick={() => setIsDropdownOpen(false)}
                  className="text-xs font-bold hover:underline"
                  style={{ color: 'var(--brand-accent)' }}
                >
                  Lihat Semua
                </Link>
              </div>
              <div className="max-h-64 overflow-y-auto p-1.5">
                {projects.length === 0 ? (
                  <p className="text-xs text-slate-500 px-3 py-4 text-center italic">Belum ada proyek yang diikuti.</p>
                ) : (
                  projects.map((proj) => (
                    <button
                      key={proj.id}
                      onClick={() => handleSelectProject(proj)}
                      className={`w-full text-left px-3 py-2.5 rounded-xl transition-all flex flex-col mb-1 border ${
                        activeProjectId === proj.id
                          ? 'bg-slate-900/5 border-slate-200'
                          : 'border-transparent hover:bg-slate-50'
                      }`}
                    >
                      <span
                        className="font-bold text-sm truncate"
                        style={activeProjectId === proj.id ? { color: 'var(--brand-accent)' } : { color: '#334155' }}
                      >
                        {proj.name}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                        Role: {proj.role}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* --- INDIKATOR OFFLINE / FAILED SYNC RETRY --- */}
        {!isOnline ? (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-100 text-amber-800 rounded-full text-xs font-bold animate-pulse border border-amber-200">
            <WifiOff size={14} />
            <span className="hidden sm:inline">Offline {pendingSyncs > 0 && `(${pendingSyncs} antrean)`}</span>
          </div>
        ) : failedSyncs > 0 ? (
          <button
            type="button"
            onClick={handleRetryFailedSync}
            disabled={isSyncing}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-full text-xs font-bold border border-rose-200 transition-all"
            title="Klik untuk mengirim ulang data offline yang sempat gagal"
          >
            <AlertTriangle size={14} />
            <span className="hidden sm:inline">{isSyncing ? 'Mengirim ulang...' : `${failedSyncs} Sync Gagal (Ulangi)`}</span>
          </button>
        ) : pendingSyncs > 0 || isSyncing ? (
          <button
            type="button"
            onClick={() => {
              setIsSyncing(true);
              processSyncQueue().finally(() => setIsSyncing(false));
            }}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-xs font-bold border border-blue-200 hover:bg-blue-100"
          >
            <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">{isSyncing ? 'Sinkronisasi...' : `${pendingSyncs} data tertunda`}</span>
          </button>
        ) : null}

        {/* COMMAND PALETTE TRIGGER */}
        <button
          type="button"
          onClick={openSearch}
          className="relative hidden lg:flex items-center gap-2.5 pl-3.5 pr-3 py-2 bg-slate-100/70 hover:bg-slate-100 border border-slate-200/70 hover:border-slate-300 rounded-full text-sm transition-all w-64 text-slate-400 text-left"
        >
          <Search size={15} className="shrink-0 text-slate-400" />
          <span className="flex-1 truncate text-xs font-medium">Cari menu, task, WBS...</span>
          <kbd className="text-[10px] font-mono font-bold bg-white text-slate-500 border border-slate-200 px-1.5 py-0.5 rounded shadow-sm">
            Ctrl K
          </kbd>
        </button>

        {/* EXECUTIVE GRADIENT THEME & AUTO FONT CONTRAST SWITCHER */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setIsThemeOpen(!isThemeOpen);
              setIsNotifOpen(false);
              setIsDropdownOpen(false);
            }}
            title="Tema Degradasi & Auto Warna Font (WCAG)"
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-full transition-all flex items-center gap-1.5"
          >
            <span
              className="w-4 h-4 rounded-full ring-2 ring-white shadow-sm shrink-0"
              style={{ backgroundImage: 'var(--brand-gradient)' }}
            />
            <Palette size={17} className="hidden sm:block" />
          </button>

          {isThemeOpen && (
            <div className="absolute right-0 mt-3 w-80 bg-white/98 backdrop-blur-xl rounded-2xl shadow-modal border border-slate-200/90 p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles size={13} style={{ color: 'var(--brand-accent)' }} /> Tema Degradasi Eksekutif
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Auto Warna Font aktif (WCAG {contrastInfo.contrastRatio}:1)
                  </p>
                </div>
              </div>

              <div className="space-y-1.5 mb-3">
                {EXECUTIVE_THEMES.map((t) => {
                  const previewContrast = getAutoGradientContrast([t.from, t.via, t.to]);
                  const selected = activeThemeId === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => handleChooseTheme(t.id)}
                      className={`w-full flex items-center justify-between p-2 rounded-xl border transition-all text-left ${
                        selected ? 'border-slate-900 bg-slate-50 shadow-sm' : 'border-slate-100 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className="w-9 h-7 rounded-lg flex items-center justify-center text-[10px] font-extrabold shadow-sm shrink-0"
                          style={{
                            backgroundImage: `linear-gradient(135deg, ${t.from} 0%, ${t.via} 52%, ${t.to} 100%)`,
                            color: previewContrast.textColor,
                          }}
                        >
                          Aa
                        </span>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-800 truncate">{t.name}</div>
                          <div className="text-[10px] text-slate-500 truncate">{t.subtitle}</div>
                        </div>
                      </div>
                      {selected && <Check size={15} className="text-slate-900 shrink-0" />}
                    </button>
                  );
                })}
              </div>

              <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
                <label className="text-[11px] font-bold text-slate-600">Warna Brand Kustom:</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={customHex}
                    onChange={(e) => handleChooseTheme('custom', e.target.value)}
                    className="w-7 h-7 rounded-lg border border-slate-200 cursor-pointer p-0.5 bg-white"
                    title="Pilih warna brand bebas (Auto Warna Font otomatis menyesuaikan)"
                  />
                  <span className="font-mono text-[11px] font-bold text-slate-500 uppercase">{customHex}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <Link
          href="/sop"
          title="SOP & Panduan"
          className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-all hidden sm:block"
        >
          <HelpCircle size={19} />
        </Link>

        {/* LIVE ENTERPRISE NOTIFICATION BELL */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setIsNotifOpen(!isNotifOpen);
              setIsThemeOpen(false);
              setIsDropdownOpen(false);
            }}
            title="Pusat Notifikasi & Persetujuan"
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-full relative transition-all"
          >
            <Bell size={19} />
            {notifSummary.total > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-rose-600 text-white text-[10px] font-extrabold rounded-full flex items-center justify-center ring-2 ring-white">
                {notifSummary.total > 99 ? '99+' : notifSummary.total}
              </span>
            )}
          </button>

          {isNotifOpen && (
            <div className="absolute right-0 mt-3 w-80 bg-white/98 backdrop-blur-xl rounded-2xl shadow-modal border border-slate-200/90 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="px-4 py-3 bg-executive-gradient flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-wider">Pusat Kendali Notifikasi</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full badge-auto-contrast">
                  {notifSummary.total} Aktif
                </span>
              </div>
              <div className="p-2 space-y-1.5">
                <Link
                  href="/approvals"
                  onClick={() => setIsNotifOpen(false)}
                  className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <ShieldCheck size={16} className="text-indigo-600 shrink-0" />
                    <span className="text-xs font-bold text-slate-700">Persetujuan Tertunda</span>
                  </div>
                  <span className={`text-xs font-extrabold px-2 py-0.5 rounded-full ${notifSummary.pendingApprovals > 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-50 text-emerald-700'}`}>
                    {notifSummary.pendingApprovals}
                  </span>
                </Link>

                <Link
                  href={activeProjectId ? `/projects/${activeProjectId}/termin` : '/projects'}
                  onClick={() => setIsNotifOpen(false)}
                  className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <AlertTriangle size={16} className="text-amber-600 shrink-0" />
                    <span className="text-xs font-bold text-slate-700">Bank Garansi (&le; 30 Hari)</span>
                  </div>
                  <span className={`text-xs font-extrabold px-2 py-0.5 rounded-full ${notifSummary.expiringGuarantees > 0 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
                    {notifSummary.expiringGuarantees}
                  </span>
                </Link>

                <Link
                  href="/qhse"
                  onClick={() => setIsNotifOpen(false)}
                  className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <AlertTriangle size={16} className="text-rose-600 shrink-0" />
                    <span className="text-xs font-bold text-slate-700">HSE Permit Kedaluwarsa</span>
                  </div>
                  <span className={`text-xs font-extrabold px-2 py-0.5 rounded-full ${notifSummary.expiringPermits > 0 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
                    {notifSummary.expiringPermits}
                  </span>
                </Link>
              </div>
            </div>
          )}
        </div>

        <div className="h-6 w-px bg-slate-200 mx-0.5"></div>

        <Link href="/settings/security" className="flex items-center gap-3 cursor-pointer group" title="Profil & Keamanan 2FA">
          <div className="text-right hidden md:block">
            <div className="text-sm font-bold text-slate-800 group-hover:text-slate-950 transition-colors max-w-[155px] truncate">
              {displayName}
            </div>
            <div className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md mt-0.5 inline-block uppercase tracking-wider border border-slate-200 transition-colors">
              {displayRole}
            </div>
          </div>
          <div
            className="p-[2px] rounded-full shadow-sm group-hover:shadow-md group-hover:scale-[1.03] transition-all"
            style={{ backgroundImage: 'var(--brand-gradient)' }}
          >
            <div className="w-9 h-9 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-extrabold tracking-wider">
              {userInitials}
            </div>
          </div>
        </Link>
      </div>
    </header>
  );
}
