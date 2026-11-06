import React, { useCallback, useEffect, useState } from 'react';
import type { StepId, RequirementItem } from '../types';
import { useProject } from '../contexts/ProjectContext';
import { api, fetchAll, jsonRequest, errorMessage, pollJobStatus, BASE_URL } from '../services/api';
import { Button, Card, PageHeader } from '../components/common';
import { VerificationDetail } from '../components/verification/VerificationDetail';
import { VerificationScopeDialog } from '../components/verification/VerificationScopeDialog';
import { VerificationLoadingModal } from '../components/verification/VerificationLoadingModal';
import type { ScopeOptions, VerificationScope } from '../components/verification/VerificationScopeDialog';

interface Run { id: string; created_at: string; snapshot_id: string; status: string }
interface Row { requirement_id: string; requirement_revision: number; stable_key: string; title: string; topic_title: string; subtopic_title: string; analysis_state: string; status: string | null; reason: string; evidence_count: number }
interface RunInput { snapshot_id: string; requirement_versions: { requirement_id: string; revision: number }[]; model_config_version: number }
interface Job { id: string; operation: string; status: string; result_ref?: { id: string }; error?: { message: string }; missing_features: { message: string }[] }
const labels: Record<string, string> = { implemented: '구현됨', partial: '부분 구현', mismatch: '불일치', not_found: '미구현 후보', needs_review: '확인 필요', not_statically_verifiable: '정적 검증 불가', not_run: '미분석' };
const stages: Record<string, string> = { queued: '대기', scope_analysis: '화면 도달 범위 분석', matching: '코드 근거 매칭', condition_judgment: '조건별 판정' };

export const VerificationView: React.FC<{ onNavigateStep: (step: StepId) => void; onSelectRequirementForTest?: (id: string) => void }> = ({ onNavigateStep, onSelectRequirementForTest }) => {
  const { projectId } = useProject();
  const [runs, setRuns] = useState<Run[]>([]);
  const [runId, setRunId] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<Row | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [activeJob, setActiveJob] = useState('');
  const [verifyProgress, setVerifyProgress] = useState<{ completed: number; total: number; stage?: string } | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [scopeOptions, setScopeOptions] = useState<ScopeOptions | null>(null);
  const [pendingInput, setPendingInput] = useState<RunInput | null>(null);
  const base = `/projects/${projectId}`;

  const load = useCallback(async () => {
    if (!projectId) return;
    const [items, jobs] = await Promise.all([fetchAll<Run>(`/projects/${projectId}/verification-runs`), fetchAll<Job>(`/projects/${projectId}/jobs`)]);
    items.reverse(); setRuns(items); setRunId(items[0]?.id || '');
    const pending = jobs.find(j => j.operation === 'verify' && ['queued', 'running'].includes(j.status));
    if (pending) { setActiveJob(pending.id); if (pending.result_ref) setRunId(pending.result_ref.id); }
  }, [projectId]);
  useEffect(() => { void Promise.resolve().then(load).catch(e => setMessage(errorMessage(e))); }, [load]);
  useEffect(() => {
    let active = true;
    if (runId) {
      const query = `?q=${encodeURIComponent(search)}${filter ? `&status=${filter}` : ''}`;
      Promise.all([fetchAll<Row>(`${base}/verification-runs/${runId}/traceability${query}`), api<Record<string, number>>(`${base}/verification-runs/${runId}/summary${query}`)])
        .then(([items, stats]) => { if (active) { setRows(items); setSummary(stats); } }).catch(e => active && setMessage(errorMessage(e)));
    }
    return () => { active = false; };
  }, [runId, base, filter, search, refresh]);
  useEffect(() => {
    if (!activeJob || !projectId) return;
    let active = true;
    let lastProgress = '';
    void Promise.resolve().then(async () => {
      setBusy(true);
      try {
        await pollJobStatus(projectId, activeJob, job => {
          if (!active) return;
          const progress = job.progress;
          setVerifyProgress(progress || null);
          setMessage(progress ? `${stages[progress.stage] || progress.stage} · 요구사항 ${progress.completed}/${progress.total}` : '코드 검증 대기 중');
          const stamp = JSON.stringify(progress);
          if (stamp !== lastProgress) { lastProgress = stamp; setRefresh(n => n + 1); }
        });
        if (!active) return;
        await load(); setRefresh(n => n + 1);
        setMessage('');
      } catch (e) { if (active) setMessage(errorMessage(e)); }
      finally { if (active) { setBusy(false); setActiveJob(''); setVerifyProgress(null); } }
    });
    return () => { active = false; };
  }, [activeJob, projectId, load]);

  const fetchVerificationInput = async () => {
    const [snapshots, requirements, config] = await Promise.all([
      fetchAll<{ id: string }>(`${base}/code/snapshots`),
      fetchAll<RequirementItem & { revision: number }>(`${base}/requirements`),
      api<{ config_version: number; connection_status: string }>(`${base}/llm`),
    ]);
    if (!snapshots.length) throw new Error('코드를 먼저 등록·인덱싱하세요.');
    const approved = requirements.filter(r => r.review_status === 'approved');
    if (!approved.length) throw new Error('요구사항을 먼저 검토 확정하세요.');
    if (config.connection_status !== 'connected') throw new Error('프로젝트 설정에서 서버 모델의 실제 연결을 먼저 확인하세요.');
    return {
      snapshot_id: snapshots.at(-1)!.id,
      requirement_versions: approved.map(r => ({ requirement_id: r.id, revision: r.revision })),
      model_config_version: config.config_version,
    };
  };

  const startAutoVerification = async () => {
    setBusy(true); setMessage('검증 요구사항과 소스코드를 확인하고 있습니다...');
    try {
      const input = await fetchVerificationInput();
      const options = await api<ScopeOptions>(`${base}/verification-runs/prepare`, jsonRequest('POST', input));

      // AI 및 키워드 휴리스틱으로 추론된 추천 진입 파일들로 자동 구성
      const defaultStack = ['spring', 'react'].includes(options.stack) ? (options.stack as 'spring' | 'react') : 'react';
      const autoEntries: Record<string, string[]> = {};
      for (const group of options.groups) {
        if (group.suggested_files && group.suggested_files.length > 0) {
          autoEntries[group.key] = group.suggested_files;
        } else if (options.files.length > 0) {
          autoEntries[group.key] = [options.files[0]];
        }
      }

      const autoScope: VerificationScope = {
        stack: defaultStack,
        entries: autoEntries,
        confirmed: true,
      };

      setMessage('AI가 연관 코드 및 화면 범위를 자동 분석하여 검증을 시작합니다...');
      const job = await api<Job>(`${base}/verification-runs`, jsonRequest('POST', { ...input, scope_config: autoScope }));
      setScopeOptions(null); setPendingInput(null); setSelected(null); setSearch(''); setFilter('');
      await load();
      if (job.result_ref) setRunId(job.result_ref.id);
      if (['queued', 'running'].includes(job.status)) setActiveJob(job.id);
      else { setMessage(''); setBusy(false); setRefresh(n => n + 1); }
    } catch (e) {
      setMessage(errorMessage(e));
      setBusy(false);
    }
  };

  const openManualScope = async () => {
    setBusy(true); setMessage('');
    try {
      const input = await fetchVerificationInput();
      const options = await api<ScopeOptions>(`${base}/verification-runs/prepare`, jsonRequest('POST', input));
      setPendingInput(input);
      setScopeOptions(options);
    } catch (e) {
      setMessage(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const start = async (scope: VerificationScope) => {
    if (!pendingInput) return;
    setBusy(true); setMessage('검증 작업을 접수하고 있습니다.');
    try {
      const job = await api<Job>(`${base}/verification-runs`, jsonRequest('POST', { ...pendingInput, scope_config: scope }));
      setScopeOptions(null); setPendingInput(null); setSelected(null); setSearch(''); setFilter('');
      await load(); if (job.result_ref) setRunId(job.result_ref.id);
      if (['queued', 'running'].includes(job.status)) setActiveJob(job.id);
      else { setMessage(''); setBusy(false); setRefresh(n => n + 1); }
    } catch (e) { setMessage(errorMessage(e)); setBusy(false); }
  };
  const exportTrace = async () => {
    setBusy(true);
    try {
      const job = await api<{ id: string }>(`${base}/exports/traceability`, jsonRequest('POST', { verification_run_id: runId, format: 'xlsx' }));
      const done = await pollJobStatus(projectId!, job.id) as { result_ref?: { id: string } };
      if (!done.result_ref) throw new Error('Excel 파일을 만들지 못했습니다.');
      const response = await fetch(`${BASE_URL}${base}/artifacts/${done.result_ref.id}/download`);
      if (!response.ok) throw new Error('다운로드에 실패했습니다.');
      const url = URL.createObjectURL(await response.blob()); const link = document.createElement('a'); link.href = url; link.download = '요구사항-추적표.xlsx'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { setMessage(errorMessage(e)); } finally { setBusy(false); }
  };
  if (!projectId) return <Button onClick={() => onNavigateStep('SETUP')}>프로젝트를 선택하세요</Button>;
  if (selected) return <VerificationDetail requirementId={selected.requirement_id} runId={runId} onBack={() => setSelected(null)} onNavigateStep={onNavigateStep} onSelectForTest={() => onSelectRequirementForTest?.(selected.requirement_id)} />;
  const run = runs.find(r => r.id === runId);
  return <div className="max-w-7xl mx-auto space-y-5">
    <VerificationLoadingModal
      isOpen={!!activeJob}
      progress={verifyProgress}
      stageText={verifyProgress?.stage ? stages[verifyProgress.stage] || verifyProgress.stage : undefined}
    />
    <PageHeader stepTag="03 / VERIFICATION" title="검증 결과" description="요구사항별 코드 구현 판정과 근거를 확인합니다." />
    {message && <p role="status" className="p-3 bg-blue-50 rounded text-sm">{message}</p>}
    {scopeOptions && <VerificationScopeDialog options={scopeOptions} busy={busy} onCancel={() => { setScopeOptions(null); setPendingInput(null); setMessage('검증 설정을 취소했습니다. 모델을 호출하지 않았습니다.'); }} onRun={start} />}
    <div className="flex flex-wrap items-center gap-2">
      <Button disabled={busy} onClick={startAutoVerification}>코드 검증 시작</Button>
      <button
        type="button"
        disabled={busy}
        onClick={openManualScope}
        className="text-xs text-slate-500 hover:text-slate-700 underline px-1 py-1 cursor-pointer disabled:opacity-50"
        title="필요한 경우에만 화면별 진입 파일을 직접 지정합니다"
      >
        진입 파일 수동 지정 (고급)
      </button>
    </div>
    <Card title="요구사항 추적표" description={run ? `최근 검증 · ${run.created_at.replace('T', ' ').slice(0, 16)}` : '아직 검증 결과가 없습니다'}>
      <div className="flex flex-wrap gap-3 mb-4"><input aria-label="추적표 검색" placeholder="기능·주제 검색" value={search} onChange={e => setSearch(e.target.value)} className="border rounded p-2" /><select aria-label="판정 필터" value={filter} onChange={e => setFilter(e.target.value)} className="border rounded p-2"><option value="">전체</option>{Object.entries(labels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select><Button disabled={!runId || busy} onClick={exportTrace}>Excel 출력</Button></div>
      <p className="text-xs text-slate-500 mb-3">Excel은 검색·필터와 관계없이 전체 결과를 출력합니다.</p>
      <p className="text-sm mb-4">선택 범위 {summary.total || 0}건 · 구현됨 {summary.implemented || 0}건 · 구현율 {(summary.implementation_rate || 0).toFixed(1)}% · 미분석 {summary.not_run || 0}건</p>
      <div className="overflow-auto"><table className="w-full text-sm text-left"><thead><tr>{['주제 / 향후 개선 계획', '기능명', '판정', '근거', '사유', '상세'].map(v => <th className="p-3 border-b" key={v}>{v}</th>)}</tr></thead><tbody>{rows.map(r => <tr key={r.requirement_id}><td className="p-3 border-b">{r.topic_title} / {r.subtopic_title}</td><td className="p-3 border-b">{r.title}</td><td className="p-3 border-b">{labels[r.status || 'not_run']}</td><td className="p-3 border-b">{r.evidence_count}곳</td><td className="p-3 border-b">{r.reason}</td><td className="p-3 border-b"><Button onClick={() => setSelected(r)}>상세 보기</Button></td></tr>)}</tbody></table>{!rows.length && <p className="p-4 text-sm text-slate-500">현재 선택 범위의 요구사항이 없습니다.</p>}</div>
    </Card>
  </div>;
};