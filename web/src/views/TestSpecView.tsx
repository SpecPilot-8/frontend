import React, { useState, useEffect } from "react";
import type { TestSpecificationGroup, TestCaseItem, StepId } from "../types";
import { useProject } from "../contexts/ProjectContext";
import {
  Button,
  Card,
  StatusBadge,
  EmptyState,
  PageHeader,
} from "../components/common";
import { pollJobStatus, BASE_URL } from "../services/api";

interface TestSpecViewProps {
  onNavigateStep: (step: StepId) => void;
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

const mockTestSpecGroup: TestSpecificationGroup = {
  requirementId: "REQ-NOTICE-002",
  requirementCode: "NOTICE-002",
  groupTitle: "공지사항 작성 및 첨부파일 검증",
  totalTests: 3,
  precondition: "관리자 권한 계정 로그인 및 첨부파일 저장소 가용 용량 확보",
  testCases: [
    {
      id: "TC-NOTICE-002-01",
      testCode: "TC-NOTICE-002-01",
      title: "정상 첨부파일(50MB 이하) 등록 및 공지 게시",
      status: "PASSED" as const,
      actualStatus: "PASSED" as const,
      testType: "FUNCTIONAL",
      priority: "HIGH",
      procedure:
        "1. 제목/본문 입력 -> 2. 30MB PDF 파일 첨부 -> 3. 저장 버튼 클릭",
      inputValue: 'title="시스템 점검 안내", file="guide.pdf (30MB)"',
      expected:
        "201 Created 응답 반환 및 상세 페이지로 이동, 파일 다운로드 정상 동작",
      codeBasedPrediction: "NoticeService.java:34 메서드 검증 통과 예상",
    },
    {
      id: "TC-NOTICE-002-02",
      testCode: "TC-NOTICE-002-02",
      title: "용량 제한 초과 파일(50MB 초과) 업로드 시 서버 제한 검증",
      status: "FAILED" as const,
      actualStatus: "FAILED" as const,
      testType: "EDGE_CASE",
      priority: "HIGH",
      procedure: "1. 제목/본문 입력 -> 2. 200MB 동영상 첨부 -> 3. 전송 시도",
      inputValue: 'file="video_manual.mp4 (200MB)"',
      expected: "명세상 300MB까지 허용되어 200MB 정상 업로드 기대",
      codeBasedPrediction:
        "서버 multipart max-file-size 50MB 제한으로 413 Payload Too Large 발생 예측",
    },
    {
      id: "TC-NOTICE-002-03",
      testCode: "TC-NOTICE-002-03",
      title: "필수 입력 항목(제목) 누락 유효성 검사",
      status: "PASSED" as const,
      actualStatus: "PASSED" as const,
      testType: "VALIDATION",
      priority: "MEDIUM",
      procedure: "1. 제목 공란 유지 -> 2. 본문만 입력 -> 3. 저장 버튼 클릭",
      inputValue: 'title="", content="내용 테스트"',
      expected: '전송 차단 및 "제목을 입력해주세요" 유효성 에러 메시지 노출',
      codeBasedPrediction:
        "NoticeRequestDto @NotBlank(title) 유효성 검사 로직 통과",
    },
  ],
};

export const TestSpecView: React.FC<TestSpecViewProps> = ({
  onNavigateStep,
}) => {
  const { projectId } = useProject();

  const [isLoading, setIsLoading] = useState(true);
  const [latestRun, setLatestRun] = useState<VerificationRun | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const [specGroup, setSpecGroup] = useState<TestSpecificationGroup | null>(
    null,
  );
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null);
  const [isUsingMock, setIsUsingMock] = useState<boolean>(false);

  useEffect(() => {
    if (!projectId) return;

    const loadVerificationRun = async () => {
      try {
        const runsRes = await fetch(
          `${BASE_URL}/projects/${projectId}/verification-runs`,
        );
        if (!runsRes.ok) {
          throw new Error("검증 실행 목록을 조회할 수 없습니다.");
        }
        const runsData = await runsRes.json();

        if (runsData.items && runsData.items.length > 0) {
          const runId = runsData.items[0].id;
          const detailRes = await fetch(
            `${BASE_URL}/projects/${projectId}/verification-runs/${runId}`,
          );
          if (!detailRes.ok) {
            throw new Error("검증 상세 정보를 조회할 수 없습니다.");
          }
          const detailData = await detailRes.json();
          setLatestRun(detailData);
        }
      } catch (error) {
        console.error("검증 실행 정보 로딩 실패:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadVerificationRun();
  }, [projectId]);

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
        // 비동기 202 응답 처리 (폴링 대기)
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
    if (!projectId) return;
    setIsExporting(true);

    try {
      const specRes = await fetch(
        `${BASE_URL}/projects/${projectId}/test-specifications`,
      );
      if (!specRes.ok) {
        throw new Error("테스트 사양서 목록 조회에 실패했습니다.");
      }
      const specData = await specRes.json();

      if (!specData.items || specData.items.length === 0) {
        alert(
          "출력할 테스트 사양서가 아직 존재하지 않습니다. (생성 작업 필요)",
        );
        setIsExporting(false);
        return;
      }

      const targetSpec = specData.items[0];

      const exportRes = await fetch(
        `${BASE_URL}/projects/${projectId}/exports/test-specification`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            test_specification_id: targetSpec.id,
            revision: targetSpec.revision || 1,
            execution_selection: "latest_per_case",
            template_id: "thinktree-test-spec-v1",
            include_analysis_detail: false,
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

      const exportJob = await exportRes.json();

      // 엑셀 생성 역시 백그라운드 작업일 수 있으므로 폴링 처리
      if (exportJob.id) {
        const finalJob = (await pollJobStatus(
          projectId,
          exportJob.id,
          (jobInfo: { progress?: { stage: string } }) => {
            if (jobInfo.progress) {
              console.log(`엑셀 파일 생성 중... ${jobInfo.progress.stage}`);
            }
          },
        )) as {
          status: string;
          error?: { message: string };
          result_ref?: { id: string };
        };

        if (["failed", "blocked", "cancelled"].includes(finalJob.status)) {
          alert(`[출력 실패] ${finalJob.error?.message || finalJob.status}`);
        } else if (finalJob.result_ref && finalJob.result_ref.id) {
          const artifactId = finalJob.result_ref.id;
          window.open(
            `${BASE_URL}/projects/${projectId}/artifacts/${artifactId}/download`,
            "_blank",
          );
        } else {
          alert("엑셀 파일이 생성되었지만 다운로드 링크를 찾을 수 없습니다.");
        }
      } else if (exportJob.result_ref && exportJob.result_ref.id) {
        // 이미 생성 완료된 결과가 즉시 반환된 경우
        const artifactId = exportJob.result_ref.id;
        window.open(
          `${BASE_URL}/projects/${projectId}/artifacts/${artifactId}/download`,
          "_blank",
        );
      } else if (exportJob.error) {
        alert(
          `[출력 실패] ${exportJob.error.message || "출력할 데이터가 없습니다."}`,
        );
      }
    } catch (error: unknown) {
      console.error(error);
      const msg = error instanceof Error ? error.message : "알 수 없는 오류";
      alert(`엑셀 파일 내보내기 중 통신 오류가 발생했습니다: ${msg}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleToggleMock = () => {
    if (!isUsingMock) {
      setSpecGroup(mockTestSpecGroup);
      if (mockTestSpecGroup.testCases.length > 0) {
        setActiveCaseId(mockTestSpecGroup.testCases[0].id);
      }
      setIsUsingMock(true);
    } else {
      setSpecGroup(null);
      setActiveCaseId(null);
      setIsUsingMock(false);
    }
  };

  const activeCase: TestCaseItem | undefined =
    specGroup?.testCases.find(
      (item: TestCaseItem) => item.id === activeCaseId,
    ) || specGroup?.testCases[0];

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto py-12 text-center text-xs text-slate-400">
        검증 데이터를 불러오는 중입니다...
      </div>
    );
  }

  if (isUsingMock && specGroup) {
    return (
      <div className="max-w-6xl mx-auto py-2 px-2 md:px-4 space-y-4">
        <PageHeader
          stepTag="04 / TEST SPECIFICATION"
          title="QA 테스트 사양서 명세"
          description="검증된 요구사항을 바탕으로 자동 구성된 테스트 케이스와 검증 절차를 검토합니다."
          action={
            <div className="flex items-center space-x-2 flex-wrap">
              <Button
                variant="ghost"
                onClick={handleToggleMock}
                className="text-blue-600 bg-blue-50"
              >
                실제 API 모드로 복귀
              </Button>
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
                {isExporting
                  ? "사양서 엑셀 생성 중..."
                  : "사양서 엑셀(XLSX) 내보내기"}
              </Button>
            </div>
          }
        />

        <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
          <div className="md:col-span-5">
            <Card
              title="테스트 케이스 목록"
              description={`요구사항 [${specGroup.requirementCode || specGroup.requirementId}]에 연결된 케이스`}
              className="h-full"
              extra={
                <span className="text-[11px] text-slate-400">
                  총 {specGroup.totalTests || specGroup.testCases.length}건
                </span>
              }
            >
              <div className="space-y-1.5 pr-1 max-h-150 overflow-y-auto">
                {specGroup.testCases.map((item: TestCaseItem) => {
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
                      <div className="flex items-center justify-between">
                        <span className="font-bold font-mono text-blue-600">
                          {item.testCode}
                        </span>
                        <StatusBadge status={item.status as string} />
                      </div>
                      <div className="font-semibold truncate">{item.title}</div>
                      <div className="flex items-center space-x-2 text-[10px] text-slate-400">
                        <span>유형: {item.testType}</span>
                        <span>·</span>
                        <span>우선순위: {item.priority}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </Card>
          </div>

          <div className="md:col-span-7">
            {activeCase ? (
              <Card
                title={`[${activeCase.testCode}] 상세 절차`}
                description={activeCase.title}
                className="h-full"
                extra={<StatusBadge status={activeCase.status as string} />}
              >
                <div className="space-y-4 text-xs">
                  {specGroup.precondition && (
                    <div className="p-3.5 bg-slate-50/70 rounded-xl border border-slate-200/60">
                      <span className="font-bold text-slate-800 block mb-1">
                        사전 조건 (Precondition)
                      </span>
                      <p className="text-slate-600 leading-relaxed">
                        {specGroup.precondition}
                      </p>
                    </div>
                  )}

                  <div className="p-3.5 bg-white rounded-xl border border-slate-200/80 space-y-1.5 shadow-sm">
                    <span className="font-bold text-slate-800 block">
                      수행 절차 (Procedure)
                    </span>
                    <p className="text-slate-600 leading-relaxed whitespace-pre-line">
                      {activeCase.procedure}
                    </p>
                  </div>

                  <div className="p-3.5 bg-white rounded-xl border border-slate-200/80 space-y-1.5 shadow-sm">
                    <span className="font-bold text-slate-800 block">
                      입력값 / 테스트 파라미터 (Input Value)
                    </span>
                    <div className="font-mono text-[11px] text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-100 break-all">
                      {activeCase.inputValue}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3.5 bg-emerald-50/50 rounded-xl border border-emerald-100 space-y-1.5">
                      <span className="font-bold text-emerald-800 block">
                        명세 기준 기대 결과 (Expected)
                      </span>
                      <p className="text-emerald-900/90 leading-relaxed text-[11px]">
                        {activeCase.expected}
                      </p>
                    </div>

                    <div className="p-3.5 bg-blue-50/50 rounded-xl border border-blue-100 space-y-1.5">
                      <span className="font-bold text-blue-800 block">
                        코드 분석 기반 예측 (Prediction)
                      </span>
                      <p className="text-blue-900/90 leading-relaxed text-[11px]">
                        {activeCase.codeBasedPrediction}
                      </p>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-slate-400 text-[11px]">
                    <span>연결 요구사항 ID: {specGroup.requirementId}</span>
                    <span>
                      판정: {activeCase.actualStatus || activeCase.status}
                    </span>
                  </div>
                </div>
              </Card>
            ) : null}
          </div>
        </div>
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
            <div className="flex items-center space-x-2">
              <Button
                variant="primary"
                onClick={() => onNavigateStep("VERIFICATION")}
              >
                검증 화면으로 돌아가기
              </Button>
              <Button
                variant="ghost"
                onClick={handleToggleMock}
                className="text-blue-600 bg-blue-50"
              >
                목업 데이터 확인
              </Button>
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-2 px-2 md:px-4 space-y-4">
      <PageHeader
        stepTag="04 / TEST SPECIFICATION"
        title="QA 테스트 사양서 명세"
        description="검증된 요구사항을 바탕으로 자동 구성된 테스트 케이스와 검증 절차를 검토합니다."
        action={
          <Button
            variant="primary"
            onClick={handleExportExcel}
            disabled={isExporting}
          >
            {isExporting
              ? "사양서 엑셀 생성 중..."
              : "사양서 엑셀(XLSX) 내보내기"}
          </Button>
        }
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
            <span className="font-semibold text-slate-900">
              포함된 요구사항:
            </span>{" "}
            {latestRun.requirement_versions?.length || 0}개
          </p>
        </div>

        <div className="pt-2 flex items-center justify-between border-t border-slate-100">
          <div className="flex items-center space-x-2">
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

          <Button
            variant="ghost"
            onClick={handleToggleMock}
            className="text-blue-600 bg-blue-50"
          >
            목업 결과 화면 확인
          </Button>
        </div>
      </Card>
    </div>
  );
};
