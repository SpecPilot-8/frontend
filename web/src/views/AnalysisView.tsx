import React, { useState, useMemo } from 'react';
import type { StepId, RequirementItem, AcceptanceCriteria } from '../types';
import { fetchRequirements } from '../services/api';
import { Button, Card, Input, StatusBadge } from '../components/common';
import { VIEW_HEADER } from '../styles/typography';

interface AnalysisViewProps {
  onNavigateStep: (step: StepId) => void;
  specDocumentName?: string;
  specVersion?: string;
}

export const AnalysisView: React.FC<AnalysisViewProps> = ({
  onNavigateStep,
  specDocumentName = '한성대_specpilot_기획서_v0.2.pdf',
  specVersion = 'v0.2',
}) => {
  const [requirements, setRequirements] = useState<RequirementItem[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // 화면 모드 상태
  const [viewMode, setViewMode] = useState<'VIEW' | 'ADD' | 'EDIT'>('ADD');

  // 입력 폼 상태
  const [formReqId, setFormReqId] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formActor, setFormActor] = useState('관리자');
  const [formCondition, setFormCondition] = useState('');
  const [formAction, setFormAction] = useState('');
  const [formExpected, setFormExpected] = useState('');

  // 목업 데이터 로드 및 초기화 토글
  const handleToggleMockData = () => {
    if (requirements.length > 0) {
      setRequirements([]);
      setSelectedId('');
      setViewMode('ADD');
    } else {
      setIsLoading(true);
      fetchRequirements()
        .then((data) => {
          setRequirements(data);
          if (data.length > 0) {
            const defaultItem = data.find((r) => r.reqCode === 'NOTICE-002') || data[0];
            setSelectedId(defaultItem.id);
            setViewMode('VIEW');
          }
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  };

  // 검색어 필터링
  const filteredRequirements = useMemo(() => {
    if (!searchQuery.trim()) return requirements;
    const query = searchQuery.toLowerCase();
    return requirements.filter(
      (r) =>
        r.reqCode.toLowerCase().includes(query) ||
        r.title.toLowerCase().includes(query)
    );
  }, [requirements, searchQuery]);

  const selectedReq = requirements.find((r) => r.id === selectedId) || filteredRequirements[0];

  const completedCount = requirements.filter(
    (r) => r.status === 'VERIFIED' || r.status === 'COMPLETED'
  ).length;

  // 수정 모드 진입
  const handleStartEdit = () => {
    if (!selectedReq) return;
    setFormReqId(selectedReq.reqCode);
    setFormTitle(selectedReq.title);
    setFormDesc(selectedReq.originalText || selectedReq.description || '');
    setFormLocation(selectedReq.sourcePage || '문서 8페이지');
    setFormActor(selectedReq.actor || '관리자');
    setFormCondition(selectedReq.condition || '');
    setFormAction(selectedReq.action || '');
    setFormExpected(selectedReq.expectedResult || '');
    setViewMode('EDIT');
  };

  // 등록 모드 진입
  const handleStartAdd = () => {
    setFormReqId(`NOTICE-00${requirements.length + 1}`);
    setFormTitle('');
    setFormDesc('');
    setFormLocation('문서 8페이지');
    setFormActor('관리자');
    setFormCondition('');
    setFormAction('');
    setFormExpected('');
    setViewMode('ADD');
  };

  // 요구사항 저장 및 등록
  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;

    if (viewMode === 'EDIT' && selectedReq) {
      const updatedList = requirements.map((item) => {
        if (item.id === selectedReq.id) {
          return {
            ...item,
            reqCode: formReqId.trim() || item.reqCode,
            title: formTitle,
            description: formDesc,
            originalText: formDesc,
            sourcePage: formLocation,
            actor: formActor,
            condition: formCondition,
            action: formAction,
            expectedResult: formExpected,
          };
        }
        return item;
      });
      setRequirements(updatedList);
      setViewMode('VIEW');
    } else {
      const defaultCriteria: AcceptanceCriteria[] = [
        {
          id: `AC-${Date.now()}-1`,
          category: '입력값 검증',
          description: '필수 입력 항목 검증',
          count: 3,
        },
        {
          id: `AC-${Date.now()}-2`,
          category: '경로 및 이동',
          description: '등록 API 호출 · 완료 후 목록 이동',
          count: 3,
        },
        {
          id: `AC-${Date.now()}-3`,
          category: '비즈니스 로직',
          description: formDesc || '권한 및 업무 규칙 검증',
          count: 3,
        },
      ];

      const newReq: RequirementItem = {
        id: `REQ-${Date.now().toString().slice(-4)}`,
        reqCode: formReqId.trim() || `NOTICE-00${requirements.length + 1}`,
        title: formTitle,
        description: formDesc,
        originalText: formDesc || '입력된 원문 내용이 없습니다.',
        sourceDoc: specDocumentName,
        sourcePage: formLocation || '문서 8페이지',
        category: '기능 요구사항',
        status: 'PENDING',
        reviewStatus: 'UNREVIEWED',
        actor: formActor || '관리자',
        condition: formCondition || '첨부파일 ≤ 300MB',
        action: formAction || formTitle,
        expectedResult: formExpected || '목록으로 이동',
        criteria: defaultCriteria,
        acceptanceCriteria: defaultCriteria,
      };

      setRequirements((prev) => [newReq, ...prev]);
      setSelectedId(newReq.id);
      setViewMode('VIEW');
    }
  };

  // 로딩 화면
  if (isLoading) {
    return (
      <div className="max-w-[1180px] mx-auto py-12 text-center text-xs text-slate-400">
        요구사항 명세를 불러오는 중입니다...
      </div>
    );
  }

  // 등록 화면
  if (viewMode === 'ADD' || requirements.length === 0) {
    return (
      <div className="max-w-[1180px] mx-auto py-2 px-2 md:px-4 space-y-4">
        <div>
          <span className={VIEW_HEADER.stepTag}>02 / REQUIREMENT ANALYSIS</span>
          <h1 className={VIEW_HEADER.title}>요구사항을 등록해 주세요</h1>
          <p className={VIEW_HEADER.desc}>
            명세를 자동 분석하거나, 원문을 보면서 요구사항을 직접 입력할 수 있습니다.
          </p>
        </div>

        {/* 연결 안내 배너 */}
        <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-4 text-xs">
          <div className="font-semibold text-amber-800">
            AI 분석 서비스에 연결하지 못했습니다.
          </div>
          <div className="text-amber-700/90 text-[11px] mt-0.5">
            연결 상태를 확인하거나 요구사항을 직접 입력해 검토를 계속하세요.
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          {/* 입력 폼 */}
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
                  <label className={VIEW_HEADER.fieldLabel}>
                    명세 원문 또는 요구사항 설명
                  </label>
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
                    <Input
                      type="text"
                      disabled
                      value="검토 필요"
                    />
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                  <span className="text-[11px] text-slate-400">
                    수락 조건은 추가 후 편집할 수 있습니다.
                  </span>
                  <div className="flex items-center space-x-2">
                    {requirements.length > 0 && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="md"
                        onClick={() => setViewMode('VIEW')}
                      >
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

          {/* 안내 및 설정 패널 */}
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
                    variant="secondary"
                    size="md"
                    onClick={() => onNavigateStep('SETUP')}
                    className="w-full"
                  >
                    프로젝트 설정 열기
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="md"
                    onClick={handleToggleMockData}
                    className="w-full bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200"
                  >
                    목업 데이터로 화면 확인
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

  // 수정 화면
  if (viewMode === 'EDIT' && selectedReq) {
    return (
      <div className="max-w-[1180px] mx-auto py-2 px-2 md:px-4 space-y-4">
        <div>
          <span className={VIEW_HEADER.stepTag}>02 / REQUIREMENT ANALYSIS</span>
          <h1 className={VIEW_HEADER.title}>요구사항 수정</h1>
          <p className={VIEW_HEADER.desc}>
            원문 내용과 구조화된 수락 조건 속성을 수정합니다.
          </p>
        </div>

        <Card>
          <form onSubmit={handleSubmitForm} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className={VIEW_HEADER.fieldLabel}>요구사항 ID</label>
                <Input
                  type="text"
                  value={formReqId}
                  onChange={(e) => setFormReqId(e.target.value)}
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
                onChange={(e) => setFormDesc(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 resize-none"
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
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => setViewMode('VIEW')}
              >
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

  // 상세 조회 화면
  return (
    <div className="max-w-[1180px] mx-auto py-2 px-2 md:px-4 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <span className={VIEW_HEADER.stepTag}>02 / REQUIREMENT ANALYSIS</span>
          <h1 className={VIEW_HEADER.title}>명세 분석</h1>
          <p className={VIEW_HEADER.desc}>
            원문에서 추출한 요구사항과 수락 조건을 확인하고 확정하세요.
          </p>
        </div>
        <div className="flex items-center space-x-2 self-start sm:self-center">
          <Button
            type="button"
            variant="ghost"
            size="md"
            onClick={handleToggleMockData}
          >
            목업 비우기
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={handleStartAdd}
          >
            + 새 요구사항 등록
          </Button>
          <Button
            type="button"
            variant="primary"
            size="lg"
            onClick={() => onNavigateStep('VERIFICATION')}
            className="whitespace-nowrap"
          >
            확정한 명세로 검증
          </Button>
        </div>
      </div>

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
        {/* 목록 패널 */}
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

              <div className="space-y-1.5 max-h-[480px] overflow-y-auto pr-1">
                {filteredRequirements.map((item) => {
                  const isSelected = selectedReq?.id === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setSelectedId(item.id);
                        setViewMode('VIEW');
                      }}
                      className={`w-full text-left p-3 rounded-xl transition-all ${
                        isSelected
                          ? 'bg-blue-50/80 border border-blue-200/70 text-blue-600'
                          : 'bg-white hover:bg-slate-50 border border-transparent text-slate-700'
                      }`}
                    >
                      <div className="text-xs font-bold leading-tight">
                        {item.reqCode}
                      </div>
                      <div className="text-xs font-medium text-slate-800 mt-1 truncate">
                        {item.title}
                      </div>
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

        {/* 상세 정보 패널 */}
        {selectedReq && (
          <div className="lg:col-span-8">
            <Card className="flex flex-col justify-between h-full space-y-5">
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      {selectedReq.reqCode} · {selectedReq.title}
                    </h2>
                    <p className="text-[11px] text-slate-400 mt-1">
                      문서 {selectedReq.sourcePage} · {selectedReq.category}
                    </p>
                  </div>
                  <StatusBadge status="검토 완료" />
                </div>

                <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-4 space-y-1">
                  <span className="text-[11px] font-semibold text-slate-400 block">
                    명세 원문
                  </span>
                  <p className="text-xs text-slate-700 leading-relaxed font-normal">
                    {selectedReq.originalText || selectedReq.description}
                  </p>
                </div>

                {/* 핵심 속성 */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                  <div className="bg-slate-50/70 border border-slate-200/60 rounded-xl p-3">
                    <span className="text-[10px] text-slate-400 block mb-0.5">
                      행위자
                    </span>
                    <span className="text-xs font-semibold text-slate-800">
                      {selectedReq.actor || '관리자'}
                    </span>
                  </div>
                  <div className="bg-slate-50/70 border border-slate-200/60 rounded-xl p-3">
                    <span className="text-[10px] text-slate-400 block mb-0.5">
                      조건
                    </span>
                    <span className="text-xs font-semibold text-slate-800 truncate block">
                      {selectedReq.condition || '첨부파일 ≤ 300MB'}
                    </span>
                  </div>
                  <div className="bg-slate-50/70 border border-slate-200/60 rounded-xl p-3">
                    <span className="text-[10px] text-slate-400 block mb-0.5">
                      동작
                    </span>
                    <span className="text-xs font-semibold text-slate-800 truncate block">
                      {selectedReq.action || '공지사항 등록'}
                    </span>
                  </div>
                  <div className="bg-slate-50/70 border border-slate-200/60 rounded-xl p-3">
                    <span className="text-[10px] text-slate-400 block mb-0.5">
                      기대 결과
                    </span>
                    <span className="text-xs font-semibold text-slate-800 truncate block">
                      {selectedReq.expectedResult || '목록으로 이동'}
                    </span>
                  </div>
                </div>

                {/* 수락 조건 */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-900">수락 조건</h3>
                    <span className="text-[11px] text-slate-400">
                      {selectedReq.acceptanceCriteria?.length ?? 5}개 항목
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {(selectedReq.acceptanceCriteria || []).map(
                      (ac: AcceptanceCriteria, idx: number) => (
                        <div
                          key={ac.id || idx}
                          className="bg-slate-50/60 border border-slate-200/50 rounded-xl px-4 py-2.5 flex flex-col sm:flex-row sm:items-center text-xs gap-2"
                        >
                          <span className="font-semibold text-slate-600 sm:w-28 shrink-0">
                            {ac.category} {ac.count ? `(${ac.count})` : ''}
                          </span>
                          <span className="text-slate-700 flex-1">
                            {ac.description}
                          </span>
                        </div>
                      )
                    )}
                  </div>
                </div>
              </div>

              {/* 하단 제어 바 */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-600">
                  검토 상태: 확정됨
                </span>
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={handleStartEdit}
                >
                  요구사항 수정
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};