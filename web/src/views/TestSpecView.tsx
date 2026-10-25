import React, { useState, useEffect, useCallback } from "react";
import type { StepId } from "../types";
import type { TestSpecification, TestCase, TestExecution, StepResult } from "../types/test";
import { useProject } from "../contexts/ProjectContext";
import {
  Button,
  Card,
  StatusBadge,
  EmptyState,
  PageHeader,
  Input,
} from "../components/common";
import {
  pollJobStatus,
  fetchTestSpecifications,
  fetchTestCases,
  fetchTestExecutions,
  saveTestBatch,
  BASE_URL,
} from "../services/api";

// 백엔드 enum 코드를 화면 라벨로 바꾼다 (docs/schemas/test-generation.schema.json)
const TYPE_LABEL: Record<string, string> = { positive: "정상", negative: "오류", boundary: "경계값" };
const PREDICTION_LABEL: Record<string, string> = {
  normal_expected: "정상 예상",
  failure_expected: "실패 예상",
  needs_review: "확인 필요",
  unknown: "예상 없음",
};
const STEP_STATUS_LABEL: Record<string, string> = { not_run: "미실행", passed: "통과", failed: "실패", on_hold: "보류" };

interface TestSpecViewProps {
  onNavigateStep: (step: StepId) => void;
  selectedRequirementId?: string;
}

interface VerificationRun {
  id: string;
  snapshot_id: string;
  requirement_versions?: { requirement_id: string; revision?: number }[];
}

export const TestSpecView: React.FC<TestSpecViewProps> = ({
  onNavigateStep,
  selectedRequirementId,
}) => {
  const { projectId } = useProject();

  const [isLoading, setIsLoading] = useState(true);
  const [latestRun, setLatestRun] = useState<VerificationRun | null>(null);
  const [testSpec, setTestSpec] = useState<TestSpecification | null>(null);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null);
  const [latestExecution, setLatestExecution] = useState<TestExecution | null>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  
  const [isEditing, setIsEditing] = useState(false);
  const [draftResults, setDraftResults] = useState<Record<string, StepResult>>({});
  const [isSaving, setIsSaving] = useState(false);

  const loadVerificationRunAndSpec = useCallback(async () => {
    if (!projectId) return;
    try {
      const runsRes = await fetch(`${BASE_URL}/projects/${projectId}/verification-runs`);
      if (runsRes.ok) {
        const runsData = await runsRes.json();
        if (runsData.items && runsData.items.length > 0) {
          const runId = runsData.items[0].id;
          const detailRes = await fetch(`${BASE_URL}/projects/${projectId}/verification-runs/${runId}`);
          if (detailRes.ok) setLatestRun(await detailRes.json());
        }
      }

      const specs = await fetchTestSpecifications(projectId);
      if (specs && specs.length > 0) {
        const currentSpec = specs[0];
        setTestSpec(currentSpec);
        
        const cases = await fetchTestCases(projectId, currentSpec.id);
        setTestCases(cases);
        
        if (cases.length > 0) {
          // 검증 상세의 '이 요구사항의 테스트'로 오면 그 요구사항에 연결된 첫 시험을 연다
          const linked = cases.find((c: TestCase) =>
            c.requirement_links.some((l) => l.requirement_id === selectedRequirementId),
          );
          setActiveCaseId(prev => prev || (linked ?? cases[0]).id);
        }
      }
    } catch (error) {
      console.error("테스트 데이터 로딩 실패:", error);
    } finally {
      setIsLoading(false);
    }
  }, [projectId, selectedRequirementId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadVerificationRunAndSpec();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadVerificationRunAndSpec]);

  useEffect(() => {
    if (!projectId || !activeCaseId) return;
    
    let isMounted = true;
    const loadExecutions = async () => {
      try {
        const executions = await fetchTestExecutions(projectId, activeCaseId);
        if (isMounted) {
          if (executions && executions.length > 0) {
            setLatestExecution(executions[0]);
          } else {
            setLatestExecution(null);
          }
          setTimeout(() => setIsEditing(false), 0);
        }
      } catch (err) {
        console.error("수행 결과 로딩 실패:", err);
      }
    };
    void loadExecutions();
    
    return () => { isMounted = false; };
  }, [projectId, activeCaseId]);

  const activeCase = testCases.find(c => c.id === activeCaseId) || testCases[0];

  const handleStartEdit = () => {
    if (!activeCase) return;
    const initialDrafts: Record<string, StepResult> = {};
    activeCase.steps.forEach(step => {
      const existing = latestExecution?.step_results.find(r => r.step_key === step.step_key);
      initialDrafts[step.step_key] = existing || {
        step_key: step.step_key,
        status: "not_run",
        actual: "",
        notes: "",
        performed_at: null,
      };
    });
    setDraftResults(initialDrafts);
    setIsEditing(true);
  };

  const handleDraftChange = (stepKey: string, field: keyof StepResult, value: string) => {
    setDraftResults(prev => ({
      ...prev,
      [stepKey]: { ...prev[stepKey], [field]: value }
    }));
  };

  const handleSaveBatch = async () => {
    if (!projectId || !testSpec || !activeCase) return;
    setIsSaving(true);

    try {
      const stepResultsArray = Object.values(draftResults).map(res => {
        if (res.status === "passed" || res.status === "failed") {
          return {
            ...res,
            actual: res.actual || "결과 기록 없음",
            performed_at: res.performed_at || new Date().toISOString(),
          };
        }
        return res;
      });

      const payload = {
        base_specification_revision: testSpec.revision,
        client_save_id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
        changes: [
          {
            test_case_id: activeCase.id,
            base_test_case_revision: activeCase.revision,
            execution: latestExecution ? {
              operation: "update",
              execution_id: latestExecution.id,
              base_version: latestExecution.version,
              step_results: stepResultsArray
            } : {
              operation: "create",
              bind_to: "after_save",
              step_results: stepResultsArray,
              environment: "Default Environment"
            }
          }
        ]
      };

      await saveTestBatch(projectId, testSpec.id, payload);
      alert("수행 결과가 저장되었습니다.");
      setIsEditing(false);
      
      const executions = await fetchTestExecutions(projectId, activeCase.id);
      if (executions && executions.length > 0) setLatestExecution(executions[0]);
      
    } catch (error: unknown) {
      console.error(error);
      const msg = error instanceof Error ? error.message : "알 수 없는 오류";
      alert(`저장 중 오류가 발생했습니다: ${msg}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerateTestSpec = async () => {
    if (!projectId || !latestRun) return;
    setIsGenerating(true);

    try {
      const reqIds = latestRun.requirement_versions
        ? latestRun.requirement_versions.map((r) => r.requirement_id)
        : [];

      if (reqIds.length === 0) throw new Error("검증에 사용된 요구사항이 없습니다.");

      const res = await fetch(`${BASE_URL}/projects/${projectId}/test-specifications/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verification_run_id: latestRun.id, requirement_ids: reqIds }),
      });

      if (!res.ok) throw new Error("테스트 사양서 생성 요청 실패");

      const job = await res.json();

      if (job.status === "blocked" || job.status === "failed") {
        alert(`[테스트 생성 차단됨]\n사유: ${job.missing_features?.[0]?.message || "어댑터 미연결"}`);
      } else if (job.id) {
        const finalJob = await pollJobStatus(projectId, job.id) as { status: string; error?: { message: string } };
        if (["failed", "blocked", "cancelled"].includes(finalJob.status)) {
          alert(`[생성 실패] ${finalJob.error?.message || finalJob.status}`);
        } else {
          alert("테스트 사양서가 성공적으로 생성되었습니다.");
          await loadVerificationRunAndSpec(); 
        }
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "알 수 없는 오류";
      alert(`요청 중 오류: ${msg}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExportExcel = async () => {
    if (!projectId || !testSpec) return;
    setIsExporting(true);

    try {
      const exportRes = await fetch(`${BASE_URL}/projects/${projectId}/exports/test-specification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          test_specification_id: testSpec.id,
          revision: testSpec.revision,
          execution_selection: "latest_per_case",
          template_id: "thinktree-test-spec-v1",
          include_analysis_detail: false,
          format: "xlsx",
        }),
      });

      if (!exportRes.ok) throw new Error("엑셀 파일 출력 요청 실패");

      const exportJob = await exportRes.json();
      if (exportJob.id) {
        const finalJob = await pollJobStatus(projectId, exportJob.id) as { status: string; error?: { message: string }, result_ref?: { id: string } };
        if (["failed", "blocked", "cancelled"].includes(finalJob.status)) {
          alert(`[출력 실패] ${finalJob.error?.message || finalJob.status}`);
        } else if (finalJob.result_ref?.id) {
          window.open(`${BASE_URL}/projects/${projectId}/artifacts/${finalJob.result_ref.id}/download`, "_blank");
        }
      } else if (exportJob.result_ref?.id) {
        window.open(`${BASE_URL}/projects/${projectId}/artifacts/${exportJob.result_ref.id}/download`, "_blank");
      } else if (exportJob.error) {
        alert(`[출력 실패] ${exportJob.error.message}`);
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "알 수 없는 오류";
      alert(`오류: ${msg}`);
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) {
    return <div className="max-w-6xl mx-auto py-12 text-center text-xs text-slate-400">데이터를 불러오는 중입니다...</div>;
  }

  if (testSpec && testCases.length > 0) {
    return (
      <div className="max-w-6xl mx-auto py-2 px-2 md:px-4 space-y-4">
        <PageHeader
          stepTag="04 / TEST SPECIFICATION"
          title="QA 테스트 사양서 명세"
          description="검증된 요구사항을 바탕으로 자동 구성된 테스트 케이스와 검증 절차를 검토합니다."
          action={
            <div className="flex items-center space-x-2 flex-wrap">
              <Button variant="secondary" onClick={() => onNavigateStep("VERIFICATION")}>
                이전 화면으로
              </Button>
              <Button variant="primary" onClick={handleExportExcel} disabled={isExporting}>
                {isExporting ? "엑셀 생성 중..." : "엑셀(XLSX) 내보내기"}
              </Button>
            </div>
          }
        />

        <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
          <div className="md:col-span-4">
            <Card title="테스트 시나리오" className="h-full" extra={<span className="text-[11px] text-slate-400">총 {testCases.length}건</span>}>
              <div className="space-y-1.5 max-h-150 overflow-y-auto pr-1">
                {testCases.map((item) => {
                  const isSelected = activeCase?.id === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => !isEditing && setActiveCaseId(item.id)}
                      disabled={isEditing}
                      className={`w-full text-left p-3 rounded-xl border text-xs transition-colors space-y-1.5 ${
                        isSelected ? "border-blue-300 bg-blue-50/60 text-slate-900" : "border-slate-200 hover:bg-slate-50 text-slate-700"
                      } ${isEditing && !isSelected ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold font-mono text-blue-600">{item.test_no}</span>
                      </div>
                      <div className="font-semibold truncate">{item.title}</div>
                      <div className="text-[10px] text-slate-400">유형: {TYPE_LABEL[item.type] ?? item.type}</div>
                    </button>
                  );
                })}
              </div>
            </Card>
          </div>

          <div className="md:col-span-8">
            {activeCase ? (
              <Card 
                title={`[${activeCase.test_no}] 상세 절차`} 
                description={activeCase.title} 
                className="h-full"
                extra={
                  isEditing ? (
                    <div className="flex gap-2">
                      <Button variant="secondary" size="sm" onClick={() => setIsEditing(false)}>취소</Button>
                      <Button variant="primary" size="sm" onClick={handleSaveBatch} disabled={isSaving}>
                        {isSaving ? "저장 중..." : "결과 저장"}
                      </Button>
                    </div>
                  ) : (
                    <Button variant="outline" size="sm" onClick={handleStartEdit}>결과 기록 (편집)</Button>
                  )
                }
              >
                <div className="space-y-4 text-xs">
                  {activeCase.preconditions && (
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-slate-700">
                      <span className="font-bold block mb-1">사전 조건</span>
                      {activeCase.preconditions}
                    </div>
                  )}

                  {activeCase.prediction && (
                    <div className="p-3 bg-blue-50/50 rounded-lg border border-blue-100 text-blue-900/90">
                      <span className="font-bold block mb-1">AI 코드 예측 ({PREDICTION_LABEL[activeCase.prediction.status] ?? activeCase.prediction.status})</span>
                      {activeCase.prediction.reason}
                    </div>
                  )}

                  <div className="space-y-3">
                    <span className="font-bold text-slate-800 block">테스트 단계 ({activeCase.steps.length}개)</span>
                    {activeCase.steps.map((step) => {
                      const result = isEditing 
                        ? draftResults[step.step_key] 
                        : latestExecution?.step_results.find(r => r.step_key === step.step_key);
                      
                      const status = result?.status || "not_run";

                      return (
                        <div key={step.step_key} className="p-3 border border-slate-200 rounded-lg bg-white space-y-2 shadow-sm">
                          <div className="flex justify-between items-start">
                            <span className="font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">Step {step.order}</span>
                            {!isEditing && <StatusBadge status={STEP_STATUS_LABEL[status] ?? status} />}
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                            <div>
                              <span className="text-[10px] text-slate-400 block mb-0.5">수행 절차</span>
                              <div className="text-slate-700 leading-relaxed">{step.action}</div>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 block mb-0.5">기대 결과</span>
                              <div className="text-emerald-700 leading-relaxed">{step.expected}</div>
                            </div>
                          </div>
                          
                          {step.test_data.input && (
                            <div className="mt-2 text-[11px] font-mono bg-slate-50 p-2 rounded text-slate-600">
                              입력값: {step.test_data.input}
                            </div>
                          )}

                          {isEditing ? (
                            <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div>
                                <label className="text-[10px] text-slate-500 block mb-1">수행 상태</label>
                                <select 
                                  value={status} 
                                  onChange={(e) => handleDraftChange(step.step_key, "status", e.target.value)}
                                  className="w-full border border-slate-200 rounded p-1.5 text-xs"
                                >
                                  <option value="not_run">미실행</option>
                                  <option value="passed">통과 (Pass)</option>
                                  <option value="failed">실패 (Fail)</option>
                                  <option value="on_hold">보류 (Hold)</option>
                                </select>
                              </div>
                              <div>
                                <label className="text-[10px] text-slate-500 block mb-1">실제 결과 / 메모</label>
                                <Input 
                                  type="text" 
                                  value={result?.actual || result?.notes || ""} 
                                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleDraftChange(step.step_key, "actual", e.target.value)} 
                                  placeholder="결과 메모 입력"
                                />
                              </div>
                            </div>
                          ) : (
                            result && status !== "not_run" && (
                              <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                                <span className="font-semibold text-slate-600">실제 결과: </span>
                                {result.actual || result.notes || "기록 없음"}
                              </div>
                            )
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </Card>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-2 px-2 md:px-4 space-y-4">
      <PageHeader stepTag="04 / TEST SPECIFICATION" title="테스트 사양서 생성" description="코드 검증 결과를 바탕으로 테스트 케이스를 도출합니다." />
      <EmptyState
        title="사양서 기록 없음"
        description="아직 생성된 테스트 사양서가 없습니다. AI 자동 도출을 요청해 주세요."
        action={
          <div className="flex space-x-2">
            <Button variant="secondary" onClick={() => onNavigateStep("VERIFICATION")}>이전으로</Button>
            <Button variant="primary" onClick={handleGenerateTestSpec} disabled={isGenerating}>
              {isGenerating ? "AI 테스트 생성 요청 중..." : "AI 테스트 사양서 생성"}
            </Button>
          </div>
        }
      />
    </div>
  );
};