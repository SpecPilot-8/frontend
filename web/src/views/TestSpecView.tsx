import React, { useState, useEffect, useMemo } from "react";
import type { StepId, TestCaseApi } from "../types";
import type { Requirement, RequirementCondition } from "../types/verification";
import { useProject } from "../contexts/ProjectContext";
import {
  Button,
  Card,
  StatusBadge,
  EmptyState,
  PageHeader,
} from "../components/common";
import { pollJobStatus, BASE_URL } from "../services/api";
import {
  PREDICTION_LABEL,
  TEST_SECTION_LABEL,
  TEST_SECTION_ORDER,
  TEST_TYPE_LABEL,
} from "../constants/verdict";

interface TestSpecViewProps {
  onNavigateStep: (step: StepId) => void;
  // 검증 상세에서 넘어오면 그 요구사항에 연결된 시험만 먼저 보여준다 (요구사항 id 또는 stable_key)
  selectedRequirementId?: string;
}

interface RequirementVersion {
  requirement_id: string;
  revision?: number;
}

interface VerificationRun {
  id: string;
  snapshot_id: string;
  requirement_versions?: RequirementVersion[];
}

interface TestSpecification {
  id: string;
  created_at: string;
  revision: number;
  verification_run_id: string;
  test_case_ids: string[];
}

interface ChunkLocation {
  file_path: string;
  start_line: number;
  end_line: number;
}

export const TestSpecView: React.FC<TestSpecViewProps> = ({
  onNavigateStep,
  selectedRequirementId,
}) => {
  const { projectId } = useProject();

  const [isLoading, setIsLoading] = useState(true);
  const [latestRun, setLatestRun] = useState<VerificationRun | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const [spec, setSpec] = useState<TestSpecification | null>(null);
  const [cases, setCases] = useState<TestCaseApi[]>([]);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [chunks, setChunks] = useState<Record<string, ChunkLocation | null>>({});

  const [section, setSection] = useState<string>("all");
  const [prediction, setPrediction] = useState<string>("all");
  const [requirementFilter, setRequirementFilter] = useState<string | null>(
    selectedRequirementId || null,
  );
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;

    const load = async () => {
      try {
        const runsRes = await fetch(
          `${BASE_URL}/projects/${projectId}/verification-runs`,
        );
        if (!runsRes.ok) {
          throw new Error("검증 실행 목록을 조회할 수 없습니다.");
        }
        const runsData = await runsRes.json();
        if (!runsData.items || runsData.items.length === 0) return;

        const runId = runsData.items[0].id;
        const [detailRes, specsRes, reqRes] = await Promise.all([
          fetch(`${BASE_URL}/projects/${projectId}/verification-runs/${runId}`),
          fetch(`${BASE_URL}/projects/${projectId}/test-specifications?limit=200`),
          fetch(`${BASE_URL}/projects/${projectId}/requirements?limit=200`),
        ]);
        if (!detailRes.ok) {
          throw new Error("검증 상세 정보를 조회할 수 없습니다.");
        }
        setLatestRun(await detailRes.json());
        if (reqRes.ok) setRequirements((await reqRes.json()).items || []);

        // 이 검증 실행으로 만든 사양서 중 시험이 들어 있는 가장 최근 것
        const specs: TestSpecification[] = specsRes.ok
          ? (await specsRes.json()).items || []
          : [];
        const target = specs
          .filter((s) => s.verification_run_id === runId && s.test_case_ids.length > 0)
          .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
        if (!target) return;
        setSpec(target);
        const casesRes = await fetch(
          `${BASE_URL}/projects/${projectId}/test-cases?test_specification_id=${target.id}&limit=200`,
        );
        if (casesRes.ok) setCases((await casesRes.json()).items || []);
      } catch (error) {
        console.error("테스트 사양서 로딩 실패:", error);
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [projectId]);

  // 조건 id → 조건, 요구사항 id → 요구사항
  const conditionOf = useMemo(() => {
    const map = new Map<string, RequirementCondition>();
    for (const r of requirements) {
      for (const c of r.conditions ?? []) map.set(c.id, c);
    }
    return map;
  }, [requirements]);

  const filterRequirement = useMemo(
    () =>
      requirements.find(
        (r) => r.id === requirementFilter || r.stable_key === requirementFilter,
      ),
    [requirements, requirementFilter],
  );

  const sorted = useMemo(
    () =>
      [...cases].sort(
        (a, b) =>
          TEST_SECTION_ORDER.indexOf(a.export_section_key) -
            TEST_SECTION_ORDER.indexOf(b.export_section_key) ||
          a.test_no.localeCompare(b.test_no),
      ),
    [cases],
  );

  const visible = useMemo(
    () =>
      sorted.filter(
        (c) =>
          (section === "all" || c.export_section_key === section) &&
          (prediction === "all" || c.prediction.status === prediction) &&
          (!filterRequirement ||
            c.requirement_links.some((l) => l.requirement_id === filterRequirement.id)),
      ),
    [sorted, section, prediction, filterRequirement],
  );

  const activeCase =
    visible.find((c) => c.id === activeCaseId) || visible[0] || null;

  const counts = useMemo(() => {
    const bySection: Record<string, number> = {};
    const byPrediction: Record<string, number> = {};
    for (const c of cases) {
      bySection[c.export_section_key] = (bySection[c.export_section_key] || 0) + 1;
      byPrediction[c.prediction.status] = (byPrediction[c.prediction.status] || 0) + 1;
    }
    return {
      bySection,
      byPrediction,
      steps: cases.reduce((n, c) => n + c.steps.length, 0),
    };
  }, [cases]);

  // 선택한 시험의 코드 근거 위치 (파일·줄)
  useEffect(() => {
    if (!projectId || !latestRun || !activeCase) return;
    // 한 번 조회한 청크는 실패(null)도 기록해 다시 요청하지 않는다
    const missing = activeCase.prediction.primary_chunk_ids.filter((id) => !(id in chunks));
    if (missing.length === 0) return;
    Promise.all(
      missing.map((id) =>
        fetch(
          `${BASE_URL}/projects/${projectId}/code/snapshots/${latestRun.snapshot_id}/chunks/${id}`,
        )
          .then((res) => (res.ok ? res.json() : null))
          .then((c) => [id, c] as const),
      ),
    ).then((pairs) =>
      setChunks((prev) => {
        const next = { ...prev };
        for (const [id, c] of pairs) next[id] = c;
        return next;
      }),
    );
  }, [projectId, latestRun, activeCase, chunks]);

  const screenOf = (c: TestCaseApi) => {
    const key = requirements.find((r) => r.id === c.requirement_links[0]?.requirement_id)
      ?.stable_key;
    return key ? key.split("-").slice(0, 2).join("-") : "";
  };

  const handleGenerateTestSpec = async () => {
    if (!projectId || !latestRun) return;
    setIsGenerating(true);

    try {
      const reqIds = latestRun.requirement_versions
        ? latestRun.requirement_versions.map((r) => r.requirement_id)
        : [];

      if (reqIds.length === 0) {
        alert("검증에 사용된 요구사항이 없습니다.");
        setIsGenerating(false);
        return;
      }

      const res = await fetch(
        `${BASE_URL}/projects/${projectId}/test-specifications/generate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            verification_run_id: latestRun.id,
            requirement_ids: reqIds,
          }),
        },
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(
          errData.error?.message || "테스트 사양서 생성 요청에 실패했습니다.",
        );
      }

      const job = await res.json();

      if (job.status === "blocked" || job.status === "failed") {
        alert(
          `[백엔드 테스트 생성 차단됨]\n사유: ${job.missing_features?.[0]?.message || "AI 모델 어댑터 미연결"}\n\n테스트 생성은 AI 모델이 필수적이므로 더 이상 진행할 수 없습니다.`,
        );
      } else if (job.id) {
        const finalJob = (await pollJobStatus(
          projectId,
          job.id,
          (jobInfo: { progress?: { stage: string } }) => {
            if (jobInfo.progress) {
              console.log(`테스트 사양서 생성 중... ${jobInfo.progress.stage}`);
            }
          },
        )) as { status: string; error?: { message: string } };

        if (["failed", "blocked", "cancelled"].includes(finalJob.status)) {
          alert(`[생성 실패] ${finalJob.error?.message || finalJob.status}`);
        } else {
          alert("테스트 사양서가 성공적으로 생성되었습니다.");
        }
      }
    } catch (error: unknown) {
      console.error(error);
      const msg = error instanceof Error ? error.message : "알 수 없는 오류";
      alert(`테스트 생성 요청 중 통신 오류가 발생했습니다: ${msg}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExportExcel = async () => {
    if (!projectId || !spec) return;
    setIsExporting(true);

    try {
      const exportRes = await fetch(
        `${BASE_URL}/projects/${projectId}/exports/test-specification`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            test_specification_id: spec.id,
            revision: spec.revision,
            execution_selection: "latest_per_case",
            template_id: "thinktree-test-spec-v1",
            include_analysis_detail: true,
            format: "xlsx",
          }),
        },
      );

      if (!exportRes.ok) {
        const errData = await exportRes.json().catch(() => ({}));
        throw new Error(
          errData.error?.message || "엑셀 파일 출력 요청에 실패했습니다.",
        );
      }

      let job = await exportRes.json();
      if (job.status !== "completed" && job.id) {
        job = await pollJobStatus(projectId, job.id);
      }
      if (job.result_ref?.id) {
        window.open(
          `${BASE_URL}/projects/${projectId}/artifacts/${job.result_ref.id}/download`,
          "_blank",
        );
      } else {
        alert(`[출력 실패] ${job.error?.message || job.status}`);
      }
    } catch (error: unknown) {
      console.error(error);
      const msg = error instanceof Error ? error.message : "알 수 없는 오류";
      alert(`엑셀 파일 내보내기 중 통신 오류가 발생했습니다: ${msg}`);
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto py-12 text-center text-xs text-slate-400">
        검증 데이터를 불러오는 중입니다...
      </div>
    );
  }

  if (!latestRun) {
    return (
      <div className="max-w-6xl mx-auto py-2 px-2 md:px-4 space-y-4">
        <PageHeader
          stepTag="04 / TEST SPECIFICATION"
          title="테스트 사양서를 생성할 수 없습니다."
          description="이전 단계에서 코드 검증을 먼저 실행해야 합니다."
        />
        <EmptyState
          title="검증 기록 없음"
          description="코드 검증을 먼저 실행한 뒤 테스트 사양서를 생성해 주세요."
          action={
            <Button
              variant="primary"
              onClick={() => onNavigateStep("VERIFICATION")}
            >
              검증 화면으로 돌아가기
            </Button>
          }
        />
      </div>
    );
  }

  if (!spec) {
    return (
      <div className="max-w-6xl mx-auto py-2 px-2 md:px-4 space-y-4">
        <PageHeader
          stepTag="04 / TEST SPECIFICATION"
          title="테스트 사양서"
          description="확정한 요구사항으로 단계별 시험 절차를 만듭니다."
        />
        <Card
          title="테스트 사양서 자동 생성"
          description="가장 최근에 실행한 코드 검증 결과를 바탕으로 테스트 케이스를 추출합니다."
          className="space-y-4"
        >
          <div className="bg-slate-50/70 border border-slate-200/60 rounded-xl p-4 space-y-2 text-sm text-slate-700">
            <p>
              <span className="font-semibold text-slate-900">기준 검증 ID:</span>{" "}
              {latestRun.id}
            </p>
            <p>
              <span className="font-semibold text-slate-900">대상 스냅샷:</span>{" "}
              {latestRun.snapshot_id}
            </p>
            <p>
              <span className="font-semibold text-slate-900">포함된 요구사항:</span>{" "}
              {latestRun.requirement_versions?.length || 0}개
            </p>
          </div>
          <div className="pt-2 flex items-center space-x-2 border-t border-slate-100">
            <Button
              variant="secondary"
              onClick={() => onNavigateStep("VERIFICATION")}
            >
              이전 화면으로
            </Button>
            <Button
              variant="primary"
              onClick={handleGenerateTestSpec}
              disabled={isGenerating}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isGenerating
                ? "AI 테스트 생성 요청 중..."
                : "AI 테스트 사양서 생성 (자동 도출)"}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const chip = (active: boolean) =>
    `px-2.5 py-1 rounded-lg border text-[11px] whitespace-nowrap transition-colors ${
      active
        ? "border-blue-300 bg-blue-50 text-blue-700 font-semibold"
        : "border-slate-200 text-slate-600 hover:bg-slate-50"
    }`;

  return (
    <div className="max-w-[1400px] mx-auto py-2 px-2 md:px-4 space-y-4">
      <PageHeader
        stepTag="04 / TEST SPECIFICATION"
        title="테스트 사양서"
        description={`시험 ${cases.length}개 · 단계 ${counts.steps}개. 예상결과는 기획서 기준이고, 코드 예측은 검증 판정으로 붙였습니다.`}
        action={
          <div className="flex items-center space-x-2 flex-wrap">
            <Button
              variant="secondary"
              onClick={() => onNavigateStep("VERIFICATION")}
            >
              이전 화면으로
            </Button>
            <Button
              variant="primary"
              onClick={handleExportExcel}
              disabled={isExporting}
            >
              {isExporting ? "사양서 엑셀 생성 중..." : "사양서 엑셀(XLSX) 내보내기"}
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-1.5">
        <button type="button" className={chip(section === "all")} onClick={() => setSection("all")}>
          전체 {cases.length}
        </button>
        {TEST_SECTION_ORDER.filter((s) => counts.bySection[s]).map((s) => (
          <button key={s} type="button" className={chip(section === s)} onClick={() => setSection(s)}>
            {TEST_SECTION_LABEL[s]} {counts.bySection[s]}
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-slate-200" />
        {["all", "failure_expected", "normal_expected", "needs_review"].map((s) => (
          <button
            key={s}
            type="button"
            className={chip(prediction === s)}
            onClick={() => setPrediction(s)}
          >
            {s === "all" ? "코드 예측 전체" : `${PREDICTION_LABEL[s]} ${counts.byPrediction[s] || 0}`}
          </button>
        ))}
        {filterRequirement && (
          <button
            type="button"
            className="px-2.5 py-1 rounded-lg border border-amber-300 bg-amber-50 text-amber-700 text-[11px]"
            onClick={() => setRequirementFilter(null)}
          >
            요구사항 {filterRequirement.stable_key} 시험만 보기 ✕
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
        <div className="md:col-span-4 min-w-0">
          <Card
            title="시험 목록"
            extra={<span className="text-[11px] text-slate-400">{visible.length}건</span>}
            className="h-full"
          >
            <div className="space-y-1.5 pr-1 max-h-[70vh] overflow-y-auto">
              {visible.length === 0 && (
                <p className="text-xs text-slate-400 py-6 text-center">조건에 맞는 시험이 없습니다.</p>
              )}
              {visible.map((item) => {
                const isSelected = activeCase?.id === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveCaseId(item.id)}
                    className={`w-full text-left p-3 rounded-xl border text-xs transition-colors space-y-1.5 ${
                      isSelected
                        ? "border-blue-300 bg-blue-50/60 text-slate-900 shadow-sm"
                        : "border-slate-200 hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold font-mono text-blue-600 truncate">{item.test_no}</span>
                      <StatusBadge
                        status={PREDICTION_LABEL[item.prediction.status]}
                        className="whitespace-nowrap"
                      />
                    </div>
                    <div className="font-semibold">{item.title}</div>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                      <span>{TEST_SECTION_LABEL[item.export_section_key]}</span>
                      <span>·</span>
                      <span>{screenOf(item)}</span>
                      <span>·</span>
                      <span>{TEST_TYPE_LABEL[item.type]}</span>
                      <span>·</span>
                      <span>단계 {item.steps.length}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>
        </div>

        <div className="md:col-span-8 min-w-0">
          {activeCase && (
            <Card
              title={`[${activeCase.test_no}] ${activeCase.title}`}
              description={`${TEST_SECTION_LABEL[activeCase.export_section_key]} · ${screenOf(activeCase)} · ${TEST_TYPE_LABEL[activeCase.type]} 시험`}
              extra={
                <StatusBadge
                  status={PREDICTION_LABEL[activeCase.prediction.status]}
                  className="whitespace-nowrap"
                />
              }
            >
              <div className="space-y-4 text-xs">
                {activeCase.preconditions && (
                  <div className="p-3.5 bg-slate-50/70 rounded-xl border border-slate-200/60">
                    <span className="font-bold text-slate-800 block mb-1">사전 조건</span>
                    <p className="text-slate-600 leading-relaxed">{activeCase.preconditions}</p>
                  </div>
                )}

                <div className="overflow-x-auto rounded-xl border border-slate-200/80">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        <th className="px-2.5 py-2 w-8">No</th>
                        <th className="px-2.5 py-2 w-[26%]">시험절차</th>
                        <th className="px-2.5 py-2 w-[32%]">예상결과 (기획서 기준)</th>
                        <th className="px-2.5 py-2 min-w-[140px] whitespace-nowrap">시험데이터</th>
                        <th className="px-2.5 py-2 whitespace-nowrap">확인 조건</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeCase.steps.map((s) => (
                        <tr key={s.step_key} className="border-t border-slate-100 align-top">
                          <td className="px-2.5 py-2 text-slate-400">{s.order}</td>
                          <td className="px-2.5 py-2 text-slate-800">{s.action}</td>
                          <td className="px-2.5 py-2 text-emerald-900/90">{s.expected}</td>
                          <td className="px-2.5 py-2 text-slate-600 space-y-0.5">
                            <div>계정: {s.test_data.account ?? "-"}</div>
                            {s.test_data.input && <div>입력: {s.test_data.input}</div>}
                            {s.test_data.notes && (
                              <div className="text-slate-400">{s.test_data.notes}</div>
                            )}
                          </td>
                          <td className="px-2.5 py-2">
                            <div className="flex flex-wrap gap-1">
                              {s.requirement_links.flatMap((l) =>
                                l.condition_ids.map((id) => {
                                  const c = conditionOf.get(id);
                                  return (
                                    <span
                                      key={id}
                                      title={c?.text}
                                      className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono text-[10px] whitespace-nowrap"
                                    >
                                      {c?.stable_key ?? id.slice(0, 8)}
                                    </span>
                                  );
                                }),
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="p-3.5 bg-blue-50/50 rounded-xl border border-blue-100 space-y-1.5">
                  <span className="font-bold text-blue-800 block">코드 분석 기반 예측</span>
                  <p className="text-blue-900/90 leading-relaxed text-[11px]">
                    {activeCase.prediction.reason}
                  </p>
                  {activeCase.prediction.primary_chunk_ids.length > 0 && (
                    <ul className="pt-1 space-y-0.5 font-mono text-[10px] text-blue-900/70">
                      {activeCase.prediction.primary_chunk_ids.map((id) => {
                        const c = chunks[id];
                        return (
                          <li key={id} className="break-all">
                            {c
                              ? `${c.file_path}:${c.start_line}-${c.end_line}`
                              : c === null
                                ? "근거 위치를 불러오지 못했습니다."
                                : "근거 위치 불러오는 중..."}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                {(activeCase.warnings.length > 0 || activeCase.assumptions.length > 0) && (
                  <div className="p-3.5 bg-amber-50/50 rounded-xl border border-amber-100 space-y-1">
                    <span className="font-bold text-amber-800 block">검토 메모</span>
                    {activeCase.warnings.map((w, i) => (
                      <p key={`w${i}`} className="text-amber-900/90 text-[11px]">
                        {w.message}
                      </p>
                    ))}
                    {activeCase.assumptions.map((a, i) => (
                      <p key={`a${i}`} className="text-amber-900/70 text-[11px]">
                        준비: {a}
                      </p>
                    ))}
                  </div>
                )}

                <p className="pt-2 border-t border-slate-100 text-slate-400 text-[11px]">
                  확인결과는 사람이 시험을 수행한 뒤 기록합니다. 아직 수행 기록이 없습니다.
                </p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};
