import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { StepId, RequirementItem } from '../types';
import type { TestCase, TestExecution, TestSpecification, TestStep, StepResult } from '../types/test';
import { useProject } from '../contexts/ProjectContext';
import { api, fetchAll, jsonRequest, errorMessage, pollJobStatus, BASE_URL } from '../services/api';
import { Button, Card, PageHeader } from '../components/common';

type Spec = TestSpecification & { requirement_versions: {requirement_id:string;revision:number}[] };
type Req = RequirementItem & {revision:number;subtopic_id:string};
interface Run {id:string;created_at:string;status:string;requirement_versions:{requirement_id:string;revision:number}[]}
interface Draft {title:string;preconditions:string;steps:TestStep[];results:StepResult[];procedureChanged:boolean;executionChanged:boolean}
const inputClass='w-full border border-slate-200 rounded p-2 text-sm bg-white';
const predictionLabels:Record<string,string>={normal_expected:'정상 예상',failure_expected:'실패 예상',needs_review:'확인 필요',unknown:'미예측'};
const statusLabels={not_run:'미실행',passed:'통과',failed:'실패',on_hold:'보류'};
const resultFor=(step_key:string):StepResult=>({step_key,status:'not_run',actual:'',notes:'',performed_at:null});
const sectionLabels={login:'로그인',signup:'회원가입',password_find:'비밀번호찾기',notice:'공지사항',mypage:'마이페이지',authorization:'권한',general:'기타 기능'};

export const TestSpecView:React.FC<{onNavigateStep:(step:StepId)=>void;selectedRequirementId?:string}>=({onNavigateStep,selectedRequirementId})=>{
  const {projectId,setUnsavedChanges,setNavigationLocked,saveBeforeLeaveRef}=useProject();
  const base=`/projects/${projectId}`;
  const [specs,setSpecs]=useState<Spec[]>([]);
  const [specId,setSpecId]=useState('');
  const [runs,setRuns]=useState<Run[]>([]);
  const [runId,setRunId]=useState('');
  const [cases,setCases]=useState<TestCase[]>([]);
  const [requirements,setRequirements]=useState<Req[]>([]);
  const [executions,setExecutions]=useState<Record<string,TestExecution>>({});
  const [summary,setSummary]=useState<{scenario_summary:Record<string,number>;step_summary:Record<string,number>}|null>(null);
  const [activeId,setActiveId]=useState('');
  const [filter,setFilter]=useState(selectedRequirementId||'');
  const [drafts,setDrafts]=useState<Record<string,Draft>>({});
  const [editing,setEditing]=useState(false);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const [adding,setAdding]=useState(false);
  const [newTitle,setNewTitle]=useState('');
  const [newReqId,setNewReqId]=useState('');
  const [section,setSection]=useState('general');
  const [type,setType]=useState('positive');
  const [newSteps,setNewSteps]=useState<{action:string;expected:string;input:string}[]>([{action:'',expected:'',input:''}]);
  const pending=useRef<{fingerprint:string;payload:unknown}|null>(null);
  const spec=specs.find(s=>s.id===specId);
  const visible=cases.filter(c=>!filter||c.requirement_links.some(l=>l.requirement_id===filter));
  const active=visible.find(c=>c.id===activeId)||visible[0];
  const changed=Object.values(drafts).some(d=>d.procedureChanged||d.executionChanged);

  const loadLists=useCallback(async()=>{
    if(!projectId)return;
    const [specItems,runItems]=await Promise.all([fetchAll<Spec>(`/projects/${projectId}/test-specifications`),fetchAll<Run>(`/projects/${projectId}/verification-runs`)]);
    specItems.reverse();runItems.reverse();setSpecs(specItems);setRuns(runItems);setRunId(prev=>prev||runItems[0]?.id||'');setSpecId(prev=>prev||specItems[0]?.id||'');
  },[projectId]);
  const loadSpec=useCallback(async()=>{
    if(!projectId||!specId)return;
    const [current,items,stats]=await Promise.all([api<Spec>(`/projects/${projectId}/test-specifications/${specId}`),fetchAll<TestCase>(`/projects/${projectId}/test-cases?test_specification_id=${specId}`),api<{scenario_summary:Record<string,number>;step_summary:Record<string,number>}>(`/projects/${projectId}/test-specifications/${specId}/execution-summary`)]);
    const [reqs,records]=await Promise.all([
      Promise.all(current.requirement_versions.map(r=>api<Req>(`/projects/${projectId}/requirements/${r.requirement_id}?revision=${r.revision}`))),
      Promise.all(items.map(c=>fetchAll<TestExecution>(`/projects/${projectId}/test-cases/${c.id}/executions`))),
    ]);
    const latest:Record<string,TestExecution>={};
    items.forEach((c,i)=>{const e=records[i].filter(e=>e.test_case_revision===c.revision).sort((a,b)=>b.attempt_no-a.attempt_no)[0];if(e)latest[c.id]=e;});
    setSpecs(prev=>prev.map(s=>s.id===current.id?current:s));setCases(items);setRequirements(reqs);setExecutions(latest);setSummary(stats);setActiveId(prev=>items.some(c=>c.id===prev)?prev:items[0]?.id||'');setNewReqId(prev=>reqs.some(r=>r.id===prev)?prev:reqs[0]?.id||'');
  },[projectId,specId]);
  useEffect(()=>{void Promise.resolve().then(loadLists).catch(e=>setMessage(errorMessage(e)));},[loadLists]);
  useEffect(()=>{void Promise.resolve().then(loadSpec).catch(e=>setMessage(errorMessage(e)));},[loadSpec]);
  useEffect(()=>{
    const warn=(e:BeforeUnloadEvent)=>{if(changed||adding)e.preventDefault();};window.addEventListener('beforeunload',warn);
    return()=>window.removeEventListener('beforeunload',warn);
  },[changed,adding]);
  useEffect(()=>{setUnsavedChanges(changed||adding);return()=>setUnsavedChanges(false);},[changed,adding,setUnsavedChanges]);
  const draftFor=(c:TestCase):Draft=>drafts[c.id]||{title:c.title,preconditions:c.preconditions,steps:structuredClone(c.steps),results:c.steps.map(s=>executions[c.id]?.step_results.find(r=>r.step_key===s.step_key)||resultFor(s.step_key)),procedureChanged:false,executionChanged:false};
  const changeProcedure=(id:string,change:Partial<Draft>)=>{
    const c=cases.find(c=>c.id===id)!;const old=draftFor(c);const steps=change.steps||old.steps;
    setDrafts(prev=>({...prev,[id]:{...old,...change,procedureChanged:true,executionChanged:false,results:steps.map(s=>resultFor(s.step_key))}}));
  };
  const changeResult=(id:string,key:string,field:keyof StepResult,value:string)=>{
    const old=draftFor(cases.find(c=>c.id===id)!);
    setDrafts(prev=>({...prev,[id]:{...old,executionChanged:true,results:old.results.map(r=>{if(r.step_key!==key)return r;const changed={...r,[field]:value};return {...changed,performed_at:(changed.status==='passed'||changed.status==='failed')?new Date().toISOString():null};})}}));
  };
  const save=useCallback(async()=>{
    if(!spec)return false;setBusy(true);setNavigationLocked(true);setMessage('');
    try{
      const changes=Object.entries(drafts).filter(([,d])=>d.procedureChanged||d.executionChanged).map(([id,d])=>{
        const c=cases.find(c=>c.id===id)!;const ex=executions[id];
        const results=d.results.map(r=>({...r,performed_at:(r.status==='passed'||r.status==='failed')?(r.performed_at||new Date().toISOString()):null}));
        for(const r of results){if((r.status==='passed'||r.status==='failed')&&!r.actual.trim())throw new Error('통과·실패에는 실제 결과를 입력하세요.');if(r.status==='on_hold'&&!r.notes.trim())throw new Error('보류 사유를 입력하세요.');}
        return{test_case_id:id,base_test_case_revision:c.revision,...(d.procedureChanged?{procedure:{title:d.title,preconditions:d.preconditions,steps:d.steps}}:{}),...(d.executionChanged?{execution:!d.procedureChanged&&ex?{operation:'update',execution_id:ex.id,base_version:ex.version,step_results:results}:{operation:'create',bind_to:'after_save',step_results:results}}:{})};
      });
      const body={base_specification_revision:spec.revision,changes};const fingerprint=JSON.stringify(body);
      if(pending.current?.fingerprint!==fingerprint)pending.current={fingerprint,payload:{...body,client_save_id:crypto.randomUUID()}};
      await api(`${base}/test-specifications/${spec.id}/edit-batches`,jsonRequest('POST',pending.current.payload));
      pending.current=null;setDrafts({});setEditing(false);setUnsavedChanges(false);await loadSpec();setMessage('저장했습니다. 서버의 절차·수행 결과·집계를 다시 조회했습니다.');return true;
    }catch(e){setMessage(`${errorMessage(e)} · 편집 내용을 유지했습니다. 충돌 시 최신 개정을 확인한 뒤 다시 편집하세요.`);return false;}finally{setBusy(false);setNavigationLocked(false);}
  },[spec,drafts,cases,executions,base,loadSpec,setUnsavedChanges,setNavigationLocked]);
  useEffect(()=>{saveBeforeLeaveRef.current=adding?null:save;return()=>{saveBeforeLeaveRef.current=null;};},[saveBeforeLeaveRef,save,adding]);
  const createSpec=async()=>{
    const run=runs.find(r=>r.id===runId);if(!run)return;setBusy(true);
    try{const created=await api<Spec>(`${base}/test-specifications`,jsonRequest('POST',{verification_run_id:run.id,requirement_ids:run.requirement_versions.map(r=>r.requirement_id)}));await loadLists();setSpecId(created.id);setMessage('빈 수동 사양서를 만들었습니다. 시험을 직접 추가하세요.');}
    catch(e){setMessage(errorMessage(e));}finally{setBusy(false);}
  };
  const generate=async()=>{
    const run=runs.find(r=>r.id===runId);if(!run)return;setBusy(true);
    try{const job=await api<{id:string}>(`${base}/test-specifications/generate`,jsonRequest('POST',{verification_run_id:run.id,requirement_ids:run.requirement_versions.map(r=>r.requirement_id)}));const done=await pollJobStatus(projectId!,job.id) as {status:string;missing_features:{message:string}[]};await loadLists();setMessage(done.status==='blocked'?done.missing_features.map(f=>f.message).join(' / '):`생성 상태: ${done.status}`);}
    catch(e){setMessage(errorMessage(e));}finally{setBusy(false);}
  };
  const addCase=async(event:React.FormEvent)=>{
    event.preventDefault();const r=requirements.find(r=>r.id===newReqId);if(!r||!spec)return;setBusy(true);
    try{const links=[{requirement_id:r.id,requirement_revision:r.revision,condition_ids:r.conditions.map(c=>c.id!)}];
      await api(`${base}/test-cases`,jsonRequest('POST',{test_specification_id:spec.id,export_section_key:section,subtopic_id:r.subtopic_id,title:newTitle,type,preconditions:'',requirement_links:links,steps:newSteps.map((s,i)=>({step_key:crypto.randomUUID(),order:i+1,action:s.action,expected:s.expected,test_data:{account:null,input:s.input,notes:''},requirement_links:links}))}));
      setAdding(false);setNewTitle('');setNewSteps([{action:'',expected:'',input:''}]);await loadSpec();setMessage('수동 시험을 추가했습니다. 실제 수행은 아직 미실행입니다.');
    }catch(e){setMessage(errorMessage(e));}finally{setBusy(false);}
  };
  const exportExcel=async()=>{
    if(!spec)return;setBusy(true);
    try{const job=await api<{id:string}>(`${base}/exports/test-specification`,jsonRequest('POST',{test_specification_id:spec.id,revision:spec.revision,execution_selection:'latest_per_case',template_id:'thinktree-test-spec-v1',include_analysis_detail:true,format:'xlsx'}));
      const done=await pollJobStatus(projectId!,job.id) as {status:string;result_ref?:{id:string}};if(done.status!=='completed'||!done.result_ref)throw new Error(`출력 상태: ${done.status}`);
      const res=await fetch(`${BASE_URL}${base}/artifacts/${done.result_ref.id}/download`);if(!res.ok)throw new Error('다운로드 실패');const url=URL.createObjectURL(await res.blob());const link=document.createElement('a');link.href=url;link.download='테스트-사양서.xlsx';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }catch(e){setMessage(errorMessage(e));}finally{setBusy(false);}
  };
  if(!projectId)return <Button onClick={()=>onNavigateStep('SETUP')}>프로젝트를 선택하세요</Button>;
  return <div className="max-w-7xl mx-auto space-y-5">
    <PageHeader stepTag="04 / TEST SPECIFICATION" title="테스트 사양서" description="시험 절차와 실제 수행을 구분해 편집·저장하고 단계별 Excel을 출력합니다."/>
    {message&&<p role="status" className="bg-blue-50 p-3 rounded text-sm">{message}</p>}
    <div className="flex flex-wrap gap-2"><select aria-label="사양서 생성 기준 실행" className={inputClass+' max-w-sm'} value={runId} disabled={editing||adding||busy} onChange={e=>setRunId(e.target.value)}>{runs.map(r=><option key={r.id} value={r.id}>{r.created_at} · {r.status}</option>)}</select><Button disabled={!runId||busy||editing||adding} onClick={createSpec}>수동 사양서 만들기</Button><Button variant="secondary" disabled={!runId||busy||editing||adding} onClick={generate}>AI 시험 생성</Button></div>
    {!runs.length&&<p>먼저 요구사항을 검토 확정하고 검증을 접수하세요. 모델 미연결 실행에서도 수동 사양서를 작성할 수 있습니다.</p>}
    <div className="flex flex-wrap gap-2"><select aria-label="테스트 사양서 선택" value={specId} className={inputClass+' max-w-sm'} disabled={editing||adding||busy} onChange={e=>setSpecId(e.target.value)}>{specs.map(s=><option key={s.id} value={s.id}>{s.id.slice(0,8)} · 개정 {s.revision} · {s.status}</option>)}</select><Button disabled={!spec||busy||editing||adding} onClick={()=>setAdding(true)}>시험 수동 추가</Button><Button disabled={!spec||busy||editing||adding} onClick={exportExcel}>테스트 Excel 출력</Button></div>
    {summary&&<p className="text-sm">시나리오 {summary.scenario_summary.total}개 · 단계 {summary.step_summary.total}개 · 통과 {summary.step_summary.passed} / 실패 {summary.step_summary.failed} / 보류 {summary.step_summary.on_hold} / 미실행 {summary.step_summary.not_run}</p>}
    {adding&&<Card title="시험 수동 추가"><form className="space-y-3" onSubmit={addCase}>
      <label>시험 이름<input aria-label="시험 이름" required className={inputClass} value={newTitle} onChange={e=>setNewTitle(e.target.value)}/></label>
      <select aria-label="시험 연결 요구사항" className={inputClass} value={newReqId} onChange={e=>setNewReqId(e.target.value)}>{requirements.map(r=><option key={r.id} value={r.id}>{r.title} · 개정 {r.revision}</option>)}</select>
      <p className="text-xs">선택한 요구사항의 수락 조건을 이 시험의 각 단계에 연결합니다. 절차·기대 결과는 직접 작성하세요.</p>
      <div className="flex gap-3"><select aria-label="시험 출력 영역" className={inputClass} value={section} onChange={e=>setSection(e.target.value)}>{Object.entries(sectionLabels).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select><select aria-label="시험 유형" className={inputClass} value={type} onChange={e=>setType(e.target.value)}><option value="positive">정상</option><option value="negative">오류</option><option value="boundary">경계</option></select></div>
      {newSteps.map((s,i)=><fieldset key={i} className="border rounded p-3 space-y-2"><legend>단계 {i+1}</legend>{(['action','expected','input'] as const).map(k=><label key={k} className="block">{k==='action'?'시험 절차':k==='expected'?'기대 결과':'입력값'}<input aria-label={`새 단계 ${i+1} ${k}`} required={k!=='input'} className={inputClass} value={s[k]} onChange={e=>setNewSteps(prev=>prev.map((x,n)=>n===i?{...x,[k]:e.target.value}:x))}/></label>)}</fieldset>)}
      <div className="flex gap-2"><Button type="button" variant="secondary" onClick={()=>setNewSteps(prev=>[...prev,{action:'',expected:'',input:''}])}>시험 단계 추가</Button><Button type="submit" disabled={busy}>시험 추가 저장</Button><Button type="button" variant="secondary" disabled={busy} onClick={()=>setAdding(false)}>추가 취소</Button></div>
    </form></Card>}
    <div className="grid lg:grid-cols-[260px_1fr] gap-5">
      <Card title="시험 목록"><select aria-label="시험 요구사항 필터" className={inputClass} value={filter} disabled={editing} onChange={e=>setFilter(e.target.value)}><option value="">전체 요구사항</option>{requirements.map(r=><option key={r.id} value={r.id}>{r.title}</option>)}</select><div className="mt-3 space-y-2">{visible.map(c=><button key={c.id} disabled={busy} className={`w-full text-left border rounded p-3 text-sm ${active?.id===c.id?'bg-blue-50 border-blue-400':''}`} onClick={()=>setActiveId(c.id)}>{c.test_no}<strong className="block">{c.title}</strong><small>{statusLabels[(executions[c.id]?.status||'not_run') as keyof typeof statusLabels]} · 개정 {c.revision}{drafts[c.id]?.procedureChanged||drafts[c.id]?.executionChanged?' · 미저장':''}</small></button>)}</div></Card>
      <Card title={active?.title||'등록된 시험이 없습니다'} extra={active&&!adding?(editing?<div className="flex gap-2"><Button disabled={busy||!changed} onClick={save}>저장</Button><Button variant="secondary" disabled={busy} onClick={()=>{setDrafts({});setEditing(false);setUnsavedChanges(false);void loadSpec().catch(e=>setMessage(errorMessage(e)));}}>취소</Button></div>:<Button aria-label="시험 표 편집" disabled={busy} onClick={()=>setEditing(true)}>✎ 편집</Button>):undefined}>
        {active&&(()=>{const draft=draftFor(active);const steps=editing?draft.steps:active.steps;return <div className="space-y-4">
          <p className="text-sm">코드 예측: {predictionLabels[active.prediction?.status||'unknown']||'확인 필요'} · {active.prediction?.reason||'없음'}</p>
          {draft.procedureChanged&&<p className="text-amber-700 text-sm">절차를 변경했습니다. 이전 수행 결과를 새 절차에 적용하지 않습니다.</p>}
          {editing&&<label>시험 제목<input aria-label="편집 시험 제목" className={inputClass} value={draft.title} onChange={e=>changeProcedure(active.id,{title:e.target.value})}/></label>}
          {steps.map((step,i)=>{const result=editing?draft.results.find(r=>r.step_key===step.step_key):executions[active.id]?.step_results.find(r=>r.step_key===step.step_key);return <fieldset key={step.step_key} className="border rounded p-4 space-y-3"><legend>단계 {i+1}</legend>
            <div className="grid md:grid-cols-2 gap-3">{(['action','expected'] as const).map(k=><label key={k}>{k==='action'?'시험 절차':'기대 결과'}{editing?<textarea aria-label={`단계 ${i+1} ${k}`} className={inputClass} value={step[k]} onChange={e=>changeProcedure(active.id,{steps:draft.steps.map((s,n)=>n===i?{...s,[k]:e.target.value}:s)})}/>:<p className="text-sm whitespace-pre-wrap select-text">{step[k]}</p>}</label>)}</div>
            <label className="block">입력값{editing?<input aria-label={`단계 ${i+1} 입력값`} className={inputClass} value={step.test_data.input} onChange={e=>changeProcedure(active.id,{steps:draft.steps.map((s,n)=>n===i?{...s,test_data:{...s.test_data,input:e.target.value}}:s)})}/>:<p className="text-sm">{step.test_data.input||'미지정'}</p>}</label>
            {editing?<div className="grid md:grid-cols-3 gap-3"><label>수행 상태<select aria-label={`단계 ${i+1} 수행 상태`} className={inputClass} value={result?.status||'not_run'} onChange={e=>changeResult(active.id,step.step_key,'status',e.target.value)}>{Object.entries(statusLabels).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label><label>실제 결과<input aria-label={`단계 ${i+1} 실제 결과`} className={inputClass} value={result?.actual||''} onChange={e=>changeResult(active.id,step.step_key,'actual',e.target.value)}/></label><label>수행 메모 / 보류 사유<input aria-label={`단계 ${i+1} 수행 메모`} className={inputClass} value={result?.notes||''} onChange={e=>changeResult(active.id,step.step_key,'notes',e.target.value)}/></label></div>:<p className="text-sm">실제 수행: {statusLabels[result?.status||'not_run']} · {result?.actual} {result?.notes}</p>}
            <p className="text-xs text-slate-400">연결 조건 {step.requirement_links.reduce((n,r)=>n+r.condition_ids.length,0)}개 · 단계 키 {step.step_key}</p>
          </fieldset>;})}
          {editing&&<Button variant="secondary" onClick={()=>changeProcedure(active.id,{steps:[...draft.steps,{...structuredClone(draft.steps[0]),step_key:crypto.randomUUID(),order:draft.steps.length+1,action:'',expected:''}]})}>단계 추가</Button>}
        </div>;})()}
      </Card>
    </div>
  </div>;
};
