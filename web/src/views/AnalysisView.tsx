import React, { useState, useMemo, useEffect, useCallback } from "react";
import type { StepId, RequirementItem, Condition } from "../types";
import { fetchRequirements, pollJobStatus, BASE_URL } from "../services/api";
import { useProject } from "../contexts/ProjectContext";
import {
  Button,
  Card,
  Input,
  StatusBadge,
  PageHeader,
} from "../components/common";
import { VIEW_HEADER } from "../styles/typography";

interface AnalysisViewProps {
  onNavigateStep: (step: StepId) => void;
  specDocumentName?: string;
  specVersion?: string;
}

export const AnalysisView: React.FC<AnalysisViewProps> = ({
  onNavigateStep,
  specDocumentName = "등록된 기획서 없음",
  specVersion = "v0.2",
}) => {
  const { projectId } = useProject();

  const [requirements, setRequirements] = useState<RequirementItem[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const [pollingMessage, setPollingMessage] = useState<string>("");

  const [viewMode, setViewMode] = useState<"VIEW" | "ADD" | "EDIT">("ADD");

  const [formReqId, setFormReqId] = useState("");
  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formLocation, setFormLocation] = useState("");
  const [formActor, setFormActor] = useState("관리자");
  const [formCondition, setFormCondition] = useState("");
  const [formAction, setFormAction] = useState("");
  const [formExpected, setFormExpected] = useState("");

  const loadData = useCallback(
    async (preserveId?: string) => {
      if (!projectId) return;
      setIsLoading(true);
      setPollingMessage("");
      try {
        const data = await fetchRequirements(projectId);
        setRequirements(data);
        if (data.length > 0) {
          setRequirements((currentReqs) => {
            const targetId = typeof preserveId === "string" ? preserveId : selectedId;
            const exists = currentReqs.find((r) => r.id === targetId);

            if (exists) {
              setSelectedId(exists.id);
            } else {
              const defaultItem = currentReqs[0];
              setSelectedId(defaultItem.id);
            }
            return currentReqs;
          });
          setViewMode("VIEW");
        } else {
          setViewMode("ADD");
        }
      } catch (error) {
        console.error("데이터 로딩 중 에러:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [projectId, selectedId],
  );

  useEffect(() => {
    let isMounted = true;
    if (projectId) {
      fetchRequirements(projectId)
        .then((data) => {
          if (!isMounted) return;
          setRequirements(data);
          if (data.length > 0) {
            const defaultItem = data[0];
            setSelectedId(defaultItem.id);
            setViewMode("VIEW");
          } else {
            setViewMode("ADD");
          }
        })
        .catch((err) => {
          if (isMounted) console.error("데이터 초기 로딩 에러:", err);
        });
    }
    return () => {
      isMounted = false;
    };
  }, [projectId]);

  const handleRefreshData = () => loadData();

  const handleStartAIAnalysis = async () => {
    if (!projectId) return;

    setIsLoading(true);
    setPollingMessage("백엔드에 분석을 요청하는 중입니다...");

    try {
      const docRes = await fetch(`${BASE_URL}/projects/${projectId}/documents`);
      if (!docRes.ok) throw new Error("문서 목록 조회 실패");
      const docData = await docRes.json();
      if (!docData.items || docData.items.length === 0) {
        alert("백엔드에 등록된 기획서 문서가 없습니다. 프로젝트 설정에서 파일을 먼저 업로드하세요.");
        setIsLoading(false);
        setPollingMessage("");
        return;
      }

      const docId = docData.items[0].id;
      const docRev = docData.items[0].revision || 1;

      setPollingMessage("문서 구조를 파싱하고 있습니다...");
      const parseRes = await fetch(
        `${BASE_URL}/projects/${projectId}/documents/${docId}/parse`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ document_revision: docRev }),
        }
      );
      if (!parseRes.ok) throw new Error("문서 파싱 요청 실패");

      const parseJobInit = await parseRes.json();
      if (parseJobInit.id) {
        const finalParseJob = (await pollJobStatus(
          projectId,
          parseJobInit.id,
          (jobInfo: { progress?: { stage: string; completed: number; total: number } }) => {
            if (jobInfo.progress) {
              setPollingMessage(`문서 구조 파싱 중... (${jobInfo.progress.completed}/${jobInfo.progress.total})`);
            }
          }
        )) as { status: string; error?: { message: string } };

        if (["failed", "blocked", "cancelled"].includes(finalParseJob.status)) {
          alert(`[파싱 실패]\n상태: ${finalParseJob.status}\n서버에서 문서 파싱을 완료하지 못했습니다.`);
          setIsLoading(false);
          setPollingMessage("");
          return;
        }
      }

      setPollingMessage("AI 모델에 요구사항 추출을 요청했습니다...");
      const extRes = await fetch(
        `${BASE_URL}/projects/${projectId}/documents/${docId}/requirements/extract`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            document_revision: docRev,
            model_config_version: 0,
            accept_warnings: true,
          }),
        }
      );

      if (!extRes.ok) throw new Error("요구사항 추출 요청 실패");
      const extJob = await extRes.json();

      if (extJob.status === "blocked" || extJob.status === "failed") {
        alert(`[백엔드 분석 차단됨]\n사유: ${extJob.missing_features?.[0]?.message || "AI 모델 어댑터 미연결"}\n\n자동 분석이 불가능하므로 좌측 폼에서 요구사항을 수동으로 입력해 주세요.`);
        setIsLoading(false);
        setPollingMessage("");
        return;
      }

      if (extJob.id) {
        setPollingMessage("AI가 기획서의 의미를 추출하고 있습니다. 잠시만 기다려주세요...");

        const finalExtJob = (await pollJobStatus(
          projectId,
          extJob.id,
          (jobInfo: { progress?: { stage: string; completed: number; total: number } }) => {
            if (jobInfo.progress && jobInfo.progress.stage === "extracting") {
              setPollingMessage(`의미 추출 진행 중... (${jobInfo.progress.completed}/${jobInfo.progress.total})`);
            }
          }
        )) as { status: string; error?: { message: string } };

        if (["failed", "blocked", "cancelled"].includes(finalExtJob.status)) {
          alert(`[분석 실패]\n사유: ${finalExtJob.error?.message || finalExtJob.status}`);
          setIsLoading(false);
          setPollingMessage("");
          return;
        }

        setPollingMessage("분석이 완료되었습니다. 데이터를 불러옵니다...");
        await loadData();
      }
    } catch (error: unknown) {
      console.error(error);
      const msg = error instanceof Error ? error.message : "알 수 없는 오류";
      alert(`AI 분석 요청 중 통신 오류가 발생했습니다: ${msg}`);
      setIsLoading(false);
      setPollingMessage("");
    }
  };

  const filteredRequirements = useMemo(() => {
    if (!searchQuery.trim()) return requirements;
    const query = searchQuery.toLowerCase();
    return requirements.filter(
      (r) =>
        r.stable_key.toLowerCase().includes(query) ||
        r.title.toLowerCase().includes(query),
    );
  }, [requirements, searchQuery]);

  const selectedReq = requirements.find((r) => r.id === selectedId) || filteredRequirements[0];
  const completedCount = requirements.filter((r) => r.review_status === "approved").length;

  const handleStartEdit = () => {
    if (!selectedReq) return;
    setFormReqId(selectedReq.stable_key);
    setFormTitle(selectedReq.title);
    setFormDesc(selectedReq.original_text || "");
    setFormLocation("");
    setFormActor("");
    setFormCondition(selectedReq.condition || "");
    setFormAction(selectedReq.action || "");
    setFormExpected(selectedReq.expected || "");
    setViewMode("EDIT");
  };

  const handleStartAdd = () => {
    setFormReqId(`REQ-${requirements.length + 1}`);
    setFormTitle("");
    setFormDesc("");
    setFormLocation("");
    setFormActor("");
    setFormCondition("");
    setFormAction("");
    setFormExpected("");
    setViewMode("ADD");
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!projectId) {
      alert("선택된 프로젝트가 없습니다. 브라우저를 새로고침하셨다면, 좌측 메뉴에서 프로젝트를 다시 선택한 뒤 진입해 주세요.");
      return;
    }
    
    // 빈 값 방어를 위한 명시적 프론트엔드 검증 강화
    if (!formTitle.trim()) {
      alert("기능 이름을 필수로 입력해 주세요.");
      return;
    }
    setIsLoading(true);

    try {
      const docRes = await fetch(`${BASE_URL}/projects/${projectId}/documents`);
      if (!docRes.ok) throw new Error("문서 조회 실패");
      const docData = await docRes.json();
      const docId = docData.items?.[0]?.id;
      const docRev = docData.items?.[0]?.revision || 1;

      if (viewMode === "EDIT" && selectedReq) {
        const reqRevision = (selectedReq as RequirementItem & { revision?: number }).revision || 1;
        const patchRes = await fetch(
          `${BASE_URL}/projects/${projectId}/requirements/${selectedReq.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              base_revision: reqRevision,
              title: formTitle,
              condition: formCondition,
              action: formAction,
              expected: formExpected,
            }),
          }
        );

        if (!patchRes.ok) {
          const errData = await patchRes.json().catch(() => ({}));
          throw new Error(errData.error?.message || "수정 요청이 거절되었습니다.");
        }

        await loadData(selectedReq.id);
      } else {
        if (!docId) throw new Error("업로드된 기획서가 없습니다.");

        const postRes = await fetch(
          `${BASE_URL}/projects/${projectId}/requirements`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              document_id: docId,
              document_revision: docRev,
              title: formTitle,
              original_text: formDesc,
              condition: formCondition,
              action: formAction,
              expected: formExpected,
              req_type: "functional",
              origin: "manual",
              author_reason: "수동 추가",
              conditions: [
                {
                  stable_key: formReqId.trim() || `REQ-${Date.now()}`,
                  text: formExpected || formTitle,
                  category: "business_logic",
                  target: "unknown",
                  verifiable: "code",
                  source_refs: [],
                },
              ],
            }),
          }
        );

        if (!postRes.ok) {
          const errData = await postRes.json().catch(() => ({}));
          throw new Error(errData.error?.message || "등록 요청이 거절되었습니다.");
        }

        const newData = await postRes.json();
        await loadData(newData.id);
      }
    } catch (error: unknown) {
      console.error(error);
      const msg = error instanceof Error ? error.message : "알 수 없는 오류";
      alert(`요구사항 저장 중 오류가 발생했습니다.\n${msg}`);
      setIsLoading(false);
    }
  };

  const handleApproveRequirement = async () => {
    if (!selectedReq || !projectId) return;
    setIsLoading(true);

    try {
      const reqRevision = (selectedReq as RequirementItem & { revision?: number }).revision || 1;
      const response = await fetch(
        `${BASE_URL}/projects/${projectId}/requirements/${selectedReq.id}/review`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            base_revision: reqRevision,
            status: "approved",
          }),
        }
      );

      if (!response.ok) throw new Error("검토 확정에 실패했습니다.");
      await loadData(selectedReq.id);
    } catch (error) {
      console.error(error);
      alert("요구사항 확정 처리 중 오류가 발생했습니다.");
      setIsLoading(false);
    }
  };

  const handleGoToVerification = () => {
    const hasApproved = requirements.some((req) => req.review_status === "approved");
    if (!hasApproved) {
      alert("검토가 완료(확정)된 요구사항이 최소 1개 이상 필요합니다.\n\n먼저 '검토 확정' 버튼을 눌러 승인해 주세요.");
      return;
    }
    onNavigateStep("VERIFICATION");
  };

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto py-12 flex flex-col items-center justify-center space-y-4">
        {pollingMessage && (
          <div className="flex items-center space-x-3 text-blue-600 font-semibold bg-blue-50/50 px-4 py-2 rounded-xl animate-pulse">
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>{pollingMessage}</span>
          </div>
        )}
        <div className="text-xs text-slate-400">요구사항 데이터를 불러오고 있습니다...</div>
      </div>
    );
  }

  if (viewMode === "ADD" || requirements.length === 0) {
    return (
      <div className="max-w-6xl mx-auto py-2 px-2 md:px-4 space-y-4">
        <PageHeader
          stepTag="02 / REQUIREMENT ANALYSIS"
          title="요구사항을 등록해 주세요"
          description="명세를 자동 분석하거나, 원문을 보면서 요구사항을 직접 입력할 수 있습니다."
        />

        <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-4 text-xs">
          <div className="font-semibold text-amber-800">AI 분석 서비스에 연결하지 못했습니다.</div>
          <div className="text-amber-700/90 text-[11px] mt-0.5">
            연결 상태를 확인하거나 요구사항을 직접 입력해 검토를 계속하세요.
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          <div className="lg:col-span-8">
            <Card
              title="요구사항 직접 입력"
              description="추가한 요구사항은 검토 후 코드 검증에 사용할 수 있습니다."
              className="flex flex-col justify-between h-full"
            >
              <form onSubmit={handleSubmitForm} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className={VIEW_HEADER.fieldLabel}>요구사항 ID</label>
                    <Input
                      type="text"
                      value={formReqId}
                      onChange={(e) => setFormReqId(e.target.value)}
                      placeholder="예: NOTICE-002"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className={VIEW_HEADER.fieldLabel}>기능 이름</label>
                    <Input
                      type="text"
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      placeholder="예: 공지사항 작성"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className={VIEW_HEADER.fieldLabel}>명세 원문 또는 요구사항 설명</label>
                  <textarea
                    rows={4}
                    value={formDesc}
                    onChange={(e) => setFormDesc(e.target.value)}
                    placeholder="행위자, 조건, 동작, 기대 결과를 포함해 입력하세요."
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 resize-none"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className={VIEW_HEADER.fieldLabel}>원문 위치</label>
                    <Input
                      type="text"
                      value={formLocation}
                      onChange={(e) => setFormLocation(e.target.value)}
                      placeholder="예: 문서 8페이지"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className={VIEW_HEADER.fieldLabel}>검토 상태</label>
                    <Input type="text" disabled value="검토 필요" />
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                  <span className="text-[11px] text-slate-400">수락 조건은 추가 후 편집할 수 있습니다.</span>
                  <div className="flex items-center space-x-2">
                    {requirements.length > 0 && (
                      <Button type="button" variant="secondary" size="md" onClick={() => setViewMode("VIEW")}>
                        취소
                      </Button>
                    )}
                    <Button type="submit" variant="primary" size="lg">
                      요구사항 추가
                    </Button>
                  </div>
                </div>
              </form>
            </Card>
          </div>

          <div className="lg:col-span-4">
            <Card
              title="자동 분석을 사용하려면"
              description="프로젝트 자료와 모델 연결을 확인하세요."
              className="flex flex-col justify-between h-full space-y-5"
            >
              <div className="space-y-4">
                <div className="text-xs space-y-1.5 text-slate-600 pt-1">
                  <div>명세 파일 업로드 상태 확인</div>
                  <div>API 키 연결 확인</div>
                  <div>분석 다시 시도</div>
                </div>

                <div className="space-y-2 pt-2">
                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    onClick={handleStartAIAnalysis}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    AI 분석 시작
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    onClick={() => onNavigateStep("SETUP")}
                    className="w-full"
                  >
                    프로젝트 설정 열기
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="md"
                    onClick={handleRefreshData}
                    className="w-full bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200"
                  >
                    데이터 새로고침
                  </Button>
                </div>
              </div>

              <div className="text-[11px] text-slate-400 pt-3 border-t border-slate-100 leading-relaxed">
                자동 분석이 실패해도 직접 입력한 내용은 유지됩니다.
              </div>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (viewMode === "EDIT" && selectedReq) {
    return (
      <div className="max-w-6xl mx-auto py-2 px-2 md:px-4 space-y-4">
        <PageHeader
          stepTag="02 / REQUIREMENT ANALYSIS"
          title="요구사항 수정"
          description="원문 내용과 구조화된 수락 조건 속성을 수정합니다."
        />

        <Card>
          <form onSubmit={handleSubmitForm} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className={VIEW_HEADER.fieldLabel}>요구사항 ID</label>
                <Input
                  type="text"
                  value={formReqId}
                  onChange={(e) => setFormReqId(e.target.value)}
                  disabled
                />
              </div>
              <div className="space-y-1.5">
                <label className={VIEW_HEADER.fieldLabel}>기능 이름</label>
                <Input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className={VIEW_HEADER.fieldLabel}>명세 원문</label>
              <textarea
                rows={3}
                value={formDesc}
                disabled
                className="w-full px-3 py-2 text-xs border border-slate-200 bg-slate-50 rounded-lg text-slate-500 cursor-not-allowed resize-none"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-2">
                구조화 속성
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <span className="text-[11px] text-slate-500">행위자</span>
                  <Input
                    type="text"
                    value={formActor}
                    onChange={(e) => setFormActor(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[11px] text-slate-500">조건</span>
                  <Input
                    type="text"
                    value={formCondition}
                    onChange={(e) => setFormCondition(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[11px] text-slate-500">동작</span>
                  <Input
                    type="text"
                    value={formAction}
                    onChange={(e) => setFormAction(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[11px] text-slate-500">기대 결과</span>
                  <Input
                    type="text"
                    value={formExpected}
                    onChange={(e) => setFormExpected(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className={VIEW_HEADER.fieldLabel}>원문 위치</label>
              <Input
                type="text"
                value={formLocation}
                onChange={(e) => setFormLocation(e.target.value)}
              />
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
              <Button type="button" variant="secondary" size="md" onClick={() => setViewMode("VIEW")}>
                취소
              </Button>
              <Button type="submit" variant="primary" size="lg">
                수정 사항 저장
              </Button>
            </div>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-2 px-2 md:px-4 space-y-4">
      <PageHeader
        stepTag="02 / REQUIREMENT ANALYSIS"
        title="명세 분석"
        description="원문에서 추출한 요구사항과 수락 조건을 확인하고 확정하세요."
        action={
          <>
            <Button type="button" variant="ghost" size="md" onClick={handleRefreshData}>
              데이터 새로고침
            </Button>
            <Button type="button" variant="secondary" size="md" onClick={handleStartAdd}>
              + 새 요구사항 등록
            </Button>
            <Button type="button" variant="primary" size="lg" onClick={handleGoToVerification} className="whitespace-nowrap">
              확정한 명세로 검증
            </Button>
          </>
        }
      />

      <div className="flex items-center justify-between text-xs text-slate-500 px-1">
        <div>
          <span className="font-medium text-slate-700">{specDocumentName}</span>
          <span className="mx-2 text-slate-300">·</span>
          <span>{specVersion}</span>
        </div>
        <div className="text-slate-400">
          전체 {requirements.length}개 · 검토 완료 {completedCount || requirements.length}개
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        <div className="lg:col-span-4">
          <Card
            title="요구사항 목록"
            description={`전체 ${filteredRequirements.length}개 표시`}
            className="flex flex-col justify-between h-full space-y-4"
          >
            <div className="space-y-3">
              <div>
                <Input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="요구사항 ID 또는 기능 검색"
                />
              </div>

              <div className="space-y-1.5 max-h-120 overflow-y-auto pr-1">
                {filteredRequirements.map((item) => {
                  const isSelected = selectedReq?.id === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setSelectedId(item.id);
                        setViewMode("VIEW");
                      }}
                      className={`w-full text-left p-3 rounded-xl transition-all ${
                        isSelected
                          ? "bg-blue-50/80 border border-blue-200/70 text-blue-600"
                          : "bg-white hover:bg-slate-50 border border-transparent text-slate-700"
                      }`}
                    >
                      <div className="text-xs font-bold leading-tight">{item.stable_key}</div>
                      <div className="text-xs font-medium text-slate-800 mt-1 truncate">{item.title}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 text-xs">
              <div className="font-semibold text-slate-700">문서 구조 보기</div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                원문 위치와 요구사항을 함께 확인합니다.
              </div>
            </div>
          </Card>
        </div>

        {selectedReq && (
          <div className="lg:col-span-8">
            <Card className="flex flex-col justify-between h-full space-y-5">
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      {selectedReq.stable_key} · {selectedReq.title}
                    </h2>
                    <p className="text-[11px] text-slate-400 mt-1">
                      기능 유형 · {selectedReq.req_type === "functional" ? "기능 요구사항" : "비기능 요구사항"}
                    </p>
                  </div>
                  <StatusBadge status={selectedReq.review_status === "approved" ? "검토 완료" : "검토 필요"} />
                </div>

                <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-4 space-y-1">
                  <span className="text-[11px] font-semibold text-slate-400 block">명세 원문</span>
                  <p className="text-xs text-slate-700 leading-relaxed font-normal">
                    {selectedReq.original_text || "원문이 없습니다."}
                  </p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                  <div className="bg-slate-50/70 border border-slate-200/60 rounded-xl p-3">
                    <span className="text-[10px] text-slate-400 block mb-0.5">기능/비기능</span>
                    <span className="text-xs font-semibold text-slate-800">
                      {selectedReq.req_type === "functional" ? "기능 요구사항" : "비기능 요구사항"}
                    </span>
                  </div>
                  <div className="bg-slate-50/70 border border-slate-200/60 rounded-xl p-3">
                    <span className="text-[10px] text-slate-400 block mb-0.5">조건</span>
                    <span className="text-xs font-semibold text-slate-800 truncate block">
                      {selectedReq.condition || "미지정"}
                    </span>
                  </div>
                  <div className="bg-slate-50/70 border border-slate-200/60 rounded-xl p-3">
                    <span className="text-[10px] text-slate-400 block mb-0.5">동작</span>
                    <span className="text-xs font-semibold text-slate-800 truncate block">
                      {selectedReq.action || "미지정"}
                    </span>
                  </div>
                  <div className="bg-slate-50/70 border border-slate-200/60 rounded-xl p-3">
                    <span className="text-[10px] text-slate-400 block mb-0.5">기대 결과</span>
                    <span className="text-xs font-semibold text-slate-800 truncate block">
                      {selectedReq.expected || "미지정"}
                    </span>
                  </div>
                </div>

                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-900">수락 조건</h3>
                    <span className="text-[11px] text-slate-400">
                      {selectedReq.conditions?.length ?? 0}개 항목
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {(selectedReq.conditions || []).map((ac: Condition, idx: number) => (
                      <div
                        key={ac.id || idx}
                        className="bg-slate-50/60 border border-slate-200/50 rounded-xl px-4 py-2.5 flex flex-col sm:flex-row sm:items-center text-xs gap-2"
                      >
                        <span className="font-semibold text-slate-600 sm:w-28 shrink-0">
                          {ac.category}
                        </span>
                        <span className="text-slate-700 flex-1">{ac.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-600">
                  검토 상태: {selectedReq.review_status === "approved" ? "확정됨" : "대기 중"}
                </span>
                <div className="flex items-center space-x-2">
                  <Button type="button" variant="secondary" size="md" onClick={handleStartEdit}>
                    요구사항 수정
                  </Button>
                  {selectedReq.review_status !== "approved" && (
                    <Button type="button" variant="primary" size="md" onClick={handleApproveRequirement}>
                      검토 확정
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};