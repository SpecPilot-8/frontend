import React from 'react';

interface TestSpecLoadingModalProps {
  isOpen: boolean;
  progress?: { completed: number; total: number; stage?: string } | null;
  statusText?: string;
  onCancel?: () => void;
  cancelling?: boolean;
}

const STAGES = [
  { key: 'analysis', label: '요구사항·검증 대조' },
  { key: 'generation', label: '테스트 절차·입력값 도출' },
  { key: 'draft_build', label: '예상 결과 매핑 및 빌드' },
];

export const TestSpecLoadingModal: React.FC<TestSpecLoadingModalProps> = ({
  isOpen,
  progress,
  statusText,
  onCancel,
  cancelling,
}) => {
  if (!isOpen) return null;

  const hasProgress = progress && progress.total > 0;
  const percent = hasProgress
    ? Math.min(100, Math.round((progress.completed / progress.total) * 100))
    : 0;

  // 진행률에 따라 3단계 인디케이터 활성화
  const currentStepIdx = !hasProgress
    ? 0
    : percent < 40
    ? 0
    : percent < 80
    ? 1
    : 2;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="QA 테스트 사양서 AI 자동 생성 진행 중"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200"
    >
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 md:p-8 shadow-2xl border border-slate-100 flex flex-col items-center text-center space-y-6">
        {/* 애니메이션 테스트 문서 아이콘 */}
        <div className="relative flex items-center justify-center w-20 h-20">
          <div className="absolute inset-0 rounded-full bg-emerald-100 animate-ping opacity-30" />
          <div className="absolute inset-1 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
          <div className="w-14 h-14 rounded-full bg-linear-to-tr from-emerald-600 to-teal-600 flex items-center justify-center text-white shadow-lg shadow-emerald-500/30">
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
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
              />
            </svg>
          </div>
        </div>

        {/* 텍스트 영역 */}
        <div className="space-y-1.5">
          <h3 className="text-lg font-bold text-slate-800">
            QA 테스트 사양서 AI 자동 생성 중
          </h3>
          <p className="text-xs text-slate-500 max-w-sm">
            기획서 요구사항과 코드 검증 결과를 바탕으로 테스트 절차와 예상 결과를 도출하여 사양서 초안을 빌드하고 있습니다.
          </p>
        </div>

        {/* 3단계 파이프라인 인디케이터 */}
        <div className="w-full grid grid-cols-3 gap-2 text-center text-xs">
          {STAGES.map((st, idx) => {
            const isCurrent = currentStepIdx === idx;
            const isPassed = currentStepIdx > idx;

            return (
              <div
                key={st.key}
                className={`p-2 rounded-lg border transition-all ${
                  isCurrent
                    ? 'bg-emerald-50/80 border-emerald-300 text-emerald-800 font-bold ring-1 ring-emerald-300/50'
                    : isPassed
                    ? 'bg-slate-50 border-slate-200 text-teal-700 font-medium'
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
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{statusText || '테스트케이스 생성 작업 준비 중...'}</span>
            </span>
            {hasProgress ? (
              <span className="font-bold text-emerald-600">
                {progress.completed} / {progress.total} 향후 개선 계획 ({percent}%)
              </span>
            ) : (
              <span className="text-slate-400">대기 중...</span>
            )}
          </div>

          {/* 게이지 바 */}
          <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
            {hasProgress ? (
              <div
                className="bg-linear-to-r from-emerald-500 to-teal-500 h-full rounded-full transition-all duration-300 ease-out"
                style={{ width: `${percent}%` }}
              />
            ) : (
              <div className="bg-emerald-500 h-full w-1/3 rounded-full animate-[indeterminate_1.5s_infinite_ease-in-out]" />
            )}
          </div>
        </div>

        {/* 하단 안내 및 중단 버튼 */}
        <div className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-2.5 w-full text-left">
          <span className="font-semibold text-slate-700 mr-1.5">[안내]</span>
          생성된 테스트 절차와 예상 결과는 화면에서 자유롭게 수정·보완하고 Excel로 내보낼 수 있습니다. 실제 수행(O/X) 필드는 빈 상태로 유지됩니다.
        </div>

        {onCancel && (
          <div className="pt-1 w-full flex justify-center">
            <button
              type="button"
              onClick={onCancel}
              disabled={cancelling}
              className="px-4 py-2 text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100/80 border border-rose-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span>{cancelling ? '생성 중단 처리 중...' : '테스트 사양서 생성 중단'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
