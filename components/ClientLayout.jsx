'use client';
import { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import CommandPalette from './CommandPalette';
import TopLoader from './TopLoader';
import { supabase } from '../lib/supabase';

export default function ClientLayout({ children }) {
  // State untuk hide/show sidebar
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [currentUser, setCurrentUser] = useState({ full_name: 'Admin User', role: 'owner' });
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);

  useEffect(() => {
    const fetchUser = async () => {
      const { data } = await supabase.from('profiles').select('*').limit(1).maybeSingle();
      if (data) setCurrentUser(data);
    };
    fetchUser();

    const channel = supabase.channel('room:app', { config: { presence: { key: 'user-1' } } });
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      const users = Object.values(state).flat();
      setOnlineUsers(users);
    }).subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ full_name: currentUser.full_name, role: currentUser.role });
      }
    });

    const down = (e) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsSearchOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', down);
    
    return () => { 
      document.removeEventListener('keydown', down); 
      supabase.removeChannel(channel);
    };
  }, [currentUser.full_name, currentUser.role]);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      <TopLoader />
      
      {/* Sidebar menerima state isCollapsed */}
      <Sidebar 
        isCollapsed={isSidebarCollapsed} 
        toggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)} 
        currentUser={currentUser} 
      />
      
      {/* FIX: Margin Dinamis (ml-20 jika collapsed, ml-64 jika terbuka) + Animasi */}
      <div 
        className={`flex flex-col flex-1 min-w-0 transition-all duration-300 ease-in-out print:ml-0 ${
          isSidebarCollapsed ? 'ml-20' : 'ml-64'
        }`}
      >
        <Header 
          toggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)} 
          currentUser={currentUser} 
          openSearch={() => setIsSearchOpen(true)} 
          onlineUsers={onlineUsers} 
        />
        <main className="flex-1 overflow-auto bg-slate-50 p-6 print:p-0">
          {children}
        </main>
      </div>
      
      <CommandPalette isOpen={isSearchOpen} setIsOpen={setIsSearchOpen} currentUser={currentUser} />
    </div>
  );
}