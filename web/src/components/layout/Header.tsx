/**
 * - 담당 파트: 프런트 엔드
 * - 작성자: 이시형
 * - 페이지 개요: 워크스페이스 상단에 서비스명과 프로젝트 이름을 표시하는 헤더 컴포넌트
 * - 주요 기능:
 *   1) 서비스 로고 텍스트 및 현재 프로젝트 이름 표시
 *   2) 우측 워크스페이스 안내 문구 출력
 */

import React from 'react';
import type { StepId } from '../../types';

interface HeaderProps {
  currentStep: StepId;
  onStepChange?: (step: StepId) => void;
  projectName?: string;
  subtitle?: string;
}

export const Header: React.FC<HeaderProps> = ({
  projectName = 'ThinkTree Notice Platform',
  subtitle = '요구사항과 코드의 연결을 확인하는 워크스페이스',
}) => {
  return (
    <header className="h-12 bg-white border-b border-slate-200 px-6 flex items-center justify-between select-none">
      <div className="flex items-center space-x-2">
        <span className="text-xs font-bold tracking-wider text-blue-600">
          SPECPILOT
        </span>
        <span className="text-slate-300">/</span>
        <span className="text-xs font-semibold text-slate-800">
          {projectName}
        </span>
      </div>

      <div className="text-xs text-slate-400">
        {subtitle}
      </div>
    </header>
  );
};