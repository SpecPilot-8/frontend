import React, { useState, useEffect, useMemo } from 'react';
import type { StepId, RequirementItem, ProjectSetupData } from '../types';
import { fetchRequirements, fetchProjectSetup } from '../services/api';
import { useProject } from '../contexts/ProjectContext';
import { Button, Card, Input, StatusBadge, PageHeader } from '../components/common';

interface VerificationViewProps {
  onNavigateStep: (step: StepId) => void;
  onSelectRequirementForTest?: (reqId: string) => void;
  requirementsData?: RequirementItem[];
  setupData?: ProjectSetupData;
}

export type VerificationStatus =
  | 'IMPLEMENTED'
  | 'PARTIAL'
  | 'MISMATCHED'
  | 'UNIMPLEMENTED'
  | 'NEED_CHECK';

export interface TraceabilityRow {
  stable_key: string;
  featureName: string;
  status: VerificationStatus;
  statusLabel: string;
  linkedCode: string;
  summary: string;
}

const mockTraceabilityRows: TraceabilityRow[] = [
  {
    stable_key: 'NOTICE-001',
    featureName: '공지사항 목록 조회',
    status: 'IMPLEMENTED',
    statusLabel: '구현',
    linkedCode: 'NoticeQueryService.java:22',
    summary: '조회 조건과 응답 구조가 일치합니다.',
  },
  {
    stable_key: 'NOTICE-002',
    featureName: '공지사항 작성',
    status: 'MISMATCHED',
    statusLabel: '불일치',
    linkedCode: 'NoticeService.java:34',
    summary: '명세 300MB · 서버 제한 50MB',
  },
  {
    stable_key: 'NOTICE-003',
    featureName: '공지사항 수정',
    status: 'PARTIAL',
    statusLabel: '부분구현',
    linkedCode: 'NoticeService.java:76',
    summary: '첨부파일 교체 시 이전 파일 정리 누락',
  },
  {
    stable_key: 'LOGIN-002',
    featureName: '소셜 로그인',
    status: 'NEED_CHECK',
    statusLabel: '확인 필요',
    linkedCode: 'OAuthService.java:18',
    summary: '외부 인증 응답에 대한 근거 확인 필요',
  },
  {
    stable_key: 'LOGIN-003',
    featureName: '회원가입',
    status: 'MISMATCHED',
    statusLabel: '불일치',
    linkedCode: 'AuthService.java:42',
    summary: '중복 이메일에 대한 안내가 없습니다.',
  },
  {
    stable_key: 'USER-001',
    featureName: '프로필 변경',
    status: 'UNIMPLEMENTED',
    statusLabel: '미구현 후보',
    linkedCode: '연결된 코드 없음',
    summary: '분석 범위 안에서 관련 코드를 찾지 못함',
  },
];

const BASE_URL = 'http://127.0.0.1:8000/api/v2';

export const VerificationView: React.FC<VerificationViewProps> = ({
  onNavigateStep,
  onSelectRequirementForTest,
  requirementsData,
  setupData,
}) => {
  const { projectId } = useProject();

  const [projectSetup, setProjectSetup] = useState<ProjectSetupData | null>(setupData || null);
  const [requirementsList, setRequirementsList] = useState<RequirementItem[]>(requirementsData || []);
  const [isVerified, setIsVerified] = useState<boolean>(false);
  const [tableData, setTableData] = useState<TraceabilityRow[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [sourceData, setSourceData] = useState<any>(null);

  useEffect(() => {
    if (!projectId) return;

    const forceLoadData = async () => {
      try {
        const [setupRes, reqRes, srcRes, verifyRes] = await Promise.all([
          fetchProjectSetup(projectId),
          fetchRequirements(projectId),
          // 수정 1: 실제 스냅샷 조회 API 경로 적용
          fetch(`${BASE_URL}/projects/${projectId}/code/snapshots`).then(res => res.json()).catch(() => ({ items: [] })),
          fetch(`${BASE_URL}/projects/${projectId}/verification/results`).then(res => res.json()).catch(() => ({ items: [] }))
        ]);

        if (setupRes) setProjectSetup(setupRes);
        if (reqRes) setRequirementsList(reqRes);
        
        if (srcRes && srcRes.items && srcRes.items.length > 0) {
          setSourceData(srcRes.items[0]);
        } else {
          setSourceData(null);
        }

        if (verifyRes && verifyRes.items && verifyRes.items.length > 0) {
          const formattedData = verifyRes.items.map((item: any) => ({
            stable_key: item.stable_key,
            featureName: item.feature_name || '기능명 없음',
            status: item.status,
            statusLabel: getStatusLabel(item.status),
            linkedCode: item.linked_code || '연결 코드 없음',
            summary: item.summary || '요약 정보 없음'
          }));
          setTableData(formattedData);
          setIsVerified(true);
        } else {
          setIsVerified(false);
        }
      } catch (error) {
        console.error('검증 초기 데이터 강제 로딩 에러:', error);
      }
    };

    forceLoadData();
  }, [projectId]);

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'IMPLEMENTED': return '구현';
      case 'PARTIAL': return '부분구현';
      case 'MISMATCHED': return '불일치';
      case 'UNIMPLEMENTED': return '미구현 후보';
      case 'NEED_CHECK': return '확인 필요';
      default: return '상태 불명';
    }
  };

  // 우회 로직 제거 및 백엔드 정식 검증 파이프라인 개통
  const handleStartVerification = async () => {
    if (!projectId) return;
    setIsLoading(true);

    try {
      const directCodeRes = await fetch(`${BASE_URL}/projects/${projectId}/code/snapshots`);
      const directCodeData = await directCodeRes.json();
      
      if (!directCodeData.items || directCodeData.items.length === 0) {
        alert('백엔드에 등록된 소스코드 스냅샷이 없습니다.\n1. 좌측 메뉴 [01 프로젝트 설정]으로 이동\n2. ZIP 파일 선택\n3. 화면 맨 아래 [명세 분석 시작]을 눌러 스냅샷을 생성해 주세요.');
        setIsLoading(false);
        return;
      }

      const snapshotId = directCodeData.items[0].id;
      setSourceData(directCodeData.items[0]);

      const reqsToVerify = requirementsList.filter(r => r.review_status === 'approved');

      if (reqsToVerify.length === 0) {
        alert('검토 확정(approved)된 요구사항이 한 건도 없습니다. 이전 화면에서 요구사항을 먼저 확정해 주세요.');
        setIsLoading(false);
        return;
      }

      // 수정 2: 정식 백엔드 규격에 맞춘 검증 실행(Run) 통신
      const verifyRes = await fetch(`${BASE_URL}/projects/${projectId}/verification-runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          snapshot_id: snapshotId,
          requirement_versions: reqsToVerify.map(r => ({ requirement_id: r.id, revision: (r as any).revision || 1 })),
          model_config_version: 0
        })
      });

      const verifyJob = await verifyRes.json();

      if (verifyJob.status === 'blocked' || verifyJob.status === 'failed') {
        alert(`[백엔드 검증 차단됨]\n사유: ${verifyJob.missing_features?.[0]?.message || 'AI 모델 어댑터 미연결'}\n\n코드 검증은 AI 모델이 필수적이므로 더 이상 진행할 수 없습니다.`);
      } else {
        alert('AI 코드 검증 작업이 백그라운드에서 시작되었습니다.');
      }
    } catch (error) {
      console.error(error);
      alert('검증 요청 중 통신 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleMockView = () => {
    if (!isVerified) {
      setTableData(mockTraceabilityRows);
      setIsVerified(true);
    } else {
      setTableData([]);
      setIsVerified(false);
    }
  };

  const confirmedRequirementsCount = useMemo(() => {
    return requirementsList.filter(
      (r) => r.review_status === 'approved'
    ).length;
  }, [requirementsList]);

  const requirementStatusText = confirmedRequirementsCount > 0 ? '검토 완료' : '검토 필요';
  const requirementCountText = `확정 ${confirmedRequirementsCount || requirementsList.length}개`;

  const isSourceConnected = !!sourceData?.id;
  const sourceSnapshotId = sourceData?.id || '스냅샷 미지정';
  const sourceStatusText = isSourceConnected ? '연결됨' : '보류';

  const verificationRunStatus = isVerified ? '실행 완료' : '미실행';
  const verificationAnalysisStatus = isVerified ? '분석 완료' : '미분석';

  const specVersionLabel = projectSetup?.specDocument?.version || 'v0.2';
  const snapshotLabel = sourceData?.id || 'S-014';

  const filteredData = useMemo(() => {
    return tableData.filter((row) => {
      const matchSearch =
        row.stable_key.toLowerCase().includes(searchQuery.toLowerCase()) ||
        row.featureName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        row.linkedCode.toLowerCase().includes(searchQuery.toLowerCase());
      const matchStatus =
        selectedStatusFilter === 'ALL' || row.status === selectedStatusFilter;
      return matchSearch && matchStatus;
    });
  }, [tableData, searchQuery, selectedStatusFilter]);

  const stats = useMemo(() => {
    const implemented = tableData.filter((r) => r.status === 'IMPLEMENTED').length;
    const partial = tableData.filter((r) => r.status === 'PARTIAL').length;
    const mismatched = tableData.filter((r) => r.status === 'MISMATCHED').length;
    const unimplemented = tableData.filter((r) => r.status === 'UNIMPLEMENTED').length;
    const needCheck = tableData.filter((r) => r.status === 'NEED_CHECK').length;
    const total = tableData.length;
    const matchPercentage = total > 0 ? ((implemented / total) * 100).toFixed(1) : '0.0';

    return {
      implemented,
      partial,
      mismatched,
      unimplemented,
      needCheck,
      total,
      matchPercentage,
    };
  }, [tableData]);

  if (!isVerified) {
    return (
      <div className="max-w-[1180px] mx-auto py-2 px-2 md:px-4 space-y-4">
        <PageHeader
          stepTag="03 / VERIFICATION RESULTS"
          title="검증 결과를 아직 만들지 못했습니다."
          description="검증이 완료되면 요구사항별 구현 상태와 코드 근거가 여기에 표시됩니다."
        />

        <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-4 text-xs">
          <div className="font-semibold text-amber-800">
            코드 검증 서비스를 사용할 수 없습니다.
          </div>
          <div className="text-amber-700/90 text-[11px] mt-0.5">
            프로젝트의 코드와 모델 연결을 확인한 뒤 다시 시도해 주세요.
          </div>
        </div>

        <Card
          title="분석할 자료는 준비되어 있습니다."
          description="현재는 구현 여부를 판단할 수 없는 상태입니다."
          className="space-y-5"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-50/70 border border-slate-200/60 rounded-xl p-4 space-y-1.5">
              <span className="text-xs font-bold text-slate-800">요구사항</span>
              <div className="text-xs text-slate-600">{requirementCountText}</div>
              <div className="pt-1">
                <StatusBadge status={requirementStatusText} />
              </div>
            </div>

            <div className="bg-slate-50/70 border border-slate-200/60 rounded-xl p-4 space-y-1.5">
              <span className="text-xs font-bold text-slate-800">소스코드</span>
              <div className="text-xs text-slate-600 truncate">{sourceSnapshotId}</div>
              <div className="pt-1">
                <StatusBadge status={sourceStatusText === '연결됨' ? '완료' : '보류'} />
              </div>
            </div>

            <div className="bg-slate-50/70 border border-slate-200/60 rounded-xl p-4 space-y-1.5">
              <span className="text-xs font-bold text-slate-800">검증 결과</span>
              <div className="text-xs text-slate-600">{verificationRunStatus}</div>
              <div className="pt-1">
                <span className="text-[10px] text-slate-400">
                  {verificationAnalysisStatus}
                </span>
              </div>
            </div>
          </div>

          <div className="text-[11px] text-slate-400">
            검증 전에는 정합률이나 미구현 수를 계산하지 않습니다.
          </div>

          <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100">
            <div className="flex items-center space-x-2">
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={() => onNavigateStep('SETUP')}
              >
                연결 설정 확인
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => onNavigateStep('ANALYSIS')}
              >
                요구사항 확인
              </Button>
              <Button
                type="button"
                variant="primary"
                size="md"
                className="bg-blue-600 text-white"
                onClick={handleStartVerification}
              >
                {isLoading ? '검증 분석 중...' : '다시 검증 (AI 요청)'}
              </Button>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={handleToggleMockView}
              className="bg-blue-50 text-blue-600 hover:bg-blue-100"
            >
              목업 결과 화면 확인
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-[1180px] mx-auto py-2 px-2 md:px-4 space-y-4">
      <PageHeader
        stepTag="03 / VERIFICATION RESULTS"
        title="검증 결과"
        description={`확정한 요구사항 ${stats.total}개를 코드 ${snapshotLabel}와 비교했습니다.`}
        action={
          <Button
            type="button"
            variant="primary"
            size="lg"
            onClick={() => {
              if (onSelectRequirementForTest && tableData.length > 0) {
                onSelectRequirementForTest(tableData[0].stable_key);
              }
              onNavigateStep('TEST_SPEC');
            }}
            className="whitespace-nowrap"
          >
            테스트 사양서
          </Button>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm">
          <div className="text-[11px] text-slate-500">구현</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{stats.implemented}</div>
          <div className="text-[10px] text-slate-400 mt-1">명세와 일치</div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm">
          <div className="text-[11px] text-slate-500">부분구현</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{stats.partial}</div>
          <div className="text-[10px] text-slate-400 mt-1">일부 조건 누락</div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm">
          <div className="text-[11px] text-slate-500">불일치</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{stats.mismatched}</div>
          <div className="text-[10px] text-slate-400 mt-1">명세와 코드 상충</div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm">
          <div className="text-[11px] text-slate-500">미구현 후보</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{stats.unimplemented}</div>
          <div className="text-[10px] text-slate-400 mt-1">연결 코드 미발견</div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm col-span-2 sm:col-span-1">
          <div className="text-[11px] text-slate-500">확인 필요</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{stats.needCheck}</div>
          <div className="text-[10px] text-slate-400 mt-1">근거 추가 검토</div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">요구사항 추적표</h2>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="요구사항 ID · 기능 · 파일 검색"
              className="w-52"
            />

            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="px-2.5 py-2 text-xs border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-blue-500 bg-white"
            >
              <option value="ALL">상태: 전체</option>
              <option value="IMPLEMENTED">구현</option>
              <option value="PARTIAL">부분구현</option>
              <option value="MISMATCHED">불일치</option>
              <option value="UNIMPLEMENTED">미구현 후보</option>
              <option value="NEED_CHECK">확인 필요</option>
            </select>

            <Button type="button" variant="secondary" size="md">
              추적표 내보내기
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-100 text-[11px] font-semibold text-slate-500">
                <th className="py-2.5 px-4 w-28">요구사항</th>
                <th className="py-2.5 px-4 w-40">기능</th>
                <th className="py-2.5 px-4 w-24">상태</th>
                <th className="py-2.5 px-4 w-52">연결된 코드</th>
                <th className="py-2.5 px-4">진단 요약</th>
                <th className="py-2.5 px-4 w-20 text-right">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredData.map((row) => (
                <tr key={row.stable_key} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3 px-4 font-mono font-bold text-blue-600">
                    {row.stable_key}
                  </td>
                  <td className="py-3 px-4 font-medium text-slate-800">
                    {row.featureName}
                  </td>
                  <td className="py-3 px-4">
                    <StatusBadge status={row.statusLabel} />
                  </td>
                  <td className="py-3 px-4 font-mono text-[11px] text-slate-600 truncate max-w-xs">
                    {row.linkedCode}
                  </td>
                  <td className="py-3 px-4 text-slate-600 truncate max-w-sm">
                    {row.summary}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        if (onSelectRequirementForTest) {
                          onSelectRequirementForTest(row.stable_key);
                        }
                        onNavigateStep('TEST_SPEC');
                      }}
                      className="text-[11px] font-medium text-slate-500 hover:text-blue-600 transition-colors"
                    >
                      상세 보기
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
          <div>
            분석 기준: 명세 {specVersionLabel} · 코드 {snapshotLabel} | 명세나 코드가 바뀌면 다시 검증하세요.
          </div>
          <div>
            전체 {stats.total}개 · 명세 완전 일치 {stats.implemented}/{stats.total} ({stats.matchPercentage}%)
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-1">
        <Button
          type="button"
          variant="secondary"
          size="md"
          onClick={() => onNavigateStep('ANALYSIS')}
        >
          명세 다시 검토
        </Button>

        <div className="flex items-center space-x-2">
          <Button
            type="button"
            variant="ghost"
            size="md"
            onClick={handleToggleMockView}
          >
            미검증 상태로 전환
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={handleStartVerification}
          >
            다시 검증 (AI 요청)
          </Button>
        </div>
      </div>
    </div>
  );
};