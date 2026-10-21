import React, { useState, useEffect } from 'react';
import type { StepId, AIModelOption, ProjectSetupData } from '../types';
import { fetchProjectSetup, saveProjectSetup, uploadDocument } from '../services/api';
import { useProject } from '../contexts/ProjectContext';
import { useFileUpload } from '../hooks';
import { Button, Card, Input, PageHeader } from '../components/common';
import { VIEW_HEADER } from '../styles/typography';

interface SetupViewProps {
  onNavigateStep: (step: StepId) => void;
  onProjectUpdated?: (projectName: string) => void;
  initialData?: ProjectSetupData;
}

const BASE_URL = 'http://127.0.0.1:8000/api/v2';

const DEFAULT_AI_MODELS: AIModelOption[] = [
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'Google' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'Google' },
  { id: 'gpt-4.1', name: 'GPT-4.1', provider: 'OpenAI' },
  { id: 'claude-sonnet-4.6', name: 'Claude Sonnet 4.6', provider: 'Anthropic' },
];

export const SetupView: React.FC<SetupViewProps> = ({
  onNavigateStep,
  onProjectUpdated,
  initialData,
}) => {
  const { projectId, setProjectId } = useProject();
  const [setupData, setSetupData] = useState<ProjectSetupData | null>(initialData || null);
  const [aiModels] = useState<AIModelOption[]>(DEFAULT_AI_MODELS);
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const [codeSourceTab, setCodeSourceTab] = useState<'ZIP' | 'GIT'>('ZIP');
  
  const [connectionStatus, setConnectionStatus] = useState<'IDLE' | 'CHECKING' | 'SUCCESS' | 'FAILED'>('IDLE');

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const [specFile, setSpecFile] = useState<File | null>(null);
  const [codeFile, setCodeFile] = useState<File | null>(null);

  const specUpload = useFileUpload({
    accept: '.pdf,.docx,.xlsx',
    onFileSelect: (selectedFile) => {
      setSpecFile(selectedFile);
      const ext = selectedFile.name.split('.').pop() || 'pdf';
      handleUpdateField('specDocument' as any, {
        name: selectedFile.name,
        format: ext,
        pages: 1,
        version: 'v1.0',
      });
    },
  });

  const codeUpload = useFileUpload({
    accept: '.zip',
    onFileSelect: (selectedFile) => {
      setCodeFile(selectedFile);
      handleUpdateField('sourceCode' as any, {
        name: selectedFile.name,
        fileCount: 0,
        snapshotId: 'UPLOAD-' + Date.now().toString().slice(-4),
      });
    },
  });

  useEffect(() => {
    if (!projectId) {
      setSetupData({
        projectName: '',
        techStack: '',
        codeScope: '',
        apiKey: '',
        apiKeyVerified: false,
        selectedModelId: DEFAULT_AI_MODELS[0].id,
      } as unknown as ProjectSetupData);
      setIsLoading(false);
      return;
    }

    Promise.all([
      fetchProjectSetup(projectId),
      fetch(`${BASE_URL}/projects/${projectId}/documents`).then(res => res.json()).catch(() => ({ items: [] })),
      fetch(`${BASE_URL}/projects/${projectId}/code/snapshots`).then(res => res.json()).catch(() => ({ items: [] }))
    ])
      .then(([setup, docsData, codeData]) => {
        if (!initialData) {
          const updatedSetup: any = {
            projectName: '',
            selectedModelId: DEFAULT_AI_MODELS[0].id,
            ...(setup || {})
          };

          if (docsData.items && docsData.items.length > 0) {
            const doc = docsData.items[0];
            updatedSetup.specDocument = {
              name: doc.name || '기존_업로드된_기획서.pdf',
              format: 'pdf',
              pages: 1,
              version: `v${doc.revision || 1}.0`
            };
          }

          if (codeData.items && codeData.items.length > 0) {
            const snap = codeData.items[0];
            updatedSetup.sourceCode = {
              name: '기존_업로드된_소스코드.zip',
              fileCount: snap.file_count || 0,
              snapshotId: snap.id
            };
          }

          setSetupData(updatedSetup as unknown as ProjectSetupData);
        }
      })
      .catch((err) => {
        console.error('설정 데이터 로드 실패:', err);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [initialData, projectId]);

  const currentModel =
    aiModels.find((m) => m.id === setupData?.selectedModelId) || aiModels[0];

  const handleUpdateField = <K extends keyof ProjectSetupData>(
    field: K,
    value: ProjectSetupData[K]
  ) => {
    if (!setupData) return;
    const updated = { ...setupData, [field]: value };
    setSetupData(updated);
    if (field === 'projectName' && typeof value === 'string') {
      onProjectUpdated?.(value);
    }
  };

  const handleVerifyApiKey = async () => {
    setConnectionStatus('CHECKING');

    if (!projectId) {
      setTimeout(() => {
        setConnectionStatus('SUCCESS');
        handleUpdateField('apiKeyVerified' as any, true);
      }, 800);
      return;
    }

    try {
      const res = await fetch(`${BASE_URL}/projects/${projectId}/llm/connection-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config_version: 0 })
      });

      if (res.ok) {
        setConnectionStatus('SUCCESS');
        handleUpdateField('apiKeyVerified' as any, true);
      } else {
        setConnectionStatus('FAILED');
      }
    } catch (error) {
      console.error(error);
      setConnectionStatus('FAILED');
    }
  };

  const handleBypassConnection = () => {
    setConnectionStatus('SUCCESS');
    handleUpdateField('apiKeyVerified' as any, true);
  };

  const handleStartAnalysis = async () => {
    if (!setupData) return;
    setIsSaving(true);
    
    try {
      const response = await saveProjectSetup(setupData);
      
      if (response.success && response.projectId) {
        const newProjectId = response.projectId;

        if (specFile) {
          await uploadDocument(newProjectId, specFile);
        }

        if (codeSourceTab === 'ZIP' && codeFile) {
          const formData = new FormData();
          formData.append('file', codeFile);
          
          const sourceRes = await fetch(`${BASE_URL}/projects/${newProjectId}/code/sources`, {
            method: 'POST',
            body: formData,
          });
          
          if (sourceRes.ok) {
            const sourceData = await sourceRes.json();
            if (sourceData.source_id) {
              await fetch(`${BASE_URL}/projects/${newProjectId}/code/index`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ source_id: sourceData.source_id })
              });
            }
          }
        }

        setProjectId(newProjectId);
        onNavigateStep('ANALYSIS');
      } else {
        alert('프로젝트 생성에 실패했습니다. 백엔드 연결을 확인해 주세요.');
      }
    } catch (error: any) {
      console.error(error);
      alert(`파일 처리 오류: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || !setupData) {
    return (
      <div className="max-w-[1080px] mx-auto py-12 text-center text-xs text-slate-400">
        프로젝트 설정 정보를 불러오는 중입니다...
      </div>
    );
  }

  const isSpecUploaded = !!(setupData as any).specDocument?.name;
  const isSourceUploaded = !!(setupData as any).sourceCode?.name;

  return (
    <div className="max-w-[1080px] mx-auto py-2 px-2 md:px-4 space-y-5">
      <PageHeader
        stepTag="01 / PROJECT SETUP"
        title={setupData.projectName ? '프로젝트 설정' : '새 프로젝트 만들기'}
        description={
          setupData.projectName
            ? '명세 문서와 검증할 코드를 연결하고 분석 범위를 확인하세요.'
            : '먼저 명세와 코드를 연결하세요. 분석 설정은 이후에도 바꿀 수 있습니다.'
        }/>

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
                  value={setupData.projectName || ''}
                  placeholder="프로젝트 이름을 입력하세요"
                  onChange={(e) => handleUpdateField('projectName', e.target.value)}
                />
              </div>

              <input
                type="file"
                ref={specUpload.inputRef}
                onChange={specUpload.handleFileChange}
                accept=".pdf,.docx,.xlsx"
                className="hidden"
              />
              <input
                type="file"
                ref={codeUpload.inputRef}
                onChange={codeUpload.handleFileChange}
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
                        {(setupData as any).specDocument?.name}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {(setupData as any).specDocument?.format?.toUpperCase()} · {(setupData as any).specDocument?.pages ?? 1}페이지 · {(setupData as any).specDocument?.version ?? 'v1.0'}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="md"
                      onClick={specUpload.openFileDialog}
                    >
                      문서 교체
                    </Button>
                  </div>
                ) : (
                  <div
                    onDragOver={specUpload.handleDragOver}
                    onDragLeave={specUpload.handleDragLeave}
                    onDrop={specUpload.handleDrop}
                    className={`border border-dashed rounded-xl py-8 px-4 flex flex-col items-center justify-center text-center space-y-2 transition-colors ${
                      specUpload.isDragging
                        ? 'border-blue-500 bg-blue-50/50'
                        : 'border-slate-200 bg-slate-50/50'
                    }`}
                  >
                    <p className="text-xs font-medium text-slate-700">
                      명세 문서를 여기에 놓으세요
                    </p>
                    <p className="text-[11px] text-slate-400">PDF · DOCX · XLSX</p>
                    <Button
                      type="button"
                      variant="primary"
                      size="md"
                      onClick={specUpload.openFileDialog}
                      className="mt-1"
                    >
                      명세 파일 선택
                    </Button>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className={VIEW_HEADER.fieldLabel}>검증 대상 소스코드</label>
                <div className="flex items-center space-x-1.5">
                  <Button
                    type="button"
                    variant={codeSourceTab === 'ZIP' ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => setCodeSourceTab('ZIP')}
                  >
                    ZIP 업로드
                  </Button>
                  <Button
                    type="button"
                    variant={codeSourceTab === 'GIT' ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => setCodeSourceTab('GIT')}
                  >
                    Git 저장소
                  </Button>
                </div>

                {codeSourceTab === 'ZIP' ? (
                  isSourceUploaded ? (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 mt-2 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-medium text-slate-800">
                          {(setupData as any).sourceCode?.name}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {(setupData as any).sourceCode?.fileCount ? `${(setupData as any).sourceCode.fileCount}개 파일 · ` : ''}코드 스냅샷 {(setupData as any).sourceCode?.snapshotId}
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        size="md"
                        onClick={codeUpload.openFileDialog}
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
                        onClick={codeUpload.openFileDialog}
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

            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className={VIEW_HEADER.fieldLabel}>분석 기술 스택</label>
                  <Input
                    type="text"
                    value={(setupData as any).techStack || ''}
                    onChange={(e) => handleUpdateField('techStack' as any, e.target.value)}
                    placeholder="예: Java · Spring Boot"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className={VIEW_HEADER.fieldLabel}>코드 분석 범위</label>
                  <Input
                    type="text"
                    value={(setupData as any).codeScope || ''}
                    onChange={(e) => handleUpdateField('codeScope' as any, e.target.value)}
                    placeholder="예: src/main/java"
                  />
                </div>
              </div>
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
                    ? 'border-blue-500 ring-2 ring-blue-100'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <span className="font-medium text-slate-800">
                  {currentModel?.name || '모델을 선택하세요'}
                </span>
                <div className="flex items-center space-x-2">
                  <span className="text-[11px] text-slate-400">
                    {currentModel?.provider}
                  </span>
                  <svg
                    className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
                      isDropdownOpen ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {isDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-lg z-20 p-1.5 space-y-1">
                  <div className="px-2 py-1 text-[11px] text-slate-400 font-medium">
                    분석 모델 선택 · 한 번에 1개
                  </div>
                  {aiModels.map((model) => {
                    const isSelected = ((setupData as any).selectedModelId || currentModel?.id) === model.id;
                    return (
                      <button
                        key={model.id}
                        type="button"
                        onClick={() => {
                          handleUpdateField('selectedModelId' as any, model.id);
                          setIsDropdownOpen(false);
                        }}
                        className={`w-full px-3 py-2 text-left rounded-lg text-xs flex items-center justify-between transition-colors ${
                          isSelected
                            ? 'bg-blue-50 text-blue-600 font-semibold'
                            : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div>
                          <div className="font-medium">{model.name}</div>
                          <div className="text-[10px] text-slate-400 font-normal">
                            {model.provider}
                          </div>
                        </div>
                        {isSelected && (
                          <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
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
                value={(setupData as any).apiKey || ''}
                onChange={(e) => {
                  handleUpdateField('apiKey' as any, e.target.value);
                  setConnectionStatus('IDLE');
                }}
                placeholder="제공업체 API 키 입력"
                className="tracking-wider"
              />
            </div>

            {/* 실제 연결 상태에 따른 UI 피드백 및 강제 통과 버튼 */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <span
                  className={`text-[11px] font-medium px-2 py-1 rounded-lg ${
                    connectionStatus === 'SUCCESS' || (setupData as any).apiKeyVerified
                      ? 'bg-emerald-50 text-emerald-600'
                      : connectionStatus === 'FAILED'
                      ? 'bg-rose-50 text-rose-600'
                      : connectionStatus === 'CHECKING'
                      ? 'bg-amber-50 text-amber-600 animate-pulse'
                      : 'bg-blue-50 text-blue-600'
                  }`}
                >
                  {connectionStatus === 'CHECKING'
                    ? '연결 시도 중...'
                    : connectionStatus === 'SUCCESS' || (setupData as any).apiKeyVerified
                    ? '연결 완료'
                    : connectionStatus === 'FAILED'
                    ? '연결 실패'
                    : '연결 확인 필요'}
                </span>

                <div className="flex items-center space-x-1.5">
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    onClick={handleVerifyApiKey}
                    disabled={connectionStatus === 'CHECKING'}
                  >
                    {connectionStatus === 'CHECKING' ? '확인 중...' : '실제 연결 확인'}
                  </Button>
                </div>
              </div>

              {connectionStatus === 'FAILED' && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={handleBypassConnection}
                    className="w-full py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-medium transition-colors border border-slate-300"
                  >
                    🛠️ [시연용] 검증 실패 무시하고 강제 통과하기
                  </button>
                </div>
              )}
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed pt-2 border-t border-slate-100">
              선택한 제공업체의 API 키로 연결을 확인하세요. 모델을 바꿔도 기존 분석 결과는 유지됩니다.
            </p>
          </Card>

          <Card
            title="이후 진행 순서"
            description="등록한 자료를 기준으로 검증을 진행합니다."
            className="flex flex-col justify-between space-y-3 flex-1"
          >
            <div className="space-y-3 pt-1 text-xs">
              <div>
                <div className="font-semibold text-slate-800">1 명세 분석</div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  요구사항과 수락 조건을 검토합니다.
                </div>
              </div>
              <div>
                <div className="font-semibold text-slate-800">2 코드 검증</div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  코드 근거를 보고 차이를 확인합니다.
                </div>
              </div>
              <div>
                <div className="font-semibold text-slate-800">3 테스트 사양서</div>
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
            명세를 분석한 뒤 추출된 요구사항을 검토하세요.
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            검증 항목: 입력값 · 경로 및 이동 · 비즈니스 로직 · 데이터 저장 · 오류 메시지
          </div>
        </div>
        <Button
          type="button"
          variant="primary"
          size="lg"
          onClick={handleStartAnalysis}
          disabled={isSaving}
          className="whitespace-nowrap"
        >
          {isSaving ? '파일 업로드 중...' : '명세 분석 시작'}
        </Button>
      </div>
    </div>
  );
};