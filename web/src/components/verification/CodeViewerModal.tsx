import React, { useEffect, useState } from 'react';
import { CodeBlock } from '../common/CodeBlock';

export interface CodeEvidence {
  id: string;
  file_path: string;
  start_line: number;
  end_line: number;
  code_snippet: string;
  role: 'problem' | 'context' | string;
  scope: string;
  explanation: string;
  suggested_code?: string | null;
}

interface CodeViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  evidence: CodeEvidence | null;
  requirementTitle?: string;
}

export const CodeViewerModal: React.FC<CodeViewerModalProps> = ({
  isOpen,
  onClose,
  evidence,
  requirementTitle,
}) => {
  const [activeTab, setActiveTab] = useState<'current' | 'suggested'>('current');

  const [prevEvidenceId, setPrevEvidenceId] = useState<string | null>(null);
  if (evidence && evidence.id !== prevEvidenceId) {
    setPrevEvidenceId(evidence.id);
    setActiveTab('current');
  }

  // ESC 키로 닫기
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !evidence) return null;

  const isProblem = evidence.role === 'problem';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="code-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-5xl max-h-[90vh] bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="min-w-0 pr-4">
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  isProblem ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                }`}
              >
                {isProblem ? '불일치 코드' : '참조 코드'}
              </span>
              <span className="text-xs font-mono font-medium text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                L{evidence.start_line} ~ L{evidence.end_line}
              </span>
              <span className="text-xs text-slate-400">· {evidence.scope === 'this_screen' ? '이 화면 소스' : '타 화면/참조'}</span>
            </div>
            <h3 id="code-modal-title" className="text-base font-bold text-slate-800 font-mono truncate" title={evidence.file_path}>
              {evidence.file_path}
            </h3>
            {requirementTitle && (
              <p className="text-xs text-slate-500 mt-0.5 truncate">
                관련 요구사항: <span className="font-medium text-slate-700">{requirementTitle}</span>
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
            aria-label="팝업 닫기"
            title="닫기 (ESC)"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tab Header if suggested code exists */}
        {evidence.suggested_code && (
          <div className="flex border-b border-slate-200 bg-slate-100/80 px-6 pt-2">
            <button
              type="button"
              onClick={() => setActiveTab('current')}
              className={`pb-2.5 px-4 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
                activeTab === 'current'
                  ? 'border-blue-600 text-blue-600 bg-white rounded-t-lg'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              현재 코드 스니펫 (L{evidence.start_line}~L{evidence.end_line})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('suggested')}
              className={`pb-2.5 px-4 text-sm font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'suggested'
                  ? 'border-emerald-600 text-emerald-700 bg-white rounded-t-lg'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>✨ AI 수정 제안 코드</span>
              <span className="px-1.5 py-0.2 rounded text-[11px] bg-emerald-100 text-emerald-800 font-bold">권장</span>
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/50">
          {/* Code Viewer */}
          <div>
            {activeTab === 'current' ? (
              <CodeBlock
                code={evidence.code_snippet}
                filePath={evidence.file_path}
                startLine={evidence.start_line}
                showLineNumbers={true}
                badge={{
                  text: isProblem ? '불일치 코드' : '현재 코드',
                  variant: isProblem ? 'danger' : 'info',
                }}
              />
            ) : (
              <CodeBlock
                code={evidence.suggested_code || ''}
                filePath={evidence.file_path}
                startLine={evidence.start_line}
                showLineNumbers={true}
                badge={{
                  text: '수정 권장안',
                  variant: 'info',
                }}
              />
            )}
          </div>

          {/* AI Explanation Box */}
          {evidence.explanation && (
            <div className={`p-4 rounded-lg border text-sm leading-relaxed ${
              isProblem ? 'bg-amber-50/80 border-amber-200 text-amber-900' : 'bg-blue-50/80 border-blue-200 text-blue-900'
            }`}>
              <div className="flex items-center gap-1.5 font-bold mb-1.5 text-xs uppercase tracking-wider">
                <span>{isProblem ? '⚠️ 판정 사유 및 불일치 지점' : 'ℹ️ 코드 분석 내용'}</span>
              </div>
              <p className="whitespace-pre-wrap">{evidence.explanation}</p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-200 bg-white">
          <span className="text-xs text-slate-400">
            단축키: <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-300 font-mono text-[11px]">ESC</kbd> 로 닫기
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};
