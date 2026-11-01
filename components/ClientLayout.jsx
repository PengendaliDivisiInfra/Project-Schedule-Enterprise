'use client';
import { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import CommandPalette from './CommandPalette';
import TopLoader from './TopLoader';
import { supabase } from '../lib/supabase';

export default function ClientLayout({ children }) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  
  // State User dengan Failsafe Default
  const [currentUser, setCurrentUser] = useState({ full_name: 'Admin User', role: 'owner' });

  useEffect(() => {
    const fetchUser = async () => {
      try {
        // Gunakan maybeSingle() agar tidak error 406 jika tabel kosong
        const { data, error } = await supabase.from('profiles').select('*').limit(1).maybeSingle();
        
        if (data && !error) {
          setCurrentUser(data);
        } else {
          console.warn("Profil tidak ditemukan atau error, menggunakan default Admin.");
        }
      } catch (err) {
        console.error("Gagal fetch profile:", err);
      }
    };
    fetchUser();

    const down = (e) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsSearchOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      <TopLoader />
      
      <Sidebar 
        isCollapsed={isSidebarCollapsed} 
        toggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)} 
        currentUser={currentUser}
      />
      <div className="flex flex-col flex-1 min-w-0">
        <Header 
          toggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)} 
          currentUser={currentUser}
          openSearch={() => setIsSearchOpen(true)}
        />
        <main className="flex-1 overflow-auto bg-slate-50 p-6">
          {children}
        </main>
      </div>

      <CommandPalette 
        isOpen={isSearchOpen} 
        setIsOpen={setIsSearchOpen} 
        currentUser={currentUser} 
      />
    </div>
  );
}
