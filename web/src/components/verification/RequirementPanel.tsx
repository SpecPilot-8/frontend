import React, { useState } from 'react';
import { Card, Button } from '../common';
import { SpecPageViewer } from './SpecPageViewer';
import { BASE_URL } from '../../services/api';
import { formatRequirementTitle, type Requirement, type SourceRef } from '../../types/verification';

interface ConditionVerdict {
  condition_id: string;
  status: string;
  stable_key?: string;
  reason?: string;
  evidence_ids?: string[];
}

interface Condition {
  id: string;
  stable_key: string;
  category: string;
  text?: string;
}

interface VerificationData {
  condition_verdicts?: ConditionVerdict[];
}

interface RequirementPanelProps {
  projectId: string;
  requirement: Requirement;
  verificationData?: VerificationData;
  onReview?: () => void;
  selectedConditionId?: string | null;
  onSelectCondition?: (conditionId: string, evidenceIds: string[]) => void;
}

const verdictLabels: Record<string, string> = {
  implemented: '구현됨',
  partial: '부분 구현',
  mismatch: '불일치',
  not_found: '미구현 후보',
  needs_review: '확인 필요',
  not_statically_verifiable: '정적 검증 불가',
  not_run: '미분석',
};

const verdictStyles: Record<string, string> = {
  implemented: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  partial: 'bg-amber-50 text-amber-700 border-amber-200',
  mismatch: 'bg-rose-50 text-rose-700 border-rose-200',
  not_found: 'bg-blue-50 text-blue-700 border-blue-200',
  needs_review: 'bg-amber-50 text-amber-700 border-amber-200',
  not_statically_verifiable: 'bg-slate-100 text-slate-600 border-slate-200',
  not_run: 'bg-slate-50 text-slate-500 border-slate-200',
};

export const RequirementPanel: React.FC<RequirementPanelProps> = ({
  projectId,
  requirement,
  verificationData,
  onReview,
  selectedConditionId,
  onSelectCondition,
}) => {
  const [isPdfOpen, setIsPdfOpen] = useState(false);
  const primaryRef: SourceRef | undefined = requirement.source_refs?.[0];
  const pageIndex = primaryRef?.location?.index || 0;
  const bbox = primaryRef?.location?.bbox;

  const categories = [
    { key: 'display', label: '화면 표시' },
    { key: 'validation', label: '입력값 검증' },
    { key: 'navigation', label: '경로 및 이동' },
    { key: 'business_logic', label: '비즈니스 로직' },
    { key: 'data', label: '데이터 저장' },
    { key: 'error_message', label: '오류 메시지' },
  ];

  const conditions = (requirement as unknown as { conditions?: Condition[] }).conditions || [];
  const verdicts = verificationData?.condition_verdicts || [];
  const displayTitle = formatRequirementTitle(requirement.title, requirement.original_text, conditions);

  const statsList = categories.map(cat => {
    const catConditions = conditions.filter((c: Condition) => c.category === cat.key);
    if (catConditions.length === 0) return null;
    
    const implementedCount = catConditions.filter((c: Condition) => {
      const v = verdicts.find((v: ConditionVerdict) => v.condition_id === c.id || v.condition_id === c.stable_key);
      return v && v.status === 'implemented';
    }).length;

    return { ...cat, total: catConditions.length, implemented: implementedCount };
  }).filter(Boolean) as { key: string; label: string; total: number; implemented: number }[];

  return (
    <div className="w-full min-w-0 xl:w-[44%] shrink-0 space-y-6 wrap-anywhere">
      <Card className="p-6 flex flex-col gap-6">
        <div>
          <span className="text-xs font-semibold text-blue-600 block mb-1">요구사항</span>
          <h3 className="text-base font-bold text-slate-900 mb-1.5 break-keep">
            {displayTitle}
          </h3>
          <p className="text-xs text-slate-500">
            {requirement.stable_key} · 문서 {pageIndex > 0 ? `${pageIndex}페이지` : '위치 미상'}
          </p>
          {!primaryRef && requirement.original_text && (
            <p className="text-slate-800 text-sm leading-relaxed whitespace-pre-wrap mt-3">
              {requirement.original_text}
            </p>
          )}
        </div>


        {primaryRef && (<div className="border-t border-slate-100 pt-6">
            <h4 className="text-sm font-bold text-slate-900 mb-3">
              명세 분석 추출 요구사항 (문서 {pageIndex}페이지)
            </h4>
            
            <div className="bg-white border border-slate-200 rounded-md p-4 mb-2 shadow-sm relative overflow-hidden">
              <p className="text-sm text-slate-900 leading-relaxed mt-2">
                <span className="bg-yellow-200/80 px-1 py-0.5 rounded text-[13px] leading-relaxed box-decoration-clone">
                  {primaryRef.quote}
                </span>
              </p>
            </div>
            
            <p className="text-xs text-slate-500">
              위치: {pageIndex}페이지 
              {bbox && ` (좌표: x:${Math.round(bbox[0])}, y:${Math.round(bbox[1])})`}
            </p>
          </div>
        )}

        {requirement.document_id && pageIndex > 0 && (
          <section className="border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={() => setIsPdfOpen(prev => !prev)}
              aria-expanded={isPdfOpen}
              className="w-full flex items-center justify-between py-1.5 text-left cursor-pointer group"
            >
              <h4 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                기획서 원본 · {pageIndex}쪽
              </h4>
              <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 group-hover:text-slate-800">
                <span>{isPdfOpen ? '접기' : '펼치기'}</span>
                <span
                  aria-hidden="true"
                  className={`text-slate-400 transform transition-transform ${isPdfOpen ? 'rotate-180' : ''}`}
                >
                  ▼
                </span>
              </span>
            </button>
            {isPdfOpen && (
              <div className="mt-2">
                <SpecPageViewer
                  fileUrl={`${BASE_URL}/projects/${projectId}/documents/${requirement.document_id}/file`}
                  page={pageIndex}
                  highlights={(requirement.source_refs || []).flatMap((r, i) =>
                    r.location?.index === pageIndex && r.location.bbox
                      ? [{ bbox: r.location.bbox, active: i === 0 }] : [])}
                  searchText={primaryRef?.quote}
                />
              </div>
            )}
          </section>
        )}

        <div className="border-t border-slate-100 pt-6">
          <h4 className="text-sm font-bold text-slate-900 mb-3">수락 조건 검증</h4>
          <ul className="space-y-2 text-sm">
            {statsList.length > 0 ? (
              statsList.map(stat => (
                <li key={stat.key} className="flex justify-between items-center">
                  <span className="text-slate-600">{stat.label}</span> 
                  <span className={`font-medium ${stat.implemented === stat.total ? 'text-emerald-600' : 'text-rose-500'}`}>
                    {verdicts.some(v => v.status) ? `${stat.implemented} / ${stat.total}` : `미분석 / ${stat.total}`} 
                  </span>
                </li>
              ))
            ) : (
              <li className="text-slate-400 text-xs text-center py-2">조건 데이터가 없습니다.</li>
            )}
          </ul>

          {conditions.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-100 space-y-2.5">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="font-semibold text-slate-700">조건별 판정 상세 ({conditions.length}개)</span>
                <span>클릭 시 연결 코드로 이동</span>
              </div>
              {conditions.map((c, idx) => {
                const v = verdicts.find(item => item.condition_id === c.id || item.condition_id === c.stable_key);
                const statusKey = v?.status || 'not_run';
                const catLabel = categories.find(cat => cat.key === c.category)?.label || c.category;
                const evIds = v?.evidence_ids || [];
                const condKey = c.id || c.stable_key;
                const isSelected = selectedConditionId === condKey;

                return (
                  <div
                    key={condKey}
                    onClick={() => onSelectCondition?.(condKey, evIds)}
                    className={`p-3 rounded-lg border text-xs transition-all cursor-pointer space-y-1.5 ${
                      isSelected
                        ? 'bg-blue-50/60 border-blue-400 ring-1 ring-blue-400/30'
                        : 'bg-slate-50/70 hover:bg-slate-100/70 border-slate-200/80'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="px-1.5 py-0.5 rounded bg-slate-200/80 text-slate-700 font-bold text-[11px]">
                          조건 {idx + 1}
                        </span>
                        <span className="text-slate-500 font-medium truncate">{catLabel}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {evIds.length > 0 && (
                          <span className="text-[11px] text-blue-600 font-semibold">
                            코드 {evIds.length}곳
                          </span>
                        )}
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${verdictStyles[statusKey] || verdictStyles.not_run}`}>
                          {verdictLabels[statusKey] || statusKey}
                        </span>
                      </div>
                    </div>
                    {c.text && (
                      <p className="text-slate-800 font-medium leading-relaxed break-keep">
                        {c.text}
                      </p>
                    )}
                    {v?.reason && v.reason !== '미분석' && (
                      <p className="text-slate-500 leading-relaxed break-keep pt-1 border-t border-slate-200/60">
                        {v.reason}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <Button onClick={onReview} variant="outline" className="w-full mt-2 text-slate-700">
          명세 원문 검토
        </Button>
      </Card>
    </div>
  );
};
