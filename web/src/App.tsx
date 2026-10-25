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
  const {unsavedChanges,setUnsavedChanges,navigationLocked,saveBeforeLeaveRef}=useProject();
  const [pendingStep,setPendingStep] = useState<StepId | null>(null);
  const [leaving,setLeaving] = useState(false);
  const [currentStep, setCurrentStep] = useState<StepId>('HOME');
  const [projectName, setProjectName] = useState<string>('프로젝트 선택');
  const [techStack, setTechStack] = useState<string>('');
  const [selectedRequirementId, setSelectedRequirementId] = useState<string>('');

  const finishNavigation = (step: StepId) => { setUnsavedChanges(false); setPendingStep(null); setCurrentStep(step); };
  const navigate = (step: StepId) => {
    if(navigationLocked) return;
    if(unsavedChanges) {setPendingStep(step); return;}
    finishNavigation(step);
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
      {pendingStep && <div role="dialog" aria-modal="true" aria-label="미저장 변경 확인" className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center"><div className="bg-white rounded-xl p-6 space-y-4 max-w-lg"><h2 className="font-bold">저장하지 않은 변경이 있습니다</h2><p>저장 후 이동하거나, 변경을 폐기하거나, 편집을 계속할 수 있습니다.</p><div className="flex gap-2"><button disabled={leaving} className="border rounded p-2" onClick={async()=>{setLeaving(true);try{if(await saveBeforeLeaveRef.current?.())finishNavigation(pendingStep);else setPendingStep(null);}finally{setLeaving(false);}}}>저장 후 이동</button><button disabled={leaving} className="border rounded p-2" onClick={()=>finishNavigation(pendingStep)}>변경 폐기 후 이동</button><button disabled={leaving} className="border rounded p-2" onClick={()=>setPendingStep(null)}>편집 계속</button></div></div></div>}
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