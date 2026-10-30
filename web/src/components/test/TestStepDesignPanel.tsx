import type { DesignIntent, TestStep } from '../../types/test';
import { evidenceSources, resolveTestEvidence } from '../../services/testEvidence';
import type { TestRequirement } from '../../services/testEvidence';

interface Props {step: TestStep; requirements: TestRequirement[]; intents: DesignIntent[]; stale: boolean}

export function TestStepDesignPanel({step, requirements, intents, stale}: Props) {
  const design = step.design;
  const linked = resolveTestEvidence(step.requirement_links, requirements);
  const criteria = linked.flatMap(r => r.conditions.filter(c => c.condition).map(c => ({condition: c.condition!, requirement: r.requirement!})));
  const labels = [...new Set(intents.filter(i => design?.intent_ids.includes(i.id)).map(i => i.label))];
  return <section className="rounded-lg border border-slate-200 px-4 py-3 space-y-3 text-sm leading-7">
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1"><h5 className="font-semibold text-slate-800">이 단계의 설계 근거</h5>{labels.length > 0 && <span className="text-xs text-slate-500">{labels.join(' · ')}</span>}</div>
    {design ? <>
      <p className={`text-xs ${stale || design.basis === 'review_needed' ? 'text-amber-800' : 'text-slate-500'}`}>
        {stale ? '편집 전 생성 설명입니다. 현재 절차·입력값과 다시 대조해야 합니다.' : design.basis === 'review_needed' ? '해석 확인 필요 · 원문 밖의 가정이 포함될 수 있습니다.' : 'AI가 작성한 설계 설명 · 아래 원문과 대조하세요.'}
      </p>
      <dl className="space-y-3 select-text"><div><dt className="text-xs font-medium text-slate-500">이 절차를 선택한 이유</dt><dd className="mt-1 whitespace-pre-wrap [overflow-wrap:anywhere]">{design.rationale}</dd></div><div><dt className="text-xs font-medium text-slate-500">입력값·역할 선정 이유</dt><dd className="mt-1 whitespace-pre-wrap [overflow-wrap:anywhere]">{design.input_rationale}</dd></div></dl>
    </> : <p className="text-xs text-slate-500">절차·입력값 선정 사유가 저장되지 않은 단계입니다. 아래는 연결 정보로 확인한 명세이며, 선정 사유를 추정해 채우지 않았습니다.</p>}
    <div className="border-t border-slate-100 pt-3 space-y-3 select-text">
      <p className="text-xs font-semibold text-slate-500">명세의 판정 기준</p>
      {criteria.slice(0, 2).map(({condition, requirement}) => {
        const source = evidenceSources(condition, requirement);
        const quote = source.refs[0];
        return <div key={`${requirement.id}:${condition.id}`}><p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{condition.text}</p>
          {quote?.quote ? <><blockquote className="mt-2 border-l-2 border-slate-300 bg-slate-50 px-3 py-2 text-xs leading-6 whitespace-pre-wrap [overflow-wrap:anywhere] line-clamp-3">{quote.quote}</blockquote><p className="mt-1 text-xs text-slate-500">{source.kind === 'condition' ? '조건의 원문 인용' : '요구사항 수준의 인용 · 조건별 인용 없음'}{quote.location?.index ? ` · PDF ${quote.location.index}쪽` : ' · 쪽수 미등록'} · 요구사항 개정 {requirement.revision}</p></> : <p className="mt-1 text-xs text-amber-800">이 조건의 원문 인용이 등록되지 않았습니다.</p>}
        </div>;
      })}
      {!criteria.length && <p className="text-xs text-amber-800">연결된 조건 또는 해당 개정을 불러오지 못했습니다. 상단의 단계 근거에서 확인하세요.</p>}
      {criteria.length > 2 && <p className="text-xs text-slate-500">연결 조건 {criteria.length}개 중 2개를 표시합니다. 단계 상단의 근거에서 전체 원문을 확인할 수 있습니다.</p>}
    </div>
  </section>;
}
