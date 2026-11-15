/* eslint-disable react-refresh/only-export-components */
/**
 * - 담당 파트: 프런트 엔드
 * - 작성자: 이시형
 * - 페이지 개요: 현재 선택된 프로젝트 정보와 화면 이동 잠금 상태를 전역으로 관리하는 컨텍스트 파일
 * - 주요 기능:
 *   1) 프로젝트 식별자와 프로젝트 이름의 로컬 스토리지 동기화
 *   2) 미저장 변경 사항 여부 및 화면 전환 전 저장 콜백 관리
 */

import { createContext, useContext, useState, useRef } from "react";
import type { ReactNode, MutableRefObject } from "react";

interface ProjectContextType {
  analysisTarget: { requirementId: string; documentId: string; revision: number } | null;
  setAnalysisTarget: (value: { requirementId: string; documentId: string; revision: number } | null) => void;
  saveBeforeLeaveRef: MutableRefObject<(() => Promise<boolean>) | null>;
  projectId: string | null;
  projectName: string;
  setProjectName: (name: string) => void;
  unsavedChanges: boolean;
  setUnsavedChanges: (value: boolean) => void;
  navigationLocked: boolean;
  setNavigationLocked: (value: boolean) => void;
  setProjectId: (id: string | null) => void;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const ProjectProvider = ({ children }: { children: ReactNode }) => {
  const [projectId, setProjectId] = useState<string | null>(() => localStorage.getItem("specpilot.projectId"));
  const [projectName, setProjectNameState] = useState<string>(() => localStorage.getItem("specpilot.projectName") || "프로젝트 선택");

  const setProjectName = (name: string) => {
    localStorage.setItem("specpilot.projectName", name);
    setProjectNameState(name);
  };

  const saveBeforeLeaveRef = useRef<(() => Promise<boolean>) | null>(null);
  const [analysisTarget, setAnalysisTarget] = useState<ProjectContextType['analysisTarget']>(null);
  const [unsavedChanges,setUnsavedChanges] = useState(false);
  const [navigationLocked,setNavigationLocked] = useState(false);
  // 프로젝트 선택 상태를 로컬 스토리지에 반영하는 로직
  const selectProject = (id: string | null) => {
    if (id) localStorage.setItem("specpilot.projectId", id);
    else {
      localStorage.removeItem("specpilot.projectId");
      localStorage.removeItem("specpilot.projectName");
    }
    setProjectId(id);
  };
  return (
    <ProjectContext.Provider value={{ analysisTarget, setAnalysisTarget, saveBeforeLeaveRef, projectId, projectName, setProjectName, setProjectId: selectProject, unsavedChanges, setUnsavedChanges, navigationLocked, setNavigationLocked }}>
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
