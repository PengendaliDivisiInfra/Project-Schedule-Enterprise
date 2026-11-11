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
      color: 'text-blue-600 bg-blue-100'
    },
    {
      icon: ShoppingCart,
      title: '2. Purchase Order',
      desc: 'Buat PO ke Vendor. Pantau progress pengiriman barang secara real-time.',
      color: 'text-indigo-600 bg-indigo-100'
    },
    {
      icon: Truck,
      title: '3. Penerimaan Barang',
      desc: 'Catat kedatangan barang via Surat Jalan. Stok gudang otomatis bertambah.',
      color: 'text-amber-600 bg-amber-100'
    },
    {
      icon: Box,
      title: '4. Stok Gudang',
      desc: 'Monitor sisa stok fisik, batas minimum, dan pemakaian harian di lapangan.',
      color: 'text-emerald-600 bg-emerald-100'
    }
  ];

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm mb-6 overflow-hidden transition-all duration-300">
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className="w-full flex justify-between items-center p-4 bg-slate-50 hover:bg-slate-100 transition-colors"
      >
        <div className="flex items-center gap-2 text-slate-800 font-bold">
          <Info className="w-5 h-5 text-blue-600" />
          Alur Kerja Material Management (Enterprise Guide)
        </div>
        {isOpen ? <ChevronUp className="w-5 h-5 text-slate-500" /> : <ChevronDown className="w-5 h-5 text-slate-500" />}
      </button>
      
      {isOpen && (
        <div className="p-4 grid grid-cols-1 md:grid-cols-4 gap-4 animate-in fade-in slide-in-from-top-2">
          {steps.map((step, idx) => (
            <div key={idx} className="flex flex-col gap-3 p-4 rounded-lg border border-slate-100 bg-white hover:shadow-md transition-shadow relative">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${step.color}`}>
                <step.icon className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-slate-800 text-sm">{step.title}</h4>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">{step.desc}</p>
              </div>
              {/* Garis penghubung antar step (kecuali step terakhir) */}
              {idx < steps.length - 1 && (
                <div className="hidden md:block absolute top-1/2 -right-3 w-6 border-t-2 border-dashed border-slate-300 z-10"></div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}