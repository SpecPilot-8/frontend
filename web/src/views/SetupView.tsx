import { PROJECT_STACKS } from "../projectStacks";
import React, { useState, useEffect, useCallback } from "react";
import type { StepId, ProjectSetupData } from "../types";
import type { AIModelProfile } from "../types/project";
import {
  fetchProjectSetup,
  saveProjectSetup,
  uploadDocument,
  pollJobStatus,
  updateProjectLLMConfig,
  verifyLLMConnection,
  BASE_URL,
  api, fetchAll,
} from "../services/api";
import { useProject } from "../contexts/ProjectContext";
import { useFileUpload } from "../hooks";
import { Button, Card, Input, PageHeader } from "../components/common";
import { VIEW_HEADER } from "../styles/typography";

interface SetupViewProps {
  onNavigateStep: (step: StepId) => void;
  onProjectUpdated?: (projectName: string, techStack: string) => void;
  initialData?: ProjectSetupData;
}

export const SetupView: React.FC<SetupViewProps> = ({
  onNavigateStep,
  onProjectUpdated,
  initialData,
}) => {
  const { projectId, setProjectId, unsavedChanges, setUnsavedChanges, saveBeforeLeaveRef, setNavigationLocked } = useProject();

  const [setupData, setSetupData] = useState<ProjectSetupData | null>(() => {
    if (initialData) return initialData;
    if (!projectId) {
      return {
        projectName: "",
        specFile: null,
        codeSource: null,
        techStack: "auto",
        aiConfig: {
          modelId: "primary", 
          apiKey: "",
          isConnected: false,
          configVersion: 0,
        },
      };
    }
    return null;
  });

  const [modelProfiles, setModelProfiles] = useState<AIModelProfile[]>([]);
  const [codeSourceTab, setCodeSourceTab] = useState<"ZIP" | "GIT">("ZIP");

  const [connectionStatus, setConnectionStatus] = useState<
    "IDLE" | "CHECKING" | "SUCCESS" | "FAILED"
  >("IDLE");
  const [connectionErrorMsg, setConnectionErrorMsg] = useState<string>("");

  const [isLoading, setIsLoading] = useState<boolean>(!!projectId && !initialData);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [savingMessage, setSavingMessage] = useState<string>("");
  const [isUploaded, setIsUploaded] = useState<boolean>(false);

  const [specFile, setSpecFile] = useState<File | null>(null);
  const [codeFile, setCodeFile] = useState<File | null>(null);
  const [loadError, setLoadError] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    setNavigationLocked(isSaving || connectionStatus === "CHECKING");
    return () => setNavigationLocked(false);
  }, [isSaving, connectionStatus, setNavigationLocked]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (unsavedChanges) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsavedChanges]);

  useEffect(() => {
    return () => {
      setUnsavedChanges(false);
    };
  }, [setUnsavedChanges]);

  useEffect(() => {
    api<{ items: AIModelProfile[] }>("/model-profiles")
      .then((data) => setModelProfiles(data.items))
      .catch(() => setConnectionErrorMsg("서버 모델 설정을 불러오지 못했습니다. 백엔드 연결을 확인하세요."));
  }, []);

  const {
    inputRef: specInputRef,
    handleFileChange: onSpecFileChange,
    isDragging: isSpecDragging,
    handleDragOver: onSpecDragOver,
    handleDragLeave: onSpecDragLeave,
    handleDrop: onSpecDrop,
    openFileDialog: openSpecFileDialog,
  } = useFileUpload({
    accept: ".pdf",
    onFileSelect: (selectedFile) => {
      setSpecFile(selectedFile);
      setUnsavedChanges(true);
      handleUpdateField("specFile", {
        fileName: selectedFile.name,
        pageCount: undefined,
        version: "v1.0",
        uploaded: false,
      });
    },
  });

  const {
    inputRef: codeInputRef,
    handleFileChange: onCodeFileChange,
    openFileDialog: openCodeFileDialog,
  } = useFileUpload({
    accept: ".zip",
    onFileSelect: (selectedFile) => {
      setCodeFile(selectedFile);
      setUnsavedChanges(true);
      handleUpdateField("codeSource", {
        type: "ZIP",
        sourceName: selectedFile.name,
        fileCount: 0,
        snapshotId: undefined,
      });
    },
  });

  useEffect(() => {
    if (!projectId || isSaving || unsavedChanges) return;
    let active = true;

    Promise.all([
      fetchProjectSetup(projectId),
      fetchAll<{ id: string; filename?: string; revision?: number; page_count?: number; file_count?: number }>(`/projects/${projectId}/documents`).then(items => ({ items: items.reverse() })),
      fetchAll<{ id: string; filename?: string; revision?: number; page_count?: number; file_count?: number }>(`/projects/${projectId}/code/snapshots`).then(items => ({ items: items.reverse() })),
      api<{ profile_id: string; config_version: number; connection_status: string }>(`/projects/${projectId}/llm`),
    ])
      .then(([setup, docsData, codeData, llmData]) => {
        if (!active) return;
        if (!setup) throw new Error("프로젝트 설정을 불러오지 못했습니다.");
        setLoadError("");
        if (!initialData) {
          const updatedSetup: ProjectSetupData = {
            projectName: setup?.projectName || "",
            version: setup?.version || 1,
            techStack: setup?.techStack || "auto",
            aiConfig: {
              modelId: llmData?.profile_id || "primary",
              apiKey: "",
              isConnected: llmData?.connection_status === "connected",
              configVersion: llmData?.config_version || 0,
            },
            specFile: setup?.specFile || null,
            codeSource: setup?.codeSource || null,
          };

          if (docsData.items && docsData.items.length > 0) {
            const doc = docsData.items[0];
            updatedSetup.specFile = {
              fileName: doc.filename || "기존_업로드된_기획서.pdf",
              uploaded: true,
              pageCount: doc.page_count,
              version: `v${doc.revision || 1}.0`,
            };
            setIsUploaded(true);
          }

          if (codeData.items && codeData.items.length > 0) {
            const snap = codeData.items[0];
            updatedSetup.codeSource = {
              type: "ZIP",
              sourceName: "기존_업로드된_소스코드.zip",
              fileCount: snap.file_count || 0,
              snapshotId: snap.id,
            };
          }

          setSetupData(updatedSetup);
          setUnsavedChanges(false);
          onProjectUpdated?.(updatedSetup.projectName, updatedSetup.techStack || "auto");
        }
      })
      .catch((err) => {
        if (active) setLoadError(err instanceof Error ? err.message : "프로젝트 설정을 불러오지 못했습니다.");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => { active = false; };
  }, [initialData, projectId, onProjectUpdated, isSaving, unsavedChanges, setUnsavedChanges, loadAttempt]);

  const currentModel =
    modelProfiles.find((m) => m.id === "primary");

  const handleUpdateField = <K extends keyof ProjectSetupData>(
    field: K,
    value: ProjectSetupData[K],
  ) => {
    if (!setupData) return;
    setUnsavedChanges(true);
    const updated = { ...setupData, [field]: value };
    setSetupData(updated);
  };

  const handleUpdateAiConfig = (
    key: keyof ProjectSetupData["aiConfig"],
    value: string | boolean | number,
  ) => {
    if (!setupData) return;
    if (key === "modelId" || key === "apiKey") setUnsavedChanges(true);
    setSetupData(prev => prev ? ({ ...prev, aiConfig: { ...prev.aiConfig, [key]: value,
      ...((key === "modelId" || key === "apiKey") ? { isConnected: false } : {}) } }) : prev);
    if (key === "modelId" || key === "apiKey") {
      setConnectionStatus("IDLE");
      setConnectionErrorMsg("");
    }
  };

  const handleSaveAndUpload = useCallback(async (): Promise<boolean> => {
    if (isSaving) return false;
    if (!setupData || !setupData.projectName.trim()) {
      alert("프로젝트 이름을 입력해주세요.");
      return false;
    }

    setIsSaving(true);
    setSavingMessage("프로젝트 설정을 저장하는 중...");

    try {
      const baseVersion = setupData.version || 1;
      const response = await saveProjectSetup(setupData, projectId || undefined, baseVersion);

      if (response.success && response.projectId) {
        const newProjectId = response.projectId;
        const saved = response.data as { version: number };
        setSetupData(prev => prev ? { ...prev, version: saved.version } : prev);
        setProjectId(newProjectId);
        onProjectUpdated?.(setupData.projectName, setupData.techStack || "auto");

        if (specFile) {
          setSavingMessage("명세 문서를 서버에 업로드하는 중...");
          await uploadDocument(newProjectId, specFile);
          setSpecFile(null);
          setIsUploaded(true);
          setSetupData(prev => prev ? { ...prev, specFile: prev.specFile ? { ...prev.specFile, uploaded: true } : null } : prev);
        }

        if (codeSourceTab === "ZIP" && codeFile) {
          setSavingMessage("소스코드를 업로드하는 중...");
          const formData = new FormData();
          formData.append("file", codeFile);

          const sourceRes = await fetch(`${BASE_URL}/projects/${newProjectId}/code/sources`, {
            method: "POST",
            body: formData,
          });

          if (!sourceRes.ok) {
            const errData = await sourceRes.json().catch(() => ({}));
            throw new Error(errData.error?.message || "소스코드 업로드에 실패했습니다.");
          }

          const sourceResponseData = await sourceRes.json();
          
          if (sourceResponseData.source_id) {
            setSavingMessage("소스코드 구조 인덱싱을 요청하는 중...");
            const indexRes = await fetch(`${BASE_URL}/projects/${newProjectId}/code/index`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ source_id: sourceResponseData.source_id }),
            });

            if (!indexRes.ok) throw new Error("코드 인덱싱 요청 접수에 실패했습니다.");

            const indexJob = await indexRes.json();
            
            if (indexJob.id) {
              const finalJob = (await pollJobStatus(
                newProjectId,
                indexJob.id,
                (jobInfo: { progress?: { completed: number; total: number } }) => {
                  if (jobInfo.progress) {
                    setSavingMessage(`소스코드 인덱싱 중... (${jobInfo.progress.completed}/${jobInfo.progress.total})`);
                  } else {
                    setSavingMessage("소스코드 인덱싱 진행 중...");
                  }
                }
              )) as { status: string; error?: { message: string } };

              if (["failed", "blocked", "cancelled"].includes(finalJob.status)) {
                throw new Error(`[인덱싱 실패] ${finalJob.error?.message || finalJob.status}`);
              }
            }
          }
        }

        setCodeFile(null);
        setIsUploaded(Boolean(specFile || setupData.specFile?.fileName));
        setUnsavedChanges(false);
        alert("프로젝트 저장 및 파일 업로드가 완료되었습니다. 서버 모델 연결을 확인할 수 있습니다.");
        return true;
      } else {
        alert(`프로젝트 저장 실패: ${response.error || "알 수 없는 오류"}`);
        return false;
      }
    } catch (error: unknown) {
      console.error(error);
      const msg = error instanceof Error ? error.message : "알 수 없는 오류";
      alert(`프로젝트 설정 저장 중 오류가 발생했습니다:\n${msg}`);
      return false;
    } finally {
      setIsSaving(false);
      setSavingMessage("");
    }
  }, [setupData, projectId, specFile, codeSourceTab, codeFile, setProjectId, setUnsavedChanges, onProjectUpdated, isSaving]);

  useEffect(() => {
    saveBeforeLeaveRef.current = unsavedChanges ? handleSaveAndUpload : null;
    return () => {
      saveBeforeLeaveRef.current = null;
    };
  }, [saveBeforeLeaveRef, unsavedChanges, handleSaveAndUpload]);

  const handleVerifyApiKey = async () => {
    if (!projectId) {
      alert("먼저 프로젝트 설정을 저장해주세요.");
      return;
    }

    setConnectionStatus("CHECKING");
    setConnectionErrorMsg("");

    try {
      let currentConfigVersion = setupData?.aiConfig.configVersion || 0;
      handleUpdateAiConfig("isConnected", false);

      const llmRes = await updateProjectLLMConfig(projectId, "primary", currentConfigVersion);
      currentConfigVersion = llmRes.config_version || (currentConfigVersion + 1);
      handleUpdateAiConfig("configVersion", currentConfigVersion);

      const verifyRes = await verifyLLMConnection(projectId, currentConfigVersion);

      if (verifyRes.status === "connected") {
        setConnectionStatus("SUCCESS");
        handleUpdateAiConfig("isConnected", true);
        alert("서버에 설정된 모델의 실제 호출과 JSON 응답을 확인했습니다.");
      } else {
        throw new Error("연결에 실패했습니다.");
      }
    } catch (error: unknown) {
      console.error("AI 연결 확인 오류:", error);
      setConnectionStatus("FAILED");
      
      const err = error as { message?: string, missing_features?: { message: string }[] };
      let errMsg = err.message || "연결 확인 중 오류가 발생했습니다.";
      if (err.missing_features && err.missing_features.length > 0) {
        errMsg = err.missing_features[0].message;
      }
      setConnectionErrorMsg(errMsg);
    }
  };

  const handleStartAnalysis = () => {
    if (!isUploaded) {
      alert("먼저 프로젝트를 저장하고 파일을 업로드해주세요.");
      return;
    }
    onNavigateStep("ANALYSIS");
  };

  if (loadError && !setupData) return <div role="alert" className="p-8 space-y-3 text-sm text-red-700"><p>{loadError}</p><Button onClick={() => { setIsLoading(true); setLoadAttempt(value => value + 1); }}>다시 불러오기</Button></div>;

  if (isLoading || !setupData) {
    return (
      <div className="max-w-6xl mx-auto py-12 text-center text-xs text-slate-400">
        프로젝트 설정 정보를 불러오는 중입니다...
      </div>
    );
  }

  const isSpecUploaded = !!setupData.specFile?.fileName;
  const isSourceUploaded = !!setupData.codeSource?.sourceName;

  return (
    <div className="max-w-6xl mx-auto py-2 px-2 md:px-4 space-y-5">
      <PageHeader
        stepTag="01 / PROJECT SETUP"
        title="프로젝트 설정"
        description="명세 문서와 검증할 코드를 연결하고 프로젝트를 준비하세요."
      />

      {loadError && <p role="alert" className="text-sm text-red-700">{loadError} 현재 입력은 유지됩니다.</p>}
      <fieldset disabled={isSaving || connectionStatus === "CHECKING"} className="min-w-0 grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        <div className="lg:col-span-8">
          <Card
            title="프로젝트와 분석 자료"
            description="문서·코드·설정을 한 곳에서 관리합니다."
            className="flex flex-col justify-between space-y-5 h-full"
          >
            <div className="space-y-5">
              <div className="space-y-1.5">
                <label className={VIEW_HEADER.fieldLabel}>프로젝트 이름</label>
                <Input
                  aria-label="프로젝트 이름"
                  type="text"
                  value={setupData.projectName || ""}
                  placeholder="프로젝트 이름을 입력하세요"
                  onChange={(e) =>
                    handleUpdateField("projectName", e.target.value)
                  }
                />
              </div>

              <input
                type="file"
                ref={specInputRef as React.Ref<HTMLInputElement>}
                onChange={onSpecFileChange}
                accept=".pdf"
                className="hidden"
              />
              <input
                type="file"
                ref={codeInputRef as React.Ref<HTMLInputElement>}
                onChange={onCodeFileChange}
                accept=".zip"
                className="hidden"
              />

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className={VIEW_HEADER.fieldLabel}>명세 문서</label>
                  {isSpecUploaded && (
                    <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                      {setupData.specFile?.uploaded ? "업로드 완료" : "파일 선택됨 · 저장 전"}
                    </span>
                  )}
                </div>

                {isSpecUploaded ? (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-medium text-slate-800">
                        {setupData.specFile?.fileName}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        PDF · {setupData.specFile?.pageCount ? `${setupData.specFile.pageCount}페이지` : "페이지 수 확인 전"} ·{" "}
                        {setupData.specFile?.version ?? "v1.0"}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="md"
                      onClick={openSpecFileDialog}
                    >
                      문서 교체
                    </Button>
                  </div>
                ) : (
                  <div
                    onDragOver={onSpecDragOver}
                    onDragLeave={onSpecDragLeave}
                    onDrop={onSpecDrop}
                    className={`border border-dashed rounded-xl py-8 px-4 flex flex-col items-center justify-center text-center space-y-2 transition-colors ${
                      isSpecDragging
                        ? "border-blue-500 bg-blue-50/50"
                        : "border-slate-200 bg-slate-50/50"
                    }`}
                  >
                    <p className="text-xs font-medium text-slate-700">
                      명세 문서를 여기에 놓으세요
                    </p>
                    <p className="text-[11px] text-slate-400">
                      오직 PDF 파일만 지원됩니다
                    </p>
                    <Button
                      type="button"
                      variant="primary"
                      size="md"
                      onClick={openSpecFileDialog}
                      className="mt-1"
                    >
                      명세 파일 선택
                    </Button>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className={VIEW_HEADER.fieldLabel}>
                  검증 대상 소스코드
                </label>
                <div className="flex items-center space-x-1.5">
                  <Button
                    type="button"
                    variant={codeSourceTab === "ZIP" ? "primary" : "secondary"}
                    size="sm"
                    onClick={() => setCodeSourceTab("ZIP")}
                  >
                    ZIP 업로드
                  </Button>
                  <Button
                    type="button"
                    variant={codeSourceTab === "GIT" ? "primary" : "secondary"}
                    size="sm"
                    disabled
                    title="원격 Git 가져오기는 후속 지원 예정입니다"
                    onClick={() => setCodeSourceTab("GIT")}
                  >
                    Git 저장소
                  </Button>
                </div>

                {codeSourceTab === "ZIP" ? (
                  isSourceUploaded ? (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 mt-2 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-medium text-slate-800">
                          {setupData.codeSource?.sourceName}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {setupData.codeSource?.fileCount
                            ? `${setupData.codeSource.fileCount}개 파일 · `
                            : ""}
                          {setupData.codeSource?.snapshotId ? `코드 스냅샷 ${setupData.codeSource.snapshotId}` : "파일 선택됨 · 저장 전"}
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        size="md"
                        onClick={openCodeFileDialog}
                      >
                        파일 교체
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2 pt-1">
                      <div className="p-3 border border-slate-200 rounded-lg text-xs text-slate-400 bg-white">
                        아직 코드 파일을 선택하지 않았습니다.
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        size="md"
                        onClick={openCodeFileDialog}
                      >
                        코드 ZIP 선택
                      </Button>
                    </div>
                  )
                ) : (
                  <div className="pt-1">
                    <Input
                      type="text"
                      placeholder="https://github.com/organization/repository.git"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="w-full sm:w-auto">
                <div className="space-y-2 max-w-xl">
                  <label htmlFor="project-tech-stack" className={VIEW_HEADER.fieldLabel}>
                    분석 기술 스택
                  </label>
                  <select
                    id="project-tech-stack"
                    value={setupData.techStack || "auto"}
                    onChange={(e) => handleUpdateField("techStack", e.target.value)}
                    aria-describedby="project-stack-help source-scope-help"
                    className="w-full px-3 py-2 text-xs text-slate-800 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
                  >
                    {PROJECT_STACKS.map((stack) => (
                      <option key={stack.value} value={stack.value}>{stack.label}</option>
                    ))}
                  </select>
                  <p id="project-stack-help" className="text-xs text-slate-500">
                    기술 스택은 프로젝트 분류에 사용합니다. 실제 파서는 파일 확장자에 맞춰 선택합니다.
                  </p>
                  <p id="source-scope-help" className="text-xs text-slate-500">
                    ZIP 안의 지원 소스 전체를 분석합니다. Git·의존성·빌드 폴더와 macOS 메타데이터는 자동으로 제외합니다.
                  </p>
                </div>
              </div>

              <Button
                type="button"
                variant={isUploaded && !unsavedChanges ? "secondary" : "primary"}
                size="lg"
                onClick={handleSaveAndUpload}
                disabled={isSaving}
                className="whitespace-nowrap mt-4 sm:mt-0"
              >
                {isSaving ? savingMessage || "처리 중..." : isUploaded && !unsavedChanges ? "설정 및 파일 저장 완료" : "설정 및 파일 저장"}
              </Button>
            </div>
          </Card>
        </div>

        <div className="lg:col-span-4 flex flex-col justify-between gap-5 h-full">
          <Card
            title="AI 모델 연결"
            description="서버에 등록된 키와 모델로 연결을 테스트합니다."
            className="space-y-4"
          >
            <div className="space-y-3 rounded-lg bg-slate-50 border border-slate-200 p-3">
              <div>
                <div className={VIEW_HEADER.fieldLabel}>연결 방식</div>
                <p className="text-xs text-slate-700 mt-1">백엔드 서버 설정 사용</p>
              </div>
              <div>
                <div className={VIEW_HEADER.fieldLabel}>제공업체</div>
                <p className="text-xs text-slate-700 mt-1">{currentModel?.provider || "설정 확인 중"}</p>
              </div>
              <div>
                <div className={VIEW_HEADER.fieldLabel}>분석 모델</div>
                <p className="text-xs text-slate-700 mt-1 break-all">{currentModel?.model || "설정 확인 중"}</p>
              </div>
              <p className="text-xs text-slate-500">
                {currentModel?.enabled ? "서버에 등록된 API 키를 사용합니다. 화면에서 키를 입력하지 않아도 됩니다." : "서버의 제공업체·모델·API 키 설정을 확인해주세요."}
              </p>
            </div>

            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <span
                  className={`text-[11px] font-medium px-2 py-1 rounded-lg ${
                    connectionStatus === "SUCCESS" || setupData.aiConfig.isConnected
                      ? "bg-emerald-50 text-emerald-600"
                      : connectionStatus === "FAILED"
                        ? "bg-rose-50 text-rose-600"
                        : connectionStatus === "CHECKING"
                          ? "bg-amber-50 text-amber-600 animate-pulse"
                          : "bg-blue-50 text-blue-600"
                  }`}
                >
                  {connectionStatus === "CHECKING"
                    ? "연결 시도 중..."
                    : connectionStatus === "SUCCESS" || setupData.aiConfig.isConnected
                      ? "연결 완료"
                      : connectionStatus === "FAILED"
                        ? "연결 실패"
                        : "연결 확인 필요"}
                </span>

                <div className="flex items-center space-x-1.5">
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    onClick={handleVerifyApiKey}
                    disabled={connectionStatus === "CHECKING" || !projectId || !currentModel?.enabled}
                  >
                    {connectionStatus === "CHECKING"
                      ? "확인 중..."
                      : "실제 연결 확인"}
                  </Button>
                </div>
              </div>
              
              {connectionErrorMsg && (
                <div className="text-[11px] text-rose-600 bg-rose-50 p-2 rounded-lg mt-2 break-keep">
                  <span className="font-semibold block mb-0.5">연결 에러</span>
                  {connectionErrorMsg}
                </div>
              )}
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed pt-2 border-t border-slate-100">
              프로젝트를 저장한 뒤 연결을 확인하세요. 짧은 테스트 요청 1회로 호출 비용이 발생할 수 있습니다. 문서와 코드는 보내지 않습니다.
            </p>
            <p className="text-xs text-amber-700">연결 성공 후 요구사항 추출과 코드 검증을 실행할 수 있습니다. 코드 검증은 화면 진입 파일 확인이 필요하며, 실제 실행 테스트와는 구분됩니다. 테스트 자동 생성은 준비 중입니다.</p>
          </Card>

          <Card
            title="이후 진행 순서"
            description="등록한 자료를 기준으로 검증을 진행합니다."
            className="flex flex-col justify-between space-y-3 flex-1"
          >
            <div className="space-y-3 pt-1 text-xs">
              <div>
                <div className="font-semibold text-slate-800">명세 분석</div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  요구사항과 수락 조건을 검토합니다.
                </div>
              </div>
              <div>
                <div className="font-semibold text-slate-800">코드 검증</div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  코드 근거를 보고 차이를 확인합니다.
                </div>
              </div>
              <div>
                <div className="font-semibold text-slate-800">
                  테스트 사양서
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  시험 절차를 만들고 결과를 기록합니다.
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-400 leading-relaxed">
              모델 연결은 프로젝트 설정에서 관리합니다.
            </div>
          </Card>
        </div>
      </fieldset>

      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-slate-800">
            파일 저장 후 명세 분석을 시작할 수 있습니다. AI 미연결 시 원문 검토와 수동 작성을 이용하세요.
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            검증 항목: 입력값 · 경로 및 이동 · 비즈니스 로직 · 데이터 저장 ·
            오류 메시지
          </div>
        </div>
        <Button
          type="button"
          variant="primary"
          size="lg"
          onClick={handleStartAnalysis}
          disabled={!isUploaded || isSaving || connectionStatus === "CHECKING"}
          className="whitespace-nowrap"
        >
          명세 분석 시작
        </Button>
      </div>
    </div>
  );
};
