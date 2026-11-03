'use client';
import { createContext, useContext, useState, useEffect } from 'react';

const ProjectContext = createContext();

export function ProjectProvider({ children }) {
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [userRole, setUserRole] = useState(null); // Menyimpan role: pm, dd, qc, hse, site_admin
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const savedProject = localStorage.getItem('activeProjectId');
    const savedRole = localStorage.getItem('userRole');
    if (savedProject) setActiveProjectId(savedProject);
    if (savedRole) setUserRole(savedRole);
    setIsLoaded(true);
  }, []);

  const selectProject = (id, role) => {
    setActiveProjectId(id);
    setUserRole(role);
    localStorage.setItem('activeProjectId', id);
    localStorage.setItem('userRole', role);
  };

  return (
    <ProjectContext.Provider value={{ activeProjectId, userRole, selectProject, isLoaded }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  return useContext(ProjectContext);
}