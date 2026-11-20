/**
 * - 담당 파트: 프런트 엔드
 * - 작성자: 정래원
 * - 페이지 개요: 사양서 작성 이후 요구사항 개정이나 새 검증 판정 변화로 다시 시험해야 하는 시험을 보여주는 패널
 * - 주요 기능:
 *   1) 재시험 대상 API 조회 (가장 최근 완료 검증 실행과 비교)
 *   2) 시험별 사유(요구사항 개정, 판정 변화) 표시와 해당 시험으로 이동
 */

import { useEffect, useState } from 'react';
import { api } from '../../services/api';

interface Reason {
  kind: 'requirement_revised' | 'verdict_changed';
  before_revision?: number; after_revision?: number;
  requirement_key?: string; condition_key?: string; before_status?: string; after_status?: string;
}
interface RetestReport {
  compared_run_id: string | null;
  retest_count: number;
  items: { test_case_id: string; test_no: string; title: string; reasons: Reason[] }[];
}

const labels: Record<string, string> = { implemented: '구현됨', partial: '부분 구현', mismatch: '불일치', not_found: '미구현 후보', needs_review: '확인 필요', not_statically_verifiable: '정적 검증 불가' };

function describe(r: Reason) {
  if (r.kind === 'requirement_revised') return `요구사항 개정 ${r.before_revision} → ${r.after_revision}`;
  return `판정 변화 ${labels[r.before_status || ''] || r.before_status} → ${labels[r.after_status || ''] || r.after_status}${r.condition_key || r.requirement_key ? ` (${r.condition_key || r.requirement_key})` : ''}`;
}

interface Props { base: string; specId: string; revision: number; onSelectCase: (id: string) => void }

export function TestRetestPanel({ base, specId, revision, onSelectCase }: Props) {
  const [report, setReport] = useState<RetestReport | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    api<RetestReport>(`${base}/test-specifications/${specId}/retest?revision=${revision}`)
      .then(res => { if (active) { setReport(res); setError(''); } })
      .catch(e => active && setError(e instanceof Error ? e.message : String(e)));
    return () => { active = false; };
  }, [base, specId, revision]);

  if (error) return <p className="text-xs text-amber-800">재시험 대상을 확인하지 못했습니다: {error}</p>;
  if (!report || !report.retest_count) return null;
  return <details className="rounded-lg border border-orange-200 bg-orange-50/50 px-4 py-3 text-sm" open>
    <summary className="cursor-pointer font-medium text-orange-900">재시험 필요 {report.retest_count}건 · 사양서 작성 이후 요구사항이나 코드 판정이 바뀌었습니다</summary>
    <ul className="mt-3 space-y-2">
      {report.items.map(item => <li key={item.test_case_id}>
        <button className="text-left font-medium text-blue-700 underline underline-offset-2" onClick={() => onSelectCase(item.test_case_id)}>{item.test_no} {item.title}</button>
        <ul className="mt-1 list-disc pl-5 text-xs text-slate-600">{item.reasons.map((r, i) => <li key={i}>{describe(r)}</li>)}</ul>
      </li>)}
    </ul>
  </details>;
}
