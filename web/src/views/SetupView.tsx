import React, { useState, useEffect } from 'react';
import type { StepId, AIModelOption, ProjectSetupData } from '../types';
import { fetchAIModels, fetchProjectSetup } from '../services/api';
import { useFileUpload } from '../hooks';
import { Button, Card, Input } from '../components/common';
import { VIEW_HEADER } from '../styles/typography';

interface SetupViewProps {
  onNavigateStep: (step: StepId) => void;
  onProjectUpdated?: (projectName: string) => void;
  initialData?: ProjectSetupData;
}

export const SetupView: React.FC<SetupViewProps> = ({
  onNavigateStep,
  onProjectUpdated,
  initialData,
}) => {
  const [setupData, setSetupData] = useState<ProjectSetupData | null>(initialData || null);
  const [aiModels, setAiModels] = useState<AIModelOption[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const [codeSourceTab, setCodeSourceTab] = useState<'ZIP' | 'GIT'>('ZIP');
  const [isApiKeyChecked, setIsApiKeyChecked] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(!initialData);

  // 명세서 파일 업로드 Hook
  const specUpload = useFileUpload({
    accept: '.pdf,.docx,.xlsx',
    onFileSelect: (selectedFile) => {
      const ext = selectedFile.name.split('.').pop() || 'pdf';
      handleUpdateField('specDocument', {
        name: selectedFile.name,
        format: ext,
        pages: 1,
        version: 'v1.0',
      });
    },
  });

  // 소스코드 ZIP 업로드 Hook
  const codeUpload = useFileUpload({
    accept: '.zip',
    onFileSelect: (selectedFile) => {
      handleUpdateField('sourceCode', {
        name: selectedFile.name,
        fileCount: 0,
        snapshotId: 'UPLOAD-' + Date.now().toString().slice(-4),
      });
    },
  });

  useEffect(() => {
    Promise.all([fetchAIModels(), fetchProjectSetup()])
      .then(([models, setup]) => {
        setAiModels(models);
        if (!initialData) {
          setSetupData(setup);
        }
      })
      .catch((err) => {
        console.error('설정 데이터 로드 실패:', err);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [initialData]);

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

  if (isLoading || !setupData) {
    return (
      <div className="max-w-[1080px] mx-auto py-12 text-center text-xs text-slate-400">
        프로젝트 설정 정보를 불러오는 중입니다...
      </div>
    );
  }

  const isSpecUploaded = !!setupData.specDocument?.name;
  const isSourceUploaded = !!setupData.sourceCode?.name;

  return (
    <div className="max-w-[1080px] mx-auto py-2 px-2 md:px-4 space-y-5">
      <div>
        <span className={VIEW_HEADER.stepTag}>01 / PROJECT SETUP</span>
        <h1 className={VIEW_HEADER.title}>
          {setupData.projectName ? '프로젝트 설정' : '새 프로젝트 만들기'}
        </h1>
        <p className={VIEW_HEADER.desc}>
          {setupData.projectName
            ? '명세 문서와 검증할 코드를 연결하고 분석 범위를 확인하세요.'
            : '먼저 명세와 코드를 연결하세요. 분석 설정은 이후에도 바꿀 수 있습니다.'}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* 프로젝트와 분석 자료 */}
        <div className="lg:col-span-8">
          <Card
            title="프로젝트와 분석 자료"
            description="문서·코드·설정을 한 곳에서 관리합니다."
            className="flex flex-col justify-between space-y-5 h-full"
          >
            <div className="space-y-5">
              {/* 프로젝트 이름 */}
              <div className="space-y-1.5">
                <label className={VIEW_HEADER.fieldLabel}>프로젝트 이름</label>
                <Input
                  type="text"
                  value={setupData.projectName || ''}
                  placeholder="프로젝트 이름을 입력하세요"
                  onChange={(e) => handleUpdateField('projectName', e.target.value)}
                />
              </div>

              {/* 숨겨진 파일 Input들 */}
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

              {/* 명세 문서 영역 */}
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
                        {setupData.specDocument?.name}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {setupData.specDocument?.format?.toUpperCase()} · {setupData.specDocument?.pages ?? 1}페이지 · {setupData.specDocument?.version ?? 'v1.0'}
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

              {/* 검증 대상 소스코드 영역 */}
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
                          {setupData.sourceCode?.name}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {setupData.sourceCode?.fileCount ? `${setupData.sourceCode.fileCount}개 파일 · ` : ''}코드 스냅샷 {setupData.sourceCode?.snapshotId}
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

            {/* 분석 기술 스택 및 코드 분석 범위 */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className={VIEW_HEADER.fieldLabel}>분석 기술 스택</label>
                  <Input
                    type="text"
                    value={setupData.techStack || ''}
                    onChange={(e) => handleUpdateField('techStack', e.target.value)}
                    placeholder="예: Java · Spring Boot"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className={VIEW_HEADER.fieldLabel}>코드 분석 범위</label>
                  <Input
                    type="text"
                    value={setupData.codeScope || ''}
                    onChange={(e) => handleUpdateField('codeScope', e.target.value)}
                    placeholder="예: src/main/java"
                  />
                </div>
              </div>
              {setupData.excludePatterns && (
                <p className="text-[11px] text-slate-400">
                  제외: {setupData.excludePatterns.join(' / ')}
                </p>
              )}
            </div>
          </Card>
        </div>

        <div className="lg:col-span-4 flex flex-col justify-between gap-5 h-full">
          {/* AI 모델 연결 카드 */}
          <Card
            title="AI 모델 연결"
            description="분석에 사용할 모델의 연결 상태를 확인합니다."
            className="space-y-4"
          >
            {/* 모델 드롭다운 */}
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
                    const isSelected = (setupData.selectedModelId || currentModel?.id) === model.id;
                    return (
                      <button
                        key={model.id}
                        type="button"
                        onClick={() => {
                          handleUpdateField('selectedModelId', model.id);
                          setIsDropdownOpen(false);
                        }}
                        className={`w-full px-3 py-2 text-left rounded-lg text-xs flex items-center justify-between transition-colors ${
                          isSelected
                            ? 'bg-blue-50 text-blue-600 font-semibold'
                            : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div>
                          <div>{model.name}</div>
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

            {/* API 키 */}
            <div className="space-y-1.5">
              <label className={VIEW_HEADER.fieldLabel}>API 키</label>
              <Input
                type="password"
                value={setupData.apiKey || ''}
                onChange={(e) => {
                  handleUpdateField('apiKey', e.target.value);
                  setIsApiKeyChecked(false);
                }}
                placeholder="제공업체 API 키 입력"
                className="tracking-wider"
              />
            </div>

            {/* 연결 확인 상태 */}
            <div className="flex items-center justify-between pt-1">
              <span
                className={`text-[11px] font-medium px-2 py-1 rounded-lg ${
                  isApiKeyChecked || setupData.apiKeyVerified
                    ? 'bg-emerald-50 text-emerald-600'
                    : 'bg-blue-50 text-blue-600'
                }`}
              >
                {isApiKeyChecked || setupData.apiKeyVerified ? '연결 완료' : '연결 확인 필요'}
              </span>
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => {
                  setIsApiKeyChecked(true);
                  handleUpdateField('apiKeyVerified', true);
                }}
              >
                연결 확인
              </Button>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed pt-2 border-t border-slate-100">
              선택한 제공업체의 API 키로 연결을 확인하세요. 모델을 바꿔도 기존 분석 결과는 유지됩니다.
            </p>
          </Card>

          {/* 이후 진행 순서 카드 */}
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

      {/* 하단 액션 배너 */}
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
          onClick={() => onNavigateStep('ANALYSIS')}
          className="whitespace-nowrap"
        >
          명세 분석 시작
        </Button>
      </div>
    </div>
  );
};