/**
 * - 담당 파트: 프런트 엔드
 * - 작성자: 이시형
 * - 페이지 개요: 기획서 문서의 특정 페이지를 캔버스에 렌더링하고 출처 위치를 강조 표시하는 컴포넌트
 * - 주요 기능:
 *   1) 문서 페이지 확대 및 전체 보기 전환 렌더링
 *   2) 출처 좌표 또는 검색 문장 기반 하이라이트 영역 표시
 *   3) 활성 출처 위치로 프레임 내부 스크롤 자동 이동
 */

import React, { useEffect, useRef, useState } from "react";
import type * as pdfjs from "pdfjs-dist";
import { loadDocument } from "../common/pdf";

export interface PageHighlight {
  bbox: number[];
  active?: boolean;
}

interface SpecPageViewerProps {
  fileUrl: string;
  page: number;
  bbox?: number[];
  highlights?: PageHighlight[];
  searchText?: string;
}

type LocateStatus = "bbox" | "text" | "none";

const ZOOM = 3;

const normalize = (s: string) => s.replace(/\s+/g, "");

// 페이지 텍스트에서 검색 문장과 일치하는 영역 좌표를 계산하는 로직
const findTextBox = (
  items: unknown[],
  viewport: pdfjs.PageViewport,
  text: string,
): number[] | null => {
  const runs = items.filter(
    (it): it is { str: string; transform: number[]; width: number; height: number } =>
      typeof (it as { str?: unknown }).str === "string",
  );
  let haystack = "";
  const owner: number[] = [];
  runs.forEach((run, i) => {
    for (const ch of run.str) {
      if (/\s/.test(ch)) continue;
      haystack += ch;
      owner.push(i);
    }
  });
  const needle = normalize(text);
  if (!needle || !haystack) return null;

  let start = -1;
  let length = 0;
  for (const n of [needle.length, 60, 30, 15]) {
    if (n > needle.length || n < Math.min(6, needle.length)) continue;
    start = haystack.indexOf(needle.slice(0, n));
    if (start >= 0) {
      length = n;
      break;
    }
  }
  if (start < 0) return null;

  const used = new Set(owner.slice(start, start + length));
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  used.forEach((i) => {
    const { transform: t, width, height } = runs[i];
    const h = height || Math.hypot(t[2], t[3]);
    const [ax, ay, bx, by] = viewport.convertToViewportRectangle([t[4], t[5], t[4] + width, t[5] + h]);
    x0 = Math.min(x0, ax, bx);
    x1 = Math.max(x1, ax, bx);
    y0 = Math.min(y0, ay, by);
    y1 = Math.max(y1, ay, by);
  });
  if (!Number.isFinite(x0)) return null;
  return [x0, y0, x1 - x0, y1 - y0];
};

export const SpecPageViewer: React.FC<SpecPageViewerProps> = ({ fileUrl, page, bbox, highlights, searchText }) => {
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState(0);
  const [fit, setFit] = useState(false);
  const [textBox, setTextBox] = useState<number[] | null>(null);
  const [status, setStatus] = useState<LocateStatus>("none");

  const boxes: PageHighlight[] = highlights ?? (bbox ? [{ bbox, active: true }] : []);
  const boxKey = JSON.stringify(boxes);

  // 문서 페이지를 캔버스에 그리고 강조 위치로 스크롤하는 로직
  useEffect(() => {
    let cancelled = false;
    let renderTask: pdfjs.RenderTask | null = null;
    const canvas = canvasRef.current;
    const frame = frameRef.current;
    if (!canvas || !frame) return;
    const list = JSON.parse(boxKey) as PageHighlight[];
    const active = list.find((b) => b.active);

    loadDocument(fileUrl)
      .then((doc) => doc.getPage(page))
      .then(async (pdfPage) => {
        if (cancelled) return;
        const base = pdfPage.getViewport({ scale: 1 });
        const width = frame.clientWidth * (fit ? 1 : ZOOM);
        const s = width / base.width;
        const viewport = pdfPage.getViewport({ scale: s * window.devicePixelRatio });
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${base.height * s}px`;
        renderTask = pdfPage.render({ canvasContext: canvas.getContext("2d")!, viewport });
        await renderTask.promise;
        if (cancelled) return;

        let target: number[] | null = active?.bbox ?? null;
        let found: number[] | null = null;
        if (!target && searchText) {
          const content = await pdfPage.getTextContent();
          if (cancelled) return;
          found = findTextBox(content.items, base, searchText);
          target = found;
        }
        setTextBox(found);
        setStatus(active?.bbox ? "bbox" : found ? "text" : "none");
        setScale(s);
        setError(null);
        if (target && !fit) {
          frame.scrollTo({
            left: Math.max(0, (target[0] + target[2] / 2) * s - frame.clientWidth / 2),
            top: Math.max(0, (target[1] + target[3] / 2) * s - frame.clientHeight / 2),
          });
        } else {
          frame.scrollTo({ left: 0, top: 0 });
        }
      })
      .catch((e: Error) => {
        if (!cancelled && e?.name !== "RenderingCancelledException") {
          setError("기획서 원본을 불러오지 못했습니다.");
        }
      });

    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [fileUrl, page, boxKey, searchText, fit]);

  const drawn: PageHighlight[] = textBox ? [...boxes, { bbox: textBox, active: true }] : boxes;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-slate-500">
          {searchText !== undefined && scale > 0 && (
            status === "bbox" ? "파서가 기록한 위치를 표시합니다."
            : status === "text" ? "PDF 텍스트에서 같은 문장을 찾아 위치를 표시했습니다."
            : "정확한 위치 정보가 없어 페이지만 표시합니다."
          )}
        </span>
        <button
          type="button"
          onClick={() => setFit(!fit)}
          className="text-[11px] px-2 py-1 rounded border border-slate-200 text-slate-600 hover:bg-slate-50 shrink-0"
        >
          {fit ? "요구사항 위치 확대" : "전체 페이지 보기"}
        </button>
      </div>
      <div ref={frameRef} className="relative w-full h-90 overflow-auto border border-slate-200 rounded bg-slate-50">
        <div className="relative inline-block">
          <canvas ref={canvasRef} className="block" />
          {scale > 0 && drawn.map((b, i) => {
            const strong = Boolean(b.active);
            return (
              <div
                key={i}
                data-testid={strong ? "pdf-highlight-active" : "pdf-highlight"}
                className={`absolute rounded-sm pointer-events-none ${
                  strong ? "border-2 border-amber-500 bg-amber-300/25" : "border border-dashed border-sky-500 bg-sky-300/10"
                }`}
                style={{
                  left: b.bbox[0] * scale - 3,
                  top: b.bbox[1] * scale - 3,
                  width: b.bbox[2] * scale + 6,
                  height: b.bbox[3] * scale + 6,
                }}
              />
            );
          })}
        </div>
        {error && <div className="p-4 text-xs text-slate-500">{error}</div>}
      </div>
    </div>
  );
};