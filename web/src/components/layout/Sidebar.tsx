import React, { useState } from "react";
import type { StepId } from "../../types";

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
  { id: "SETUP", number: "01", label: "프로젝트 설정" },
  { id: "ANALYSIS", number: "02", label: "명세 분석" },
  { id: "VERIFICATION", number: "03", label: "검증 결과" },
  { id: "TEST_SPEC", number: "04", label: "테스트 사양서" },
];

export const Sidebar: React.FC<SidebarProps> = ({
  currentStep,
  onStepChange,
  onSwitchProject,
  projectName = "새 프로젝트",
  techStack = "기술 스택 미지정",
  disabled = false,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <aside
      className={`relative ${
        isCollapsed ? "w-16 px-2" : "w-56 px-4"
      } bg-white border-r border-slate-200/80 flex flex-col justify-between py-4 shrink-0 select-none transition-all duration-300`}
    >
      <div className="space-y-5">
        {/* 워크스페이스 카드 */}
        <div
          className={`bg-slate-50/70 border border-slate-200/60 rounded-xl overflow-hidden transition-all ${
            isCollapsed ? "p-2 flex flex-col items-center gap-2" : "p-3.5"
          }`}
        >
          <div
            className={`flex items-center ${
              isCollapsed ? "justify-center" : "justify-between"
            } mb-1`}
          >
            {!isCollapsed && (
              <span className="text-[10px] font-semibold text-slate-400 tracking-wide">
                워크스페이스
              </span>
            )}
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="flex items-center justify-center w-6 h-6 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-100 transition-colors cursor-pointer focus:outline-none"
              title="사이드바 토글"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <rect
                  x="3"
                  y="3"
                  width="18"
                  height="18"
                  rx="2"
                  ry="2"
                  strokeWidth={2.5}
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M9 3v18"
                />
              </svg>
            </button>
          </div>

          {!isCollapsed ? (
            <div className="space-y-1">
              <div className="text-xs font-bold text-slate-900 truncate">
                {projectName}
              </div>
              <div className="text-[11px] text-slate-500 truncate">
                {techStack}
              </div>
            </div>
          ) : (
            <div
              className="text-xs font-bold text-slate-900 truncate"
              title={projectName}
            >
              {projectName.charAt(0)}
            </div>
          )}
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
                title={item.label}
                className={`w-full flex items-center ${
                  isCollapsed ? "justify-center p-2" : "space-x-2 px-3 py-2"
                } rounded-xl text-xs font-medium transition-all cursor-pointer ${
                  isActive
                    ? "bg-blue-50 text-blue-600 font-bold shadow-sm"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <span
                  className={
                    isActive ? "text-blue-600" : "text-slate-400 font-normal"
                  }
                >
                  {item.number}
                </span>
                {!isCollapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>
      </div>

      {/* 하단 프로세스 안내 및 프로젝트 전환 버튼 */}
      <div
        className={`pt-4 border-t border-slate-100 ${
          isCollapsed ? "flex justify-center" : "space-y-2.5"
        }`}
      >
        {!isCollapsed && (
          <div className="text-[11px] text-slate-400 px-1 truncate">
            명세 → 코드 검증 → QA
          </div>
        )}
        <button
          type="button"
          disabled={disabled}
          onClick={onSwitchProject}
          title="프로젝트 전환"
          className={`w-full py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm cursor-pointer ${
            isCollapsed ? "px-0 text-[10px]" : ""
          }`}
        >
          {isCollapsed ? "⇄" : "프로젝트 전환"}
        </button>
      </div>
    </aside>
  );
};
