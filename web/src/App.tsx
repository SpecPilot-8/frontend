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

const Workspace: React.FC = () => {
  const {unsavedChanges,setUnsavedChanges,navigationLocked}=useProject();
  const [currentStep, setCurrentStep] = useState<StepId>('HOME');
  const [projectName, setProjectName] = useState<string>('프로젝트 선택');
  const [techStack, setTechStack] = useState<string>('');
  const [selectedRequirementId, setSelectedRequirementId] = useState<string>('');

  const navigate = (step: StepId) => {
    if(navigationLocked) return;
    if(unsavedChanges && !window.confirm('저장하지 않은 변경을 폐기하고 이동할까요? 취소하면 편집을 계속합니다.')) return;
    setUnsavedChanges(false); setCurrentStep(step);
  };
  const handleSelectProject = (projectId: string) => {
    setProjectName(`Project-${projectId}`);
    setTechStack('');
    setSelectedRequirementId('');
    navigate('SETUP');
  };

  const handleProjectUpdated = useCallback((newProjectName: string) => {
    setProjectName(newProjectName);
  }, []);

  const handleSelectRequirementForTest = (reqId: string) => {
    setSelectedRequirementId(reqId);
    setCurrentStep('TEST_SPEC');
  };

  const handleSwitchProject = () => {
    navigate('HOME');
  };

  return (
    <>
      <div className="flex flex-col h-screen w-screen bg-slate-50 text-slate-800 antialiased overflow-hidden select-none font-sans">
        {/* 상단 글로벌 헤더 */}
        <Header
          currentStep={currentStep}
          onStepChange={navigate}
          projectName={projectName}
          subtitle="요구사항과 코드의 연결을 확인하는 워크스페이스"
        />

        {/* 중앙 메인 작업 영역 */}
        <div className="flex flex-1 overflow-hidden">
          {/* 홈 화면이 아닐 때만 좌측 사이드바 표시 */}
          {currentStep !== 'HOME' && (
            <Sidebar
              currentStep={currentStep}
              onStepChange={navigate}
              onSwitchProject={handleSwitchProject}
              projectName={projectName}
              techStack={techStack}
            />
          )}

          <main className="flex-1 overflow-y-auto bg-slate-50/60 p-4 md:p-6">
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

        {/* 하단 상태 바 */}
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