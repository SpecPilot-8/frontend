import React, { useEffect, useRef, useState } from "react";
import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export interface PageHighlight {
  // [x, y, w, h], PDF 좌표(pt, 왼쪽 위 기준)
  bbox: number[];
  // 현재 보고 있는 출처. 진하게 표시하고 이 박스로 스크롤한다
  active?: boolean;
}

interface SpecPageViewerProps {
  // 백엔드 GET /documents/{d}/file
  fileUrl: string;
  // 1부터 센다 (v2 블록 location.index)
  page: number;
  // [x, y, w, h], PDF 좌표(pt, 왼쪽 위 기준). 파서가 찾은 요구사항 행 위치
  bbox?: number[];
  // 여러 출처를 한 페이지에 함께 표시할 때 사용한다. 있으면 bbox보다 우선한다
  highlights?: PageHighlight[];
  // 활성 박스 좌표가 없을 때 페이지 텍스트에서 이 문장을 찾아 위치를 추정한다
  searchText?: string;
}

type LocateStatus = "bbox" | "text" | "none";

// 화면설계서 한 페이지를 패널 폭에 다 맞추면 글자를 읽을 수 없어서 기본은 확대해서 요구사항 위치로 스크롤한다
const ZOOM = 3;

// 같은 문서를 요구사항마다 다시 받지 않는다
const documents = new Map<string, Promise<pdfjs.PDFDocumentProxy>>();
const loadDocument = (url: string) => {
  if (!documents.has(url)) {
    const task = pdfjs.getDocument(url).promise;
    task.catch(() => documents.delete(url));
    documents.set(url, task);
  }
  return documents.get(url)!;
};

const normalize = (s: string) => s.replace(/\s+/g, "");

// 텍스트 레이어에서 문장을 찾아 그 글자들을 감싸는 박스를 [x, y, w, h](scale 1, 왼쪽 위 기준)로 돌려준다.
// OCR 페이지처럼 텍스트 레이어가 없으면 null.
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

  // 표 셀 줄바꿈 때문에 긴 문장은 통째로 안 맞을 수 있어 앞부분을 점점 줄여가며 찾는다
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
  // 부모가 렌더할 때마다 새 배열을 넘겨도 페이지를 다시 그리지 않도록 값으로 비교한다
  const boxKey = JSON.stringify(boxes);

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
          // 박스가 프레임 가운데 오도록 프레임 안에서만 스크롤한다 (페이지 전체는 움직이지 않는다)
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
