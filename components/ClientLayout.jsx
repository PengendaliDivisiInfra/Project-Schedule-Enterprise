'use client';
import { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import { supabase } from '../lib/supabase';

export default function ClientLayout({ children }) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    // Simulasi mengambil data user dari tabel profiles
    // Di production, ini harusnya mengambil dari Supabase Auth (auth.getUser())
    const fetchUser = async () => {
      const { data } = await supabase.from('profiles').select('*').limit(1).single();
      if (data) {
        setCurrentUser(data);
      } else {
        // Fallback jika database kosong
        setCurrentUser({ full_name: 'Admin User', role: 'owner' });
      }
    };
    fetchUser();
  }, []);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      <Sidebar 
        isCollapsed={isSidebarCollapsed} 
        toggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)} 
        currentUser={currentUser}
      />
      <div className="flex flex-col flex-1 min-w-0">
        <Header 
          toggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)} 
          currentUser={currentUser} 
        />
        <main className="flex-1 overflow-auto bg-slate-50 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
