/**
 * - 담당 파트: 프런트 엔드
 * - 작성자: 이시형
 * - 페이지 개요: 테스트 사양서의 경계값·중복·원문 기반 문구 4대 품질 규칙 점검 상세 모달 컴포넌트
 * - 주요 기능:
 *   1) 4대 품질 규칙 요약 수치와 규칙 유형·검색어 필터링 표시
 *   2) 관련 시험 케이스로 바로 이동 기능 및 조회 오류 시 재시도 지원
 */

import { useEffect, useRef, useState } from "react";
import { Button } from "../common";
import type { QualityReport, TestCase } from "../../types/test";

interface Props {
  open: boolean;
  report: QualityReport | null;
  error: string;
  loading: boolean;
  dirty: boolean;
  cases: Pick<TestCase, "id" | "test_no" | "title" | "steps">[];
  onClose: () => void;
  onRetry: () => void;
  onSelectCase: (id: string, stepKey?: string) => void;
}

type FilterKind = "all" | "boundary" | "duplicates" | "invented" | "borrowed";

const formatLimit = (limit: string) => {
  if (limit.startsWith("max ")) return `최대 ${limit.slice(4)}`;
  if (limit.startsWith("min ")) return `최소 ${limit.slice(4)}`;
  return limit;
};

export function TestQualityPanel({
  open,
  report,
  error,
  loading,
  dirty,
  cases,
  onClose,
  onRetry,
  onSelectCase,
}: Props) {
  const [filter, setFilter] = useState<FilterKind>("all");
  const [query, setQuery] = useState("");
  const [showSatisfiedBoundary, setShowSatisfiedBoundary] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const skipRestoreFocusRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    skipRestoreFocusRef.current = false;
    const dialog = dialogRef.current;
    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (!skipRestoreFocusRef.current) {
        opener?.focus();
      }
    };
  }, [open]);

  if (!open) return null;

  const summary = report?.summary;
  const issueCount = summary
    ? summary.boundary_missing +
      summary.duplicates +
      summary.invented_messages +
      summary.borrowed_messages
    : 0;

  const findCaseByWhere = (where: string) => {
    const trimmed = where.trim();
    if (!trimmed) return undefined;
    const direct = cases.find((c) => c.title === trimmed);
    if (direct) return { testCase: direct, stepKey: undefined };
    const splitIdx = trimmed.lastIndexOf(" / ");
    if (splitIdx <= 0) return undefined;
    const titlePart = trimmed.slice(0, splitIdx).trim();
    const stepPart = trimmed.slice(splitIdx + 3).trim();
    const matched = cases.find((c) => c.title === titlePart);
    if (!matched) return undefined;
    const hasStep = matched.steps.some((s) => s.step_key === stepPart);
    return { testCase: matched, stepKey: hasStep ? stepPart : undefined };
  };

  const handleJumpToCase = (caseId: string, stepKey?: string) => {
    skipRestoreFocusRef.current = true;
    onClose();
    onSelectCase(caseId, stepKey);
  };

  const keyword = query.trim().toLowerCase();
  const matchesKeyword = (...fields: (string | string[] | undefined)[]) => {
    if (!keyword) return true;
    const text = fields
      .flatMap((f) => (Array.isArray(f) ? f : [f || ""]))
      .join(" ")
      .toLowerCase();
    return text.includes(keyword);
  };

  const boundaryItems = (report?.boundary || []).filter(
    (b) =>
      (showSatisfiedBoundary || b.missing.length > 0) &&
      matchesKeyword(b.requirement, b.limit, b.missing),
  );
  const duplicateItems = (report?.duplicates || []).filter((d) =>
    matchesKeyword(d.kind, d.where),
  );
  const inventedItems = (report?.invented || []).filter((i) =>
    matchesKeyword(i.requirements, i.message, i.where),
  );
  const borrowedItems = (report?.borrowed || []).filter((b) =>
    matchesKeyword(b.requirements, b.found_in, b.message, b.where),
  );

  const hasVisibleRows =
    ((filter === "all" || filter === "boundary") &&
      boundaryItems.length > 0) ||
    ((filter === "all" || filter === "duplicates") &&
      duplicateItems.length > 0) ||
    ((filter === "all" || filter === "invented") &&
      inventedItems.length > 0) ||
    ((filter === "all" || filter === "borrowed") && borrowedItems.length > 0);

  return (
    <dialog
      ref={dialogRef}
      onClose={() => {
        if (!dialogRef.current?.open) onClose();
      }}
      aria-labelledby="test-quality-title"
      className="m-auto w-[calc(100%-2rem)] max-w-3xl max-h-[88vh] rounded-xl border border-slate-200 bg-white p-0 text-slate-800 shadow-lg backdrop:bg-slate-900/40"
    >
      <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-6 py-4">
        <div className="min-w-0">
          <h2 id="test-quality-title" className="text-base font-semibold">
            사양서 품질 규칙 점검
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            {summary
              ? `전체 ${summary.tests}개 시험 · ${summary.steps}개 단계 기준 · 수치 경계값·중복·원문 문구를 규칙으로 점검합니다.`
              : "수치 경계값, 단계·시험 중복, 원문에 없는 문구와 타 요구사항 문구 혼입을 점검합니다."}
          </p>
        </div>
        <Button
          variant="secondary"
          autoFocus
          onClick={() => dialogRef.current?.close()}
        >
          닫기
        </Button>
      </header>

      <div className="space-y-4 p-6 text-sm leading-6">
        {loading ? (
          <p className="text-slate-500">품질 점검 결과를 계산하는 중입니다.</p>
        ) : error ? (
          <div role="status" className="space-y-2">
            <p className="text-amber-800">
              품질 점검 결과를 불러오지 못했습니다. {error}
            </p>
            <Button variant="secondary" onClick={onRetry}>
              품질 점검 다시 조회
            </Button>
          </div>
        ) : (
          report &&
          summary && (
            <>
              <div className="flex flex-wrap gap-x-5 gap-y-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                <p>
                  경계값 누락{" "}
                  <strong
                    className={
                      summary.boundary_missing > 0 ? "text-amber-800" : ""
                    }
                  >
                    {summary.boundary_missing}
                  </strong>
                  {" / "}
                  {summary.boundary_limits}건
                </p>
                <p>
                  단계·시험 중복{" "}
                  <strong
                    className={summary.duplicates > 0 ? "text-amber-800" : ""}
                  >
                    {summary.duplicates}
                  </strong>
                  건
                </p>
                <p>
                  원문 미포함 문구{" "}
                  <strong
                    className={
                      summary.invented_messages > 0 ? "text-amber-800" : ""
                    }
                  >
                    {summary.invented_messages}
                  </strong>
                  건
                </p>
                <p>
                  타 요구사항 혼입{" "}
                  <strong
                    className={
                      summary.borrowed_messages > 0 ? "text-amber-800" : ""
                    }
                  >
                    {summary.borrowed_messages}
                  </strong>
                  건
                </p>
              </div>
              {dirty && (
                <p className="text-xs text-amber-800">
                  편집 중인 내용은 저장 후 품질 점검에 반영됩니다.
                </p>
              )}

              <div className="flex flex-wrap items-center gap-2">
                {(
                  [
                    ["all", "전체"],
                    [
                      "boundary",
                      `경계값 (${summary.boundary_missing}/${summary.boundary_limits})`,
                    ],
                    ["duplicates", `중복 (${summary.duplicates})`],
                    ["invented", `미포함 문구 (${summary.invented_messages})`],
                    [
                      "borrowed",
                      `타 요구사항 혼입 (${summary.borrowed_messages})`,
                    ],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={filter === value}
                    className={`border rounded px-3 py-1.5 text-xs cursor-pointer ${
                      filter === value
                        ? "border-blue-300 bg-blue-50 text-blue-700 font-medium"
                        : "border-slate-200 text-slate-600"
                    }`}
                    onClick={() => setFilter(value)}
                  >
                    {label}
                  </button>
                ))}
                <input
                  aria-label="품질 점검 검색"
                  placeholder="요구사항 키·문구·시험명 검색"
                  className="min-w-0 w-full sm:w-64 border border-slate-200 rounded px-3 py-1.5 text-sm"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                {(filter === "all" || filter === "boundary") &&
                  report.boundary.some((b) => b.missing.length === 0) && (
                    <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 ml-auto cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showSatisfiedBoundary}
                        onChange={(e) =>
                          setShowSatisfiedBoundary(e.target.checked)
                        }
                      />
                      충족된 경계값도 표시
                    </label>
                  )}
              </div>

              <div className="space-y-3">
                {(filter === "all" || filter === "boundary") &&
                  boundaryItems.map((b, idx) => (
                    <section
                      key={`boundary-${b.requirement}-${b.limit}-${idx}`}
                      className="border border-slate-200 rounded-lg p-4 text-sm leading-6"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs text-slate-500">
                          경계값 · {b.requirement} · {formatLimit(b.limit)}
                        </span>
                        <span
                          className={`text-xs font-medium ${
                            b.missing.length > 0
                              ? "text-amber-800"
                              : "text-slate-600"
                          }`}
                        >
                          {b.missing.length > 0
                            ? `누락: ${b.missing.join(", ")}`
                            : "경계 정확값·바깥값 충족"}
                        </span>
                      </div>
                      <p className="mt-1.5 text-xs text-slate-500">
                        연결된 시험 단계 {b.step_count}개
                        {b.step_count === 0 &&
                          " — 이 수치 제약을 다루는 시험 단계가 없습니다."}
                      </p>
                    </section>
                  ))}

                {(filter === "all" || filter === "duplicates") &&
                  duplicateItems.map((d, idx) => (
                    <section
                      key={`dup-${d.kind}-${idx}`}
                      className="border border-slate-200 rounded-lg p-4 text-sm leading-6"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs text-slate-500">
                          {d.kind === "same_test"
                            ? "같은 시험 내 단계 중복"
                            : "동일 내용 시험 중복"}
                        </span>
                        <span className="text-xs font-medium text-amber-800">
                          {d.count}회 반복
                        </span>
                      </div>
                      <ul className="mt-2 space-y-1 text-xs text-slate-700">
                        {d.where.map((w, wIdx) => {
                          const target = findCaseByWhere(w);
                          return (
                            <li
                              key={`${w}-${wIdx}`}
                              className="flex flex-wrap items-center gap-2"
                            >
                              <span>• {w}</span>
                              {target && (
                                <button
                                  type="button"
                                  className="text-blue-600 underline underline-offset-2 cursor-pointer"
                                  onClick={() =>
                                    handleJumpToCase(
                                      target.testCase.id,
                                      target.stepKey,
                                    )
                                  }
                                >
                                  {target.testCase.test_no} 이동
                                </button>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  ))}

                {(filter === "all" || filter === "invented") &&
                  inventedItems.map((item, idx) => {
                    const target = findCaseByWhere(item.where);
                    return (
                      <section
                        key={`inv-${item.where}-${idx}`}
                        className="border border-slate-200 rounded-lg p-4 text-sm leading-6"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs text-slate-500">
                            원문 미포함 인용 문구 의심 ·{" "}
                            {item.requirements.join(", ")}
                          </span>
                          <span className="text-xs font-medium text-amber-800">
                            {item.where}
                          </span>
                        </div>
                        <p className="mt-1.5 text-sm text-slate-800 select-text">
                          &ldquo;{item.message}&rdquo;
                        </p>
                        {target && (
                          <button
                            type="button"
                            className="mt-2 text-xs font-medium text-blue-600 underline underline-offset-2 cursor-pointer"
                            onClick={() =>
                              handleJumpToCase(
                                target.testCase.id,
                                target.stepKey,
                              )
                            }
                          >
                            {target.testCase.test_no} 시험으로 이동
                          </button>
                        )}
                      </section>
                    );
                  })}

                {(filter === "all" || filter === "borrowed") &&
                  borrowedItems.map((item, idx) => {
                    const target = findCaseByWhere(item.where);
                    return (
                      <section
                        key={`bor-${item.where}-${idx}`}
                        className="border border-slate-200 rounded-lg p-4 text-sm leading-6"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs text-slate-500">
                            타 요구사항 문구 혼입 · 연결{" "}
                            {item.requirements.join(", ")} → 원문 출처{" "}
                            {item.found_in.join(", ")}
                          </span>
                          <span className="text-xs font-medium text-amber-800">
                            {item.where}
                          </span>
                        </div>
                        <p className="mt-1.5 text-sm text-slate-800 select-text">
                          &ldquo;{item.message}&rdquo;
                        </p>
                        {target && (
                          <button
                            type="button"
                            className="mt-2 text-xs font-medium text-blue-600 underline underline-offset-2 cursor-pointer"
                            onClick={() =>
                              handleJumpToCase(
                                target.testCase.id,
                                target.stepKey,
                              )
                            }
                          >
                            {target.testCase.test_no} 시험으로 이동
                          </button>
                        )}
                      </section>
                    );
                  })}

                {!hasVisibleRows && (
                  <p className="py-3 text-sm text-slate-500">
                    {keyword
                      ? "검색 결과가 없습니다."
                      : issueCount === 0
                        ? "탐지된 품질 이상 항목이 없습니다."
                        : "현재 선택한 필터에 해당하는 점검 항목이 없습니다."}
                  </p>
                )}
              </div>
            </>
          )
        )}
      </div>

      <footer className="sticky bottom-0 z-10 flex items-center justify-between gap-4 border-t border-slate-200 bg-white px-6 py-3">
        <p className="text-xs text-slate-500">
          규칙 기반 의심 탐지이며 최종 적합 여부는 시험 설계 검토에서 확인합니다.
        </p>
        <Button
          variant="secondary"
          onClick={() => dialogRef.current?.close()}
        >
          닫기
        </Button>
      </footer>
    </dialog>
  );
}
