'use client';

import React from 'react';
import { Check } from 'lucide-react';

interface WorkflowStepperProps {
  currentStep: number;
}

const STEPS = [
  { id: 1, name: 'SPK & Kontrak' },
  { id: 2, name: 'Fisik (BPUTK)' },
  { id: 3, name: 'BAPP / BAOP' },
  { id: 4, name: 'Kwitansi' },
  { id: 5, name: 'Pembayaran' },
];

export function WorkflowStepper({ currentStep }: WorkflowStepperProps) {
  if (currentStep === 0) return null;

  return (
    <div className="w-full bg-white border border-slate-200 rounded-2xl p-5 shadow-sm mb-6 print:hidden">
      <div className="flex items-center justify-between relative max-w-4xl mx-auto">
        {/* Garis Background */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1.5 bg-slate-100 -z-10 rounded-full"></div>

        {STEPS.map((step) => {
          // LOGIC FIX: active selalu menang atas completed
          const isActive = step.id === currentStep;
          const isCompleted = step.id < currentStep;

          return (
            <div key={step.id} className="flex flex-col items-center gap-2 relative z-10 bg-white px-3">
              <div 
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-500 border-2
                  ${isActive ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200 scale-110' : 
                    isCompleted ? 'bg-emerald-500 border-emerald-500 text-white shadow-md shadow-emerald-200' : 
                    'bg-slate-50 border-slate-200 text-slate-400'}
                `}
              >
                {isCompleted && !isActive ? <Check size={18} strokeWidth={3} /> : step.id}
              </div>
              <span className={`text-[11px] font-bold uppercase tracking-wider text-center ${
                isActive ? 'text-indigo-700' : 
                isCompleted ? 'text-emerald-600' : 'text-slate-400'
              }`}>
                {step.name}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}