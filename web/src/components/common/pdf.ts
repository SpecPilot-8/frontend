/**
 * - 담당 파트: 프런트 엔드
 * - 작성자: 이시형
 * - 페이지 개요: PDF 문서를 로드하고 블록 영역 안에서 인용문 텍스트의 줄별 좌표를 계산하는 유틸 파일
 * - 주요 기능:
 *   1) 한글 폰트 구문 해석을 위한 번들 CMap 로더 설정 및 문서 캐싱
 *   2) PDF 텍스트 항목의 글자 단위 좌표 변환
 *   3) 블록 범위 내 인용문 문자열 매칭 및 줄별 하이라이트 사각형 산출
 */

import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

const cmapUrls = import.meta.glob("/node_modules/pdfjs-dist/cmaps/*.bcmap", {
  query: "?url",
  import: "default",
  eager: true,
}) as Record<string, string>;
const cmapByName = new Map(
  Object.entries(cmapUrls).map(([path, url]) => [path.slice(path.lastIndexOf("/") + 1, -".bcmap".length), url]),
);

// 번들된 CMap 데이터를 읽어오는 클래스
class BundledCMapReaderFactory {
  async fetch({ name }: { name: string }) {
    const url = cmapByName.get(name);
    if (!url) throw new Error(`CMap ${name}을 찾을 수 없습니다`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`CMap ${name}을 불러오지 못했습니다`);
    return { cMapData: new Uint8Array(await res.arrayBuffer()), isCompressed: true };
  }
}

// PDF 문서를 캐싱하여 로드하는 로직
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

export type PdfRect = [number, number, number, number];

type TextItem = { str: string; transform: number[]; width: number };
type Glyph = { c: string; x0: number; x1: number; top: number; bottom: number; line: number };

const mul = (m: number[], n: number[]) => [
  m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
];

// 텍스트 항목을 글자 단위 좌표로 변환하는 로직
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

// 블록 안에서 인용문이 차지하는 줄별 사각형 좌표를 계산하는 로직
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
