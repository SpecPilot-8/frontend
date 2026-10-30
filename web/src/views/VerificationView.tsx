import React, { useCallback, useEffect, useState } from 'react';
import type { StepId, RequirementItem } from '../types';
import { formatRequirementTitle } from '../types/verification';
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
const statusBadgeStyles: Record<string, string> = {
  implemented: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  partial: 'bg-amber-50 text-amber-700 border-amber-200',
  mismatch: 'bg-rose-50 text-rose-700 border-rose-200',
  not_found: 'bg-blue-50 text-blue-700 border-blue-200',
  needs_review: 'bg-purple-50 text-purple-700 border-purple-200',
  not_statically_verifiable: 'bg-slate-100 text-slate-600 border-slate-200',
  not_run: 'bg-slate-50 text-slate-500 border-slate-200',
};
const stages: Record<string, string> = { queued: '대기', scope_analysis: '화면 도달 범위 분석', matching: '코드 근거 매칭', condition_judgment: '조건별 판정' };

export const VerificationView: React.FC<{ onNavigateStep: (step: StepId) => void; onSelectRequirementForTest?: (id: string) => void }> = ({ onNavigateStep, onSelectRequirementForTest }) => {
  const { projectId } = useProject();
  const [runs, setRuns] = useState<Run[]>([]);
  const [runId, setRunId] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [reqMap, setReqMap] = useState<Record<string, RequirementItem>>({});
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<Row | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [activeJob, setActiveJob] = useState('');
  const [cancellingJob, setCancellingJob] = useState(false);
  const [verifyProgress, setVerifyProgress] = useState<{ completed: number; total: number; stage?: string } | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [scopeOptions, setScopeOptions] = useState<ScopeOptions | null>(null);
  const [pendingInput, setPendingInput] = useState<RunInput | null>(null);
  const base = `/projects/${projectId}`;

  const load = useCallback(async () => {
    if (!projectId) return;
    const [items, jobs, reqs] = await Promise.all([
      fetchAll<Run>(`/projects/${projectId}/verification-runs`),
      fetchAll<Job>(`/projects/${projectId}/jobs`),
      fetchAll<RequirementItem>(`/projects/${projectId}/requirements`).catch(() => [] as RequirementItem[]),
    ]);
    items.reverse(); setRuns(items); setRunId(prev => items.some(r => r.id === prev) ? prev : items[0]?.id || '');
    setReqMap(Object.fromEntries(reqs.map(r => [r.id, r])));
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
        const done = await pollJobStatus(projectId, activeJob, job => {
          if (!active) return;
          const progress = job.progress;
          setVerifyProgress(progress || null);
          setMessage(progress ? `${stages[progress.stage] || progress.stage} · 요구사항 ${progress.completed}/${progress.total}` : '코드 검증 대기 중');
          const stamp = JSON.stringify(progress);
          if (stamp !== lastProgress) { lastProgress = stamp; setRefresh(n => n + 1); }
        }) as Job;
        if (!active) return;
        await load(); setRefresh(n => n + 1);
        setMessage(done.status === 'completed' ? '조건별 코드 판정을 완료했습니다. 추적표와 원문·코드 근거를 확인하세요. 실제 실행 테스트 결과와는 구분됩니다.'
          : done.error?.message || done.missing_features?.map(f => f.message).join(' / ') || `검증 상태: ${done.status}`);
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
      if (['queued', 'running'].includes(job.status)) {
        setActiveJob(job.id);
      } else {
        setMessage(job.error?.message || job.missing_features?.map(f => f.message).join(' / ') || '검증 실패');
        setBusy(false);
      }
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

  const cancelActiveJob = async () => {
    if (!projectId || !activeJob || cancellingJob) return;
    if (!window.confirm('진행 중인 코드 정합성 검증 작업을 중단하시겠습니까?')) return;
    setCancellingJob(true);
    try {
      await api(`${base}/jobs/${activeJob}/cancel`, jsonRequest('POST', {}));
      setMessage('코드 검증 작업을 사용자가 중단했습니다.');
      setActiveJob('');
      setVerifyProgress(null);
      await load();
      setRefresh(n => n + 1);
    } catch (e) {
      setMessage(`작업 중단 실패: ${errorMessage(e)}`);
    } finally {
      setCancellingJob(false);
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
      else { setMessage(job.error?.message || job.missing_features.map(f => f.message).join(' / ')); setBusy(false); }
    } catch (e) { setMessage(errorMessage(e)); setBusy(false); }
  };
  const exportTrace = async () => {
    setBusy(true);
    try {
      const job = await api<{ id: string }>(`${base}/exports/traceability`, jsonRequest('POST', { verification_run_id: runId, format: 'xlsx' }));
      const done = await pollJobStatus(projectId!, job.id) as { status: string; result_ref?: { id: string } };
      if (done.status !== 'completed' || !done.result_ref) throw new Error(`내보내기 상태: ${done.status}`);
      const response = await fetch(`${BASE_URL}${base}/artifacts/${done.result_ref.id}/download`);
      if (!response.ok) throw new Error('다운로드에 실패했습니다.');
      const url = URL.createObjectURL(await response.blob()); const link = document.createElement('a'); link.href = url; link.download = '요구사항-추적표.xlsx'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { setMessage(errorMessage(e)); } finally { setBusy(false); }
  };
  if (!projectId) return <Button onClick={() => onNavigateStep('SETUP')}>프로젝트를 선택하세요</Button>;
  if (selected) return <VerificationDetail requirementId={selected.requirement_id} requirementRevision={selected.requirement_revision} runId={runId} onBack={() => setSelected(null)} onNavigateStep={onNavigateStep} onSelectForTest={() => onSelectRequirementForTest?.(selected.requirement_id)} />;
  const run = runs.find(r => r.id === runId);
  return <div className="max-w-7xl mx-auto space-y-5">
    <VerificationLoadingModal
      isOpen={!!activeJob}
      progress={verifyProgress}
      stageText={verifyProgress?.stage ? stages[verifyProgress.stage] || verifyProgress.stage : undefined}
      onCancel={cancelActiveJob}
      cancelling={cancellingJob}
    />
    <PageHeader stepTag="03 / VERIFICATION" title="검증 결과" description="선택한 실행의 요구사항 개정·코드 스냅샷을 기준으로 판정과 근거를 확인합니다." />
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
      <Button variant="secondary" onClick={() => onNavigateStep('ANALYSIS')}>명세 검토로 이동</Button>
      <Button variant="secondary" onClick={() => onNavigateStep('SETUP')}>모델·코드 설정</Button>
      <Button variant="secondary" onClick={() => onNavigateStep('TEST_SPEC')}>테스트 사양서로 이동</Button>
    </div>
    <Card title="요구사항 추적표" description={run ? `실행 상태: ${run.status} · 스냅샷 ${run.snapshot_id}` : '아직 검증 실행이 없습니다'}>
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-slate-50/80 border border-slate-200/80 rounded-xl mb-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-0">
          <select aria-label="검증 실행 선택" value={runId} disabled={busy} onChange={e => { setRunId(e.target.value); setMessage(''); }} className="border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 bg-white shadow-2xs focus:outline-none focus:border-blue-500 max-w-xs truncate">{runs.map(r => <option key={r.id} value={r.id}>{r.created_at} · {r.status}</option>)}</select>
          <input aria-label="추적표 검색" placeholder="기능·주제 검색" value={search} onChange={e => setSearch(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 bg-white shadow-2xs focus:outline-none focus:border-blue-500 w-52" />
          <select aria-label="판정 필터" value={filter} onChange={e => setFilter(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 bg-white shadow-2xs focus:outline-none focus:border-blue-500"><option value="">전체</option>{Object.entries(labels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        </div>
        <Button disabled={!runId || busy} onClick={exportTrace} className="whitespace-nowrap shadow-2xs">실행 전체 Excel 출력</Button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4 px-1">
        <p className="text-xs font-medium text-slate-700 bg-slate-100/80 border border-slate-200/70 px-3 py-1.5 rounded-lg">
          선택 범위 <strong className="text-slate-900">{summary.total || 0}건</strong> · 구현됨 <strong className="text-emerald-600">{summary.implemented || 0}건</strong> · 구현율 <strong className="text-blue-600">{(summary.implementation_rate || 0).toFixed(1)}%</strong> · 미분석 <strong className="text-slate-500">{summary.not_run || 0}건</strong>
        </p>
        <p className="text-xs text-slate-400">Excel은 현재 검색·필터와 관계없이 선택한 검증 실행 전체를 출력합니다.</p>
      </div>
      <div className={`rounded-xl border border-slate-200 overflow-auto ${rows.length > 10 ? 'max-h-160' : ''}`}>
        <table className="w-full min-w-230 text-sm text-left border-collapse">
          <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 sticky top-0 z-10">
            <tr>
              <th className="w-44 min-w-40 px-4 py-3 whitespace-nowrap">주제 / 소주제</th>
              <th className="w-52 min-w-45 px-4 py-3 whitespace-nowrap">기능명</th>
              <th className="w-28 min-w-27.5 px-4 py-3 text-center whitespace-nowrap">판정</th>
              <th className="w-20 min-w-19 px-3 py-3 text-center whitespace-nowrap">근거</th>
              <th className="px-4 py-3 whitespace-nowrap">사유</th>
              <th className="w-24 min-w-24 px-4 py-3 text-center whitespace-nowrap">상세</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {rows.map(r => {
              const statusKey = r.status || 'not_run';
              return (
                <tr key={r.requirement_id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-4 py-3.5 align-middle text-xs font-medium text-slate-700 break-keep leading-snug">
                    {r.topic_title} / {r.subtopic_title}
                  </td>
                  <td className="px-4 py-3.5 align-middle break-keep">
                    <div className="font-semibold text-slate-900 leading-snug">
                      {formatRequirementTitle(r.title, reqMap[r.requirement_id]?.original_text, reqMap[r.requirement_id]?.conditions)}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 align-middle text-center whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusBadgeStyles[statusKey] || statusBadgeStyles.not_run}`}>
                      {labels[statusKey]}
                    </span>
                    <small className="block mt-1 text-[11px] text-slate-400">{r.analysis_state}</small>
                  </td>
                  <td className="px-3 py-3.5 align-middle text-center whitespace-nowrap">
                    <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-md text-xs font-semibold ${r.evidence_count > 0 ? 'bg-blue-50 text-blue-700 border border-blue-100' : 'bg-slate-100 text-slate-500'}`}>
                      {r.evidence_count}곳
                    </span>
                  </td>
                  <td className="px-4 py-3.5 align-middle text-[13px] text-slate-600 leading-relaxed break-keep">
                    {r.reason}
                  </td>
                  <td className="px-4 py-3.5 align-middle text-center whitespace-nowrap">
                    <Button size="sm" className="whitespace-nowrap" onClick={() => setSelected(r)}>상세 보기</Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!rows.length && <p className="p-6 text-center text-sm text-slate-500 bg-white">현재 선택 범위의 요구사항이 없습니다.</p>}
      </div>
    </Card>
  </div>;
};
