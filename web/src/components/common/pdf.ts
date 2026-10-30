import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

// 한글 CID 폰트는 CMap 없이는 pdf.js가 글자를 해석하지 못해 텍스트 레이어가 비고,
// 인용문 위치를 하나도 찾을 수 없다. VS Code webview(base: "./")에서는 cMapUrl 같은
// 고정 경로가 깨지므로 CMap을 번들 자산으로 넣고 pdf.js에 직접 공급한다.
const cmapUrls = import.meta.glob("/node_modules/pdfjs-dist/cmaps/*.bcmap", {
  query: "?url",
  import: "default",
  eager: true,
}) as Record<string, string>;
const cmapByName = new Map(
  Object.entries(cmapUrls).map(([path, url]) => [path.slice(path.lastIndexOf("/") + 1, -".bcmap".length), url]),
);

class BundledCMapReaderFactory {
  async fetch({ name }: { name: string }) {
    const url = cmapByName.get(name);
    if (!url) throw new Error(`CMap ${name}을 찾을 수 없습니다`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`CMap ${name}을 불러오지 못했습니다`);
    return { cMapData: new Uint8Array(await res.arrayBuffer()), isCompressed: true };
  }
}

// 같은 문서를 요구사항마다 다시 받지 않는다
const documents = new Map<string, Promise<pdfjs.PDFDocumentProxy>>();
export const loadDocument = (url: string) => {
  if (!documents.has(url)) {
    const task = pdfjs.getDocument({
      url,
      CMapReaderFactory: BundledCMapReaderFactory,
      useWorkerFetch: false,
    }).promise;
    task.catch(() => documents.delete(url));
    documents.set(url, task);
  }
  return documents.get(url)!;
};

/** [x, y, w, h], PDF pt, 페이지 왼쪽 위 원점 (백엔드 블록 location.bbox와 같은 좌표계) */
export type PdfRect = [number, number, number, number];

type TextItem = { str: string; transform: number[]; width: number };
type Glyph = { c: string; x0: number; x1: number; top: number; bottom: number; line: number };

const mul = (m: number[], n: number[]) => [
  m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
];

/** 텍스트 항목을 글자 단위로 펼친다. pdf.js는 글자별 폭을 주지 않으므로 항목 폭을 글자 수로 나눈다. */
function toGlyphs(items: TextItem[], viewportTransform: number[]): Glyph[] {
  const glyphs: Glyph[] = [];
  const lines: { base: number; size: number }[] = [];
  for (const it of items) {
    if (!it.str?.trim()) continue;
    const t = mul(viewportTransform, it.transform);
    const size = Math.hypot(t[2], t[3]);
    const base = t[5];
    const chars = Array.from(it.str.normalize("NFC"));
    const step = it.width / chars.length;
    let line = lines.findIndex((l) => Math.abs(l.base - base) < Math.max(l.size, size) * 0.5);
    if (line < 0) {
      lines.push({ base, size });
      line = lines.length - 1;
    }
    chars.forEach((c, i) => {
      if (!c.trim()) return;
      const x0 = t[4] + step * i;
      glyphs.push({ c, x0, x1: x0 + step, top: base - size * 0.9, bottom: base + size * 0.25, line });
    });
  }
  return glyphs;
}

/**
 * 인용문(quote)이 블록(bbox) 안에서 차지하는 줄별 사각형. 못 찾으면 null.
 *
 * 기획서 PDF는 한글 공백이 빠진 채 글자 간격으로만 띄어 쓰는 경우가 많아, 백엔드가 공백을
 * 복원한 블록 텍스트와 PDF 텍스트의 공백이 다르다. 공백을 모두 지운 문자열끼리 비교한다.
 * OCR로 읽은 헤더처럼 PDF에 글자가 없는 블록은 null → 호출 측에서 블록 전체로 표시한다.
 */
export function quoteRects(items: TextItem[], viewportTransform: number[], bbox: PdfRect, quote: string): PdfRect[] | null {
  const needle = quote.normalize("NFC").replace(/\s+/g, "");
  if (!needle) return null;
  const [bx, by, bw, bh] = bbox;
  const M = 2;
  const glyphs = toGlyphs(items, viewportTransform).filter((g) => {
    const cx = (g.x0 + g.x1) / 2;
    const cy = (g.top + g.bottom) / 2;
    return cx >= bx - M && cx <= bx + bw + M && cy >= by - M && cy <= by + bh + M;
  });
  const lineTop = new Map<number, number>();
  glyphs.forEach((g) => lineTop.set(g.line, Math.min(lineTop.get(g.line) ?? Infinity, g.top)));
  glyphs.sort((a, b) => lineTop.get(a.line)! - lineTop.get(b.line)! || a.line - b.line || a.x0 - b.x0);

  const start = glyphs.map((g) => g.c).join("").indexOf(needle);
  if (start < 0) return null;
  const owners = glyphs.flatMap((g, i) => Array.from(g.c, () => i));
  const byLine = new Map<number, PdfRect>();
  for (const i of new Set(owners.slice(start, start + needle.length))) {
    const g = glyphs[i];
    const r = byLine.get(g.line);
    if (!r) {
      byLine.set(g.line, [g.x0, g.top, g.x1 - g.x0, g.bottom - g.top]);
      continue;
    }
    const x0 = Math.min(r[0], g.x0);
    const y0 = Math.min(r[1], g.top);
    byLine.set(g.line, [x0, y0, Math.max(r[0] + r[2], g.x1) - x0, Math.max(r[1] + r[3], g.bottom) - y0]);
  }
  return [...byLine.values()].sort((a, b) => a[1] - b[1] || a[0] - b[0]);
}
