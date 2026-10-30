import React from 'react';

interface ExtractionLoadingModalProps {
  isOpen: boolean;
  progress?: { completed: number; total: number } | null;
  statusText?: string;
}

export const ExtractionLoadingModal: React.FC<ExtractionLoadingModalProps> = ({
  isOpen,
  progress,
  statusText,
}) => {
  if (!isOpen) return null;

  const hasProgress = progress && progress.total > 0;
  const percent = hasProgress
    ? Math.min(100, Math.round((progress.completed / progress.total) * 100))
    : 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="AI 요구사항 추출 진행 중"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
    >
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 md:p-8 shadow-2xl border border-slate-100 flex flex-col items-center text-center space-y-6">
        {/* 애니메이션 AI 아이콘 */}
        <div className="relative flex items-center justify-center w-20 h-20">
          <div className="absolute inset-0 rounded-full bg-blue-100 animate-ping opacity-30" />
          <div className="absolute inset-1 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
          <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
            <svg
              className="w-7 h-7 animate-pulse"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          </div>
        </div>

        {/* 텍스트 영역 */}
        <div className="space-y-1.5">
          <h3 className="text-lg font-bold text-slate-800">
            AI 요구사항 자동 추출 진행 중
          </h3>
          <p className="text-xs text-slate-500 max-w-sm">
            기획서의 화면 설계 표와 원문을 순서대로 분석하여 기능 요구사항과 세부 수락 조건을 도출하고 있습니다.
          </p>
        </div>

        {/* 진행률 게이지 카드 */}
        <div className="w-full bg-slate-50 border border-slate-200/80 rounded-xl p-4 space-y-2.5 text-left">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-blue-700 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
              {statusText || (hasProgress ? `화면 분석 진행 중` : "모델 분석 요청 대기 중...")}
            </span>
            {hasProgress && (
              <span className="text-slate-600">
                {progress.completed} / {progress.total} 화면 ({percent}%)
              </span>
            )}
          </div>

          <div className="w-full bg-slate-200/80 h-2.5 rounded-full overflow-hidden">
            {hasProgress ? (
              <div
                className="bg-gradient-to-r from-blue-600 to-indigo-600 h-full rounded-full transition-all duration-300 ease-out shadow-sm"
                style={{ width: `${percent}%` }}
              />
            ) : (
              <div className="bg-blue-500 h-full w-1/3 rounded-full animate-[indeterminate_1.5s_infinite_ease-in-out]" />
            )}
          </div>
        </div>

        {/* 하단 안내 */}
        <div className="text-[11px] text-slate-400 bg-blue-50/50 border border-blue-100 rounded-lg p-2.5 w-full">
          💡 분석 중에는 브라우저 창을 닫지 마세요. 완료 후 원문과 비교 검토할 수 있도록 초안으로 안전하게 저장됩니다.
        </div>
      </div>
    </div>
  );
};
