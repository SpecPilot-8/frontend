import React, { useEffect, useRef, useState } from "react";
import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

interface SpecPageViewerProps {
  // 백엔드 GET /documents/{d}/file
  fileUrl: string;
  // 1부터 센다 (v2 블록 location.index)
  page: number;
  // [x, y, w, h], PDF 좌표(pt, 왼쪽 위 기준). 파서가 찾은 요구사항 행 위치
  bbox?: number[];
}

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

export const SpecPageViewer: React.FC<SpecPageViewerProps> = ({ fileUrl, page, bbox }) => {
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState(0);
  const [fit, setFit] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let renderTask: pdfjs.RenderTask | null = null;
    const canvas = canvasRef.current;
    const frame = frameRef.current;
    if (!canvas || !frame) return;

    loadDocument(fileUrl)
      .then((doc) => doc.getPage(page))
      .then((pdfPage) => {
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
        return renderTask.promise.then(() => {
          if (cancelled) return;
          setScale(s);
          setError(null);
          if (bbox && !fit) {
            // 박스가 프레임 가운데 오도록 프레임 안에서만 스크롤한다 (페이지 전체는 움직이지 않는다)
            frame.scrollTo({
              left: Math.max(0, (bbox[0] + bbox[2] / 2) * s - frame.clientWidth / 2),
              top: Math.max(0, (bbox[1] + bbox[3] / 2) * s - frame.clientHeight / 2),
            });
          } else {
            frame.scrollTo({ left: 0, top: 0 });
          }
        });
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
  }, [fileUrl, page, bbox, fit]);

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setFit(!fit)}
          className="text-[11px] px-2 py-1 rounded border border-slate-200 text-slate-600 hover:bg-slate-50"
        >
          {fit ? "요구사항 위치 확대" : "전체 페이지 보기"}
        </button>
      </div>
      <div ref={frameRef} className="relative w-full h-90 overflow-auto border border-slate-200 rounded bg-slate-50">
        <div className="relative inline-block">
          <canvas ref={canvasRef} className="block" />
          {bbox && scale > 0 && (
            <div
              className="absolute border-2 border-amber-500 bg-amber-300/25 rounded-sm pointer-events-none"
              style={{
                left: bbox[0] * scale - 3,
                top: bbox[1] * scale - 3,
                width: bbox[2] * scale + 6,
                height: bbox[3] * scale + 6,
              }}
            />
          )}
        </div>
        {error && <div className="p-4 text-xs text-slate-500">{error}</div>}
      </div>
    </div>
  );
};
