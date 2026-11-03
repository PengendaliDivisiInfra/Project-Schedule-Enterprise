'use client';
import { createContext, useContext, useState, useEffect } from 'react';

const ProjectContext = createContext();

export function ProjectProvider({ children }) {
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const savedProject = localStorage.getItem('activeProjectId');
    if (savedProject) setActiveProjectId(savedProject);
    setIsLoaded(true);
  }, []);

  const selectProject = (id) => {
    setActiveProjectId(id);
    localStorage.setItem('activeProjectId', id);
  };

  return (
    <ProjectContext.Provider value={{ activeProjectId, selectProject, isLoaded }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  return useContext(ProjectContext);
}