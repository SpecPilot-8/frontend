import React, { useState } from 'react';
import { Button } from '../common';

export interface VerificationScope {
  stack: 'spring' | 'react';
  entries: Record<string, string[]>;
  confirmed: true;
}
export interface ScopeOptions {
  snapshot_id: string;
  requirement_count: number;
  max_model_calls: number;
  stack: string;
  files: string[];
  groups: { key: string; title: string; source_screen_id: string | null; suggested_files: string[] }[];
  warnings: string[];
}

export const VerificationScopeDialog: React.FC<{
  options: ScopeOptions; busy: boolean; onCancel: () => void; onRun: (scope: VerificationScope) => void;
}> = ({ options, busy, onCancel, onRun }) => {
  const [stack, setStack] = useState(options.stack);
  const [entries, setEntries] = useState<Record<string, string[]>>(() => Object.fromEntries(options.groups.map(g => [g.key, g.suggested_files])));
  const [confirmed, setConfirmed] = useState(false);
  const ready = ['spring', 'react'].includes(stack) && options.groups.every(g => entries[g.key]?.length) && confirmed;
  return <div className="fixed inset-0 bg-slate-900/40 z-40 flex items-center justify-center p-4">
    <div role="dialog" aria-modal="true" aria-label="화면 진입 파일 확인" className="bg-white rounded-xl p-5 max-w-3xl w-full max-h-[85vh] overflow-auto space-y-4">
      <h2 className="text-lg font-bold">화면 진입 파일 확인</h2>
      <p className="text-sm">화면에서 사용하는 파일을 연결하면 이 파일에서 도달하는 코드만 해당 화면의 구현 근거로 사용합니다. 다른 화면의 구현과 구분하기 위한 설정입니다.</p>
      <label className="block text-sm">코드 분석 스택<select aria-label="코드 분석 스택" className="block w-full border rounded p-2 mt-1" value={stack} disabled={busy} onChange={e => { setStack(e.target.value); setEntries(Object.fromEntries(options.groups.map(g => [g.key, []]))); setConfirmed(false); }}>
        <option value="">스택 선택</option><option value="spring">Java / Spring MVC · Thymeleaf</option><option value="react">JavaScript / React · Express</option>
      </select></label>
      {options.warnings.map((warning, i) => <p className="text-sm text-amber-800" key={i}>{warning}</p>)}
      <div className="space-y-3">{options.groups.map(group => <label className="block text-sm" key={group.key}>
        <strong>{group.title}</strong> {group.source_screen_id && <span>· {group.source_screen_id}</span>}
        <select multiple size={4} aria-label={`${group.title} 진입 파일`} value={entries[group.key] || []} disabled={busy} className="block w-full border rounded p-2 mt-1 text-xs" onChange={e => { setEntries(prev => ({ ...prev, [group.key]: [...e.target.selectedOptions].map(o => o.value) })); setConfirmed(false); }}>
          {options.files.map(file => <option key={file} value={file}>{file}</option>)}
        </select>
      </label>)}</div>
      {!options.files.length && <p className="text-red-700 text-sm">지원하는 진입 소스 파일이 없습니다. 코드 ZIP과 기술 스택을 확인하세요.</p>}
      <p className="text-xs text-slate-500">여러 파일은 ⌘/Ctrl 키를 누르고 선택하세요. 요구사항 {options.requirement_count}개 · 화면 {options.groups.length}개 · 모델 호출 최대 {options.max_model_calls}회에 비용이 발생할 수 있습니다. 소스코드와 승인된 명세를 서버에 설정된 모델로 전송합니다.</p>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={confirmed} disabled={busy} onChange={e => setConfirmed(e.target.checked)} />화면별 진입 파일 연결을 확인했습니다.</label>
      <div className="flex gap-2 justify-end"><Button variant="secondary" disabled={busy} onClick={onCancel}>설정 취소</Button><Button disabled={!ready || busy} onClick={() => onRun({ stack: stack as 'spring' | 'react', entries, confirmed: true })}>{busy ? '검증 접수 중...' : '연결한 파일로 검증 시작'}</Button></div>
    </div>
  </div>;
};
