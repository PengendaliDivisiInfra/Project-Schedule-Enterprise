'use client';
import { useState } from 'react';
import Sidebar from './Sidebar';
import { Menu, X } from 'lucide-react';

export default function ClientLayout({ children }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <div className="flex bg-gray-50 h-screen overflow-hidden">
      {/* Sidebar Container */}
      <div className={`transition-all duration-300 ease-in-out shrink-0 ${isSidebarOpen ? 'w-64' : 'w-0'} overflow-hidden`}>
        <Sidebar />
      </div>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        {/* Toggle Button */}
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="absolute top-4 left-4 z-50 bg-white p-2 rounded-md shadow-md border border-gray-200 text-gray-700 hover:bg-gray-100 transition-colors"
          title={isSidebarOpen ? "Hide Sidebar" : "Show Sidebar"}
        >
          {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>

        <div className="flex-1 overflow-y-auto p-4 pt-16">
          {children}
        </div>
      </main>
    </div>
  );
}
