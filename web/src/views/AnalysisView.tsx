import React, { useCallback, useEffect, useState } from 'react';
import type { StepId, Condition, RequirementItem } from '../types';
import { useProject } from '../contexts/ProjectContext';
import { api, fetchAll, jsonRequest, errorMessage, pollJobStatus, BASE_URL } from '../services/api';
import { ParsingWarnings } from '../components/ParsingWarnings';
import { Button, Card, PageHeader } from '../components/common';

interface Doc { id: string; filename: string; revision: number; parse_status: string; parser_version?: string; warnings: { code?: string; message: string }[] }
interface Block { id: string; text: string; location: { index: number }; structure: { section: string; label: string | null } }
interface Group { id: string; title: string; subtopics: { id: string; title: string }[] }
type Req = RequirementItem & { revision: number; document_id: string; document_revision: number; source_refs: { block_id: string; quote: string }[] };
const categoryLabels = { display: '화면 표시', validation: '입력 검사', navigation: '화면 이동', business_logic: '비즈니스 로직', data: '데이터 저장', error_message: '오류 메시지' };
const field = 'w-full border border-slate-200 rounded-lg p-2 text-sm bg-white';
const blankCondition = (): Condition => ({ stable_key: crypto.randomUUID(), text: '', category: 'business_logic', target: 'unknown', verifiable: 'code', source_refs: [] });

export const AnalysisView: React.FC<{ onNavigateStep: (step: StepId) => void }> = ({ onNavigateStep }) => {
  const { projectId, setUnsavedChanges, saveBeforeLeaveRef } = useProject();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [docId, setDocId] = useState('');
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [reqs, setReqs] = useState<Req[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [blockId, setBlockId] = useState('');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [title, setTitle] = useState('');
  const [topic, setTopic] = useState('');
  const [subtopic, setSubtopic] = useState('');
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const selected = reqs.find(r => r.id === selectedId);
  const document = docs.find(d => d.id === docId);
  const source = blocks.find(b => b.id === blockId);
  const base = `/projects/${projectId}`;

  const load = useCallback(async () => {
    if (!projectId || !docId) return;
    const [documents, original, grouped, requirements] = await Promise.all([
      fetchAll<Doc>(`/projects/${projectId}/documents`),
      fetchAll<Block>(`/projects/${projectId}/documents/${docId}/blocks`),
      api<{ topics: Group[] }>(`/projects/${projectId}/documents/${docId}/requirement-groups`),
      fetchAll<Req>(`/projects/${projectId}/requirements?document_id=${docId}`),
    ]);
    setDocs(documents.reverse()); setBlocks(original); setGroups(grouped.topics); setReqs(requirements);
    setSelectedId(prev => requirements.some(r => r.id === prev) ? prev : (requirements[0]?.id || ''));
  }, [projectId, docId]);
  useEffect(() => {
    let active = true;
    if (projectId) fetchAll<Doc>(`/projects/${projectId}/documents`).then(items => {
      if (active) { setDocs(items.reverse()); setDocId(items[0]?.id || ''); }
    }).catch(e => active && setMessage(errorMessage(e)));
    return () => { active = false; };
  }, [projectId]);
  useEffect(() => { void Promise.resolve().then(load).catch(e => setMessage(errorMessage(e))); }, [load]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (editing) event.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [editing]);

  const groupName = (r: Req) => {
    const t = groups.find(g => g.subtopics.some(s => s.id === r.subtopic_id));
    return `${t?.title || '미분류'} - ${t?.subtopics.find(s => s.id === r.subtopic_id)?.title || '기능 확인 필요'}`;
  };
  const startEdit = (fresh: boolean) => {
    setIsNew(fresh); setTitle(fresh ? '' : selected?.title || '');
    const g = groups.find(g => g.subtopics.some(s => s.id === selected?.subtopic_id));
    setTopic(fresh ? '' : g?.title || '');
    setSubtopic(fresh ? '' : g?.subtopics.find(s => s.id === selected?.subtopic_id)?.title || '');
    setConditions(fresh ? [blankCondition()] : structuredClone(selected?.conditions || []));
    setEditing(true); setUnsavedChanges(true); setMessage('');
  };
  const save = useCallback(async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!document) return false;
    setBusy(true); setMessage('');
    try {
      const group = await api<{ subtopic_id: string }>(`${base}/documents/${docId}/requirement-groups`, jsonRequest('POST', {
        document_revision: document.revision, topic_title: topic.trim(), subtopic_title: subtopic.trim(),
      }));
      const clean = conditions.map(c => ({ ...c, source_refs: (c.source_refs || []).map(r => ({ block_id: r.block_id, quote: r.quote })) }));
      const data = isNew ? {
        document_id: docId, document_revision: document.revision, subtopic_id: group.subtopic_id,
        title: title.trim(), original_text: source?.text || '', author_reason: '사용자가 원문을 확인해 수동 등록',
        source_refs: source ? [{ block_id: source.id, quote: source.text }] : [],
        conditions: clean.map(c => ({ ...c, source_refs: source ? [{ block_id: source.id, quote: source.text }] : [] })),
      } : { base_revision: selected?.revision, subtopic_id: group.subtopic_id, title: title.trim(), conditions: clean };
      const saved = await api<Req>(`${base}/requirements${isNew ? '' : `/${selectedId}`}`, jsonRequest(isNew ? 'POST' : 'PATCH', data));
      await load(); setSelectedId(saved.id); setEditing(false); setUnsavedChanges(false); setMessage('저장했습니다. 변경된 조건을 확인한 뒤 검토를 확정하세요.'); return true;
    } catch (e) { setMessage(errorMessage(e)); return false; } finally { setBusy(false); }
  }, [document,base,docId,topic,subtopic,conditions,isNew,source,title,selected,selectedId,load,setUnsavedChanges]);
  useEffect(()=>{saveBeforeLeaveRef.current=editing?save:null;return()=>{saveBeforeLeaveRef.current=null;};},[saveBeforeLeaveRef,save,editing]);
  const parse = async () => {
    if (!document) return;
    setBusy(true); setMessage('문서의 화면 표와 원문을 읽고 있습니다.');
    try {
      const job = await api<{ id: string }>(`${base}/documents/${docId}/parse`, jsonRequest('POST', { document_revision: document.revision, force: blocks.length > 0 }));
      const result = await pollJobStatus(projectId!, job.id) as { status: string };
      await load(); setMessage(result.status === 'completed' ? '문서 파싱을 마쳤습니다. 경고와 원문을 확인하세요.' : '파싱에 실패했습니다. 문서 경고를 확인하세요.');
    } catch (e) { setMessage(errorMessage(e)); } finally { setBusy(false); }
  };
  const extract = async () => {
    if (!document) return;
    setBusy(true);
    try {
      const config = await api<{ config_version: number }>(`${base}/llm`);
      const job = await api<{ id: string }>(`${base}/documents/${docId}/requirements/extract`, jsonRequest('POST', {
        document_revision: document.revision, model_config_version: config.config_version, accept_warnings: true,
      }));
      const done = await pollJobStatus(projectId!, job.id) as { status: string; missing_features: { message: string }[] };
      await load(); setMessage(done.status === 'blocked' ? done.missing_features.map(f => f.message).join(' / ') : `분석 상태: ${done.status}`);
    } catch (e) { setMessage(errorMessage(e)); } finally { setBusy(false); }
  };
  const approve = async () => {
    if (!selected) return;
    setBusy(true);
    try { await api(`${base}/requirements/${selected.id}/review`, jsonRequest('PUT', { base_revision: selected.revision, status: 'approved' })); await load(); setMessage('검토를 확정했습니다.'); }
    catch (e) { setMessage(errorMessage(e)); } finally { setBusy(false); }
  };
  if (!projectId) return <Button onClick={() => onNavigateStep('SETUP')}>프로젝트를 먼저 선택하세요</Button>;
  return <div className="max-w-7xl mx-auto space-y-5">
    <PageHeader stepTag="02 / REQUIREMENT ANALYSIS" title="명세 분석" description="원문에서 요구사항을 검토하고 주제·소주제별로 수락 조건을 확정합니다." />
    {message && <p role="status" className="p-3 rounded bg-blue-50 text-sm whitespace-pre-wrap">{message}</p>}
    <div className="flex flex-wrap gap-2">
      <select aria-label="기획서 선택" className={field + ' max-w-sm'} value={docId} disabled={editing || busy} onChange={e => setDocId(e.target.value)}>{docs.map(d => <option key={d.id} value={d.id}>{d.filename} · 개정 {d.revision}</option>)}</select>
      <Button onClick={parse} disabled={!document || busy || editing || reqs.length > 0}>{blocks.length ? "문서 다시 파싱" : "문서 파싱"}</Button>
      <Button variant="secondary" onClick={extract} disabled={!blocks.length || busy || editing}>AI 요구사항 추출</Button>
      <Button onClick={() => startEdit(true)} disabled={!document || busy || editing}>요구사항 수동 추가</Button>
      <Button variant="secondary" onClick={() => onNavigateStep('VERIFICATION')} disabled={editing || busy}>검증 결과로 이동</Button>
    </div>
    {document && blocks.length > 0 && <p className="text-sm text-slate-600">원문 {blocks.length}개 블록을 읽었습니다. {document.parse_status === 'partial' ? '일부 항목은 원문 확인이 필요합니다.' : '문서 읽기를 마쳤습니다.'}</p>}
    {document?.parser_version && document.parser_version !== 'pdf-layout-2' && <p className="text-sm text-amber-800">이전 OCR 결과입니다. 한국어 OCR 설정을 적용한 뒤 ‘문서 다시 파싱’을 눌러주세요. 저장된 요구사항이 있다면 새 문서로 등록해야 합니다.</p>}
    {document?.warnings?.length ? <ParsingWarnings warnings={document.warnings} fileUrl={`${BASE_URL}${base}/documents/${docId}/file`} /> : null}
    <div className="grid xl:grid-cols-[300px_1fr] gap-5">
      <Card title="문서 원문" description={`${blocks.length}개 블록`}>
        <select aria-label="원문 블록 선택" className={field} value={blockId} disabled={editing && !isNew} onChange={e => setBlockId(e.target.value)}>
          <option value="">출처를 선택하세요</option>{blocks.map(b => <option key={b.id} value={b.id}>{b.location.index}쪽 · {b.structure.section} {b.structure.label} · {b.text.slice(0,35)}</option>)}
        </select>
        {source && <><p className="text-sm whitespace-pre-wrap my-4 select-text">{source.text}</p><a className="text-blue-600 text-sm" target="_blank" rel="noreferrer" href={`${BASE_URL}${base}/documents/${docId}/file#page=${source.location.index}`}>PDF {source.location.index}쪽 열기</a></>}
        <hr className="my-4" /><input aria-label="요구사항 검색" className={field} placeholder="요구사항 검색" value={search} onChange={e => setSearch(e.target.value)} />
        <div className="mt-3 space-y-2 max-h-[500px] overflow-y-auto">{reqs.filter(r => `${r.title} ${groupName(r)}`.includes(search)).map(r => <button disabled={editing || busy} onClick={() => setSelectedId(r.id)} key={r.id} className={`w-full text-left p-3 rounded border text-sm ${r.id === selectedId ? 'bg-blue-50 border-blue-400' : ''}`}><small className="block text-slate-500">{groupName(r)}</small>{r.title}<small className="block">{r.review_status === 'approved' ? '검토 완료' : '검토 필요'} · 개정 {r.revision}</small></button>)}</div>
      </Card>
      <Card title={editing ? (isNew ? '요구사항 추가' : '요구사항 편집') : selected?.title || '등록된 요구사항이 없습니다'}>
        {editing ? <form onSubmit={save} className="space-y-3">
          <label className="block">주제<input aria-label="주제" required maxLength={200} className={field} value={topic} onChange={e => setTopic(e.target.value)} /></label>
          <label className="block">소주제<input aria-label="소주제" required maxLength={200} className={field} value={subtopic} onChange={e => setSubtopic(e.target.value)} /></label>
          <label className="block">요구사항 이름<input aria-label="요구사항 이름" required maxLength={300} className={field} value={title} onChange={e => setTitle(e.target.value)} /></label>
          {conditions.map((c,i) => <fieldset className="border rounded p-3 space-y-2" key={c.stable_key}><legend>수락 조건 {i+1}</legend>
            <textarea aria-label={`조건 ${i+1}`} required className={field} value={c.text} onChange={e => setConditions(prev => prev.map((x,n) => n===i ? {...x,text:e.target.value}:x))} />
            <div className="flex gap-2"><select aria-label={`조건 ${i+1} 범주`} className={field} value={c.category} onChange={e => setConditions(prev => prev.map((x,n) => n===i ? {...x,category:e.target.value as Condition['category']}:x))}>{Object.entries(categoryLabels).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select>
            <select aria-label={`조건 ${i+1} 구현 위치`} className={field} value={c.target} onChange={e => setConditions(prev => prev.map((x,n) => n===i ? {...x,target:e.target.value as Condition['target']}:x))}>{['unknown','frontend','backend','both'].map(k => <option key={k} value={k}>{k}</option>)}</select>
            <select aria-label={`조건 ${i+1} 검증 가능 여부`} className={field} value={c.verifiable} onChange={e => setConditions(prev => prev.map((x,n) => n===i ? {...x,verifiable:e.target.value as Condition['verifiable']}:x))}><option value="code">코드로 검증</option><option value="not_statically_verifiable">실행 확인 필요</option></select>
            <Button type="button" variant="ghost" disabled={conditions.length===1} onClick={() => setConditions(prev => prev.filter((_,n) => n!==i))}>삭제</Button></div>
          </fieldset>)}
          <div className="flex gap-2"><Button type="button" variant="secondary" disabled={busy} onClick={() => setConditions(prev => [...prev,blankCondition()])}>조건 추가</Button><Button type="submit" disabled={busy}>저장</Button><Button type="button" variant="secondary" disabled={busy} onClick={() => {setEditing(false);setUnsavedChanges(false);}}>취소</Button></div>
        </form> : selected ? <div className="space-y-4">
          <p>{groupName(selected)} · 개정 {selected.revision}</p><p className="whitespace-pre-wrap select-text text-sm">{selected.original_text || '원문 출처 없음: 사용자가 수동 작성한 항목입니다.'}</p>
          {selected.conditions.map(c => <div key={c.id || c.stable_key} className="border rounded p-3 text-sm"><small>{categoryLabels[c.category]} · {c.target} · {c.verifiable}</small><p>{c.text}</p></div>)}
          <div className="flex gap-2"><Button onClick={() => startEdit(false)} disabled={busy}>요구사항 편집</Button><Button onClick={approve} disabled={busy || selected.review_status==='approved'}>검토 확정</Button></div>
        </div> : <p className="text-sm text-slate-500">문서를 파싱한 뒤 원문을 선택해 수동 등록할 수 있습니다. AI 미연결 상태에서는 자동 추출이 차단됩니다.</p>}
      </Card>
    </div>
  </div>;
};
