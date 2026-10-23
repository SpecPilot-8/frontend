import React, { useState, useEffect } from "react";
import { RequirementPanel } from "./RequirementPanel";
import { Button } from "../common";
import { useProject } from "../../contexts/ProjectContext";
import { isMockMode, BASE_URL } from "../../services/api";
import type { Requirement } from "../../types/verification";
import type { StepId } from "../../types";

interface VerificationDetailProps {
  requirementId: string;
  onBack: () => void;
  onNavigateStep: (step: StepId) => void;
}

interface EvidenceItem {
  id: string;
  file_path: string;
  start_line: number;
  end_line: number;
  role: string;
  explanation: string;
  code_snippet: string;
  suggested_code?: string;
}

interface CallFlowNode {
  id: string;
  label: string;
  evidence_ids?: string[];
}

interface ConditionVerdict {
  condition_id: string;
  status: string;
}

interface VerificationDetailData {
  status: string;
  reason: string;
  condition_verdicts?: ConditionVerdict[];
  call_flow?: {
    nodes?: CallFlowNode[];
  };
  evidence?: EvidenceItem[];
  counts?: {
    files: number;
    evidence_locations: number;
  };
}

export const VerificationDetail: React.FC<VerificationDetailProps> = ({
  requirementId,
  onBack,
  onNavigateStep,
}) => {
  const { projectId } = useProject();
  const [isLoading, setIsLoading] = useState(true);

  const [requirement, setRequirement] = useState<Requirement | null>(null);
  const [verificationData, setVerificationData] =
    useState<VerificationDetailData | null>(null);
  const [openEvidenceIds, setOpenEvidenceIds] = useState<Set<string>>(
    new Set(),
  );

  useEffect(() => {
    if (!projectId || isMockMode) return;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const reqRes = await fetch(
          `${BASE_URL}/projects/${projectId}/requirements/${requirementId}`,
        );
        if (reqRes.ok) {
          setRequirement(await reqRes.json());
        }

        const runsRes = await fetch(
          `${BASE_URL}/projects/${projectId}/verification-runs`,
        );
        if (runsRes.ok) {
          const runsData = await runsRes.json();
          if (runsData.items?.length > 0) {
            const latestRunId = runsData.items[0].id;
            const detailRes = await fetch(
              `${BASE_URL}/projects/${projectId}/verification-runs/${latestRunId}/requirements/${requirementId}`,
            );
            if (detailRes.ok) {
              const detailData: VerificationDetailData = await detailRes.json();
              setVerificationData(detailData);
              if (detailData.evidence && detailData.evidence.length > 0) {
                setOpenEvidenceIds(new Set([detailData.evidence[0].id]));
              }
            }
          }
        }
      } catch (error) {
        console.error("상세 데이터 호출 실패:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [projectId, requirementId]);

  const toggleEvidence = (id: string) => {
    const newSet = new Set(openEvidenceIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setOpenEvidenceIds(newSet);
  };

  if (isLoading && !isMockMode) {
    return (
      <div className="p-8 text-center text-slate-500">
        서버에서 상세 데이터를 불러오는 중입니다...
      </div>
    );
  }

  if (!requirement || !verificationData) {
    return (
      <div className="p-8 text-center text-slate-500">
        데이터를 찾을 수 없거나 분석 모델이 아직 연결되지 않았습니다.
        <div className="mt-4">
          <Button onClick={onBack} variant="outline" className="mr-2">
            목록으로 돌아가기
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-2 px-2 md:px-4 space-y-4">
      <div className="flex items-center justify-between bg-white px-6 py-4 rounded-xl border border-slate-200/80 shadow-sm mb-4">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="text-sm font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1.5 transition-colors"
          >
            <span>←</span> 검증 결과 목록
          </button>
          <div className="h-4 w-px bg-slate-200"></div>
          <h2 className="text-lg font-bold text-slate-900">
            {requirement.stable_key} · 검증 상세
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="md"
            onClick={() => onNavigateStep("TEST_SPEC")}
            className="bg-blue-600 text-white"
          >
            이 요구사항의 테스트
          </Button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6 items-start">
        <RequirementPanel requirement={requirement} verificationData={verificationData} />

        <div className="flex-1 bg-white rounded-xl border border-slate-200/80 shadow-sm p-6 w-full">
          <div className="flex justify-between items-end mb-6 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 mb-1.5">
                관련 호출 흐름 · 코드 근거
              </h3>
              <p className="text-[13px] text-slate-500">
                파일·줄 번호별로 펼쳐 확인하세요. 목록이 길면 아래로 스크롤할 수 있습니다.
              </p>
            </div>
            <div className="text-[12px] text-slate-400">
              {verificationData.counts?.files || 0}개 파일 · 근거{" "}
              {verificationData.counts?.evidence_locations || 0}곳
            </div>
          </div>

          {verificationData.call_flow?.nodes &&
            verificationData.call_flow.nodes.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 text-[13px] text-slate-600 mb-6 bg-slate-50 py-2.5 px-4 rounded-lg">
                {verificationData.call_flow.nodes.map(
                  (node: CallFlowNode, idx: number) => {
                    const nodesList = verificationData.call_flow?.nodes ?? [];
                    return (
                      <React.Fragment key={node.id}>
                        <span
                          className={
                            node.evidence_ids && node.evidence_ids.length > 0
                              ? "font-bold text-red-500"
                              : ""
                          }
                        >
                          {node.label}
                        </span>
                        {idx < nodesList.length - 1 && (
                          <span className="text-slate-300">→</span>
                        )}
                      </React.Fragment>
                    );
                  },
                )}
              </div>
            )}

          {(!verificationData.evidence ||
            verificationData.evidence.length === 0) && (
            <div className="p-8 text-center bg-slate-50 rounded-lg border border-slate-200 text-slate-500 text-sm">
              분석 범위 내에서 관련된 코드 근거를 찾지 못했습니다.
            </div>
          )}

          <div className="space-y-3">
            {verificationData.evidence?.map((ev: EvidenceItem) => {
              const isOpen = openEvidenceIds.has(ev.id);
              const isProblem = ev.role === "problem";

              return (
                <div
                  key={ev.id}
                  className={`border rounded-lg overflow-hidden transition-colors ${isOpen ? (isProblem ? "border-red-200" : "border-blue-200") : "border-slate-200"}`}
                >
                  <button
                    onClick={() => toggleEvidence(ev.id)}
                    className={`w-full px-4 py-3 flex justify-between items-center transition-colors ${isOpen ? (isProblem ? "bg-red-50" : "bg-blue-50") : "bg-white hover:bg-slate-50"}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-slate-800">
                        {ev.file_path} · L{ev.start_line}-{ev.end_line}
                      </span>
                      <span className="text-[11px] text-slate-500 truncate max-w-50">
                        {ev.explanation}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded ${isProblem ? "text-red-500 bg-red-100" : "text-slate-600 bg-slate-100"}`}
                      >
                        {isProblem ? "불일치" : "참조"}
                      </span>
                      <span
                        className={`text-slate-400 transform transition-transform ${isOpen ? "rotate-180" : ""}`}
                      >
                        ▼
                      </span>
                    </div>
                  </button>

                  {isOpen && (
                    <div
                      className={`p-5 bg-white border-t ${isProblem ? "border-red-100" : "border-blue-100"}`}
                    >
                      <p
                        className={`text-[13px] font-bold mb-2 ${isProblem ? "text-red-500" : "text-blue-500"}`}
                      >
                        코드 스니펫
                      </p>
                      <div
                        className={`${isProblem ? "bg-red-50/50 border-red-100" : "bg-slate-50 border-slate-200"} rounded-md p-4 mb-4 border overflow-x-auto font-mono text-[13px] leading-relaxed text-slate-800`}
                      >
                        <pre>
                          <code>{ev.code_snippet}</code>
                        </pre>
                      </div>

                      <p className="text-[13px] text-slate-600 mb-4 whitespace-pre-wrap">
                        {ev.explanation}
                      </p>

                      {ev.suggested_code && (
                        <>
                          <p className="text-[13px] text-blue-600 font-bold mb-2">
                            수정 제안
                          </p>
                          <div className="bg-slate-900 rounded-md p-4 overflow-x-auto font-mono text-[13px] leading-relaxed text-slate-300">
                            <pre>
                              <code>{ev.suggested_code}</code>
                            </pre>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};