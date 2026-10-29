import { useEffect, useRef, useState } from 'react';
import { Button } from '../common';
import { api, BASE_URL } from '../../services/api';
import { evidenceSources, resolveTestEvidence } from '../../services/testEvidence';
import type { TestRequirement } from '../../services/testEvidence';
import type { RequirementLink } from '../../types/test';

interface Props {
  projectId: string;
  title: string;
  links: RequirementLink[];
  requirements: TestRequirement[];
  onClose: () => void;
}

export function TestEvidenceDialog({ projectId, title, links, requirements, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [documents, setDocuments] = useState<Record<string, { filename: string }>>({});
  const [documentError, setDocumentError] = useState(false);
  const resolved = resolveTestEvidence(links, requirements);

  useEffect(() => {
    const dialog = dialogRef.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog?.showModal();
    return () => { dialog?.close(); opener?.focus(); };
  }, []);

  useEffect(() => {
    let active = true;
    const ids = [...new Set(resolveTestEvidence(links, requirements).map(item => item.requirement?.document_id).filter((id): id is string => !!id))];
    void Promise.allSettled(ids.map(async id => [id, await api<{ filename: string }>(`/projects/${projectId}/documents/${id}`)] as const))
      .then(results => {
        if (!active) return;
        setDocuments(Object.fromEntries(results.filter(r => r.status === 'fulfilled').map(r => r.value)));
        setDocumentError(results.some(r => r.status === 'rejected'));
      });
    return () => { active = false; };
  }, [projectId, links, requirements]);

  return <dialog ref={dialogRef} onClose={() => { if (!dialogRef.current?.open) onClose(); }} aria-labelledby="test-evidence-title" className="m-auto w-[calc(100%_-_2rem)] max-w-2xl max-h-[90vh] rounded-xl border border-slate-200 bg-white p-0 text-slate-800 shadow-lg backdrop:bg-slate-900/40">
    <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-6 py-4">
      <div className="min-w-0"><h2 id="test-evidence-title" className="text-base font-semibold">{title}</h2><p className="mt-1 text-xs text-slate-500">연결된 명세 · 원문 확인</p></div>
      <Button variant="secondary" autoFocus onClick={() => dialogRef.current?.close()}>닫기</Button>
    </div>
    <div className="space-y-5 p-6 text-sm leading-7 select-text">
      <p className="text-slate-600">시험에 연결된 요구사항 개정과 수락 조건입니다. 기대 결과를 아래 명세 원문과 비교하세요.</p>
      {documentError && <p className="text-xs text-amber-800">문서 이름 일부를 불러오지 못했습니다. 저장된 인용과 원문 링크는 아래에서 확인할 수 있습니다.</p>}
      {!resolved.length && <p>연결된 요구사항이 없습니다. 이 시험의 생성 근거를 확인할 수 없습니다.</p>}
      {resolved.map(({ link, requirement, conditions }) => <section key={`${link.requirement_id}:${link.requirement_revision}`} className="rounded-lg border border-slate-200 p-4 space-y-4">
        {!requirement ? <p className="text-amber-800">연결된 요구사항 개정 {link.requirement_revision}을 불러오지 못했습니다. 다른 개정으로 대체하지 않았습니다.</p> : <>
          <div><p className="text-xs font-medium text-slate-500">요구사항 · 개정 {requirement.revision}{requirement.stable_key && !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(requirement.stable_key) ? ` · ${requirement.stable_key}` : ''}</p><h3 className="mt-1 font-semibold text-slate-900">{requirement.title}</h3>
            {requirement.document_id && <p className="mt-1 text-xs text-slate-500 break-words">{documents[requirement.document_id]?.filename || '명세 문서'}{requirement.document_revision ? ` · 문서 개정 ${requirement.document_revision}` : ''}</p>}
          </div>
          {!!requirement.review_reasons?.length && <details className="text-xs text-slate-600"><summary className="cursor-pointer font-medium">명세 검토 메모</summary>{requirement.review_reasons.map((note, i) => <p className="mt-2 whitespace-pre-wrap" key={i}>{note}</p>)}</details>}
          {!conditions.length && <div className="border-t border-slate-100 pt-4"><p className="text-amber-800">요구사항에는 연결되어 있지만, 구체적인 수락 조건이 지정되지 않았습니다.</p><p className="mt-2 text-slate-600 whitespace-pre-wrap">{requirement.original_text || '저장된 명세 원문이 없습니다.'}</p></div>}
          {conditions.map(({ id, condition }, index) => <div key={id} className="border-t border-slate-100 pt-4">
            {!condition ? <p className="text-amber-800">연결된 수락 조건 {index + 1}을 찾지 못했습니다. 시험의 조건 연결을 확인하세요.</p> : <>
              <p className="text-xs font-semibold text-slate-500">수락 조건 {index + 1}</p><p className="mt-1 whitespace-pre-wrap">{condition.text}</p>
              {condition.ambiguity?.map((note, i) => <p className="mt-2 text-xs text-amber-800" key={i}>해석 확인 사항: {note}</p>)}
              {(() => {
                const source = evidenceSources(condition, requirement);
                return <div className="mt-3 space-y-3">
                  <p className="text-xs font-medium text-slate-500">{source.kind === 'condition' ? '이 조건의 명세 원문' : '요구사항 원문 · 조건별 인용 없음'}</p>
                  {source.refs.map((ref, i) => <div key={`${ref.block_id}-${i}`}>
                    <blockquote className="border-l-2 border-slate-300 bg-slate-50 px-3 py-2 whitespace-pre-wrap">{ref.quote || '저장된 인용이 없습니다.'}</blockquote>
                    {requirement.document_id && <a className="mt-1 inline-block text-xs font-medium text-blue-600 underline underline-offset-2" target="_blank" rel="noreferrer" href={`${BASE_URL}/projects/${projectId}/documents/${requirement.document_id}/file${ref.location?.index ? `#page=${ref.location.index}` : ''}`}>{ref.location?.index ? `PDF ${ref.location.index}쪽 원문 열기` : 'PDF 원문 열기 · 쪽수 미등록'}</a>}
                  </div>)}
                  {!source.refs.length && <><p className="text-slate-600 whitespace-pre-wrap">{requirement.original_text || '저장된 명세 원문이 없습니다.'}</p><p className="text-xs text-amber-800">원문 인용과 위치가 등록되지 않았습니다. 수동 등록한 조건은 문서와 직접 대조하세요.</p></>}
                </div>;
              })()}
            </>}
          </div>)}
        </>}
      </section>)}
    </div>
  </dialog>;
}
