'use client';
import { Menu, Search, Bell, ChevronDown, UserCircle } from 'lucide-react';
import { useState } from 'react';

export default function Header({ toggleSidebar, currentUser, openSearch }) {
  const [showProfile, setShowProfile] = useState(false);

  const roleColors = {
    owner: 'bg-amber-100 text-amber-800 border-amber-300',
    admin: 'bg-blue-100 text-blue-800 border-blue-300',
    pelaksana: 'bg-green-100 text-green-800 border-green-300'
  };

  return (
    <header className="h-[64px] bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-30 relative shadow-sm">
      <div className="flex items-center gap-4">
        <button onClick={toggleSidebar} className="p-2 hover:bg-slate-100 rounded-md transition-colors text-slate-500">
          <Menu size={20} />
        </button>
        
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-md cursor-pointer hover:bg-slate-100 transition-colors">
          <span className="text-sm font-semibold text-slate-700">Proyek Jembatan Cisomang</span>
          <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold uppercase">Aktif</span>
          <ChevronDown size={14} className="text-slate-400" />
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Search Trigger (Membuka Command Palette) */}
        <button 
          onClick={openSearch}
          className="relative hidden md:flex items-center text-left w-64 bg-slate-100 hover:bg-slate-200 border border-transparent transition-colors px-3 py-1.5 rounded-md"
        >
          <Search size={16} className="text-slate-400 mr-2" />
          <span className="text-sm text-slate-400 flex-1">Cari task, material...</span>
          <kbd className="hidden sm:inline-block bg-white border border-slate-300 text-slate-500 text-[10px] font-mono px-1.5 py-0.5 rounded shadow-sm">Ctrl K</kbd>
        </button>

        <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-full relative">
          <Bell size={20} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
        </button>

        <div className="h-6 w-px bg-slate-200 mx-1"></div>

        <div className="relative">
          <button 
            onClick={() => setShowProfile(!showProfile)}
            className="flex items-center gap-3 hover:bg-slate-50 p-1.5 rounded-lg transition-colors"
          >
            <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center text-slate-500">
              <UserCircle size={24} />
            </div>
            <div className="hidden md:block text-left">
              <p className="text-sm font-bold text-slate-800 leading-tight">{currentUser?.full_name || 'Loading...'}</p>
              <span className={`text-[10px] px-1.5 py-0.5 rounded border font-bold uppercase ${roleColors[currentUser?.role] || roleColors.pelaksana}`}>
                {currentUser?.role || 'Guest'}
              </span>
            </div>
          </button>

          {showProfile && (
            <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-lg shadow-xl py-1 z-50 animate-fade-in">
              <div className="px-4 py-2 border-b border-slate-100">
                <p className="text-xs text-slate-500">Signed in as</p>
                <p className="text-sm font-bold text-slate-800 truncate">{currentUser?.full_name}</p>
              </div>
              <button className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">Account Settings</button>
              <button className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 font-medium">Sign Out</button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
