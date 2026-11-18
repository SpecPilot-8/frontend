/**
 * - 담당 파트: 프런트 엔드
 * - 작성자: 이시형
 * - 페이지 개요: 두 검증 실행 간의 요구사항과 조건별 판정 변화를 요약하고 상세 비교표를 표시하는 컴포넌트
 * - 주요 기능:
 *   1) 두 실행 간 요구사항 변경 건수와 조건 판정 개선 및 퇴행 요약 표시
 *   2) 변경된 요구사항만 필터링하고 삭제된 요구사항 목록 안내
 *   3) 조건별 변경 전후 판정 상태 비교표 펼치기 및 접기 기능
 */

import React, { useState } from 'react';
import { Button } from '../common';

export interface VerificationCompareRequirement {
  key: string;
  change: 'added' | 'removed' | 'changed';
  requirement_id: string;
  title: string;
  before_status: string | null;
  after_status: string | null;
  before_revision: number | null;
  after_revision: number | null;
}

export interface VerificationCompareCondition {
  key: string;
  change: 'added' | 'removed' | 'changed';
  requirement_key: string;
  condition_id: string;
  text: string;
  before_status: string | null;
  after_status: string | null;
  before_message_match: string | null;
  after_message_match: string | null;
}

export interface VerificationCompareResponse {
  base_run_id: string;
  run_id: string;
  base_snapshot_id: string;
  snapshot_id: string;
  summary: {
    requirements_changed: number;
    requirements_added: number;
    requirements_removed: number;
    conditions_status_changed: number;
    improved: number;
    regressed: number;
  };
  requirements: VerificationCompareRequirement[];
  conditions: VerificationCompareCondition[];
}

interface VerificationComparePanelProps {
  data: VerificationCompareResponse | null;
  loading: boolean;
  error: string;
  baseLabel: string;
  currentLabel: string;
  statusLabels: Record<string, string>;
  onlyChanged: boolean;
  onToggleOnlyChanged: (checked: boolean) => void;
  onClose: () => void;
}

export const VerificationComparePanel: React.FC<VerificationComparePanelProps> = ({
  data,
  loading,
  error,
  baseLabel,
  currentLabel,
  statusLabels,
  onlyChanged,
  onToggleOnlyChanged,
  onClose,
}) => {
  const [expanded, setExpanded] = useState(false);

  const labelOf = (status: string | null) => statusLabels[status || 'not_run'] || status || '미분석';

  if (loading) {
    return (
      <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-xs text-slate-600">
        이전 실행과의 판정 차이를 비교하는 중입니다...
      </div>
    );
  }

  if (error) {
    return (
      <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50/70 px-4 py-3 text-xs text-rose-700 flex items-center justify-between gap-2">
        <span>실행 비교 조회 실패: {error}</span>
        <Button type="button" variant="secondary" size="sm" onClick={onClose}>
          닫기
        </Button>
      </div>
    );
  }

  if (!data) return null;

  const { summary, requirements, conditions } = data;
  const removedReqs = requirements.filter((r) => r.change === 'removed');
  const totalChanges = requirements.length + conditions.length;

  return (
    <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-3">
      {/* 상단 비교 요약 및 제어 영역 */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-700">
          <span className="font-semibold text-slate-900">
            실행 비교
          </span>
          <span className="text-slate-500">
            {baseLabel} → {currentLabel}
          </span>
          <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700">
            요구사항 변경 <strong>{summary.requirements_changed}</strong>건
            {summary.requirements_added > 0 ? ` · 추가 ${summary.requirements_added}` : ''}
            {summary.requirements_removed > 0 ? ` · 삭제 ${summary.requirements_removed}` : ''}
          </span>
          <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700">
            조건 상태 변경 <strong>{summary.conditions_status_changed}</strong>건
            {summary.improved > 0 && (
              <>
                {' '}· 개선 <strong className="text-emerald-600">+{summary.improved}</strong>
              </>
            )}
            {summary.regressed > 0 && (
              <>
                {' '}· 퇴행 <strong className="text-rose-600">-{summary.regressed}</strong>
              </>
            )}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer select-none px-1">
            <input
              type="checkbox"
              checked={onlyChanged}
              onChange={(e) => onToggleOnlyChanged(e.target.checked)}
              className="rounded border-slate-300"
            />
            <span>변경된 요구사항만 보기</span>
          </label>
          {conditions.length > 0 && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setExpanded((prev) => !prev)}
            >
              {expanded ? '조건 비교 접기' : `조건별 비교 (${conditions.length}건)`}
            </Button>
          )}
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            비교 해제
          </Button>
        </div>
      </div>

      {totalChanges === 0 && (
        <p className="text-xs text-slate-500">
          두 검증 실행 간에 요구사항과 조건 판정 변화가 없습니다.
        </p>
      )}

      {/* 이전 실행에서 삭제된 요구사항 안내 영역 */}
      {removedReqs.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-xs text-amber-800 space-y-1">
          <div className="font-semibold">현재 실행에서 제외된 요구사항 ({removedReqs.length}건)</div>
          <div className="flex flex-wrap gap-2">
            {removedReqs.map((r) => (
              <span key={r.key} className="px-2 py-0.5 rounded bg-white border border-amber-200 text-slate-700">
                {r.title} ({labelOf(r.before_status)})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 조건별 전후 판정 비교 표 영역 */}
      {expanded && conditions.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
              <tr>
                <th className="px-3 py-2 whitespace-nowrap">요구사항</th>
                <th className="px-3 py-2">조건 내용</th>
                <th className="px-3 py-2 whitespace-nowrap">이전 판정</th>
                <th className="px-3 py-2 whitespace-nowrap">현재 판정</th>
                <th className="px-3 py-2 text-center whitespace-nowrap">변화</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {conditions.map((c) => {
                const isImproved = c.change === 'changed' && c.after_status === 'implemented' && c.before_status !== 'implemented';
                const isRegressed = c.change === 'changed' && c.before_status === 'implemented' && c.after_status !== 'implemented';
                const changeText =
                  c.change === 'added'
                    ? '추가'
                    : c.change === 'removed'
                      ? '삭제'
                      : isImproved
                        ? '개선'
                        : isRegressed
                          ? '퇴행'
                          : '변경';
                const changeStyle = isImproved
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : isRegressed
                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                    : 'bg-slate-100 text-slate-700 border-slate-200';
                return (
                  <tr key={c.key} className="hover:bg-slate-50/70">
                    <td className="px-3 py-2 text-slate-500 font-mono whitespace-nowrap align-top">
                      {c.requirement_key}
                    </td>
                    <td className="px-3 py-2 text-slate-800 wrap-anywhere align-top">
                      {c.text}
                    </td>
                    <td className="px-3 py-2 text-slate-500 whitespace-nowrap align-top">
                      {c.change === 'added' ? '-' : labelOf(c.before_status)}
                    </td>
                    <td className="px-3 py-2 text-slate-800 font-medium whitespace-nowrap align-top">
                      {c.change === 'removed' ? '-' : labelOf(c.after_status)}
                    </td>
                    <td className="px-3 py-2 text-center whitespace-nowrap align-top">
                      <span className={`inline-block px-2 py-0.5 rounded border text-[11px] font-medium ${changeStyle}`}>
                        {changeText}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
