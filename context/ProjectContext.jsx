'use client';
import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const ProjectContext = createContext({
  activeProjectId: null,
  userRole: null,
  projects: [],
  selectProject: () => {},
});

export function ProjectProvider({ children }) {
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [projects, setProjects] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let active = true;

    // 1. Ambil dari Cache Lokal dulu agar respons instan & aman saat offline
    const savedProject = localStorage.getItem('activeProjectId');
    const savedRole = localStorage.getItem('userRole');
    const cachedProjects = localStorage.getItem('cachedProjects');

    if (savedProject) setActiveProjectId(savedProject);
    if (savedRole) setUserRole(savedRole);
    if (cachedProjects) {
      try {
        setProjects(JSON.parse(cachedProjects));
      } catch (e) {}
    }

    setIsLoaded(true);

    // 2. Fetch daftar proyek milik user yang sedang login (mencegah duplikat lintas anggota tim)
    const fetchUserProjects = async () => {
      if (typeof window === 'undefined' || !navigator.onLine) return;
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user || !active) return;

        const { data } = await supabase
          .from('project_members')
          .select('role, projects(id, name)')
          .eq('user_id', user.id);

        if (!active || !data) return;

        // Deduplikasi berdasarkan project.id agar daftar proyek selalu unik
        const projectMap = new Map();
        data
          .filter((i) => i.projects && i.projects.id)
          .forEach((i) => {
            if (!projectMap.has(i.projects.id)) {
              projectMap.set(i.projects.id, {
                id: i.projects.id,
                name: i.projects.name,
                role: i.role,
              });
            }
          });

        const formatted = Array.from(projectMap.values());
        setProjects(formatted);
        localStorage.setItem('cachedProjects', JSON.stringify(formatted));

        // Jika belum ada proyek terpilih (atau proyek cache tidak lagi dimiliki user ini), pilih proyek pertama yang sah
        const currentSaved = localStorage.getItem('activeProjectId');
        const matched = formatted.find((p) => p.id === currentSaved);
        if (!matched && formatted.length > 0) {
          const firstProj = formatted[0];
          setActiveProjectId(firstProj.id);
          setUserRole(firstProj.role);
          localStorage.setItem('activeProjectId', firstProj.id);
          localStorage.setItem('userRole', firstProj.role);
        } else if (matched && matched.role !== localStorage.getItem('userRole')) {
          setUserRole(matched.role);
          localStorage.setItem('userRole', matched.role);
        }
      } catch (err) {
        console.error('Gagal memuat daftar proyek pengguna:', err);
      }
    };

    fetchUserProjects();

    const { data: authSub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        fetchUserProjects();
      } else if (event === 'SIGNED_OUT') {
        setProjects([]);
        setActiveProjectId(null);
        setUserRole(null);
        localStorage.removeItem('cachedProjects');
        localStorage.removeItem('activeProjectId');
        localStorage.removeItem('userRole');
      }
    });

    return () => {
      active = false;
      authSub?.subscription?.unsubscribe();
    };
  }, []);

  const selectProject = (id, role) => {
    setActiveProjectId(id);
    setUserRole(role);
    localStorage.setItem('activeProjectId', id);
    localStorage.setItem('userRole', role);
  };

  return (
    <ProjectContext.Provider value={{ activeProjectId, userRole, projects, selectProject }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  return useContext(ProjectContext);
}
