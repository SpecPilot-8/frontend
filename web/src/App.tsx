import React, { useState } from 'react';
import type { StepId } from './types';
import { Header, Sidebar, StatusBar } from './components/layout';
import {
  HomeView,
  SetupView,
  AnalysisView,
  VerificationView,
  TestSpecView,
} from './views';
import { ProjectProvider } from './contexts/ProjectContext';

export const App: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<StepId>('HOME');
  const [projectName, setProjectName] = useState<string>('ThinkTree Notice Platform');
  const [techStack, setTechStack] = useState<string>('Java · Spring Boot');
  const [selectedRequirementId, setSelectedRequirementId] = useState<string>('NOTICE-001');

  const handleSelectProject = (projectId: string) => {
    setProjectName(`Project-${projectId}`);
    setTechStack('Java · Spring Boot');
    setCurrentStep('SETUP');
  };

  const handleProjectUpdated = (newProjectName: string) => {
    setProjectName(newProjectName);
  };

  const handleSelectRequirementForTest = (reqId: string) => {
    setSelectedRequirementId(reqId);
    setCurrentStep('TEST_SPEC');
  };

  const handleSwitchProject = () => {
    setCurrentStep('HOME');
  };

  return (
    <ProjectProvider>
      <div className="flex flex-col h-screen w-screen bg-slate-50 text-slate-800 antialiased overflow-hidden select-none font-sans">
        {/* 상단 글로벌 헤더 */}
        <Header
          currentStep={currentStep}
          onStepChange={setCurrentStep}
          projectName={projectName}
          subtitle="요구사항과 코드의 연결을 확인하는 워크스페이스"
        />

        {/* 중앙 메인 작업 영역 */}
        <div className="flex flex-1 overflow-hidden">
          {/* 홈 화면이 아닐 때만 좌측 사이드바 표시 */}
          {currentStep !== 'HOME' && (
            <Sidebar
              currentStep={currentStep}
              onStepChange={setCurrentStep}
              onSwitchProject={handleSwitchProject}
              projectName={projectName}
              techStack={techStack}
            />
          )}

          <main className="flex-1 overflow-y-auto bg-slate-50/60 p-4 md:p-6">
            {currentStep === 'HOME' && (
              <HomeView
                onSelectProject={handleSelectProject}
                onNavigateStep={setCurrentStep}
              />
            )}

            {currentStep === 'SETUP' && (
              <SetupView
                onNavigateStep={setCurrentStep}
                onProjectUpdated={handleProjectUpdated}
              />
            )}

            {currentStep === 'ANALYSIS' && (
              <AnalysisView
                onNavigateStep={setCurrentStep}
              />
            )}

            {currentStep === 'VERIFICATION' && (
              <VerificationView
                onNavigateStep={setCurrentStep}
                onSelectRequirementForTest={handleSelectRequirementForTest}
              />
            )}

            {currentStep === 'TEST_SPEC' && (
              <TestSpecView
                onNavigateStep={setCurrentStep}
                selectedRequirementId={selectedRequirementId}
              />
            )}
          </main>
        </div>

        {/* 하단 상태 바 */}
        <StatusBar
          specVersion={currentStep !== 'HOME' ? 'v0.2' : undefined}
          codeSnapshot={currentStep !== 'HOME' ? 'S-014' : undefined}
          language="한국어"
        />
      </div>
    </ProjectProvider>
  );
};

export default App;