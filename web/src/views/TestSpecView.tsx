import React, { useEffect, useState, useCallback } from 'react';
import type { TestSpecificationGroup, TestCaseItem, StepId } from '../types';
import { fetchTestSpecifications } from '../services/api';
import { Button, Card, StatusBadge, EmptyState } from '../components/common';

interface TestSpecViewProps {
  onNavigateStep: (step: StepId) => void;
  selectedRequirementId?: string;
}

// 목업 데이터
const mockTestSpecGroup: TestSpecificationGroup = {
  requirementId: 'REQ-NOTICE-002',
  requirementCode: 'NOTICE-002',
  groupTitle: '공지사항 작성 및 첨부파일 검증',
  totalTests: 3,
  precondition: '관리자 권한 계정 로그인 및 첨부파일 저장소 가용 용량 확보',
  testCases: [
    {
      id: 'TC-NOTICE-002-01',
      testCode: 'TC-NOTICE-002-01',
      title: '정상 첨부파일(50MB 이하) 등록 및 공지 게시',
      status: 'PASSED' as any,
      actualStatus: 'PASSED' as any,
      testType: 'FUNCTIONAL',
      priority: 'HIGH',
      procedure: '1. 제목/본문 입력 -> 2. 30MB PDF 파일 첨부 -> 3. 저장 버튼 클릭',
      inputValue: 'title="시스템 점검 안내", file="guide.pdf (30MB)"',
      expected: '201 Created 응답 반환 및 상세 페이지로 이동, 파일 다운로드 정상 동작',
      codeBasedPrediction: 'NoticeService.java:34 메서드 검증 통과 예상',
    },
    {
      id: 'TC-NOTICE-002-02',
      testCode: 'TC-NOTICE-002-02',
      title: '용량 제한 초과 파일(50MB 초과) 업로드 시 서버 제한 검증',
      status: 'FAILED' as any,
      actualStatus: 'FAILED' as any,
      testType: 'EDGE_CASE',
      priority: 'HIGH',
      procedure: '1. 제목/본문 입력 -> 2. 200MB 동영상 첨부 -> 3. 전송 시도',
      inputValue: 'file="video_manual.mp4 (200MB)"',
      expected: '명세상 300MB까지 허용되어 200MB 정상 업로드 기대',
      codeBasedPrediction: '서버 multipart max-file-size 50MB 제한으로 413 Payload Too Large 발생 예측',
    },
    {
      id: 'TC-NOTICE-002-03',
      testCode: 'TC-NOTICE-002-03',
      title: '필수 입력 항목(제목) 누락 유효성 검사',
      status: 'PASSED' as any,
      actualStatus: 'PASSED' as any,
      testType: 'VALIDATION',
      priority: 'MEDIUM',
      procedure: '1. 제목 공란 유지 -> 2. 본문만 입력 -> 3. 저장 버튼 클릭',
      inputValue: 'title="", content="내용 테스트"',
      expected: '전송 차단 및 "제목을 입력해주세요" 유효성 에러 메시지 노출',
      codeBasedPrediction: 'NoticeRequestDto @NotBlank(title) 유효성 검사 로직 통과',
    },
  ],
};

export const TestSpecView: React.FC<TestSpecViewProps> = ({
  onNavigateStep,
  selectedRequirementId = 'REQ-001',
}) => {
  const [specGroup, setSpecGroup] = useState<TestSpecificationGroup | null>(null);
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isUsingMock, setIsUsingMock] = useState<boolean>(false);

  // API 데이터 로드
  const loadApiData = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchTestSpecifications(selectedRequirementId);
      if (data && data.testCases && data.testCases.length > 0) {
        setSpecGroup(data);
        setActiveCaseId(data.testCases[0].id);
        setIsUsingMock(false);
      } else {
        setSpecGroup(null);
        setActiveCaseId(null);
      }
    } catch (error) {
      console.warn('API 호출 실패 또는 미구현 (목업으로 전환 가능):', error);
      setSpecGroup(null);
      setActiveCaseId(null);
    } finally {
      setIsLoading(false);
    }
  }, [selectedRequirementId]);

  useEffect(() => {
    loadApiData();
  }, [loadApiData]);

  // 목업 토글
  const handleToggleMock = () => {
    if (!isUsingMock) {
      setSpecGroup(mockTestSpecGroup);
      if (mockTestSpecGroup.testCases.length > 0) {
        setActiveCaseId(mockTestSpecGroup.testCases[0].id);
      }
      setIsUsingMock(true);
    } else {
      setIsUsingMock(false);
      loadApiData();
    }
  };

  const activeCase: TestCaseItem | undefined =
    specGroup?.testCases.find((item: TestCaseItem) => item.id === activeCaseId) ||
    specGroup?.testCases[0];

  const handleExport = () => {
    if (!specGroup) return;
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify(specGroup, null, 2)
    )}`;
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', jsonString);
    downloadAnchor.setAttribute(
      'download',
      `test_spec_${specGroup.requirementCode || specGroup.requirementId}.json`
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto py-16 px-6 text-center text-xs text-neutral-400">
        테스트 사양서 데이터를 불러오는 중입니다...
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-8 px-6 space-y-6">
      {/* 상단 헤더 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold text-blue-600 block mb-1">
            04 사양서
          </span>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold text-neutral-800">
              QA 테스트 사양서 명세
            </h1>
            {isUsingMock && (
              <span className="text-[10px] bg-blue-100 text-blue-700 font-semibold px-2 py-0.5 rounded">
                MOCK 데이터 모드
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-neutral-500">
            {specGroup?.groupTitle
              ? `${specGroup.groupTitle} - 요구사항을 바탕으로 자동 구성된 테스트 케이스를 검토합니다.`
              : '검증된 요구사항을 바탕으로 자동 구성된 테스트 케이스와 검증 절차를 검토합니다.'}
          </p>
        </div>

        <div className="flex items-center space-x-2 flex-wrap">
          <Button
            variant="secondary"
            onClick={handleToggleMock}
            className="text-xs"
          >
            {isUsingMock ? '실제 API 재시도' : '목업 데이터 확인'}
          </Button>

          <Button variant="secondary" onClick={() => onNavigateStep('VERIFICATION')}>
            이전 검증 결과
          </Button>
          <Button
            variant="primary"
            onClick={handleExport}
            disabled={!specGroup || !specGroup.testCases || specGroup.testCases.length === 0}
          >
            사양서 JSON 내보내기
          </Button>
        </div>
      </div>

      {!specGroup || !specGroup.testCases || specGroup.testCases.length === 0 ? (
        <EmptyState
          title="생성된 테스트 사양서가 없습니다."
          description="해당 요구사항에 대한 API 응답이 없거나 테스트 사양서가 아직 생성되지 않았습니다."
          action={
            <div className="flex items-center space-x-2">
              <Button
                variant="primary"
                size="sm"
                onClick={handleToggleMock}
              >
                목업 화면으로 확인하기
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onNavigateStep('VERIFICATION')}
              >
                검증 결과로 이동
              </Button>
            </div>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* 사양서 케이스 목록 */}
          <div className="md:col-span-5">
            <Card
              title="테스트 케이스 목록"
              description={`요구사항 [${specGroup.requirementCode || specGroup.requirementId}]에 연결된 케이스`}
              extra={
                <span className="text-xs text-neutral-400">
                  총 {specGroup.totalTests || specGroup.testCases.length}건
                </span>
              }
            >
              <div className="space-y-1.5">
                {specGroup.testCases.map((item: TestCaseItem) => {
                  const isSelected = activeCase?.id === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveCaseId(item.id)}
                      className={`w-full text-left p-3 rounded-md border text-xs transition-colors space-y-1 ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50/50 text-neutral-900'
                          : 'border-neutral-200 hover:bg-neutral-50 text-neutral-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-blue-600">
                          {item.testCode}
                        </span>
                        <StatusBadge status={item.status} />
                      </div>
                      <div className="font-medium truncate">{item.title}</div>
                      <div className="flex items-center space-x-2 text-[11px] text-neutral-400">
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

          {/* 선택된 케이스 상세 명세 */}
          <div className="md:col-span-7">
            {activeCase ? (
              <Card
                title={`[${activeCase.testCode}] 상세 절차`}
                description={activeCase.title}
                extra={<StatusBadge status={activeCase.status} />}
              >
                <div className="space-y-4 text-xs">
                  {/* 사전 조건 */}
                  {specGroup.precondition && (
                    <div className="p-3 bg-neutral-50 rounded-md border border-neutral-100">
                      <span className="font-semibold text-neutral-700 block mb-1">
                        사전 조건 (Precondition)
                      </span>
                      <p className="text-neutral-600 leading-relaxed">
                        {specGroup.precondition}
                      </p>
                    </div>
                  )}

                  {/* 수행 절차 */}
                  <div className="p-3 bg-white rounded-md border border-neutral-200 space-y-1">
                    <span className="font-semibold text-neutral-700 block">
                      수행 절차 (Procedure)
                    </span>
                    <p className="text-neutral-600 leading-relaxed whitespace-pre-line">
                      {activeCase.procedure}
                    </p>
                  </div>

                  {/* 입력값 / 테스트 데이터 */}
                  <div className="p-3 bg-white rounded-md border border-neutral-200 space-y-1">
                    <span className="font-semibold text-neutral-700 block">
                      입력값 / 테스트 파라미터 (Input Value)
                    </span>
                    <div className="font-mono text-[11px] text-slate-700 bg-slate-50 p-2 rounded border border-slate-100 break-all">
                      {activeCase.inputValue}
                    </div>
                  </div>

                  {/* 기대 결과 vs 코드 기반 예측 */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3 bg-emerald-50/50 rounded-md border border-emerald-100 space-y-1">
                      <span className="font-semibold text-emerald-800 block">
                        명세 기준 기대 결과 (Expected)
                      </span>
                      <p className="text-emerald-900 leading-relaxed text-[11px]">
                        {activeCase.expected}
                      </p>
                    </div>

                    <div className="p-3 bg-blue-50/50 rounded-md border border-blue-100 space-y-1">
                      <span className="font-semibold text-blue-800 block">
                        코드 분석 기반 예측 (Prediction)
                      </span>
                      <p className="text-blue-900 leading-relaxed text-[11px]">
                        {activeCase.codeBasedPrediction}
                      </p>
                    </div>
                  </div>

                  {/* 하단 메타 정보 */}
                  <div className="pt-2 border-t border-neutral-100 flex items-center justify-between text-neutral-400 text-[11px]">
                    <span>연결 요구사항 ID: {specGroup.requirementId}</span>
                    <span>판정: {activeCase.actualStatus || activeCase.status}</span>
                  </div>
                </div>
              </Card>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};