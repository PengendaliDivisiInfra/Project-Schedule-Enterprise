'use client';
import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { Users, Calculator, Search, Plus, Edit, Trash2, BookOpen, ChevronDown, ChevronRight } from 'lucide-react';

export default function ResourcesPage() {
  const [activeTab, setActiveTab] = useState('master'); 
  const [resources, setResources] = useState([]);
  const [planData, setPlanData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFormula, setShowFormula] = useState(false); 

  // State untuk Collapsible Groups
  const [expandedGroups, setExpandedGroups] = useState({
    'Tenaga Kerja': true,
    'Alat': true,
    'Bahan': true
  });

  const toggleGroup = (groupName) => {
    setExpandedGroups(prev => ({ ...prev, [groupName]: !prev[groupName] }));
  };

  useEffect(() => {
    if (activeTab === 'master') fetchResources();
    else fetchPlanData();
  }, [activeTab]);

  const fetchResources = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('project_resources').select('*').order('name');
    if (data) setResources(data);
    if (error) console.error(error);
    setLoading(false);
  };

  const fetchPlanData = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('v_resource_requirements').select('*').order('wbs_code');
    if (data) setPlanData(data);
    if (error) console.error(error);
    setLoading(false);
  };

  const formatRp = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(num || 0);

  // === LOGIKA GROUPING MASTER DATA ===
  const groupedResources = useMemo(() => {
    const filtered = resources.filter(r => 
      r.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      r.role?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    const groups = { 'Tenaga Kerja': [], 'Alat': [] };
    filtered.forEach(r => {
      const roleText = (r.role || '').toLowerCase();
      const alatKeywords = ['excavator', 'dump truck', 'crane', 'bulldozer', 'vibrator', 'alat berat', 'batching plant', 'truck', 'pump'];
      const isAlat = alatKeywords.some(k => roleText.includes(k)) && !roleText.includes('operator');
      
      if (isAlat) groups['Alat'].push(r);
      else groups['Tenaga Kerja'].push(r);
    });
    return groups;
  }, [resources, searchTerm]);

  // === LOGIKA GROUPING REQUIREMENT PLAN ===
  const groupedPlan = useMemo(() => {
    const filtered = planData.filter(d => 
      d.resource_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.task_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    const groups = { 'Tenaga Kerja': [], 'Alat': [], 'Bahan': [] };
    filtered.forEach(d => {
      const type = d.resource_type || 'Lainnya';
      if (!groups[type]) groups[type] = [];
      groups[type].push(d);
    });
    return groups;
  }, [planData, searchTerm]);

  // Helper untuk warna header group
  const getGroupColor = (groupName) => {
    switch(groupName) {
      case 'Tenaga Kerja': return 'text-green-700 bg-green-50 border-green-200';
      case 'Alat': return 'text-amber-700 bg-amber-50 border-amber-200';
      case 'Bahan': return 'text-blue-700 bg-blue-50 border-blue-200';
      default: return 'text-slate-700 bg-slate-50 border-slate-200';
    }
  };

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        
        {/* Header & Tabs (Sama seperti sebelumnya) */}
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex justify-between items-end">
            <div>
              <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <Users className="text-indigo-600" /> Resource Management
              </h1>
              <p className="text-sm text-slate-500 mt-1">Kelola Master Data dan Kalkulasi Resource berdasarkan AHSP.</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" placeholder={activeTab === 'master' ? "Cari resource..." : "Cari pekerjaan/material..."}
                  value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 w-72 shadow-sm"
                />
              </div>
              {activeTab === 'master' && (
                <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 shadow-sm">
                  <Plus className="w-4 h-4" /> Tambah
                </button>
              )}
            </div>
          </div>

          <div className="flex gap-2 border-b border-slate-200">
            <button onClick={() => { setActiveTab('master'); setSearchTerm(''); }} className={`px-4 py-2 text-sm font-semibold border-b-2 ${activeTab === 'master' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500'}`}>
              Master Data
            </button>
            <button onClick={() => { setActiveTab('plan'); setSearchTerm(''); }} className={`px-4 py-2 text-sm font-semibold border-b-2 flex items-center gap-2 ${activeTab === 'plan' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500'}`}>
              <Calculator className="w-4 h-4" /> Requirement Plan (AHSP)
            </button>
          </div>
        </div>

        {/* Content: MASTER DATA (Grouped) */}
        {activeTab === 'master' && (
          <div className="space-y-6">
            {Object.entries(groupedResources).map(([groupName, items]) => {
              if (items.length === 0) return null;
              const isExpanded = expandedGroups[groupName];
              
              return (
                <div key={groupName} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  {/* Group Header */}
                  <button 
                    onClick={() => toggleGroup(groupName)}
                    className={`w-full flex items-center justify-between px-5 py-3 border-b ${getGroupColor(groupName)} transition-colors`}
                  >
                    <div className="flex items-center gap-2 font-bold text-sm">
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      {groupName} 
                      <span className="px-2 py-0.5 rounded-full bg-white/50 text-[10px] ml-2 border border-current/20">{items.length} Item</span>
                    </div>
                  </button>
                  
                  {/* Table Data */}
                  {isExpanded && (
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                          <th className="p-4 font-bold w-1/3">Nama Kelompok / Tipe</th>
                          <th className="p-4 font-bold w-1/3">Role / Jabatan</th>
                          <th className="p-4 font-bold text-right">Biaya Harian</th>
                          <th className="p-4 font-bold text-center">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-sm">
                        {items.map((r) => (
                          <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-4 font-semibold text-slate-800 flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200">
                                {groupName === 'Alat' ? '🚜' : '👷'}
                              </div>
                              {r.name}
                            </td>
                            <td className="p-4 text-slate-600">{r.role}</td>
                            <td className="p-4 text-right font-mono text-slate-700 font-semibold">{formatRp(r.daily_rate)}</td>
                            <td className="p-4 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <button className="text-blue-600 hover:text-blue-800 p-1"><Edit className="w-4 h-4" /></button>
                                <button className="text-red-600 hover:text-red-800 p-1"><Trash2 className="w-4 h-4" /></button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Content: REQUIREMENT PLAN (Grouped) */}
        {activeTab === 'plan' && (
          <div className="space-y-6">
            
            {/* Panel Formula */}
            <div className="bg-white border border-indigo-100 rounded-xl shadow-sm overflow-hidden">
              <button onClick={() => setShowFormula(!showFormula)} className="w-full flex items-center justify-between px-5 py-3 bg-indigo-50/50 hover:bg-indigo-50 transition-colors">
                <div className="flex items-center gap-2 text-indigo-700 font-semibold text-sm">
                  <BookOpen className="w-4 h-4" /> Standar Formula Kalkulasi (PMBOK / Permen PUPR)
                </div>
                {showFormula ? <ChevronDown className="w-4 h-4 text-indigo-500" /> : <ChevronRight className="w-4 h-4 text-indigo-500" />}
              </button>
              
              {showFormula && (
                <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-600 border-t border-indigo-100">
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <strong className="text-indigo-600 block mb-1">A. Total Resource (TR)</strong>
                    <code className="bg-white px-2 py-1 rounded border border-slate-200 font-mono text-[11px] block mb-2">TR = Volume (V) × Koefisien (K)</code>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <strong className="text-indigo-600 block mb-1">B. Labor Demand (Man-Hours)</strong>
                    <code className="bg-white px-2 py-1 rounded border border-slate-200 font-mono text-[11px] block mb-2">Daily = (TR × 8 jam) / Durasi (Hari)</code>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <strong className="text-indigo-600 block mb-1">C. Material Supply Rate</strong>
                    <code className="bg-white px-2 py-1 rounded border border-slate-200 font-mono text-[11px] block mb-2">TMA = (V × K) × (1 + Waste 5%)</code>
                    <code className="bg-white px-2 py-1 rounded border border-slate-200 font-mono text-[11px] block mt-1">Delivery = TMA / (Durasi / 7 hari)</code>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <strong className="text-indigo-600 block mb-1">D. Equipment Scheduling</strong>
                    <code className="bg-white px-2 py-1 rounded border border-slate-200 font-mono text-[11px] block mb-2">Kapasitas = (V × K) / (Durasi × Efisiensi 0.85)</code>
                  </div>
                </div>
              )}
            </div>

            {/* Grouped Table */}
            {Object.entries(groupedPlan).map(([groupName, items]) => {
              if (items.length === 0) return null;
              const isExpanded = expandedGroups[groupName];
              
              return (
                <div key={groupName} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  <button 
                    onClick={() => toggleGroup(groupName)}
                    className={`w-full flex items-center justify-between px-5 py-3 border-b ${getGroupColor(groupName)} transition-colors`}
                  >
                    <div className="flex items-center gap-2 font-bold text-sm">
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      {groupName}
                      <span className="px-2 py-0.5 rounded-full bg-white/50 text-[10px] ml-2 border border-current/20">{items.length} Item</span>
                    </div>
                  </button>
                  
                  {isExpanded && (
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                          <th className="p-4 font-bold">WBS / Pekerjaan</th>
                          <th className="p-4 font-bold">Resource / Material</th>
                          <th className="p-4 font-bold text-center">Vol</th>
                          <th className="p-4 font-bold text-center">Durasi</th>
                          <th className="p-4 font-bold text-center">Koefisien</th>
                          <th className="p-4 font-bold text-center bg-indigo-50 text-indigo-700">Total (TR)</th>
                          <th className="p-4 font-bold text-center bg-emerald-50 text-emerald-700">Kebutuhan Harian/Mgg</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-sm">
                        {items.map((d, i) => {
                          const isBahan = d.resource_type === 'Bahan';
                          const isAlat = d.resource_type === 'Alat';
                          const unitLabel = isBahan ? `${d.unit}/mgg` : 'Jam/hr';

                          return (
                            <tr key={i} className="hover:bg-slate-50 transition-colors">
                              <td className="p-4">
                                <div className="font-semibold text-slate-700">{d.task_name}</div>
                                <div className="text-[10px] text-slate-400 font-mono">{d.wbs_code}</div>
                              </td>
                              <td className="p-4 font-medium text-slate-800">{d.resource_name}</td>
                              <td className="p-4 text-center font-mono">{d.volume}</td>
                              <td className="p-4 text-center font-mono">{d.duration} hr</td>
                              <td className="p-4 text-center font-mono text-slate-500">{d.koefisien}</td>
                              <td className="p-4 text-center font-mono font-bold text-indigo-700 bg-indigo-50/50">
                                {Number(d.total_requirement || 0).toFixed(2)} <span className="text-[10px] font-normal">{d.unit}</span>
                              </td>
                              <td className="p-4 text-center font-mono font-bold text-emerald-700 bg-emerald-50/50">
                                {Number(d.daily_requirement || 0).toFixed(2)} <span className="text-[10px] font-normal">{unitLabel}</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}