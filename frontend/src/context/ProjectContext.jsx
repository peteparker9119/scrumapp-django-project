import React, { createContext, useContext, useState } from 'react';

const ProjectContext = createContext(null);

export const ProjectProvider = ({ children }) => {
  const [currentProject, setCurrentProject] = useState(() => {
    try { return JSON.parse(localStorage.getItem('currentProject')); } catch { return null; }
  });

  const selectProject = (project) => {
    setCurrentProject(project);
    if (project) localStorage.setItem('currentProject', JSON.stringify(project));
    else localStorage.removeItem('currentProject');
  };

  return (
    <ProjectContext.Provider value={{ currentProject, selectProject }}>
      {children}
    </ProjectContext.Provider>
  );
};

export const useProject = () => useContext(ProjectContext);
