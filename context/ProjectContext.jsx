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
    // 1. Ambil dari Cache Lokal dulu
    const savedProject = localStorage.getItem('activeProjectId');
    const savedRole = localStorage.getItem('userRole');
    const cachedProjects = localStorage.getItem('cachedProjects');
    
    if (savedProject) setActiveProjectId(savedProject);
    if (savedRole) setUserRole(savedRole);
    if (cachedProjects) {
      try { setProjects(JSON.parse(cachedProjects)); } catch (e) {}
    }
    
    setIsLoaded(true);

    // 2. Fetch data terbaru HANYA jika ada internet
    if (typeof window !== 'undefined' && navigator.onLine) {
      supabase
        .from('project_members')
        .select('role, projects(id, name)')
        .then(({ data }) => {
          if (data) {
            const formatted = data.filter(i => i.projects).map(i => ({
              id: i.projects.id,
              name: i.projects.name,
              role: i.role
            }));
            setProjects(formatted);
            localStorage.setItem('cachedProjects', JSON.stringify(formatted)); // Simpan ke cache
          }
        });
    }
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