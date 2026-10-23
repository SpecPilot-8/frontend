import React, { useMemo } from 'react';
import { Card, StatusBadge } from '../common';
import { SpecPageViewer } from './SpecPageViewer';
import { BASE_URL } from '../../services/api';
import { CATEGORY_LABEL, CATEGORY_ORDER, STATUS_LABEL } from '../../constants/verdict';
import type { ConditionCategory, VerdictStatus } from '../../constants/verdict';
import type { Requirement, SourceRef, ConditionVerdictItem } from '../../types/verification';

interface RequirementPanelProps {
  projectId: string;
  requirement: Requirement;
  conditionVerdicts: ConditionVerdictItem[];
}

export const RequirementPanel: React.FC<RequirementPanelProps> = ({ projectId, requirement, conditionVerdicts }) => {
  const primaryRef: SourceRef | undefined = requirement.source_refs?.[0];
  const pageIndex = primaryRef?.location?.index || 0;
  const bbox = primaryRef?.location?.bbox;
  const fileUrl = requirement.document_id
    ? `${BASE_URL}/projects/${projectId}/documents/${requirement.document_id}/file`
    : null;

  const verdictOf = useMemo(
    () => new Map(conditionVerdicts.map((v) => [v.condition_id, v])),
    [conditionVerdicts],
  );
  const conditions = useMemo(() => requirement.conditions ?? [], [requirement.conditions]);

  // 범주별 '구현된 조건 수 / 전체 조건 수'
  const categories = useMemo(() => {
    const counts = new Map<string, { total: number; implemented: number }>();
    for (const c of conditions) {
      const item = counts.get(c.category) ?? { total: 0, implemented: 0 };
      item.total += 1;
      if (verdictOf.get(c.id)?.status === 'implemented') item.implemented += 1;
      counts.set(c.category, item);
    }
    return [...counts.entries()].sort(
      (a, b) =>
        CATEGORY_ORDER.indexOf(a[0] as ConditionCategory) - CATEGORY_ORDER.indexOf(b[0] as ConditionCategory),
    );
  }, [conditions, verdictOf]);

  return (
    <div className="w-full md:w-[46%] shrink-0 space-y-4">
      <Card className="p-6 flex flex-col gap-5">
        <div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">요구사항</h3>
          <p className="text-sm text-gray-500 mb-3">
            {requirement.stable_key} · 문서 {pageIndex > 0 ? `${pageIndex}페이지` : '위치 미상'}
          </p>
          <p className="text-gray-800 text-sm leading-relaxed whitespace-pre-wrap">{requirement.original_text}</p>
        </div>

        {fileUrl && pageIndex > 0 && (
          <div className="border-t border-gray-100 pt-5">
            <h4 className="text-sm font-bold text-gray-900 mb-1">기획서 원본 (PDF {pageIndex}페이지)</h4>
            <p className="text-xs text-gray-500 mb-3">노란 박스가 이 요구사항이 적힌 위치입니다.</p>
            <SpecPageViewer fileUrl={fileUrl} page={pageIndex} bbox={bbox} />
          </div>
        )}

        {categories.length > 0 && (
          <div className="border-t border-gray-100 pt-5">
            <h4 className="text-sm font-bold text-gray-900 mb-3">수락 조건 검증</h4>
            <ul className="space-y-2 text-sm">
              {categories.map(([category, c]) => (
                <li key={category} className="flex justify-between items-center">
                  <span className="text-gray-600">{CATEGORY_LABEL[category as ConditionCategory] ?? category}</span>
                  <span className={`font-medium ${c.implemented === c.total ? 'text-green-600' : 'text-red-500'}`}>
                    {c.implemented} / {c.total}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {conditions.length > 0 && (
          <div className="border-t border-gray-100 pt-5 space-y-2.5">
            <h4 className="text-sm font-bold text-gray-900">조건별 판정</h4>
            {conditions.map((c, i) => {
              const v = verdictOf.get(c.id);
              return (
                <div key={c.id} className="border border-gray-200 rounded-lg p-3 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="font-mono text-gray-400">C{i + 1}</span>
                    {v?.status && <StatusBadge status={STATUS_LABEL[v.status as VerdictStatus] ?? v.status} />}
                    <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 text-[10px]">
                      {CATEGORY_LABEL[c.category as ConditionCategory] ?? c.category}
                    </span>
                  </div>
                  <p className="text-[13px] text-gray-800">{c.text}</p>
                  {v?.reason && <p className="text-xs text-gray-500 leading-relaxed">{v.reason}</p>}
                  {(v?.message_match === 'differs' || v?.server_validation === 'missing') && (
                    <div className="flex flex-wrap gap-1.5 text-[10px]">
                      {v.message_match === 'differs' && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                          안내 문구가 기획서와 다름
                        </span>
                      )}
                      {v.server_validation === 'missing' && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                          화면에서만 검증, 서버 검증 없음
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
};
