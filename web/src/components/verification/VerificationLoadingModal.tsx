import React from 'react';

interface VerificationLoadingModalProps {
  isOpen: boolean;
  progress?: { completed: number; total: number; stage?: string } | null;
  stageText?: string;
}

const STAGES = [
  { key: 'scope_analysis', label: '화면 도달 범위 분석' },
  { key: 'matching', label: '코드 근거 매칭' },
  { key: 'condition_judgment', label: '조건별 일치 판정' },
];

export const VerificationLoadingModal: React.FC<VerificationLoadingModalProps> = ({
  isOpen,
  progress,
  stageText,
}) => {
  if (!isOpen) return null;

  const hasProgress = progress && progress.total > 0;
  const percent = hasProgress
    ? Math.min(100, Math.round((progress.completed / progress.total) * 100))
    : 0;

  const currentStage = progress?.stage || '';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="코드 정합성 검증 분석 진행 중"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200"
    >
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 md:p-8 shadow-2xl border border-slate-100 flex flex-col items-center text-center space-y-6">
        {/* 애니메이션 검증 아이콘 */}
        <div className="relative flex items-center justify-center w-20 h-20">
          <div className="absolute inset-0 rounded-full bg-indigo-100 animate-ping opacity-30" />
          <div className="absolute inset-1 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
          <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-indigo-600 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
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
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
        </div>

        {/* 텍스트 영역 */}
        <div className="space-y-1.5">
          <h3 className="text-lg font-bold text-slate-800">
            코드 정합성 AI 검증 분석 중
          </h3>
          <p className="text-xs text-slate-500 max-w-sm">
            기획서 요구사항 조건과 코드 스냅샷의 AST·호출 흐름을 대조하여 구현 일치 여부를 판정하고 있습니다.
          </p>
        </div>

        {/* 3단계 파이프라인 인디케이터 */}
        <div className="w-full grid grid-cols-3 gap-2 text-center text-xs">
          {STAGES.map((st, idx) => {
            const isCurrent = currentStage === st.key;
            const isPassed =
              (currentStage === 'matching' && idx === 0) ||
              (currentStage === 'condition_judgment' && idx <= 1);

            return (
              <div
                key={st.key}
                className={`p-2 rounded-lg border transition-all ${
                  isCurrent
                    ? 'bg-indigo-50/80 border-indigo-300 text-indigo-700 font-bold ring-1 ring-indigo-300/50'
                    : isPassed
                    ? 'bg-slate-50 border-slate-200 text-emerald-600 font-medium'
                    : 'bg-white border-slate-100 text-slate-400'
                }`}
              >
                <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">
                  Step 0{idx + 1}
                </div>
                <div className="truncate text-[11px]">{st.label}</div>
              </div>
            );
          })}
        </div>

        {/* 진행률 게이지 카드 */}
        <div className="w-full bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-2.5">
          <div className="flex justify-between items-center text-xs font-medium text-slate-600">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
              <span>{stageText || '코드 분석 작업 준비 중...'}</span>
            </span>
            {hasProgress ? (
              <span className="font-bold text-indigo-600">
                {progress.completed} / {progress.total} 요구사항 ({percent}%)
              </span>
            ) : (
              <span className="text-slate-400">대기 중...</span>
            )}
          </div>

          {/* 게이지 바 */}
          <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
            {hasProgress ? (
              <div
                className="bg-gradient-to-r from-indigo-500 to-blue-500 h-full rounded-full transition-all duration-300 ease-out"
                style={{ width: `${percent}%` }}
              />
            ) : (
              <div className="bg-indigo-500 h-full w-1/3 rounded-full animate-[indeterminate_1.5s_infinite_ease-in-out]" />
            )}
          </div>
        </div>

        {/* 하단 안내 */}
        <div className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-2.5 w-full text-left">
          <span className="font-semibold text-slate-700 mr-1.5">[안내]</span>
          대규모 소스코드 및 AST 정합성 판정에는 10~30초 가량 소요될 수 있습니다. 분석이 완료되면 자동으로 화면이 전환됩니다.
        </div>
      </div>
    </div>
  );
};
