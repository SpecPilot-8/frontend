import React from 'react';

export interface ParsingWarning { code?: string; message: string }
const titles: Record<string, string> = {
  OCR_SOURCE_REVIEW: 'OCR로 읽은 헤더 원문 대조',
  EMPTY_SCREEN_TABLE: '설명 표가 비어 있는 상태 화면 확인',
  SCREEN_REVIEW_REQUIRED: '헤더 인식 결과 확인',
  LAYOUT_REVIEW_REQUIRED: '지원 화면 표 구조 확인',
  OCR_REQUIRED: '전체 OCR이 필요한 페이지',
};

export const ParsingWarnings: React.FC<{ warnings: ParsingWarning[]; fileUrl: string }> = ({ warnings, fileUrl }) => {
  const groups = new Map<string, ParsingWarning[]>();
  warnings.forEach(w => { const key = w.code || 'OTHER'; groups.set(key, [...(groups.get(key) || []), w]); });
  return <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2 text-sm text-amber-900">
    <p className="font-semibold">원문 확인이 필요한 항목 {warnings.length}건</p>
    <p>경고가 있어도 읽힌 원문은 보존됩니다. OCR 헤더와 설명이 없는 상태 화면을 PDF와 대조하세요.</p>
    <div className="grid gap-2 sm:grid-cols-2">{[...groups].map(([code, items]) => {
      const pages = [...new Set(items.map(w => /^(\d+)쪽/.exec(w.message)?.[1]).filter((p): p is string => !!p))];
      return <details key={code} className="rounded-lg bg-white/70 p-3">
        <summary className="cursor-pointer font-medium">{titles[code] || '기타 확인 사항'} · {items.length}건</summary>
        {pages.length > 0 && <p className="my-2">관련 쪽: {pages.map((page, i) => <React.Fragment key={page}>{i > 0 && ', '}<a className="underline" target="_blank" rel="noreferrer" href={`${fileUrl}#page=${page}`}>{page}</a></React.Fragment>)}</p>}
        <div className="max-h-48 overflow-y-auto space-y-1 mt-2">{items.map((w, i) => <p key={i}>{w.message}</p>)}</div>
      </details>;
    })}</div>
  </div>;
};
