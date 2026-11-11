"use client";
import { useState } from 'react';
import { ClipboardList, ShoppingCart, Truck, Box, ChevronDown, ChevronUp, Info } from 'lucide-react';

export function MaterialFlowGuide() {
  const [isOpen, setIsOpen] = useState(true);

  const steps = [
    {
      icon: ClipboardList,
      title: '1. Requirement Plan',
      desc: 'Sistem kalkulasi otomatis kebutuhan material dari progres WBS & AHSP.',
      color: 'text-blue-600 bg-blue-50 border-blue-200',
      line: 'bg-blue-200'
    },
    {
      icon: ShoppingCart,
      title: '2. Purchase Order',
      desc: 'Buat PO ke Vendor. Pantau progress pengiriman barang secara real-time.',
      color: 'text-indigo-600 bg-indigo-50 border-indigo-200',
      line: 'bg-indigo-200'
    },
    {
      icon: Truck,
      title: '3. Penerimaan Barang',
      desc: 'Catat kedatangan barang via Surat Jalan. Stok gudang otomatis bertambah.',
      color: 'text-amber-600 bg-amber-50 border-amber-200',
      line: 'bg-amber-200'
    },
    {
      icon: Box,
      title: '4. Stok Gudang',
      desc: 'Monitor sisa stok fisik, batas minimum, dan pemakaian harian di lapangan.',
      color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
      line: 'bg-emerald-200'
    }
  ];

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm mb-6 overflow-hidden transition-all duration-300">
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className="w-full flex justify-between items-center p-5 bg-slate-50/50 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2 text-slate-800 font-bold">
          <div className="p-1.5 bg-blue-100 text-blue-600 rounded-lg"><Info className="w-4 h-4" /></div>
          Alur Kerja Material Management
        </div>
        {isOpen ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
      </button>
      
      {isOpen && (
        <div className="p-6 grid grid-cols-1 md:grid-cols-4 gap-6 animate-in fade-in slide-in-from-top-2 duration-300 relative">
          {/* Garis penghubung horizontal di belakang */}
          <div className="hidden md:block absolute top-[4.5rem] left-[10%] right-[10%] h-0.5 bg-slate-100 z-0"></div>

          {steps.map((step, idx) => (
            <div key={idx} className="flex flex-col gap-3 p-4 rounded-xl border border-slate-100 bg-white hover:shadow-md hover:border-slate-200 transition-all relative z-10 group">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${step.color} shadow-sm group-hover:scale-110 transition-transform`}>
                <step.icon className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-slate-800 text-sm">{step.title}</h4>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}