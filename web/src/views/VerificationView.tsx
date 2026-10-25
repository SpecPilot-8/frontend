import React, { useCallback, useEffect, useState } from 'react';
import type { StepId, RequirementItem } from '../types';
import { useProject } from '../contexts/ProjectContext';
import { api, fetchAll, jsonRequest, errorMessage, pollJobStatus, BASE_URL } from '../services/api';
import { Button, Card, PageHeader } from '../components/common';
import { VerificationDetail } from '../components/verification/VerificationDetail';

interface Run { id: string; created_at: string; snapshot_id: string; status: string }
interface Row { requirement_id: string; requirement_revision: number; stable_key: string; title: string; topic_title: string; subtopic_title: string; analysis_state: string; status: string | null; reason: string; evidence_count: number }
const labels: Record<string,string> = { implemented:'구현됨', partial:'부분 구현', mismatch:'불일치', not_found:'미구현 후보', needs_review:'확인 필요', not_statically_verifiable:'정적 검증 불가', not_run:'미분석' };
export const VerificationView: React.FC<{ onNavigateStep: (step: StepId) => void; onSelectRequirementForTest?: (id: string) => void }> = ({ onNavigateStep, onSelectRequirementForTest }) => {
  const { projectId } = useProject();
  const [runs,setRuns] = useState<Run[]>([]);
  const [runId,setRunId] = useState('');
  const [rows,setRows] = useState<Row[]>([]);
  const [summary,setSummary] = useState<Record<string,number>>({});
  const [selected,setSelected] = useState<Row | null>(null);
  const [search,setSearch] = useState('');
  const [filter,setFilter] = useState('');
  const [message,setMessage] = useState('');
  const [busy,setBusy] = useState(false);
  const base = `/projects/${projectId}`;
  const load = useCallback(async () => {
    if (!projectId) return;
    const items = await fetchAll<Run>(`/projects/${projectId}/verification-runs`);
    items.reverse(); setRuns(items); setRunId(prev => prev || items[0]?.id || '');
  },[projectId]);
  useEffect(() => { void Promise.resolve().then(load).catch(e => setMessage(errorMessage(e))); },[load]);
  useEffect(() => {
    let active=true;
    if (runId) {
      const query=`?q=${encodeURIComponent(search)}${filter ? `&status=${filter}`:''}`;
      Promise.all([fetchAll<Row>(`${base}/verification-runs/${runId}/traceability${query}`), api<Record<string,number>>(`${base}/verification-runs/${runId}/summary${query}`)])
        .then(([items,stats]) => { if(active){setRows(items);setSummary(stats);} }).catch(e => active && setMessage(errorMessage(e)));
    }
    return () => {active=false;};
  },[runId,base,filter,search]);
  const verify = async () => {
    setBusy(true);setMessage('');
    try {
      const [snapshots,requirements,config] = await Promise.all([
        fetchAll<{id:string}>(`${base}/code/snapshots`),fetchAll<RequirementItem & {revision:number}>(`${base}/requirements`),api<{config_version:number}>(`${base}/llm`),
      ]);
      if (!snapshots.length) throw new Error('코드를 먼저 등록·인덱싱하세요.');
      const approved=requirements.filter(r => r.review_status==='approved');
      if (!approved.length) throw new Error('요구사항을 먼저 검토 확정하세요.');
      const job=await api<{id:string}>(`${base}/verification-runs`,jsonRequest('POST',{snapshot_id:snapshots.at(-1)!.id,requirement_versions:approved.map(r=>({requirement_id:r.id,revision:r.revision})),model_config_version:config.config_version}));
      const done=await pollJobStatus(projectId!,job.id) as {status:string;missing_features:{message:string}[]};
      const items=(await fetchAll<Run>(`${base}/verification-runs`)).reverse();setRuns(items);setRunId(items[0]?.id || '');
      setMessage(done.status==='blocked' ? `분석 차단: ${done.missing_features.map(f=>f.message).join(' / ')}. 판정은 미분석으로 남깁니다.` : `검증 상태: ${done.status}`);
    } catch(e){setMessage(errorMessage(e));} finally{setBusy(false);}
  };
  const exportTrace = async () => {
    setBusy(true);
    try {
      const job=await api<{id:string}>(`${base}/exports/traceability`,jsonRequest('POST',{verification_run_id:runId,format:'xlsx'}));
      const done=await pollJobStatus(projectId!,job.id) as {status:string;result_ref?:{id:string}};
      if(done.status!=='completed'||!done.result_ref) throw new Error(`내보내기 상태: ${done.status}`);
      const response=await fetch(`${BASE_URL}${base}/artifacts/${done.result_ref.id}/download`);
      if(!response.ok) throw new Error('다운로드에 실패했습니다.');
      const url=URL.createObjectURL(await response.blob());const link=document.createElement('a');link.href=url;link.download='요구사항-추적표.xlsx';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }catch(e){setMessage(errorMessage(e));}finally{setBusy(false);}
  };
  if(!projectId)return <Button onClick={()=>onNavigateStep('SETUP')}>프로젝트를 선택하세요</Button>;
  if(selected)return <VerificationDetail requirementId={selected.requirement_id} requirementRevision={selected.requirement_revision} runId={runId} onBack={()=>setSelected(null)} onNavigateStep={onNavigateStep} onSelectForTest={()=>onSelectRequirementForTest?.(selected.requirement_id)} />;
  const run=runs.find(r=>r.id===runId);
  return <div className="max-w-7xl mx-auto space-y-5">
    <PageHeader stepTag="03 / VERIFICATION" title="검증 결과" description="선택한 실행의 요구사항 개정·코드 스냅샷을 기준으로 판정과 근거를 확인합니다." />
    {message&&<p role="status" className="p-3 bg-blue-50 rounded text-sm">{message}</p>}
    <div className="flex flex-wrap gap-2"><Button disabled={busy} onClick={verify}>코드 검증 시작</Button><Button variant="secondary" onClick={()=>onNavigateStep('ANALYSIS')}>명세 검토로 이동</Button><Button variant="secondary" onClick={()=>onNavigateStep('TEST_SPEC')}>테스트 사양서로 이동</Button></div>
    <Card title="요구사항 추적표" description={run ? `실행 상태: ${run.status} · 스냅샷 ${run.snapshot_id}`:'아직 검증 실행이 없습니다'}>
      <div className="flex flex-wrap gap-3 mb-4"><select aria-label="검증 실행 선택" value={runId} onChange={e=>setRunId(e.target.value)} className="border rounded p-2 max-w-sm">{runs.map(r=><option key={r.id} value={r.id}>{r.created_at} · {r.status}</option>)}</select><input aria-label="추적표 검색" placeholder="기능·주제 검색" value={search} onChange={e=>setSearch(e.target.value)} className="border rounded p-2"/><select aria-label="판정 필터" value={filter} onChange={e=>setFilter(e.target.value)} className="border rounded p-2"><option value="">전체</option>{Object.entries(labels).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select><Button disabled={!runId||busy} onClick={exportTrace}>추적표 Excel 출력</Button></div>
      <p className="text-sm mb-4">선택 범위 {summary.total||0}건 · 구현됨 {summary.implemented||0}건 · 구현율 {(summary.implementation_rate||0).toFixed(1)}% · 미분석 {summary.not_run||0}건</p>
      <div className="overflow-auto"><table className="w-full text-sm text-left"><thead><tr>{['주제 / 소주제','기능명','판정','근거','사유','상세'].map(v=><th className="p-3 border-b" key={v}>{v}</th>)}</tr></thead><tbody>{rows.map(r=><tr key={r.requirement_id}><td className="p-3 border-b">{r.topic_title} / {r.subtopic_title}</td><td className="p-3 border-b">{r.title}<small className="block">개정 {r.requirement_revision}</small></td><td className="p-3 border-b">{labels[r.status||'not_run']}<small className="block">{r.analysis_state}</small></td><td className="p-3 border-b">{r.evidence_count}곳</td><td className="p-3 border-b">{r.reason}</td><td className="p-3 border-b"><Button onClick={()=>setSelected(r)}>상세 보기</Button></td></tr>)}</tbody></table></div>
    </Card>
  </div>;
};
