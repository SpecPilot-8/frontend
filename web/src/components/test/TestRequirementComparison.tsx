import { useEffect, useState } from 'react';
import { Button, Card } from '../common';
import { api, errorMessage } from '../../services/api';
import { compareTestRequirements, designDecisionLabels } from '../../services/testComparison';
import type { PinnedRequirement } from '../../services/testComparison';
import type { TestRequirement } from '../../services/testEvidence';
import { currentDesign } from '../../services/testEvidence';
import type { HumanDesignReview, RequirementLink, TestCase, TestStep } from '../../types/test';
import { ConditionReviewDialog } from './ConditionReviewDialog';

interface Props {
  projectId: string; versions: PinnedRequirement[]; requirements: TestRequirement[];
  cases: TestCase[]; test: TestCase; steps: TestStep[]; editing: boolean; dirty: boolean;
  onSource: (links: RequirementLink[]) => void; onSelectStep: (caseId: string, stepKey: string) => void;
}

export function TestRequirementComparison({projectId, versions, requirements, cases, test, steps, editing, dirty, onSource, onSelectStep}: Props) {
  const [scope, setScope] = useState<'related'|'all'>('related');
  const [query, setQuery] = useState('');
  const [attention, setAttention] = useState(false);
  const [review, setReview] = useState<HumanDesignReview | null>(null);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [target, setTarget] = useState<{requirement_id:string;requirement_revision:number;condition_id:string} | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(async () => {
      setReview(null); setError('');
      try {
        const saved = await api<HumanDesignReview>(`/projects/${projectId}/test-cases/${test.id}/design-review?revision=${test.revision}`,{signal:controller.signal});
        if (!controller.signal.aborted) setReview(saved);
      } catch (e) {if (!controller.signal.aborted) setError(errorMessage(e));}
    });
    return () => controller.abort();
  }, [projectId, test.id, test.revision, reload]);
  const fixedReview = review?.test_case_id === test.id && review.test_case_revision === test.revision ? review : null;
  const all = compareTestRequirements(versions, requirements, cases, test, steps);
  const flat = all.flatMap(r=>r.conditions);
  const matching = (id: string, revision: number, conditionId?: string) => fixedReview?.items.find(i=>i.requirement_id===id&&i.requirement_revision===revision&&i.condition_id===conditionId);
  const search = query.trim().toLowerCase();
  const rows = all.filter(r=>scope==='all'||r.related).map(r=>({...r,conditions:r.conditions.filter(c=>{
    const item = matching(r.version.requirement_id,r.version.revision,c.condition.id);
    return (!search||`${r.requirement?.title} ${c.condition.text}`.toLowerCase().includes(search)) && (!attention || !c.selected.length&&!c.other.length || c.selected.length>0&&(dirty||item?.decision!=='adequate'));
  })})).filter(r=>!r.requirement||r.conditions.length);
  const selectedCondition = all.flatMap(r=>r.conditions.map(c=>({r,c}))).find(({r,c})=>r.version.requirement_id===target?.requirement_id&&r.version.revision===target?.requirement_revision&&c.condition.id===target?.condition_id);
  return <aside aria-label="요구사항과 시험 대조" className="min-w-0 lg:sticky lg:top-4 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
    <Card title="요구사항·수락 조건 대조" description="시험 절차와 기대 결과를 옆에서 비교합니다." className="min-w-0">
      <div className="space-y-3 text-sm leading-7 [overflow-wrap:anywhere]">
        <p className="text-xs text-slate-500">{test.test_no} · 절차 개정 {test.revision}</p>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-6"><p>사양서 전체 조건 {flat.length}개 중 시험 연결 {flat.filter(c=>c.selected.length||c.other.length).length}개</p><p>선택한 시험에 연결된 조건 {flat.filter(c=>c.selected.length).length}개</p></div>
        <details className="text-xs leading-6 text-slate-500"><summary className="cursor-pointer">조건 연결과 설계 검토의 의미</summary><p className="mt-1">연결은 해당 시험이 조건을 확인하도록 지정됐다는 뜻입니다. 절차와 기대 결과가 충분한지는 아래 사용자 검토로 기록하고, 실제 구현 충족은 시험 수행 결과로 확인합니다.</p></details>
        {all.some(r=>!r.requirement)&&<p role="status" className="text-xs text-amber-800">요구사항 {all.filter(r=>!r.requirement).length}개의 고정 개정을 불러오지 못해 전체 대조가 불완전합니다.</p>}
        {dirty && <p className="text-xs text-amber-800">편집 중인 절차를 표시합니다. 저장 후 새 개정에서 설계 검토를 남겨주세요.</p>}
        {error ? <div role="status" className="text-xs text-amber-800">검토 기록 조회 실패: {error}<button type="button" className="ml-2 underline" onClick={()=>setReload(reload+1)}>다시 조회</button></div> : fixedReview ? <p className="text-xs text-slate-600">이 시험의 사용자 검토: 설계 적합 {fixedReview.summary.adequate} · 보완 필요 {fixedReview.summary.needs_changes} · 판단 보류 {fixedReview.summary.uncertain} · 미검토 {fixedReview.summary.linked_conditions-fixedReview.summary.reviewed_conditions}{dirty?' · 편집 전 기록':''}</p> : <p className="text-xs text-slate-500">설계 검토 기록을 불러오는 중입니다.</p>}
        <p className="text-xs leading-6 text-slate-500">설계 검토는 시험 개정별로 저장됩니다. 절차를 바꾸면 새로 검토합니다.</p>
        <div className="flex flex-wrap gap-2">{([['related','이 시험의 요구사항'],['all','사양서 전체']] as const).map(([value,label])=><button key={value} type="button" aria-pressed={scope===value} onClick={()=>setScope(value)} className={`border rounded px-2.5 py-1 text-xs ${scope===value?'bg-blue-50 border-blue-300 text-blue-700':'border-slate-200 text-slate-600'}`}>{label}</button>)}</div>
        <input aria-label="요구사항 대조 검색" value={query} onChange={e=>setQuery(e.target.value)} placeholder="요구사항·수락 조건 검색" className="w-full border border-slate-200 rounded px-3 py-2 text-sm"/>
        <label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={attention} onChange={e=>setAttention(e.target.checked)}/>미연결·이 시험의 검토할 조건만</label>
        <div className="space-y-5">
          {rows.map(row=><section key={`${row.version.requirement_id}:${row.version.revision}`} className="border-t border-slate-200 pt-4 space-y-3">
            <p className="text-xs text-slate-500">요구사항 개정 {row.version.revision}</p>
            {!row.requirement ? <p className="text-amber-800">고정된 요구사항을 불러오지 못했습니다. 최신 개정으로 대체하지 않았습니다.</p> : <>
              <h3 className="font-semibold text-slate-800">{row.requirement.title}</h3>
              <div><h4 className="text-xs font-semibold text-slate-500">요구사항 원문 전체</h4><p className="mt-1 whitespace-pre-wrap select-text">{row.requirement.original_text||'원문 미등록'}</p></div>
              <p className="text-xs text-slate-500">수락 조건 {row.requirement.conditions.length}개{search||attention?' · 현재 필터 적용':''}</p>
              {row.conditions.map((entry,index)=>{
                const item = matching(row.version.requirement_id,row.version.revision,entry.condition.id);
                return <section key={entry.condition.id||index} className={`rounded-lg border p-3 space-y-2 ${entry.selected.length?'border-blue-200 bg-blue-50/30':'border-slate-200'}`}>
                  <h4 className="text-xs font-semibold text-slate-500">수락 조건 {row.requirement!.conditions.indexOf(entry.condition)+1} · {entry.selected.length?'이 시험에 연결':entry.other.length?'다른 시험에 연결':'시험 연결 없음'}</h4>
                  <p className="whitespace-pre-wrap select-text">{entry.condition.text}</p>
                  {entry.selected.map(ref=><div key={ref.step_key} className="space-y-1 border-t border-slate-200/70 pt-2 text-xs leading-6"><button type="button" className="font-medium text-blue-700 underline" onClick={()=>onSelectStep(ref.case_id,ref.step_key)}>단계 {ref.order}로 이동</button><p className="whitespace-pre-wrap">절차: {ref.action}</p><p className="whitespace-pre-wrap">기대 결과: {ref.expected}</p>{ref.rationale&&<p className="whitespace-pre-wrap text-slate-500">{dirty||!currentDesign(test)?'편집 전 AI 설명·재검토 필요':'AI 설계 설명'}: {ref.rationale}</p>}</div>)}
                  {!entry.selected.length&&entry.other.map(ref=><button key={`${ref.case_id}:${ref.step_key}`} type="button" className="block text-xs text-blue-700 underline" onClick={()=>onSelectStep(ref.case_id,ref.step_key)}>{ref.test_no} · 단계 {ref.order} 확인</button>)}
                  {!entry.selected.length&&!entry.other.length&&<p className="text-xs text-amber-800">이 사양서에서 이 조건에 연결된 시험이 없습니다. 시험을 보완하거나 명세를 확인하세요.</p>}
                  {entry.condition.id&&<button type="button" className="text-xs text-slate-600 underline" onClick={()=>onSource([{requirement_id:row.version.requirement_id,requirement_revision:row.version.revision,condition_ids:[entry.condition.id!]}])}>명세 인용·PDF 원문 확인</button>}
                  {!!entry.selected.length&&<div className="border-t border-slate-200/70 pt-2 space-y-2"><p className="text-xs font-semibold text-slate-600">{item?`${designDecisionLabels[item.decision]} · 사용자 검토${dirty?' · 편집 전':''}`:'설계 적합성 미검토'}</p>{item&&<p className="text-xs leading-6 whitespace-pre-wrap select-text">검토 사유: {item.reason}</p>}<Button variant="secondary" disabled={editing||!fixedReview||!!error||!entry.condition.id} onClick={()=>setTarget({requirement_id:row.version.requirement_id,requirement_revision:row.version.revision,condition_id:entry.condition.id!})}>{item?'설계 검토 수정':'설계 적합성 검토'}</Button></div>}
                </section>;
              })}
            </>}
          </section>)}
          {!rows.length&&<p className="py-3 text-xs text-slate-500">현재 범위에 표시할 조건이 없습니다. 사양서 전체 또는 다른 검색어로 확인하세요.</p>}
        </div>
      </div>
    </Card>
    {target&&selectedCondition&&fixedReview&&<ConditionReviewDialog projectId={projectId} test={test} review={fixedReview} target={target} conditionText={selectedCondition.c.condition.text} steps={selectedCondition.c.selected} onClose={()=>setTarget(null)} onSaved={saved=>{setReview(saved);setTarget(null);}}/>}
  </aside>;
}
