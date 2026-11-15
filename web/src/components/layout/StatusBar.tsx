/**
 * - 담당 파트: 프런트 엔드
 * - 작성자: 이시형
 * - 페이지 개요: 화면 하단에 검증 요약과 명세 및 코드 상태를 표시하는 상태 표시줄 컴포넌트
 * - 주요 기능:
 *   1) 검증 요약과 명세 및 코드 스냅샷 상태 문자열 조합
 *   2) 하단 상태바 및 표시 언어 출력
 */

import React from 'react';

interface StatusBarProps {
  specVersion?: string;
  codeSnapshot?: string;
  verificationSummary?: string;
  language?: string;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  specVersion,
  codeSnapshot,
  verificationSummary,
  language = '한국어',
}) => {
  // 표시할 상태 문자열을 조합하는 로직
  const statusSegments = [
    verificationSummary,
    specVersion ? `명세 ${specVersion}` : undefined,
    codeSnapshot ? `코드 ${codeSnapshot}` : undefined,
  ].filter(Boolean);

  return (
    <footer className="h-6 bg-blue-600 text-white text-[11px] px-4 flex items-center justify-between shrink-0 select-none">
      <div className="flex items-center space-x-2 opacity-95">
        {statusSegments.length > 0 ? (
          <span>{statusSegments.join(' · ')}</span>
        ) : (
          <span>준비 완료</span>
        )}
      </div>

      <div className="flex items-center space-x-3 opacity-90 text-[10px]">
        <span>{language}</span>
      </div>
    </footer>
  );
};