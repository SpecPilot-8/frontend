import React from 'react';
import type { StepId } from '../../types';

interface SidebarProps {
  currentStep: StepId;
  onStepChange: (step: StepId) => void;
  onSwitchProject?: () => void;
  projectName?: string;
  techStack?: string;
  disabled?: boolean;
}

interface StepNavItem {
  id: StepId;
  number: string;
  label: string;
}

const STEP_ITEMS: StepNavItem[] = [
  { id: 'SETUP', number: '01', label: '프로젝트 설정' },
  { id: 'ANALYSIS', number: '02', label: '명세 분석' },
  { id: 'VERIFICATION', number: '03', label: '검증 결과' },
  { id: 'TEST_SPEC', number: '04', label: '테스트 사양서' },
];

export const Sidebar: React.FC<SidebarProps> = ({
  currentStep,
  onStepChange,
  onSwitchProject,
  projectName = '새 프로젝트',
  techStack = '기술 스택 미지정',
  disabled = false,
}) => {
  return (
    <aside className="w-56 bg-white border-r border-slate-200/80 flex flex-col justify-between p-4 shrink-0 select-none">
      <div className="space-y-5">
        {/* 워크스페이스 카드 */}
        <div className="bg-slate-50/70 border border-slate-200/60 rounded-xl p-3.5 space-y-1">
          <span className="text-[10px] font-semibold text-slate-400 block tracking-wide">
            워크스페이스
          </span>
          <div className="text-xs font-bold text-slate-900 truncate">
            {projectName}
          </div>
          <div className="text-[11px] text-slate-500 truncate">
            {techStack}
          </div>
        </div>

        {/* 단계별 네비게이션 */}
        <nav className="space-y-1">
          {STEP_ITEMS.map((item) => {
            const isActive = currentStep === item.id;
            return (
              <button
                key={item.id}
                type="button"
                disabled={disabled}
                onClick={() => onStepChange(item.id)}
                className={`w-full flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-blue-50 text-blue-600 font-bold shadow-xs'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <span className={isActive ? 'text-blue-600' : 'text-slate-400 font-normal'}>
                  {item.number}
                </span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* 하단 프로세스 안내 및 프로젝트 전환 버튼 */}
      <div className="pt-4 border-t border-slate-100 space-y-2.5">
        <div className="text-[11px] text-slate-400 px-1">
          명세 → 코드 검증 → QA
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={onSwitchProject}
          className="w-full py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
        >
          프로젝트 전환
        </button>
      </div>
    </aside>
  );
};
