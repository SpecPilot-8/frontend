/**
 * - 담당 파트: 프런트 엔드
 * - 작성자: 이시형
 * - 페이지 개요: 기획서 문서의 특정 페이지를 캔버스에 렌더링하고 출처 위치를 강조 표시하는 컴포넌트
 * - 주요 기능:
 *   1) 문서 페이지 확대 및 전체 보기 전환 렌더링
 *   2) 출처 좌표 또는 검색 문장 기반 하이라이트 영역 표시
 *   3) 활성 출처 위치로 프레임 내부 스크롤 자동 이동 및 큰 화면 모달 확대 보기
 */

import React, { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
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

interface PdfCanvasFrameProps {
  fileUrl: string;
  page: number;
  boxes: PageHighlight[];
  boxKey: string;
  searchText?: string;
  zoomMultiplier: number;
  frameClassName: string;
  onStatusChange?: (status: LocateStatus, scale: number) => void;
  onImageClick?: () => void;
  imageTitle?: string;
}

const PdfCanvasFrame: React.FC<PdfCanvasFrameProps> = ({
  fileUrl,
  page,
  boxes,
  boxKey,
  searchText,
  zoomMultiplier,
  frameClassName,
  onStatusChange,
  onImageClick,
  imageTitle,
}) => {
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState(0);
  const [textBox, setTextBox] = useState<number[] | null>(null);

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
        const width = frame.clientWidth * zoomMultiplier;
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
        const nextStatus: LocateStatus = active?.bbox ? "bbox" : found ? "text" : "none";
        setTextBox(found);
        setScale(s);
        setError(null);
        onStatusChange?.(nextStatus, s);
        if (target && zoomMultiplier > 1) {
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
  }, [fileUrl, page, boxKey, searchText, zoomMultiplier, onStatusChange]);

  const drawn: PageHighlight[] = textBox ? [...boxes, { bbox: textBox, active: true }] : boxes;

  return (
    <div ref={frameRef} className={frameClassName}>
      <div
        className={`relative inline-block ${onImageClick ? "cursor-zoom-in" : ""}`}
        title={onImageClick ? imageTitle : undefined}
        onMouseDown={(e) => {
          pointerDownPos.current = { x: e.clientX, y: e.clientY };
        }}
        onClick={(e) => {
          if (!onImageClick) return;
          const start = pointerDownPos.current;
          if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 5) return;
          onImageClick();
        }}
      >
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
  );
};

export const SpecPageViewer: React.FC<SpecPageViewerProps> = ({ fileUrl, page, bbox, highlights, searchText }) => {
  const [scale, setScale] = useState(0);
  const [fit, setFit] = useState(false);
  const [status, setStatus] = useState<LocateStatus>("none");
  const [expandedOpen, setExpandedOpen] = useState(false);
  const [modalZoom, setModalZoom] = useState<number>(1);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const modalTitleId = useId();

  const boxes: PageHighlight[] = highlights ?? (bbox ? [{ bbox, active: true }] : []);
  const boxKey = JSON.stringify(boxes);

  useLayoutEffect(() => {
    if (!expandedOpen) return;
    const dialog = dialogRef.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog?.showModal();
    return () => {
      dialog?.close();
      opener?.focus();
    };
  }, [expandedOpen]);

  const handleStatusChange = React.useCallback((nextStatus: LocateStatus, nextScale: number) => {
    setStatus(nextStatus);
    setScale(nextScale);
  }, []);

  const openModal = () => {
    setModalZoom(1);
    setExpandedOpen(true);
  };

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
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setFit(!fit)}
            className="text-[11px] px-2 py-1 rounded border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
          >
            {fit ? "요구사항 위치 확대" : "전체 페이지 보기"}
          </button>
          <button
            type="button"
            onClick={openModal}
            className="text-[11px] px-2 py-1 rounded border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
          >
            크게 보기
          </button>
        </div>
      </div>

      <PdfCanvasFrame
        fileUrl={fileUrl}
        page={page}
        boxes={boxes}
        boxKey={boxKey}
        searchText={searchText}
        zoomMultiplier={fit ? 1 : ZOOM}
        frameClassName="relative w-full h-90 overflow-auto border border-slate-200 rounded bg-slate-50"
        onStatusChange={handleStatusChange}
        onImageClick={openModal}
        imageTitle="클릭하면 큰 화면으로 봅니다"
      />

      {expandedOpen && (
        <dialog
          ref={dialogRef}
          aria-labelledby={modalTitleId}
          onClose={() => {
            if (!dialogRef.current?.open) setExpandedOpen(false);
          }}
          onClick={(e) => {
            if (e.target === dialogRef.current) dialogRef.current.close();
          }}
          className="m-auto w-[calc(100%-2rem)] max-w-6xl h-[90vh] rounded-xl border border-slate-200 bg-white p-0 text-slate-800 shadow-xl backdrop:bg-slate-900/50"
        >
          <div className="flex flex-col h-full">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-3.5">
              <div className="min-w-0">
                <h2 id={modalTitleId} className="text-sm font-semibold text-slate-900">
                  기획서 원본 · {page}쪽
                </h2>
                {searchText !== undefined && scale > 0 && (
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {status === "bbox" ? "파서가 기록한 위치를 표시합니다."
                    : status === "text" ? "PDF 텍스트에서 같은 문장을 찾아 위치를 표시했습니다."
                    : "정확한 위치 정보가 없어 페이지만 표시합니다."}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { value: 1, label: "화면 맞춤" },
                  { value: 1.5, label: "150%" },
                  { value: 2, label: "200%" },
                  { value: 3, label: "300%" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    aria-pressed={modalZoom === opt.value}
                    onClick={() => setModalZoom(opt.value)}
                    className={`text-xs px-2.5 py-1 rounded border cursor-pointer ${
                      modalZoom === opt.value
                        ? "border-blue-300 bg-blue-50 text-blue-700 font-medium"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
                <button
                  type="button"
                  autoFocus
                  onClick={() => dialogRef.current?.close()}
                  className="ml-2 text-xs px-3 py-1 rounded border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 font-medium cursor-pointer"
                >
                  닫기
                </button>
              </div>
            </header>
            <div className="flex-1 min-h-0 p-4 bg-slate-100/70">
              <PdfCanvasFrame
                fileUrl={fileUrl}
                page={page}
                boxes={boxes}
                boxKey={boxKey}
                searchText={searchText}
                zoomMultiplier={modalZoom}
                frameClassName="relative w-full h-full overflow-auto border border-slate-200 rounded-lg bg-slate-50"
              />
            </div>
          </div>
        </dialog>
      )}
    </div>
  );
};
