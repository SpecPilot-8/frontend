import React, { useState, useEffect } from "react";
import type { StepId, AIModelOption, ProjectSetupData } from "../types";
import type { AIModelProfile } from "../types/project";
import {
  fetchProjectSetup,
  saveProjectSetup,
  uploadDocument,
  pollJobStatus,
  saveProjectCredentials,
  updateProjectLLMConfig,
  verifyLLMConnection,
  isMockMode,
  BASE_URL,
} from "../services/api";
import { useProject } from "../contexts/ProjectContext";
import { useFileUpload } from "../hooks";
import { Button, Card, Input, PageHeader } from "../components/common";
import { VIEW_HEADER } from "../styles/typography";

interface SetupViewProps {
  onNavigateStep: (step: StepId) => void;
  onProjectUpdated?: (projectName: string) => void;
  initialData?: ProjectSetupData;
}

const generateSnapshotId = () => {
  return "UPLOAD-" + new Date().getTime().toString().slice(-4);
};

export const SetupView: React.FC<SetupViewProps> = ({
  onNavigateStep,
  onProjectUpdated,
  initialData,
}) => {
  const { projectId, setProjectId } = useProject();

  const [setupData, setSetupData] = useState<ProjectSetupData | null>(() => {
    if (initialData) return initialData;
    if (!projectId) {
      return {
        projectName: "",
        specFile: null,
        codeSource: null,
        techStack: "",
        analysisScope: "",
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

  const [aiModels, setAiModels] = useState<AIModelOption[]>([]);
  const [modelProfiles, setModelProfiles] = useState<AIModelProfile[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
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

  useEffect(() => {
    fetch(`${BASE_URL}/model-profiles`)
      .then((res) => (res.ok ? res.json() : { items: [] }))
      .then((data) => {
        if (data && data.items && data.items.length > 0) {
          setModelProfiles(data.items);
          setAiModels(
            data.items.map((m: AIModelProfile) => ({
              id: m.id,
              name: m.display_name,
              provider: m.provider,
              enabled: m.enabled,
            }))
          );
        } else {
          setAiModels([{ id: "primary", name: "기본 모델 (연결 대기)", provider: "unconfigured", enabled: false }]);
        }
      })
      .catch((err) => {
        console.error("모델 목록 로드 실패:", err);
        setAiModels([{ id: "primary", name: "기본 모델 (연결 대기)", provider: "unconfigured", enabled: false }]);
      });
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
      handleUpdateField("specFile", {
        fileName: selectedFile.name,
        pageCount: 1,
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
      handleUpdateField("codeSource", {
        type: "ZIP",
        sourceName: selectedFile.name,
        fileCount: 0,
        snapshotId: generateSnapshotId(),
      });
    },
  });

  useEffect(() => {
    if (!projectId) return;

    Promise.all([
      fetchProjectSetup(projectId),
      fetch(`${BASE_URL}/projects/${projectId}/documents`).then((res) => res.json()).catch(() => ({ items: [] })),
      fetch(`${BASE_URL}/projects/${projectId}/code/snapshots`).then((res) => res.json()).catch(() => ({ items: [] })),
      fetch(`${BASE_URL}/projects/${projectId}/llm`).then((res) => res.json()).catch(() => ({ config_version: 0 })),
    ])
      .then(([setup, docsData, codeData, llmData]) => {
        if (!initialData) {
          const updatedSetup: ProjectSetupData = {
            projectName: setup?.projectName || "",
            version: setup?.version || 1,
            techStack: setup?.techStack || "",
            analysisScope: setup?.analysisScope || "",
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
              pageCount: 1,
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
        }
      })
      .catch((err) => {
        console.error(err);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [initialData, projectId]);

  const currentModel =
    aiModels.find((m) => m.id === setupData?.aiConfig.modelId) || aiModels[0];

  const handleUpdateField = <K extends keyof ProjectSetupData>(
    field: K,
    value: ProjectSetupData[K],
  ) => {
    if (!setupData) return;
    const updated = { ...setupData, [field]: value };
    setSetupData(updated);
    if (field === "projectName" && typeof value === "string") {
      onProjectUpdated?.(value);
    }
  };

  const handleUpdateAiConfig = (
    key: keyof ProjectSetupData["aiConfig"],
    value: string | boolean | number,
  ) => {
    if (!setupData) return;
    setSetupData({
      ...setupData,
      aiConfig: {
        ...setupData.aiConfig,
        [key]: value,
      },
    });
    if (key === "modelId" || key === "apiKey") {
      setConnectionStatus("IDLE");
      setConnectionErrorMsg("");
    }
  };

  const handleSaveAndUpload = async () => {
    if (!setupData || !setupData.projectName.trim()) {
      alert("프로젝트 이름을 입력해주세요.");
      return;
    }

    setIsSaving(true);
    setSavingMessage("프로젝트 설정을 저장하는 중...");

    try {
      const baseVersion = setupData.version || 1;
      const response = await saveProjectSetup(setupData, projectId || undefined, baseVersion);

      if (response.success && response.projectId) {
        const newProjectId = response.projectId;
        handleUpdateField("version", baseVersion + 1);

        if (specFile) {
          setSavingMessage("명세 문서를 서버에 업로드하는 중...");
          await uploadDocument(newProjectId, specFile);
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

        setProjectId(newProjectId);
        setIsUploaded(true);
        alert("프로젝트 저장 및 파일 업로드가 완료되었습니다. 이제 AI API 연결을 확인해주세요.");
      } else {
        alert(`프로젝트 저장 실패: ${response.error || "알 수 없는 오류"}`);
      }
    } catch (error: unknown) {
      console.error(error);
      const msg = error instanceof Error ? error.message : "알 수 없는 오류";
      alert(`프로젝트 설정 저장 중 오류가 발생했습니다:\n${msg}`);
    } finally {
      setIsSaving(false);
      setSavingMessage("");
    }
  };

  const handleVerifyApiKeyMock = () => {
    if (!projectId) {
      alert("먼저 프로젝트를 저장하고 파일을 업로드해주세요.");
      return;
    }
    setConnectionStatus("SUCCESS");
    setConnectionErrorMsg("");
    handleUpdateAiConfig("isConnected", true);
    alert("[개발 모드] AI API 연결이 임시로 강제 통과되었습니다.");
  };

  const handleVerifyApiKey = async () => {
    if (!projectId) {
      alert("먼저 프로젝트를 저장하고 파일을 업로드해주세요.");
      return;
    }

    setConnectionStatus("CHECKING");
    setConnectionErrorMsg("");

    try {
      if (isMockMode) {
        handleVerifyApiKeyMock();
        return;
      }

      const selectedProfile = modelProfiles.find((p) => p.id === setupData?.aiConfig.modelId);
      let currentConfigVersion = setupData?.aiConfig.configVersion || 0;
      let credentialRef: string | undefined;

      if (selectedProfile?.credential_required && setupData?.aiConfig.apiKey) {
        const credRes = await saveProjectCredentials(projectId, selectedProfile.id, setupData.aiConfig.apiKey);
        credentialRef = credRes.credential_ref;
      }

      const llmRes = await updateProjectLLMConfig(projectId, setupData!.aiConfig.modelId, currentConfigVersion, credentialRef);
      currentConfigVersion = llmRes.config_version || (currentConfigVersion + 1);
      handleUpdateAiConfig("configVersion", currentConfigVersion);

      const verifyRes = await verifyLLMConnection(projectId, currentConfigVersion);

      if (verifyRes.status === "connected") {
        setConnectionStatus("SUCCESS");
        handleUpdateAiConfig("isConnected", true);
        alert("AI API 연결이 성공적으로 확인되었습니다.");
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
        title={setupData.projectName ? "프로젝트 설정" : "새 프로젝트 만들기"}
        description={
          setupData.projectName
            ? "명세 문서와 검증할 코드를 연결하고 분석 범위를 확인하세요."
            : "먼저 명세와 코드를 연결하세요. 분석 설정은 이후에도 바꿀 수 있습니다."
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
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
                      업로드 완료
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
                        PDF · {setupData.specFile?.pageCount ?? 1}페이지 ·{" "}
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
                          코드 스냅샷 {setupData.codeSource?.snapshotId}
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className={VIEW_HEADER.fieldLabel}>
                      분석 기술 스택
                    </label>
                    <Input
                      type="text"
                      value={setupData.techStack || ""}
                      onChange={(e) =>
                        handleUpdateField("techStack", e.target.value)
                      }
                      placeholder="예: Java · Spring Boot"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className={VIEW_HEADER.fieldLabel}>
                      코드 분석 범위
                    </label>
                    <Input
                      type="text"
                      value={setupData.analysisScope || ""}
                      onChange={(e) =>
                        handleUpdateField("analysisScope", e.target.value)
                      }
                      placeholder="예: src/main/java"
                    />
                  </div>
                </div>
              </div>

              <Button
                type="button"
                variant={isUploaded ? "secondary" : "primary"}
                size="lg"
                onClick={handleSaveAndUpload}
                disabled={isSaving}
                className="whitespace-nowrap mt-4 sm:mt-0"
              >
                {isSaving ? savingMessage || "처리 중..." : isUploaded ? "설정 및 파일 저장 완료" : "설정 및 파일 저장"}
              </Button>
            </div>
          </Card>
        </div>

        <div className="lg:col-span-4 flex flex-col justify-between gap-5 h-full">
          <Card
            title="AI 모델 연결"
            description="분석에 사용할 모델의 연결 상태를 확인합니다."
            className="space-y-4"
          >
            <div className="space-y-1.5 relative">
              <label className={VIEW_HEADER.fieldLabel}>분석 모델</label>
              <button
                type="button"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className={`w-full px-3 py-2.5 bg-white border rounded-xl flex items-center justify-between text-xs transition-all ${
                  isDropdownOpen
                    ? "border-blue-500 ring-2 ring-blue-100"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <span className="font-medium text-slate-800">
                  {currentModel?.name || "모델을 선택하세요"}
                </span>
                <div className="flex items-center space-x-2">
                  <span className="text-[11px] text-slate-400">
                    {currentModel?.provider}
                  </span>
                  <svg
                    className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
                      isDropdownOpen ? "rotate-180" : ""
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>
              </button>

              {isDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-lg z-20 p-1.5 space-y-1">
                  <div className="px-2 py-1 text-[11px] text-slate-400 font-medium">
                    분석 모델 선택 · 한 번에 1개
                  </div>
                  {aiModels.map((model: AIModelOption & { enabled?: boolean }) => {
                    const isSelected =
                      (setupData.aiConfig.modelId || currentModel?.id) ===
                      model.id;
                    return (
                      <button
                        key={model.id}
                        type="button"
                        disabled={!model.enabled}
                        onClick={() => {
                          handleUpdateAiConfig("modelId", model.id);
                          setIsDropdownOpen(false);
                        }}
                        className={`w-full px-3 py-2 text-left rounded-lg text-xs flex items-center justify-between transition-colors ${
                          !model.enabled
                            ? "opacity-50 cursor-not-allowed bg-slate-50 text-slate-400"
                            : isSelected
                              ? "bg-blue-50 text-blue-600 font-semibold"
                              : "hover:bg-slate-50 text-slate-700"
                        }`}
                      >
                        <div>
                          <div className="font-medium">
                            {model.name} {model.enabled === false && "(미지원)"}
                          </div>
                          <div className="text-[10px] text-slate-400 font-normal">
                            {model.provider}
                          </div>
                        </div>
                        {isSelected && (
                          <svg
                            className="w-4 h-4 text-blue-600"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2.5}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label className={VIEW_HEADER.fieldLabel}>API 키</label>
              <Input
                type="password"
                value={setupData.aiConfig.apiKey || ""}
                onChange={(e) => handleUpdateAiConfig("apiKey", e.target.value)}
                placeholder="제공업체 API 키 입력"
                className="tracking-wider"
              />
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
                    variant="ghost"
                    size="md"
                    onClick={handleVerifyApiKeyMock}
                    disabled={!isUploaded}
                    className="text-amber-600 bg-amber-50 hover:bg-amber-100"
                  >
                    임시 강제 통과
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    onClick={handleVerifyApiKey}
                    disabled={connectionStatus === "CHECKING" || !isUploaded}
                  >
                    {connectionStatus === "CHECKING"
                      ? "확인 중..."
                      : "실제 연결 확인"}
                  </Button>
                </div>
              </div>
              
              {connectionStatus === "FAILED" && connectionErrorMsg && (
                <div className="text-[11px] text-rose-600 bg-rose-50 p-2 rounded-lg mt-2 break-keep">
                  <span className="font-semibold block mb-0.5">연결 에러</span>
                  {connectionErrorMsg}
                </div>
              )}
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed pt-2 border-t border-slate-100">
              먼저 파일을 저장한 뒤, API 키로 연결을 확인하세요.
            </p>
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
      </div>

      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-slate-800">
            파일 저장과 AI 연결 검증이 끝났다면 명세 분석을 시작하세요.
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
          disabled={!isUploaded}
          className="whitespace-nowrap"
        >
          명세 분석 시작
        </Button>
      </div>
    </div>
  );
};