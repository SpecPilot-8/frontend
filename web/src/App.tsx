/**
 * - 담당 파트: 프런트 엔드
 * - 작성자: 이시형
 * - 페이지 개요: 애플리케이션 최상위 레이아웃과 워크플로우 단계 전환을 관리하는 메인 컴포넌트
 * - 주요 기능:
 *   1) 단계별 화면 전환 및 세션 상태 유지
 *   2) 미저장 변경 사항 확인 모달 제어
 *   3) 상단 헤더와 좌측 사이드바 및 하단 상태바 배치
 */

import React, { useState, useCallback } from 'react';
import type { StepId } from './types';
import { Header, Sidebar, StatusBar } from './components/layout';
import {
  HomeView,
  SetupView,
  AnalysisView,
  VerificationView,
  TestSpecView,
} from './views';
import { ProjectProvider, useProject } from './contexts/ProjectContext';
import { projectStackLabel } from './projectStacks';

const Workspace: React.FC = () => {
  const { unsavedChanges, setUnsavedChanges, navigationLocked, saveBeforeLeaveRef, projectName, setProjectName } = useProject();
  const [pendingStep, setPendingStep] = useState<StepId | null>(null);
  const [leaving, setLeaving] = useState(false);
  // 초기 워크플로우 단계 복원 로직
  const [currentStep, setCurrentStep] = useState<StepId>(() => {
    try {
      const saved = sessionStorage.getItem('specpilot.currentStep') as StepId | null;
      const hasProject = Boolean(localStorage.getItem('specpilot.projectId'));
      if (saved && hasProject && ['SETUP', 'ANALYSIS', 'VERIFICATION', 'TEST_SPEC'].includes(saved)) {
        return saved;
      }
    } catch {
      // ignore
    }
    return 'HOME';
  });
  const [techStack, setTechStack] = useState<string>(() => {
    try {
      return localStorage.getItem('specpilot.techStack') || '';
    } catch {
      return '';
    }
  });
  const [selectedRequirementId, setSelectedRequirementId] = useState<string>('');

  // 단계 이동 완료 및 세션 저장 로직
  const finishNavigation = (step: StepId) => {
    setUnsavedChanges(false);
    setPendingStep(null);
    setCurrentStep(step);
    try {
      if (step === 'HOME') {
        sessionStorage.removeItem('specpilot.currentStep');
      } else {
        sessionStorage.setItem('specpilot.currentStep', step);
      }
    } catch {
      // ignore
    }
  };
  // 미저장 변경 여부를 확인하고 단계를 전환하는 로직
  const navigate = (step: StepId) => {
    if(navigationLocked) return;
    if(unsavedChanges) {setPendingStep(step); return;}
    finishNavigation(step);
  };
  // 프로젝트 선택 시 초기 설정 단계로 이동하는 로직
  const handleSelectProject = (projectId: string) => {
    setProjectName(`Project-${projectId}`);
    setTechStack('');
    setSelectedRequirementId('');
    try {
      localStorage.removeItem('specpilot.techStack');
    } catch {
      // ignore
    }
    navigate('SETUP');
  };

  const handleProjectUpdated = useCallback((newProjectName: string, stack: string) => {
    setProjectName(newProjectName);
    const label = projectStackLabel(stack);
    try {
      localStorage.setItem('specpilot.techStack', label);
    } catch {
      // ignore
    }
    setTechStack(label);
  }, [setProjectName]);

  const handleSelectRequirementForTest = (reqId: string) => {
    setSelectedRequirementId(reqId);
    navigate('TEST_SPEC');
  };

  const handleSwitchProject = () => {
    try {
      sessionStorage.removeItem('specpilot.currentStep');
      localStorage.removeItem('specpilot.techStack');
    } catch {
      // ignore
    }
    navigate('HOME');
  };

  return (
    <>
      {pendingStep && <div role="dialog" aria-modal="true" aria-label="미저장 변경 확인" className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center"><div className="bg-white rounded-xl p-6 space-y-4 max-w-lg"><h2 className="font-bold">저장하지 않은 변경이 있습니다</h2><p>저장 후 이동하거나, 변경을 폐기하거나, 편집을 계속할 수 있습니다.</p><div className="flex gap-2"><button disabled={leaving} className="border rounded p-2" onClick={async()=>{setLeaving(true);try{if(await saveBeforeLeaveRef.current?.())finishNavigation(pendingStep);else setPendingStep(null);}finally{setLeaving(false);}}}>저장 후 이동</button><button disabled={leaving} className="border rounded p-2" onClick={()=>finishNavigation(pendingStep)}>변경 폐기 후 이동</button><button disabled={leaving} className="border rounded p-2" onClick={()=>setPendingStep(null)}>편집 계속</button></div></div></div>}
      <div className="flex flex-col h-screen w-screen bg-slate-50 text-slate-800 antialiased overflow-hidden select-none font-sans">
        {/* 상단 헤더 영역 */}
        <Header
          currentStep={currentStep}
          onStepChange={navigate}
          projectName={currentStep === 'HOME' ? '프로젝트 선택' : projectName}
          subtitle="요구사항과 코드의 연결을 확인하는 워크스페이스"
        />

        {/* 중앙 메인 작업 영역 */}
        <div className="flex flex-1 overflow-hidden">
          {currentStep !== 'HOME' && (
            <Sidebar
              currentStep={currentStep}
              onStepChange={navigate}
              onSwitchProject={handleSwitchProject}
              projectName={projectName}
              techStack={techStack}
              disabled={navigationLocked}
            />
          )}

          <main className="min-w-0 flex-1 overflow-y-auto bg-slate-50/60 p-4 md:p-6">
            {currentStep === 'HOME' && (
              <HomeView
                onSelectProject={handleSelectProject}
                onNavigateStep={navigate}
              />
            )}

            {currentStep === 'SETUP' && (
              <SetupView
                onNavigateStep={navigate}
                onProjectUpdated={handleProjectUpdated}
              />
            )}

            {currentStep === 'ANALYSIS' && (
              <AnalysisView
                onNavigateStep={navigate}
              />
            )}

            {currentStep === 'VERIFICATION' && (
              <VerificationView
                onNavigateStep={navigate}
                onSelectRequirementForTest={handleSelectRequirementForTest}
              />
            )}

            {currentStep === 'TEST_SPEC' && (
              <TestSpecView
                onNavigateStep={navigate}
                selectedRequirementId={selectedRequirementId}
              />
            )}
          </main>
        </div>

        {/* 하단 상태바 영역 */}
        <StatusBar
          specVersion={undefined}
          codeSnapshot={undefined}
          language="한국어"
        />
      </div>
    </>
  );
};

export const App: React.FC = () => <ProjectProvider><Workspace /></ProjectProvider>;
export default App;
