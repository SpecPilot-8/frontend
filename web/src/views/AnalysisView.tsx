import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { StepId, Condition, RequirementItem } from '../types';
import { useProject } from '../contexts/ProjectContext';
import { api, fetchAll, jsonRequest, errorMessage, pollJobStatus, BASE_URL } from '../services/api';
import { ParsingWarnings } from '../components/ParsingWarnings';
import { ExtractionLoadingModal } from '../components/ExtractionLoadingModal';
import { Button, Card, PageHeader } from '../components/common';

interface Doc { id: string; filename: string; revision: number; parse_status: string; parser_version?: string; screens?: { page: number; screen_name?: string; screen_id?: string }[]; warnings: { code?: string; message: string }[] }
interface Block { id: string; text: string; location: { index: number }; structure: { section: string; label: string | null } }
interface Group { id: string; title: string; subtopics: { id: string; title: string }[] }
interface ExtractionJob { id: string; document_id?: string; operation: string; status: string; progress?: { completed: number; total: number }; result?: { requirement_count: number; condition_count: number }; error?: { message: string }; missing_features: { message: string }[] }
type Req = RequirementItem & { review_reasons?: string[]; revision: number; document_id: string; document_revision: number; source_refs: { block_id: string; quote: string }[] };
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
  const [activeJobId, setActiveJobId] = useState('');
  const [extractProgress, setExtractProgress] = useState<{ completed: number; total: number } | null>(null);
  const [acknowledgedFor, setAcknowledgedFor] = useState('');
  const [selectedPageFilter, setSelectedPageFilter] = useState<string>('all');
  const selected = reqs.find(r => r.id === selectedId);
  const document = docs.find(d => d.id === docId);
  const source = blocks.find(b => b.id === blockId);
  const base = `/projects/${projectId}`;
  const warningKey = `${docId}:${document?.revision}:${document?.parser_version}`;
  const warningAccepted = !document?.warnings?.length || acknowledgedFor === warningKey;

  const load = useCallback(async () => {
    if (!projectId || !docId) return;
    const [documents, original, grouped, requirements, jobs] = await Promise.all([
      fetchAll<Doc>(`/projects/${projectId}/documents`),
      fetchAll<Block>(`/projects/${projectId}/documents/${docId}/blocks`),
      api<{ topics: Group[] }>(`/projects/${projectId}/documents/${docId}/requirement-groups`),
      fetchAll<Req>(`/projects/${projectId}/requirements?document_id=${docId}`),
      fetchAll<ExtractionJob>(`/projects/${projectId}/jobs`),
    ]);
    const pending = jobs.find(j => j.operation === 'extract_requirements' && j.document_id === docId && ['queued', 'running'].includes(j.status));
    if (pending) setActiveJobId(pending.id);
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
    if (!activeJobId || !projectId) return;
    let active = true;
    void Promise.resolve().then(async () => {
      setBusy(true);
      try {
        const done = await pollJobStatus(projectId, activeJobId, job => {
          if (active) {
            if (job.progress) {
              setExtractProgress(job.progress);
              setMessage(`AI 요구사항 추출 중 · 화면 ${job.progress.completed}/${job.progress.total}`);
            } else {
              setMessage('AI 요구사항 추출 대기 중');
            }
          }
        }) as ExtractionJob;
        if (!active) return;
        await load();
        setMessage(done.status === 'completed'
          ? `요구사항 ${done.result?.requirement_count || 0}개 · 수락 조건 ${done.result?.condition_count || 0}개를 추출했습니다. 원문과 비교해 검토를 확정하세요.`
          : done.error?.message || done.missing_features?.map(f => f.message).join(' / ') || `분석 상태: ${done.status}`);
      } catch (e) { if (active) setMessage(errorMessage(e)); }
      finally {
        if (active) {
          setBusy(false);
          setActiveJobId('');
          setExtractProgress(null);
        }
      }
    });
    return () => { active = false; };
  }, [activeJobId, projectId, load]);
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
    setBusy(true); setAcknowledgedFor(''); setMessage('문서의 화면 표와 원문을 읽고 있습니다.');
    try {
      const job = await api<{ id: string }>(`${base}/documents/${docId}/parse`, jsonRequest('POST', { document_revision: document.revision, force: blocks.length > 0 }));
      const result = await pollJobStatus(projectId!, job.id) as { status: string };
      await load(); setMessage(result.status === 'completed' ? '문서 파싱을 마쳤습니다. 경고와 원문을 확인하세요.' : '파싱에 실패했습니다. 문서 경고를 확인하세요.');
    } catch (e) { setMessage(errorMessage(e)); } finally { setBusy(false); }
  };
  const extract = async () => {
    if (!document || !warningAccepted) return;
    setBusy(true); setMessage('서버 모델로 요구사항 추출을 준비하고 있습니다.');
    try {
      const config = await api<{ config_version: number; connection_status: string }>(`${base}/llm`);
      if (config.connection_status !== 'connected') throw new Error('프로젝트 설정에서 실제 모델 연결을 먼저 확인해주세요.');
      const job = await api<ExtractionJob>(`${base}/documents/${docId}/requirements/extract`, jsonRequest('POST', {
        document_revision: document.revision, model_config_version: config.config_version, accept_warnings: warningAccepted,
      }));
      if (['queued', 'running'].includes(job.status)) setActiveJobId(job.id);
      else { setMessage(job.error?.message || job.missing_features?.map(f => f.message).join(' / ') || `분석 상태: ${job.status}`); setBusy(false); }
    } catch (e) { setMessage(errorMessage(e)); setBusy(false); }
  };

  const approve = async () => {
    if (!selected) return;
    setBusy(true);
    try { await api(`${base}/requirements/${selected.id}/review`, jsonRequest('PUT', { base_revision: selected.revision, status: 'approved' })); await load(); setMessage('검토를 확정했습니다.'); }
    catch (e) { setMessage(errorMessage(e)); } finally { setBusy(false); }
  };

  const unapprovedReqs = useMemo(() => reqs.filter(r => r.review_status !== 'approved'), [reqs]);

  const approveAll = async () => {
    if (!unapprovedReqs.length) {
      alert('모든 요구사항이 이미 검토 확정되었습니다.');
      return;
    }
    if (!window.confirm(`검토가 필요한 요구사항 ${unapprovedReqs.length}개를 모두 일괄 확정하시겠습니까?`)) {
      return;
    }
    setBusy(true);
    setMessage(`요구사항 ${unapprovedReqs.length}개를 일괄 검토 확정하고 있습니다...`);
    try {
      await api(`${base}/requirements/review-all`, jsonRequest('POST', {}));
      await load();
      setMessage(`전체 ${unapprovedReqs.length}개 요구사항을 모두 검토 확정했습니다.`);
    } catch {
      try {
        await Promise.all(
          unapprovedReqs.map(r =>
            api(`${base}/requirements/${r.id}/review`, jsonRequest('PUT', { base_revision: r.revision, status: 'approved' }))
          )
        );
        await load();
        setMessage(`전체 ${unapprovedReqs.length}개 요구사항을 모두 검토 확정했습니다.`);
      } catch (err) {
        setMessage(errorMessage(err));
      }
    } finally {
      setBusy(false);
    }
  };

  const screenMap = useMemo(() => {
    const map: Record<number, string> = {};
    if (document?.screens) {
      document.screens.forEach((s) => {
        if (s.page) {
          const name = s.screen_name ? ` · ${s.screen_name}` : '';
          const id = s.screen_id && !s.screen_id.startsWith('UNKNOWN-') ? ` (${s.screen_id})` : '';
          map[s.page] = `${name}${id}`;
        }
      });
    }
    return map;
  }, [document]);

  const blocksByPage = useMemo(() => {
    const groups: Record<number, Block[]> = {};
    blocks.forEach(b => {
      const p = b.location?.index || 1;
      if (!groups[p]) groups[p] = [];
      groups[p].push(b);
    });
    return groups;
  }, [blocks]);

  const availablePages = useMemo(() => {
    return Object.keys(blocksByPage).map(Number).sort((a, b) => a - b);
  }, [blocksByPage]);

  const filteredBlocks = useMemo(() => {
    if (selectedPageFilter === 'all') return blocks;
    const pageNum = Number(selectedPageFilter);
    return blocks.filter(b => b.location?.index === pageNum);
  }, [blocks, selectedPageFilter]);
  if (!projectId) return <Button onClick={() => onNavigateStep('SETUP')}>프로젝트를 먼저 선택하세요</Button>;

  const canExtract = Boolean(
    blocks.length > 0 &&
    !busy &&
    !editing &&
    warningAccepted &&
    reqs.length === 0 &&
    document?.parser_version === 'pdf-layout-2'
  );

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {/* AI 요구사항 추출 전용 로딩 모달 */}
      <ExtractionLoadingModal
        isOpen={Boolean(activeJobId)}
        progress={extractProgress}
        statusText={message}
      />

      <PageHeader
        stepTag="02 / REQUIREMENT ANALYSIS"
        title="명세 분석"
        description="원문에서 요구사항을 검토하고 주제·소주제별로 수락 조건을 확정합니다."
        action={
          <Button
            variant={reqs.length > 0 ? "primary" : "secondary"}
            size="md"
            onClick={() => onNavigateStep('VERIFICATION')}
            disabled={editing || busy}
            className="flex items-center gap-1.5 shadow-sm font-semibold"
          >
            <span>검증 결과로 이동</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </Button>
        }
      />

      {message && !activeJobId && (
        <p role="status" className="p-3 rounded-lg bg-blue-50 border border-blue-100 text-blue-900 text-sm whitespace-pre-wrap">
          {message}
        </p>
      )}

      {/* 명세 분석 워크플로우 컨트롤 바 */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-sm space-y-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          {/* 기획서 선택 및 문서 상태 */}
          <div className="flex flex-wrap items-center gap-2.5">
            <label htmlFor="doc-select" className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              기획서 선택:
            </label>
            <select
              id="doc-select"
              aria-label="기획서 선택"
              className="px-3 py-1.5 text-xs text-slate-800 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 max-w-sm font-medium"
              value={docId}
              disabled={editing || busy}
              onChange={e => setDocId(e.target.value)}
            >
              {docs.map(d => (
                <option key={d.id} value={d.id}>
                  {d.filename} · 개정 {d.revision}
                </option>
              ))}
            </select>

            {/* 상태 뱃지 */}
            {blocks.length > 0 ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200/60">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                원문 {blocks.length}개 블록 파싱 완료
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200/60">
                문서 파싱 필요
              </span>
            )}

            {reqs.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200/60">
                  요구사항 {reqs.length}개 ({reqs.filter(r => r.review_status === 'approved').length}개 확정)
                </span>
                {unapprovedReqs.length > 0 && (
                  <button
                    type="button"
                    onClick={approveAll}
                    disabled={busy}
                    className="text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 px-2.5 py-1 rounded-full transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    title="미확정 요구사항을 한 번에 모두 확정합니다"
                  >
                    <span>✓ 전체 검토 확정 ({unapprovedReqs.length}개)</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* 파이프라인 단계 인디케이터 */}
          <div className="text-xs flex items-center gap-1.5 text-slate-400">
            <span className="font-semibold text-slate-600">진행 순서:</span>
            <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${blocks.length === 0 ? "bg-blue-100 text-blue-700 font-bold" : "bg-slate-100 text-slate-600"}`}>
              1. 문서 파싱
            </span>
            <span>→</span>
            <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${blocks.length > 0 && reqs.length === 0 ? "bg-indigo-100 text-indigo-700 font-bold animate-pulse" : "bg-slate-100 text-slate-600"}`}>
              2. 요구사항 추출
            </span>
            <span>→</span>
            <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${reqs.length > 0 ? "bg-emerald-100 text-emerald-700 font-bold" : "bg-slate-100 text-slate-600"}`}>
              3. 조건 검토 및 확정
            </span>
          </div>
        </div>

        {/* 액션 버튼 그룹 & 안내 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* 1단계: 문서 파싱 버튼 */}
            <Button
              onClick={parse}
              variant={blocks.length === 0 ? "primary" : "secondary"}
              disabled={!document || busy || editing || reqs.length > 0}
              className="flex items-center gap-1.5 shadow-sm"
              title={reqs.length > 0 ? "이미 등록된 요구사항이 있습니다. 새 문서를 등록해 파싱하세요." : "PDF 원문 표와 텍스트를 읽어옵니다"}
            >
              {blocks.length === 0 ? (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>문서 파싱 시작</span>
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>문서 다시 파싱</span>
                </>
              )}
            </Button>

            <div className="h-5 w-px bg-slate-200 hidden sm:block" />

            {/* 2단계: AI 요구사항 자동 추출 버튼 */}
            <Button
              onClick={extract}
              variant="primary"
              disabled={!canExtract}
              className={`flex items-center gap-1.5 shadow-sm border-transparent transition-all ${
                canExtract
                  ? "bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold ring-2 ring-indigo-300 ring-offset-1"
                  : ""
              }`}
              title={
                !blocks.length
                  ? "먼저 문서 파싱을 실행하세요"
                  : reqs.length > 0
                    ? "요구사항이 이미 등록되었습니다"
                    : !warningAccepted
                      ? "하단의 OCR/표 경고 확인 체크박스를 선택하세요"
                      : "AI가 화면별 명세에서 요구사항과 수락 조건을 자동 추출합니다"
              }
            >
              <svg className={`w-4 h-4 ${canExtract ? "text-amber-300 animate-spin" : "text-slate-300"}`} fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <span>✨ AI 요구사항 추출</span>
            </Button>

            {/* 보조: 수동 추가 버튼 */}
            <Button
              variant="secondary"
              onClick={() => startEdit(true)}
              disabled={!document || busy || editing}
              className="flex items-center gap-1.5"
              title="원문을 선택하여 직접 수동으로 요구사항을 추가합니다"
            >
              <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>요구사항 직접 추가</span>
            </Button>
          </div>

          {/* 현재 추천 액션 가이드 텍스트 */}
          <div className="text-xs text-slate-500 self-center">
            {blocks.length === 0 && (
              <span className="text-blue-600 font-medium">👉 먼저 [문서 파싱 시작]을 클릭하세요.</span>
            )}
            {blocks.length > 0 && reqs.length === 0 && !warningAccepted && (
              <span className="text-amber-700 font-medium">👉 아래 경고 확인 체크박스를 선택하면 AI 추출이 활성화됩니다.</span>
            )}
            {blocks.length > 0 && reqs.length === 0 && warningAccepted && (
              <span className="text-indigo-600 font-medium animate-pulse">👉 준비 완료: [✨ AI 요구사항 추출]을 클릭하세요!</span>
            )}
            {reqs.length > 0 && (
              <span className="text-emerald-700 font-medium">✓ 요구사항을 검토·확정한 후 우측 상단 '검증 결과로 이동'을 누르세요.</span>
            )}
          </div>
        </div>
      </div>
    {document && blocks.length > 0 && <p className="text-sm text-slate-600">원문 {blocks.length}개 블록을 읽었습니다. {document.parse_status === 'partial' ? '일부 항목은 원문 확인이 필요합니다.' : '문서 읽기를 마쳤습니다.'}</p>}
    {reqs.length > 0 && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">저장된 요구사항 {reqs.length}개 · 수락 조건 {reqs.reduce((sum, r) => sum + r.conditions.length, 0)}개. 원문과 비교한 뒤 검토를 확정하세요.</p>}
    {document?.parser_version && document.parser_version !== 'pdf-layout-2' && <p className="text-sm text-amber-800">이전 OCR 결과입니다. 한국어 OCR 설정을 적용한 뒤 ‘문서 다시 파싱’을 눌러주세요. 저장된 요구사항이 있다면 새 문서로 등록해야 합니다.</p>}
    {document?.warnings?.length ? <ParsingWarnings warnings={document.warnings} fileUrl={`${BASE_URL}${base}/documents/${docId}/file`} /> : null}
    {document && blocks.length > 0 && reqs.length === 0 && <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2 text-sm">
      <p>서버 모델로 {document.screens?.length || 0}개 화면의 원문을 순서대로 분석합니다. 화면마다 모델 호출 비용이 발생하며 결과는 검토 전 초안으로 저장합니다.</p>
      {document.warnings.length > 0 && <label className="flex items-center gap-2"><input type="checkbox" checked={warningAccepted} disabled={busy} onChange={e => setAcknowledgedFor(e.target.checked ? warningKey : '')} />OCR·표 경고와 원문을 확인했으며 이 결과로 요구사항 추출을 진행합니다.</label>}
    </div>}
    <div className="grid xl:grid-cols-[320px_1fr] gap-5">
      <Card title="문서 원문" description={`${blocks.length}개 블록`}>
        {/* 원문 출처 쪽수 필터 및 카테고리 드롭다운 */}
        <div className="space-y-2 mb-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-700">원문 출처 선택</span>
            {availablePages.length > 1 && (
              <div className="flex items-center gap-1 text-[11px] text-slate-500">
                <label htmlFor="page-filter">쪽수 필터:</label>
                <select
                  id="page-filter"
                  value={selectedPageFilter}
                  onChange={e => setSelectedPageFilter(e.target.value)}
                  className="border border-slate-200 rounded px-1.5 py-0.5 text-[11px] bg-slate-50 focus:outline-none focus:border-blue-500"
                >
                  <option value="all">전체 쪽수 ({availablePages.length}쪽)</option>
                  {availablePages.map(p => (
                    <option key={p} value={String(p)}>
                      {p}쪽 {screenMap[p] || ''} ({blocksByPage[p]?.length || 0}개)
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <select
            aria-label="원문 블록 선택"
            className={field}
            value={blockId}
            disabled={editing && !isNew}
            onChange={e => setBlockId(e.target.value)}
          >
            <option value="">출처를 선택하세요 ({filteredBlocks.length}개 블록)</option>
            {selectedPageFilter === 'all' ? (
              availablePages.map(p => {
                const pBlocks = blocksByPage[p] || [];
                const title = `${p}쪽${screenMap[p] || ''} (${pBlocks.length}개)`;
                return (
                  <optgroup key={p} label={title}>
                    {pBlocks.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.structure.section}{b.structure.label ? ` [${b.structure.label}]` : ''} · {b.text.slice(0, 35)}
                      </option>
                    ))}
                  </optgroup>
                );
              })
            ) : (
              filteredBlocks.map(b => (
                <option key={b.id} value={b.id}>
                  {b.location.index}쪽 · {b.structure.section}{b.structure.label ? ` [${b.structure.label}]` : ''} · {b.text.slice(0, 35)}
                </option>
              ))
            )}
          </select>
        </div>

        {source && <><p className="text-sm whitespace-pre-wrap my-4 select-text bg-slate-50 p-2.5 rounded border border-slate-100">{source.text}</p><a className="text-blue-600 text-sm font-medium hover:underline inline-block mb-3" target="_blank" rel="noreferrer" href={`${BASE_URL}${base}/documents/${docId}/file#page=${source.location.index}`}>PDF {source.location.index}쪽 원문 열기 ↗</a></>}

        <hr className="my-3 border-slate-100" />

        {/* 전체 검토 확정 퀵 버튼 */}
        {unapprovedReqs.length > 0 && (
          <div className="mb-3">
            <button
              type="button"
              onClick={approveAll}
              disabled={busy}
              className="w-full text-xs font-semibold py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              title="미확정 상태인 요구사항들을 한 번에 모두 확정합니다"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>미확정 {unapprovedReqs.length}개 전체 검토 확정</span>
            </button>
          </div>
        )}

        <input aria-label="요구사항 검색" className={field} placeholder="요구사항 검색" value={search} onChange={e => setSearch(e.target.value)} />
        <div className="mt-3 space-y-2 max-h-[500px] overflow-y-auto">{reqs.filter(r => `${r.title} ${groupName(r)}`.includes(search)).map(r => <button disabled={editing || busy} onClick={() => setSelectedId(r.id)} key={r.id} className={`w-full text-left p-3 rounded border text-sm transition-colors ${r.id === selectedId ? 'bg-blue-50 border-blue-400' : 'bg-white hover:bg-slate-50'}`}><small className="block text-slate-500">{groupName(r)}</small>{r.title}<small className={`block font-semibold mt-0.5 ${r.review_status === 'approved' ? 'text-emerald-600' : 'text-amber-600'}`}>{r.review_status === 'approved' ? '✓ 검토 확정' : '검토 필요'} · 개정 {r.revision}</small></button>)}</div>
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
          <p className="text-xs font-semibold text-slate-500">{groupName(selected)} · 개정 {selected.revision}</p>
          <p className="whitespace-pre-wrap select-text text-sm bg-slate-50 p-3 rounded-lg border border-slate-100">{selected.original_text || '원문 출처 없음: 사용자가 수동 작성한 항목입니다.'}</p>
          {selected.review_reasons?.length ? <ul className="text-sm text-amber-800 list-disc pl-5 bg-amber-50/60 p-2.5 rounded-lg border border-amber-100">{selected.review_reasons.map((reason, i) => <li key={i}>{reason}</li>)}</ul> : null}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-700">수락 조건 ({selected.conditions.length}개)</h4>
            {selected.conditions.map(c => <div key={c.id || c.stable_key} className="border rounded-lg p-3 text-sm bg-white shadow-xs"><small className="text-blue-700 font-semibold">{categoryLabels[c.category]} · {c.target} · {c.verifiable}</small><p className="mt-1 text-slate-800">{c.text}</p></div>)}
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100">
            <Button onClick={() => startEdit(false)} disabled={busy} variant="secondary">요구사항 편집</Button>
            <Button onClick={approve} disabled={busy || selected.review_status==='approved'} variant={selected.review_status==='approved' ? 'secondary' : 'primary'}>
              {selected.review_status === 'approved' ? '✓ 검토 확정 완료' : '현재 요구사항 검토 확정'}
            </Button>
            {unapprovedReqs.length > 0 && (
              <Button onClick={approveAll} disabled={busy} variant="primary" className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium border-transparent ml-auto">
                ✓ 전체 검토 확정 ({unapprovedReqs.length}개 일괄)
              </Button>
            )}
          </div>
        </div> : <p className="text-sm text-slate-500">문서를 파싱한 뒤 원문을 선택해 수동 등록할 수 있습니다. 서버 모델 연결과 파싱 경고를 확인하면 AI 요구사항을 추출할 수 있습니다.</p>}
      </Card>
      </div>
    </div>
  );
};
