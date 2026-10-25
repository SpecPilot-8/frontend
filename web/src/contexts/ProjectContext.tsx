/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";

interface ProjectContextType {
  projectId: string | null;
  unsavedChanges: boolean;
  setUnsavedChanges: (value: boolean) => void;
  navigationLocked: boolean;
  setNavigationLocked: (value: boolean) => void;
  setProjectId: (id: string | null) => void;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const ProjectProvider = ({ children }: { children: ReactNode }) => {
  const [projectId, setProjectId] = useState<string | null>(() => localStorage.getItem("specpilot.projectId"));

  const [unsavedChanges,setUnsavedChanges] = useState(false);
  const [navigationLocked,setNavigationLocked] = useState(false);
  const selectProject = (id: string | null) => {
    if (id) localStorage.setItem("specpilot.projectId", id);
    else localStorage.removeItem("specpilot.projectId");
    setProjectId(id);
  };
  return (
    <ProjectContext.Provider value={{ projectId, setProjectId: selectProject, unsavedChanges, setUnsavedChanges, navigationLocked, setNavigationLocked }}>
      {children}
    </ProjectContext.Provider>
  );
};

export const useProject = () => {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error("useProject는 ProjectProvider 안에서만 사용해야 합니다.");
  }
  return context;
};
