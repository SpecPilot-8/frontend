import React, { useState, useEffect } from "react";
import { RequirementPanel } from "./RequirementPanel";
import { Button } from "../common";
import { useProject } from "../../contexts/ProjectContext";
import { api, errorMessage } from "../../services/api";
import type { Requirement } from "../../types/verification";
import type { StepId } from "../../types";

interface VerificationDetailProps {
  requirementId: string;
  requirementRevision: number;
  runId: string;
  onSelectForTest?: () => void;
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
    edges?: { from: string; to: string }[];
    unresolved?: string[];
  };
  evidence?: EvidenceItem[];
  counts?: {
    files: number;
    evidence_locations: number;
  };
}

export const VerificationDetail: React.FC<VerificationDetailProps> = ({
  requirementId,
  requirementRevision, runId, onSelectForTest,
  onBack,
  onNavigateStep,
}) => {
  const { projectId } = useProject();
  const [error,setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const [requirement, setRequirement] = useState<Requirement | null>(null);
  const [verificationData, setVerificationData] =
    useState<VerificationDetailData | null>(null);
  const [openEvidenceIds, setOpenEvidenceIds] = useState<Set<string>>(
    new Set(),
  );

  useEffect(() => {
    if (!projectId) return;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [req, detailData] = await Promise.all([
          api<Requirement>(`/projects/${projectId}/requirements/${requirementId}?revision=${requirementRevision}`),
          api<VerificationDetailData>(`/projects/${projectId}/verification-runs/${runId}/requirements/${requirementId}`),
        ]);
        setRequirement(req); setVerificationData(detailData);
        const first = detailData.evidence?.find(e => e.role === 'problem') || detailData.evidence?.[0];
        setOpenEvidenceIds(new Set(first ? [first.id] : []));
      } catch (error) {
        setError(errorMessage(error));
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [projectId, requirementId, requirementRevision, runId]);

  const toggleEvidence = (id: string) => {
    const newSet = new Set(openEvidenceIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setOpenEvidenceIds(newSet);
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center text-slate-500">
        서버에서 상세 데이터를 불러오는 중입니다...
      </div>
    );
  }

  if (!requirement || !verificationData) {
    return (
      <div className="p-8 text-center text-slate-500">
        {error || "데이터를 불러올 수 없습니다."}
        <div className="mt-4">
          <Button onClick={onBack} variant="outline" className="mr-2">
            목록으로 돌아가기
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 max-w-6xl mx-auto py-2 px-2 md:px-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white px-6 py-4 rounded-xl border border-slate-200/80 shadow-sm mb-4">
        <div className="flex min-w-0 flex-wrap items-center gap-4">
          <button
            onClick={onBack}
            className="text-sm font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1.5 transition-colors"
          >
            <span>←</span> 검증 결과 목록
          </button>
          <div className="h-4 w-px bg-slate-200"></div>
          <h2 className="min-w-0 text-lg font-bold text-slate-900 [overflow-wrap:anywhere]">
            {requirement.stable_key} · 검증 상세
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="md"
            onClick={() => onSelectForTest ? onSelectForTest() : onNavigateStep("TEST_SPEC")}
            className="bg-blue-600 text-white"
          >
            이 요구사항의 테스트
          </Button>
        </div>
      </div>

      <div className="flex flex-col xl:flex-row gap-6 items-start min-w-0">
        <RequirementPanel projectId={projectId || ""} requirement={requirement} verificationData={verificationData} onReview={() => onNavigateStep("ANALYSIS")} />

        <div className="flex-1 min-w-0 bg-white rounded-xl border border-slate-200/80 shadow-sm p-6 w-full">
          <div className="flex flex-wrap justify-between items-end gap-3 mb-6 border-b border-slate-100 pb-4">
            <div className="min-w-0">
              <h3 className="text-base font-bold text-slate-900 mb-1.5">
                정적 참조 흐름 · 코드 근거
              </h3>
              <p className="text-[13px] text-slate-500">
                파일·줄 번호별로 펼쳐 확인하세요. 목록이 길면 아래로 스크롤할 수 있습니다.
              </p>
            </div>
            <div className="shrink-0 text-[12px] text-slate-400 whitespace-nowrap">
              {verificationData.counts?.files || 0}개 파일 · 근거{" "}
              {verificationData.counts?.evidence_locations || 0}곳
            </div>
          </div>

          {verificationData.call_flow?.nodes &&
            verificationData.call_flow.nodes.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 text-[13px] text-slate-600 mb-6 bg-slate-50 py-2.5 px-4 rounded-lg">
                {verificationData.call_flow.nodes.map(
                  (node: CallFlowNode) => {
                    return (
                      <React.Fragment key={node.id}>
                        <button
                          onClick={() => { setOpenEvidenceIds(new Set(node.evidence_ids || [])); setTimeout(() => document.getElementById(`evidence-${node.evidence_ids?.[0]}`)?.scrollIntoView({block:"nearest"}), 0); }}
                          className={"min-w-0 text-left [overflow-wrap:anywhere] " + (
                            node.evidence_ids?.some(id => verificationData.evidence?.some(ev => ev.id === id && ev.role === 'problem'))
                              ? "font-bold text-red-500"
                              : ""
                          )}
                        >
                          {node.label}
                        </button>

                      </React.Fragment>
                    );
                  },
                )}
              </div>
            )}

          {verificationData.call_flow?.edges?.length ? <div className="text-xs text-slate-500 mb-3 space-y-1 [overflow-wrap:anywhere]">{verificationData.call_flow.edges.map((edge, index) => <p key={index}>{verificationData.call_flow?.nodes?.find(n => n.id === edge.from)?.label} → {verificationData.call_flow?.nodes?.find(n => n.id === edge.to)?.label}</p>)}</div> : null}
          {verificationData.call_flow?.unresolved?.map((warning, index) => <p className="text-xs text-amber-700 mb-3 [overflow-wrap:anywhere]" key={index}>{warning}</p>)}

          {(!verificationData.evidence ||
            verificationData.evidence.length === 0) && (
            <div className="p-8 text-center bg-slate-50 rounded-lg border border-slate-200 text-slate-500 text-sm">
              {verificationData.reason || "코드 근거가 없습니다."}
            </div>
          )}

          <div className="space-y-3">
            {verificationData.evidence?.map((ev: EvidenceItem) => {
              const isOpen = openEvidenceIds.has(ev.id);
              const isProblem = ev.role === "problem";

              return (
                <div
                  key={ev.id}
                  id={`evidence-${ev.id}`}
                  className={`border rounded-lg overflow-hidden transition-colors ${isOpen ? (isProblem ? "border-red-200" : "border-blue-200") : "border-slate-200"}`}
                >
                  <button
                    type="button"
                    onClick={() => toggleEvidence(ev.id)}
                    aria-expanded={isOpen}
                    aria-controls={`evidence-content-${ev.id}`}
                    className={`w-full min-w-0 px-4 py-3 flex justify-between items-start gap-3 text-left transition-colors ${isOpen ? (isProblem ? "bg-red-50" : "bg-blue-50") : "bg-white hover:bg-slate-50"}`}
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <span className="block text-sm font-bold text-slate-800 [overflow-wrap:anywhere]">
                        {ev.file_path.split('/').pop()}
                        <span className="ml-2 inline-block whitespace-nowrap text-xs font-medium text-slate-500">L{ev.start_line}–{ev.end_line}</span>
                      </span>
                      <span className="block text-[11px] text-slate-500 [overflow-wrap:anywhere]">
                        {ev.file_path}
                      </span>
                      <span className="block truncate text-xs text-slate-500" title={ev.explanation}>
                        {ev.explanation}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 pt-0.5">
                      <span
                        className={`shrink-0 whitespace-nowrap text-xs font-bold px-2 py-0.5 rounded ${isProblem ? "text-red-500 bg-red-100" : "text-slate-600 bg-slate-100"}`}
                      >
                        {isProblem ? "불일치" : "참조"}
                      </span>
                      <span
                        aria-hidden="true"
                        className={`text-slate-400 transform transition-transform ${isOpen ? "rotate-180" : ""}`}
                      >
                        ▼
                      </span>
                    </div>
                  </button>

                  {isOpen && (
                    <div
                      id={`evidence-content-${ev.id}`}
                      className={`min-w-0 p-4 bg-white border-t ${isProblem ? "border-red-100" : "border-blue-100"}`}
                    >
                      <p
                        className={`text-[13px] font-bold mb-2 ${isProblem ? "text-red-500" : "text-blue-500"}`}
                      >
                        코드 스니펫
                      </p>
                      <div
                        tabIndex={0}
                        aria-label={`${ev.file_path} 코드 스니펫`}
                        className={`${isProblem ? "bg-red-50/50 border-red-100" : "bg-slate-50 border-slate-200"} max-w-full rounded-md p-4 mb-4 border overflow-x-auto font-mono text-[13px] leading-relaxed text-slate-800`}
                      >
                        <pre>
                          <code>{ev.code_snippet}</code>
                        </pre>
                      </div>

                      <p className="text-[13px] text-slate-600 mb-4 whitespace-pre-wrap [overflow-wrap:anywhere]">
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
