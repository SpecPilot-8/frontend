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
  // 동적으로 들어온 상태 조각들을 포맷팅
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