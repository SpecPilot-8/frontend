/**
 * - 담당 파트: 프런트 엔드
 * - 작성자: 정래원
 * - 페이지 개요: 코드가 바뀌면 이 검증 실행의 어느 화면·요구사항·시험을 다시 봐야 하는지 보여주는 패널
 * - 주요 기능:
 *   1) 새 코드 스냅샷을 고르거나, 고칠 파일을 직접 골라 영향 범위 조회
 *   2) 영향 화면별 경유 파일·요구사항, 다시 볼 시험 목록 표시
 */

import { useEffect, useState } from 'react';
import { Button } from '../common';
import { api } from '../../services/api';
import { formatRunDate } from '../../services/format';

interface ImpactScreen {
  screen_key: string;
  title: string;
  via_files: { path: string; change: string; entry: boolean }[];
  entry_removed: string[];
  requirements: { requirement_id: string; stable_key: string; title: string }[];
}
interface ImpactResponse {
  changed_files: { path: string; change: string }[];
  unreached_files: string[];
  screen_count: number;
  requirement_count: number;
  test_case_count: number;
  screens: ImpactScreen[];
  test_cases: { test_case_id: string; test_no: string; title: string; requirement_ids: string[] }[];
  method: string;
}
interface Snapshot { id: string; created_at?: string; file_count?: number }

const changeLabel: Record<string, string> = { modified: '수정', added: '추가', deleted: '삭제' };

interface Props { base: string; runId: string; snapshotId: string; onClose: () => void }

export function ChangeImpactPanel({ base, runId, snapshotId, onClose }: Props) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [files, setFiles] = useState<string[]>([]);
  const [target, setTarget] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [data, setData] = useState<ImpactResponse | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // 비교할 스냅샷 목록과 현재 실행 스냅샷의 파일 목록을 불러오는 로직
  useEffect(() => {
    let active = true;
    void Promise.all([
      api<{ items: Snapshot[] }>(`${base}/code/snapshots?limit=200`),
      api<{ files: { path: string }[] }>(`${base}/code/snapshots/${snapshotId}/files`),
    ]).then(([s, f]) => {
      if (!active) return;
      setSnapshots(s.items.filter(x => x.id !== snapshotId));
      setFiles(f.files.map(x => x.path));
    }).catch(e => active && setError(e instanceof Error ? e.message : String(e)));
    return () => { active = false; };
  }, [base, snapshotId]);

  const run = async () => {
    setLoading(true); setError('');
    try {
      const query = new URLSearchParams();
      if (target) query.set('snapshot_id', target);
      picked.forEach(f => query.append('file', f));
      setData(await api<ImpactResponse>(`${base}/verification-runs/${runId}/impact?${query}`));
    } catch (e) {
      setData(null); setError(e instanceof Error ? e.message : String(e));
    } finally { setLoading(false); }
  };

  return <section className="mb-4 rounded-xl border border-violet-200 bg-violet-50/40 p-4 text-sm space-y-3">
    <div className="flex items-start justify-between gap-3">
      <div>
        <h3 className="font-semibold text-slate-800">변경 영향 확인</h3>
        <p className="text-xs text-slate-500">새 코드 스냅샷이나 고칠 파일을 고르면 다시 봐야 할 화면·요구사항·시험을 정적 호출 그래프로 찾습니다. 판정을 다시 하지는 않습니다.</p>
      </div>
      <Button variant="secondary" onClick={onClose}>닫기</Button>
    </div>
    <div className="flex flex-wrap items-center gap-2">
      <select aria-label="비교할 코드 스냅샷" value={target} onChange={e => setTarget(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-xs bg-white max-w-xs">
        <option value="">새 스냅샷 비교 안 함</option>
        {snapshots.map(s => <option key={s.id} value={s.id}>스냅샷 {s.id.slice(0, 8)}{s.created_at ? ` · ${formatRunDate(s.created_at)}` : ''}</option>)}
      </select>
      <select aria-label="고칠 파일 추가" value="" onChange={e => e.target.value && setPicked(p => [...new Set([...p, e.target.value])])} className="border border-slate-200 rounded-lg px-3 py-2 text-xs bg-white max-w-md">
        <option value="">고칠 파일 추가…</option>
        {files.filter(f => !picked.includes(f)).map(f => <option key={f} value={f}>{f}</option>)}
      </select>
      <Button disabled={loading || (!target && !picked.length)} onClick={run}>{loading ? '확인 중…' : '영향 범위 확인'}</Button>
    </div>
    {!!picked.length && <div className="flex flex-wrap gap-1.5">{picked.map(f => <button key={f} onClick={() => setPicked(p => p.filter(x => x !== f))} className="rounded-full border border-slate-300 bg-white px-2.5 py-0.5 text-xs text-slate-700" title="빼기">{f.split('/').pop()} ✕</button>)}</div>}
    {error && <p className="text-xs text-red-700">{error}</p>}
    {data && <div className="space-y-3">
      <p className="text-xs font-medium text-slate-700">바뀐 파일 {data.changed_files.length}개 → 영향 화면 <strong>{data.screen_count}</strong> · 요구사항 <strong>{data.requirement_count}</strong> · 다시 볼 시험 <strong>{data.test_case_count}</strong></p>
      {!data.screens.length && <p className="text-xs text-slate-600">이 검증 실행의 화면 범위에 닿는 변경이 없습니다.</p>}
      {data.screens.map(s => <div key={s.screen_key} className="rounded-lg border border-slate-200 bg-white p-3">
        <p className="font-medium text-slate-800">{s.title || s.screen_key}</p>
        <p className="mt-1 text-xs text-slate-500">경유: {s.via_files.map(f => `${f.path.split('/').pop()}(${changeLabel[f.change] || f.change}${f.entry ? '·진입 파일' : ''})`).join(', ') || '없음'}{s.entry_removed.length ? ` · 진입 파일 삭제 ${s.entry_removed.length}개` : ''}</p>
        <ul className="mt-2 list-disc pl-5 text-xs text-slate-700">{s.requirements.map(r => <li key={r.requirement_id}>{r.title || r.stable_key}</li>)}</ul>
      </div>)}
      {!!data.test_cases.length && <div className="rounded-lg border border-slate-200 bg-white p-3">
        <p className="font-medium text-slate-800">다시 볼 시험</p>
        <ul className="mt-2 list-disc pl-5 text-xs text-slate-700">{data.test_cases.map(t => <li key={t.test_case_id}>{t.test_no} {t.title}</li>)}</ul>
      </div>}
      {!!data.unreached_files.length && <p className="text-xs text-slate-500">화면 범위 밖 변경: {data.unreached_files.map(f => f.split('/').pop()).join(', ')}</p>}
      <p className="text-xs text-slate-400">{data.method}</p>
    </div>}
  </section>;
}
