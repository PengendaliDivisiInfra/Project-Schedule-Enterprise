'use client';
import { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import CommandPalette from './CommandPalette';
import TopLoader from './TopLoader';
import { supabase } from '../lib/supabase';
import { useProject } from '../context/ProjectContext';

export default function ClientLayout({ children }) {
  const { activeProjectId } = useProject();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);

  useEffect(() => {
    let active = true;

    const fetchAuthenticatedProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !active) return;

        const { data: profile } = await supabase
          .from('profiles')
          .select('id, full_name, email, role, global_role')
          .eq('id', user.id)
          .maybeSingle();

        if (!active) return;
        const fallbackName =
          profile?.full_name ||
          user.user_metadata?.full_name ||
          (user.email ? user.email.split('@')[0] : 'Pengguna');

        setCurrentUser({
          id: user.id,
          email: profile?.email || user.email || '',
          full_name: fallbackName,
          role: profile?.role || 'User',
          global_role: profile?.global_role || profile?.role || 'User',
        });
      } catch {
        // Mode offline: biarkan state aman tanpa crash
      }
    };

    fetchAuthenticatedProfile();

    const { data: authSub } = supabase.auth.onAuthStateChange(() => {
      fetchAuthenticatedProfile();
    });

    const down = (e) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsSearchOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', down);

    return () => {
      active = false;
      document.removeEventListener('keydown', down);
      authSub?.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!currentUser?.id) return;

    const channel = supabase.channel('room:app', {
      config: { presence: { key: currentUser.id } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const users = Object.values(state).flat();
        setOnlineUsers(users);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            id: currentUser.id,
            full_name: currentUser.full_name,
            role: currentUser.global_role || currentUser.role,
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser?.id, currentUser?.full_name, currentUser?.global_role, currentUser?.role]);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      <TopLoader />

      <Sidebar
        activeProjectId={activeProjectId}
        isCollapsed={isSidebarCollapsed}
        toggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        currentUser={currentUser}
      />

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

      <CommandPalette
        isOpen={isSearchOpen}
        setIsOpen={setIsSearchOpen}
        currentUser={currentUser}
        activeProjectId={activeProjectId}
      />
    </div>
  );
}
