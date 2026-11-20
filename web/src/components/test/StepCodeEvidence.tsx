/**
 * - 담당 파트: 프런트 엔드
 * - 작성자: 정래원
 * - 페이지 개요: 시험 단계마다 연결된 수락 조건의 코드 판정과 근거 위치만 보여주는 패널
 * - 주요 기능:
 *   1) 펼칠 때 단계별 조건 근거 API를 조회 (같은 요구사항의 다른 조건 근거는 섞지 않음)
 *   2) 근거 파일·줄 표시, VS Code 안에서는 해당 줄로 이동
 */

import { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { useProject } from '../../contexts/ProjectContext';
import { isVsCodeEnvironment, requestJumpToLine } from '../../services/vscodeHost';

interface StepEvidence {
  step_key: string;
  order: number;
  conditions: {
    requirement_key: string;
    condition_id: string;
    condition_text: string;
    status: string | null;
    evidence: { id: string; file_path: string; start_line: number; end_line: number }[];
  }[];
}
interface CaseEvidence { snapshot_id: string; steps: StepEvidence[] }

const labels: Record<string, string> = { implemented: '구현됨', partial: '부분 구현', mismatch: '불일치', not_found: '미구현 후보', needs_review: '확인 필요', not_statically_verifiable: '정적 검증 불가' };
const tone: Record<string, string> = { implemented: 'text-emerald-700', mismatch: 'text-red-700', partial: 'text-amber-700', not_found: 'text-red-700', needs_review: 'text-amber-700' };

interface Props { base: string; testCaseId: string; revision: number }

export function StepCodeEvidence({ base, testCaseId, revision }: Props) {
  const { projectId, projectName } = useProject();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<CaseEvidence | null>(null);
  const [error, setError] = useState('');

  // 펼쳤을 때만 단계별 근거를 조회하는 로직 (시험 개정이 바뀌면 다시 조회)
  useEffect(() => {
    if (!open) return;
    let active = true;
    api<CaseEvidence>(`${base}/test-cases/${testCaseId}/evidence?revision=${revision}`)
      .then(res => { if (active) { setData(res); setError(''); } })
      .catch(e => active && setError(e instanceof Error ? e.message : String(e)));
    return () => { active = false; };
  }, [open, base, testCaseId, revision]);

  const jump = (path: string, start: number, end: number) => {
    if (!projectId || !data || !isVsCodeEnvironment()) return;
    requestJumpToLine({ projectId, projectName: projectName ? projectName.replace(/^Project-/, '') : 'Project',
      snapshotId: data.snapshot_id, filePath: path, startLine: start, endLine: end });
  };

  return <details className="rounded-lg border border-slate-200 px-4 py-3" onToggle={e => setOpen((e.target as HTMLDetailsElement).open)}>
    <summary className="cursor-pointer font-medium text-slate-700">단계별 코드 근거</summary>
    <p className="mt-2 text-xs text-slate-500">각 단계에 연결된 수락 조건의 판정과 근거 코드만 보여줍니다. 같은 요구사항의 다른 조건 근거는 섞지 않습니다.</p>
    {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    {open && !data && !error && <p className="mt-2 text-xs text-slate-500">불러오는 중…</p>}
    {data?.steps.map(step => <div key={step.step_key} className="mt-3 border-t border-slate-100 pt-3">
      <p className="text-xs font-semibold text-slate-600">{step.order}단계</p>
      {!step.conditions.length && <p className="mt-1 text-xs text-slate-500">연결된 수락 조건이 없습니다.</p>}
      {step.conditions.map(c => <div key={c.condition_id} className="mt-2 text-sm">
        <p><span className={`text-xs font-semibold ${tone[c.status || ''] || 'text-slate-500'}`}>[{labels[c.status || ''] || '미판정'}]</span> <span className="text-xs text-slate-500">{c.requirement_key}</span> {c.condition_text}</p>
        {c.evidence.length ? <ul className="mt-1 pl-4 text-xs font-mono text-slate-600">
          {c.evidence.map(ev => <li key={ev.id}>{isVsCodeEnvironment()
            ? <button className="text-blue-600 underline underline-offset-2" onClick={() => jump(ev.file_path, ev.start_line, ev.end_line)}>{ev.file_path}:{ev.start_line}-{ev.end_line}</button>
            : `${ev.file_path}:${ev.start_line}-${ev.end_line}`}</li>)}
        </ul> : <p className="mt-1 pl-4 text-xs text-slate-500">근거 코드 없음</p>}
      </div>)}
    </div>)}
  </details>;
}
