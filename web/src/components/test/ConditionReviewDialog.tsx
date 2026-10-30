import { useEffect, useRef, useState } from 'react';
import { Button } from '../common';
import { api, errorMessage, jsonRequest } from '../../services/api';
import type { ConditionDesignReview, DesignDecision, HumanDesignReview, TestCase } from '../../types/test';
import type { ComparedStep } from '../../services/testComparison';
import { designDecisionLabels } from '../../services/testComparison';

interface Props {
  projectId: string; test: TestCase; review: HumanDesignReview; conditionText: string;
  target: {requirement_id: string; requirement_revision: number; condition_id: string};
  steps: ComparedStep[]; onClose: () => void; onSaved: (review: HumanDesignReview) => void;
}

export function ConditionReviewDialog({projectId, test, review, conditionText, target, steps, onClose, onSaved}: Props) {
  const previous = review.items.find(i => i.requirement_id === target.requirement_id && i.requirement_revision === target.requirement_revision && i.condition_id === target.condition_id);
  const [decision, setDecision] = useState<DesignDecision | ''>(previous?.decision || '');
  const [reason, setReason] = useState(previous?.reason || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pending = useRef<{hash: string; id: string} | null>(null);
  const dirty = decision !== (previous?.decision || '') || reason !== (previous?.reason || '');
  useEffect(() => {
    const dialog = dialogRef.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog?.showModal();
    return () => {dialog?.close(); opener?.focus();};
  }, []);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {if (dirty || busy) event.preventDefault();};
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, busy]);
  const close = () => {if (!busy && (!dirty || window.confirm('작성한 설계 검토를 저장하지 않고 닫을까요?'))) onClose();};
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!decision || !reason.trim() || busy) return;
    const item: ConditionDesignReview = {...target, decision, reason: reason.trim()};
    const request = {test_case_revision:test.revision, base_version:review.version, items:[item]};
    const hash = JSON.stringify(request);
    if (pending.current?.hash !== hash) pending.current = {hash, id:crypto.randomUUID()};
    setBusy(true); setError('');
    try {
      const saved = await api<HumanDesignReview>(`/projects/${projectId}/test-cases/${test.id}/design-review`, jsonRequest('PUT', {...request,client_review_id:pending.current.id}));
      onSaved(saved);
    } catch (e) {setError(`${errorMessage(e)} 입력한 사유는 유지됩니다.`);}
    finally {setBusy(false);}
  };
  return <dialog ref={dialogRef} aria-labelledby="condition-review-title" onCancel={e=>{e.preventDefault();close();}} className="m-auto w-[calc(100%_-_2rem)] max-w-2xl max-h-[90vh] border border-slate-200 rounded-xl bg-white p-0 text-slate-800 shadow-lg backdrop:bg-slate-900/40">
    <form onSubmit={save}>
      <header className="sticky top-0 border-b border-slate-200 bg-white px-5 py-4"><h2 id="condition-review-title" className="font-semibold">수락 조건의 시험 설계 검토</h2><p className="mt-1 text-xs text-slate-500">{test.test_no} · 절차 개정 {test.revision} · 요구사항 개정 {target.requirement_revision}</p></header>
      <div className="p-5 space-y-4 text-sm leading-7 [overflow-wrap:anywhere]">
        <section className="rounded-lg border border-slate-200 bg-slate-50 p-3"><h3 className="text-xs font-semibold text-slate-500">확인할 수락 조건</h3><p className="mt-1 whitespace-pre-wrap select-text">{conditionText}</p></section>
        {steps.map(step=><section key={step.step_key} className="border-b border-slate-100 pb-3"><h3 className="text-xs font-semibold text-slate-500">단계 {step.order}</h3><p className="mt-1 whitespace-pre-wrap">절차: {step.action}</p><p className="mt-1 whitespace-pre-wrap">기대 결과: {step.expected}</p></section>)}
        <p className="text-xs text-slate-500">위 절차와 기대 결과가 이 조건을 충분히 확인하는지 검토하세요. 입력값·준비 상태·허용과 거부·필요한 경계값도 확인합니다. 실제 실행 결과는 별도 수행 기록에 입력합니다.</p>
        <label className="block text-xs font-medium text-slate-600">설계 검토 결과<select aria-label="설계 검토 결과" required disabled={busy} value={decision} onChange={e=>setDecision(e.target.value as DesignDecision | '')} className="mt-1 w-full border border-slate-200 rounded p-2 text-sm bg-white"><option value="">검토 결과 선택</option>{Object.entries(designDecisionLabels).map(([key,label])=><option value={key} key={key}>{label}</option>)}</select></label>
        <label className="block text-xs font-medium text-slate-600">검토 사유<textarea aria-label="설계 검토 사유" required maxLength={2000} disabled={busy} rows={4} value={reason} onChange={e=>setReason(e.target.value)} placeholder="어떤 절차·입력값·기대 결과가 조건을 확인하는지, 또는 무엇이 부족한지 적어주세요." className="mt-1 w-full border border-slate-200 rounded p-2 text-sm leading-7"/></label>
        {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
      </div>
      <footer className="sticky bottom-0 border-t border-slate-200 bg-white px-5 py-4 flex justify-end gap-2"><Button type="button" variant="secondary" disabled={busy} onClick={close}>취소</Button><Button type="submit" disabled={busy||!decision||!reason.trim()||!dirty}>{busy?'저장 중':'설계 검토 저장'}</Button></footer>
    </form>
  </dialog>;
}
