import { useState } from 'react';
import { Button, Card } from '../common';
import type { DesignReview, RequirementLink } from '../../types/test';

interface Props {
  review: DesignReview | null; error: string; loading: boolean; dirty: boolean;
  onRetry: () => void; onSelectCase: (id: string) => void; onSource: (links: RequirementLink[]) => void;
}
const statusLabels = {written: '시험 연결됨', review_needed: '검토 필요', missing: '관점 연결 없음'};
type ReviewRow = DesignReview['items'][number] | DesignReview['conditions'][number];
const isPlanned = (item: ReviewRow): item is DesignReview['items'][number] => 'perspective' in item;

export function TestDesignReviewPanel({review, error, loading, dirty, onRetry, onSelectCase, onSource}: Props) {
  const [filter, setFilter] = useState<'attention'|'all'|'conditions'>('attention');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(5);
  const [expanded, setExpanded] = useState(false);
  const key = query.trim().toLowerCase();
  const showConditions = !review?.plan_available || filter === 'conditions';
  const rows: ReviewRow[] = showConditions ? review?.conditions.filter(i => `${i.requirement_title} ${i.condition_text}`.toLowerCase().includes(key)) || []
    : review?.items.filter(i => (filter !== 'attention' || i.status !== 'written') && `${i.requirement_title} ${i.condition_text} ${i.label}`.toLowerCase().includes(key)) || [];
  return <Card title="시험 설계 점검" description="명세와 시험의 연결, 아직 확인할 내용을 검토합니다." extra={<Button variant="secondary" disabled={loading||!!error||!review} onClick={()=>setExpanded(!expanded)}>{expanded?'점검 항목 접기':'점검 항목 보기'}</Button>}>
    {loading ? <p className="text-sm text-slate-500">설계 점검 정보를 불러오는 중입니다.</p> : error ? <div role="status" className="space-y-2"><p className="text-sm text-amber-800">설계 점검 정보를 불러오지 못했습니다. {error}</p><Button variant="secondary" onClick={onRetry}>점검 정보 다시 조회</Button></div> : review && <div className="space-y-4">
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm"><p>조건 연결 <strong>{review.summary.conditions_linked} / {review.summary.conditions_total}</strong></p>{review.plan_available && <><p>시험 연결됨 <strong>{review.summary.intents_written}</strong>개 관점</p><p>검토 필요 <strong>{review.summary.intents_review_needed}</strong>개</p><p>관점 연결 없음 <strong>{review.summary.intents_missing}</strong>개</p></>}</div>
      <p className="text-xs leading-6 text-slate-500">시험 단계와 설계 기록의 연결을 집계한 값입니다. 실제 시험 통과나 검증의 충분성을 뜻하지 않습니다.{dirty && ' 편집 중인 내용은 저장 후 점검에 반영됩니다.'}</p>
      {!review.plan_available && <p className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-sm leading-6">이 사양서에는 작성 당시 시험 관점 계획이 저장되지 않았습니다. 기존 원문 연결과 연결되지 않은 조건을 확인할 수 있습니다.</p>}
      {expanded&&<><div className="flex flex-wrap items-center gap-2">
        {review.plan_available && ([['attention','검토할 관점'],['all','전체 관점'],['conditions','원문 조건']] as const).map(([value,label]) => <button key={value} aria-pressed={filter === value} className={`border rounded px-3 py-1.5 text-xs ${filter === value ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600'}`} onClick={() => {setFilter(value); setLimit(5);}}>{label}</button>)}
        <input aria-label="설계 점검 검색" placeholder="조건·시험 관점 검색" className="min-w-0 w-full sm:w-64 border border-slate-200 rounded px-3 py-1.5 text-sm" value={query} onChange={e => {setQuery(e.target.value); setLimit(5);}}/>
      </div>
      <div className="space-y-3">{rows.slice(0,limit).map((item, i) => {
        const planned = isPlanned(item);
        return <section key={planned ? item.id : `${item.requirement_id}:${item.condition_id}`} className="border border-slate-200 rounded-lg p-4 text-sm leading-7">
          <div className="flex flex-wrap justify-between gap-2"><p className="text-xs text-slate-500">{item.requirement_title} · 개정 {item.requirement_revision}</p><span className={`text-xs font-medium ${planned && item.status !== 'written' || !item.test_refs.length ? 'text-amber-800' : 'text-slate-600'}`}>{planned ? `${item.label} · ${statusLabels[item.status]}` : item.test_refs.length ? '연결된 시험 있음' : '연결된 시험 없음'}</span></div>
          <p className="mt-2 whitespace-pre-wrap select-text [overflow-wrap:anywhere]">{item.condition_text}</p>
          {planned && <><p className="mt-2 text-xs leading-6 text-slate-500">관점 선정 기준 · 규칙 제안: {item.reason}</p>{item.gap_reason && <p className="mt-2 text-sm text-amber-800 whitespace-pre-wrap">{item.gap_reason}</p>}{item.status === 'review_needed' && <p className="mt-2 text-xs text-amber-800">명세 밖의 해석이 있거나 시험 절차가 편집되어 재검토가 필요합니다.</p>}</>}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2"><button className="text-xs font-medium text-blue-600 underline underline-offset-2" onClick={() => onSource([{requirement_id:item.requirement_id, requirement_revision:item.requirement_revision, condition_ids:[item.condition_id]}])}>연결된 명세·원문</button>{item.test_refs.map(ref => <button className="text-xs font-medium text-slate-600 underline underline-offset-2" key={`${i}:${ref.case_id}:${ref.step_key}`} onClick={() => onSelectCase(ref.case_id)}>{ref.test_no} · 단계 {ref.step_order}{ref.stale ? ' · 편집 후 재검토' : ''}</button>)}</div>
        </section>;
      })}{!rows.length && <p className="py-3 text-sm text-slate-500">{query ? '검색 결과가 없습니다.' : '현재 범위에 표시할 점검 항목이 없습니다.'}</p>}</div>
      {rows.length > limit && <Button variant="secondary" onClick={() => setLimit(limit + 10)}>다음 {Math.min(10, rows.length-limit)}개 보기 · 전체 {rows.length}개</Button>}</>}
    </div>}
  </Card>;
}
