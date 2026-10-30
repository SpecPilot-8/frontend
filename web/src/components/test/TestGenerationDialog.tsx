import { useEffect, useRef, useState } from 'react';
import { Button } from '../common';
import type { DesignIntent, DesignPlan } from '../../types/test';

export interface GenerationPreviewPlan {
  model_config_version: number; requirement_count: number; subtopic_count: number;
  max_model_calls: number; provider: string; model: string; snapshot_id: string;
  verification_run_id: string; requirement_ids: string[]; runDate: string; design_plan?: DesignPlan;
}
interface Props {plan: GenerationPreviewPlan; busy: boolean; error: string; onCancel: () => void; onStart: () => void; onSource: (item: DesignIntent) => void}

export function TestGenerationDialog({plan, busy, error, onCancel, onStart, onSource}: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(5);
  const runDate = new Date(plan.runDate);
  const runLabel = Number.isNaN(runDate.getTime()) ? plan.runDate : runDate.toLocaleString('ko-KR');
  useEffect(() => {
    const dialog = ref.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog?.showModal();
    return () => {dialog?.close(); opener?.focus();};
  }, []);
  const groups = new Map<string, DesignIntent[]>();
  for (const item of plan.design_plan?.items || []) {
    const key = `${item.requirement_id}:${item.condition_id}`;
    groups.set(key, [...(groups.get(key) || []), item]);
  }
  const rows = [...groups.values()].filter(items => `${items[0].requirement_title} ${items[0].condition_text} ${items.map(i=>i.label).join(' ')}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <dialog ref={ref} aria-labelledby="test-generation-title" onCancel={e => {e.preventDefault(); if(!busy)onCancel();}} onClose={() => {if(!ref.current?.open && !busy)onCancel();}} className="m-auto w-[calc(100%_-_2rem)] max-w-3xl max-h-[90vh] border border-slate-200 rounded-xl bg-white p-0 text-slate-800 shadow-lg backdrop:bg-slate-900/40">
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white px-6 py-4"><h2 id="test-generation-title" className="text-base font-semibold">시험 설계 계획 확인</h2><p className="mt-1 text-xs text-slate-500">기준 명세와 권장 시험 관점을 확인한 뒤 생성을 시작하세요.</p></header>
    <div className="space-y-5 p-6 text-sm leading-7 [overflow-wrap:anywhere]">
      <div className="border border-slate-200 rounded-lg bg-slate-50 px-4 py-3"><p>검증 실행: {runLabel}</p><p>검토 확정 요구사항 {plan.requirement_count}개 · 소주제 {plan.subtopic_count}개</p><p className="mt-1 text-xs text-slate-500">서버 모델 {plan.provider} / {plan.model} · 최대 {plan.max_model_calls}회 호출</p><p className="text-xs text-slate-500">아래 확인 단계는 모델을 호출하지 않습니다. 생성 시작 시 호출 비용이 발생할 수 있습니다.</p></div>
      {plan.design_plan ? <>
        <div><h3 className="font-semibold">조건별 권장 시험 관점</h3><p className="mt-1 text-xs text-slate-500">조건 {plan.design_plan.summary.condition_count}개에 {plan.design_plan.summary.intent_count}개 관점을 제안했습니다. 조건 분류와 명시된 표현에 따른 규칙 제안이며, 필요한 시험을 모두 찾았다는 뜻은 아닙니다.</p></div>
        <input aria-label="생성 계획 검색" placeholder="요구사항·조건·관점 검색" className="w-full border border-slate-200 rounded px-3 py-2 text-sm" value={query} onChange={e=>{setQuery(e.target.value);setLimit(5);}}/>
        <div className="space-y-3">{rows.slice(0,limit).map(items => <section key={items[0].condition_id} className="border border-slate-200 rounded-lg p-4">
          <p className="text-xs text-slate-500">{items[0].requirement_title} · 개정 {items[0].requirement_revision}</p><p className="mt-2 whitespace-pre-wrap select-text">{items[0].condition_text}</p>
          <p className="mt-2 text-xs font-medium text-slate-700">{items.map(i=>i.label).join(' · ')}</p>
          <details className="mt-2 text-xs leading-6 text-slate-500"><summary className="cursor-pointer">관점 선정 이유</summary>{items.map(i=><p className="mt-2" key={i.id}><strong className="font-medium">{i.label}</strong> · {i.reason}</p>)}</details>
          <button type="button" className="mt-2 text-xs font-medium text-blue-600 underline underline-offset-2" disabled={busy} onClick={()=>onSource(items[0])}>이 조건의 명세·원문 확인</button>
        </section>)}{!rows.length && <p className="text-slate-500">검색 결과가 없습니다.</p>}</div>
        {rows.length > limit && <Button variant="secondary" onClick={()=>setLimit(limit+10)}>다음 {Math.min(10,rows.length-limit)}개 조건 보기 · 전체 {rows.length}개</Button>}
      </> : <p className="text-amber-800">서버에서 시험 관점 계획을 제공하지 않았습니다. 명세 연결은 생성 후 확인할 수 있습니다.</p>}
      <p className="text-xs text-slate-500">기대 결과는 명세 기준으로 작성합니다. 원문에 없는 동작·입력값·역할의 해석은 검토 필요로 남기며, 기존 사양서는 보존합니다. 실제 수행 O/X는 생성하지 않습니다.</p>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </div>
    <footer className="sticky bottom-0 border-t border-slate-200 bg-white px-6 py-4 flex flex-wrap justify-end gap-2"><Button autoFocus variant="secondary" disabled={busy} onClick={onCancel}>생성 취소</Button><Button disabled={busy} onClick={onStart}>확인한 계획으로 생성 시작</Button></footer>
  </dialog>;
}
