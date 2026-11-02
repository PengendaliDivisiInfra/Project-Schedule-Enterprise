'use client';
import { useState } from 'react';
import { X, Printer, FileText, Layout } from 'lucide-react';

export default function PrintSetupModal({ isOpen, onClose, onPrint, defaultSettings }) {
  const [settings, setSettings] = useState(defaultSettings || {
    orientation: 'landscape',
    paperSize: 'A4',
    scale: 100,
    timescale: 'mingguan',
    startDate: '',
    endDate: '',
    showLegend: true,
    showSignature: true,
    columns: {
      id: false, wbs: true, name: true, duration: true, start: true, finish: true,
      priority: false, pred: true, slack: false, critical: true, cost: true,
      alert: false, volume: true, satuan: true, tgtHr: true
    },
    signatures: {
      created: { title: 'Dibuat Oleh', name: '', role: 'Site Engineer', instansi: 'Kontraktor' },
      checked: { title: 'Diperiksa Oleh', name: '', role: 'Tim Leader', instansi: 'Konsultan Supervisi' },
      approved: { title: 'Disetujui Oleh', name: '', role: 'Direksi', instansi: 'Instansi' }
    }
  });

  const toggleColumn = (col) => {
    setSettings(prev => ({
      ...prev,
      columns: { ...prev.columns, [col]: !prev.columns[col] }
    }));
  };

  const handleSignatureChange = (type, field, value) => {
    setSettings(prev => ({
      ...prev,
      signatures: {
        ...prev.signatures,
        [type]: { ...prev.signatures[type], [field]: value }
      }
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in print-hidden">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden animate-scale-in flex flex-col max-h-[90vh]">
        
        {/* HEADER */}
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Printer size={18}/> Print Setup</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={20} /></button>
        </div>

        {/* BODY (Scrollable) */}
        <div className="p-6 overflow-y-auto space-y-6">
          
          {/* KERTAS & LAYOUT */}
          <div>
            <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2"><Layout size={16}/> Kertas & Layout</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Orientasi</label>
                <select value={settings.orientation} onChange={e => setSettings({...settings, orientation: e.target.value})} className="w-full border border-slate-300 p-2 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white">
                  <option value="portrait">Portrait</option>
                  <option value="landscape">Landscape</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Ukuran Kertas</label>
                <select value={settings.paperSize} onChange={e => setSettings({...settings, paperSize: e.target.value})} className="w-full border border-slate-300 p-2 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white">
                  <option value="A4">A4</option>
                  <option value="A3">A3</option>
                  <option value="Legal">Legal</option>
                </select>
              </div>
            </div>
          </div>

          {/* SKALA WAKTU */}
          <div>
            <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2"><FileText size={16}/> Skala Waktu & Filter</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Timescale</label>
                <select value={settings.timescale} onChange={e => setSettings({...settings, timescale: e.target.value})} className="w-full border border-slate-300 p-2 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white">
                  <option value="harian">Harian</option>
                  <option value="mingguan">Mingguan</option>
                  <option value="bulanan">Bulanan</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Dari Tanggal</label>
                <input type="date" value={settings.startDate} onChange={e => setSettings({...settings, startDate: e.target.value})} className="w-full border border-slate-300 p-2 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Sampai Tanggal</label>
                <input type="date" value={settings.endDate} onChange={e => setSettings({...settings, endDate: e.target.value})} className="w-full border border-slate-300 p-2 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
            </div>
            <div className="flex gap-4 mt-3">
              <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                <input type="checkbox" checked={settings.showLegend} onChange={e => setSettings({...settings, showLegend: e.target.checked})} className="w-4 h-4 accent-indigo-600" /> Legend
              </label>
              <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                <input type="checkbox" checked={settings.showSignature} onChange={e => setSettings({...settings, showSignature: e.target.checked})} className="w-4 h-4 accent-indigo-600" /> Tanda Tangan
              </label>
            </div>
          </div>

          {/* KOLOM YANG DICETAK */}
          <div>
            <h3 className="text-sm font-bold text-slate-700 mb-3">Kolom yang Dicetak</h3>
            <div className="grid grid-cols-3 gap-2 bg-slate-50 p-4 rounded-lg border border-slate-200">
              {[
                { key: 'id', label: 'ID' }, { key: 'wbs', label: 'WBS' }, { key: 'name', label: 'Task Name' },
                { key: 'duration', label: 'Duration' }, { key: 'start', label: 'Start' }, { key: 'finish', label: 'Finish' },
                { key: 'priority', label: 'Priority' }, { key: 'pred', label: 'Predecessors' }, { key: 'cost', label: 'Cost' },
                { key: 'slack', label: 'Total Slack' }, { key: 'critical', label: 'Critical' }, { key: 'alert', label: 'Alert' },
                { key: 'volume', label: 'Volume', custom: true }, { key: 'satuan', label: 'Satuan', custom: true }, { key: 'tgtHr', label: 'Tgt/hr', custom: true }
              ].map(col => (
                <label key={col.key} className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <input type="checkbox" checked={settings.columns[col.key]} onChange={() => toggleColumn(col.key)} className="w-3.5 h-3.5 accent-indigo-600" />
                  {col.label} {col.custom && <span className="text-[9px] text-indigo-400 bg-indigo-50 px-1 rounded">(custom)</span>}
                </label>
              ))}
            </div>
          </div>

          {/* KOLOM TANDA TANGAN */}
          <div>
            <h3 className="text-sm font-bold text-slate-700 mb-3">Kolom Tanda Tangan</h3>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 font-bold">
                  <tr>
                    <th className="p-2 border-b">Peran</th>
                    <th className="p-2 border-b">Nama</th>
                    <th className="p-2 border-b">Jabatan</th>
                    <th className="p-2 border-b">Instansi</th>
                  </tr>
                </thead>
                <tbody>
                  {['created', 'checked', 'approved'].map(type => (
                    <tr key={type} className="border-b last:border-0">
                      <td className="p-2 font-semibold text-slate-700">{settings.signatures[type].title}</td>
                      <td className="p-2"><input type="text" value={settings.signatures[type].name} onChange={e => handleSignatureChange(type, 'name', e.target.value)} placeholder="Nama" className="w-full border border-slate-300 rounded p-1 outline-none focus:border-indigo-500" /></td>
                      <td className="p-2"><input type="text" value={settings.signatures[type].role} onChange={e => handleSignatureChange(type, 'role', e.target.value)} className="w-full border border-slate-300 rounded p-1 outline-none focus:border-indigo-500" /></td>
                      <td className="p-2"><input type="text" value={settings.signatures[type].instansi} onChange={e => handleSignatureChange(type, 'instansi', e.target.value)} className="w-full border border-slate-300 rounded p-1 outline-none focus:border-indigo-500" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm font-bold text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors">Batal</button>
          <button onClick={() => onPrint(settings)} className="px-6 py-2 text-sm font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-md transition-colors flex items-center gap-2">
            <Printer size={16} /> Cetak / Simpan PDF
          </button>
        </div>
      </div>
    </div>
  );
}
