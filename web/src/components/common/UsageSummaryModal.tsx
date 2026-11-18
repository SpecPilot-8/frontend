/**
 * - 담당 파트: 프런트 엔드
 * - 작성자: 이시형
 * - 페이지 개요: 프로젝트의 단계별 토큰 사용량과 캐시 재사용 횟수 및 예상 비용을 집계하여 표시하는 모달 컴포넌트
 * - 주요 기능:
 *   1) 모델 단가 기준 입력과 출력 및 프롬프트 캐시 토큰의 예상 달러 비용 계산
 *   2) 명세 추출과 코드 검증 및 테스트 생성 작업별 호출 수와 캐시 재사용 횟수 및 처리시간 표시
 */

/* eslint-disable react-refresh/only-export-components */
import React, { useEffect, useState } from 'react';
import { api, fetchAll } from '../../services/api';
import { Button } from './Button';

export interface UsageTokens {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
}

export interface StageAnalysisMetrics {
  calls?: number;
  reused_calls?: number;
  submitted_chunks?: number;
  duration_ms?: number;
  estimated_cost_usd?: number | null;
  usage?: UsageTokens;
}

export interface JobAnalysisMetrics {
  scope_duration_ms?: number | null;
  matching?: StageAnalysisMetrics;
  condition_judgment?: StageAnalysisMetrics;
  duration_ms?: number;
  estimated_cost_usd?: number | null;
  reused_calls?: number;
}

export interface UsageJobRecord {
  id: string;
  operation: string;
  status: string;
  created_at?: string;
  updated_at?: string;
  duration_ms?: number;
  estimated_cost_usd?: number | null;
  model_config_snapshot?: {
    provider?: string;
    model?: string;
  };
  usage?: UsageTokens;
  analysis_metrics?: JobAnalysisMetrics;
}

// 백만 토큰당 예상 달러 단가 기준
// 기본 Opus 기준 일반 입력 5달러, 출력 25달러, 캐시 읽기 0.1배, 캐시 쓰기 1.25배 적용
function getModelPricing(modelName?: string) {
  const lower = (modelName || '').toLowerCase();
  if (lower.includes('haiku') || lower.includes('flash')) {
    return { input: 0.8, output: 4.0, cacheRead: 0.08, cacheWrite: 1.0 };
  }
  if (lower.includes('sonnet') || lower.includes('gpt-4.1')) {
    return { input: 3.0, output: 15.0, cacheRead: 0.3, cacheWrite: 3.75 };
  }
  return { input: 5.0, output: 25.0, cacheRead: 0.5, cacheWrite: 6.25 };
}

// 예상 달러 비용 계산 로직
// Anthropic 응답은 input_tokens에 캐시 토큰이 포함되지 않아 그대로 합산하고 Vercel만 차감
export function estimateTokenCostUsd(
  usage?: UsageTokens,
  modelName?: string,
  provider?: string
): number {
  if (!usage) return 0;
  const price = getModelPricing(modelName);
  const input = usage.input_tokens || 0;
  const output = usage.output_tokens || 0;
  const cacheRead = usage.cache_read_input_tokens || 0;
  const cacheWrite = usage.cache_creation_input_tokens || 0;
  const normalInput =
    provider === 'vercel' ? Math.max(0, input - cacheRead) : input;

  return (
    (normalInput * price.input +
      cacheRead * price.cacheRead +
      cacheWrite * price.cacheWrite +
      output * price.output) /
    1_000_000
  );
}

// 작업별 예상 비용 계산 로직
// 백엔드가 내려준 estimated_cost_usd 값을 우선 사용하고 미기록 이력만 토큰 단가로 추정
export function estimateJobCostUsd(
  job?: UsageJobRecord,
  fallbackModel?: string,
  fallbackProvider?: string
): number {
  if (!job) return 0;
  if (typeof job.estimated_cost_usd === 'number') {
    return job.estimated_cost_usd;
  }
  const metrics = job.analysis_metrics;
  if (typeof metrics?.estimated_cost_usd === 'number') {
    return metrics.estimated_cost_usd;
  }
  const model = job.model_config_snapshot?.model || fallbackModel;
  const provider = job.model_config_snapshot?.provider || fallbackProvider;
  const hasStageUsage =
    (metrics?.matching?.usage && Object.keys(metrics.matching.usage).length > 0) ||
    (metrics?.condition_judgment?.usage && Object.keys(metrics.condition_judgment.usage).length > 0);
  if (hasStageUsage) {
    return (
      estimateTokenCostUsd(metrics?.matching?.usage, model, provider) +
      estimateTokenCostUsd(metrics?.condition_judgment?.usage, model, provider)
    );
  }
  return estimateTokenCostUsd(job.usage, model, provider);
}

export function formatUsd(cost: number): string {
  if (cost <= 0) return '$0.00';
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}

export function formatMetricsDuration(ms: number): string {
  if (!ms || ms <= 0) return '-';
  const totalSec = Math.round(ms / 1000);
  if (totalSec >= 60) {
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return sec > 0 ? `${min}분 ${sec}초` : `${min}분`;
  }
  return `${(ms / 1000).toFixed(1)}초`;
}

// 작업 소요 시간 계산 로직
// 백엔드 job 또는 단계별 duration_ms 합계를 우선 사용하고 없을 때는 완료 작업 시각 차이로 산출
export function getJobDurationMs(job?: UsageJobRecord): number {
  if (!job) return 0;
  if (typeof job.duration_ms === 'number' && job.duration_ms > 0) {
    return job.duration_ms;
  }
  const m = job.analysis_metrics;
  const fromStages =
    (m?.scope_duration_ms || 0) +
    (m?.matching?.duration_ms || 0) +
    (m?.condition_judgment?.duration_ms || 0) +
    (m?.duration_ms || 0);
  if (fromStages > 0) return fromStages;
  if (job.created_at && job.updated_at && job.status === 'completed') {
    const diff = new Date(job.updated_at).getTime() - new Date(job.created_at).getTime();
    if (diff > 0 && diff < 3_600_000) return diff;
  }
  return 0;
}

// 매칭과 판정 단계의 응답 캐시 재사용 횟수 합산 로직
export function getJobReusedCalls(job?: UsageJobRecord): number {
  if (!job?.analysis_metrics) return 0;
  const m = job.analysis_metrics;
  return (m.matching?.reused_calls || 0) + (m.condition_judgment?.reused_calls || 0) + (m.reused_calls || 0);
}

// 매칭과 판정 단계의 신규 LLM 호출 횟수 합산 로직
export function getJobTotalCalls(job?: UsageJobRecord): number {
  if (!job?.analysis_metrics) return 0;
  const m = job.analysis_metrics;
  return (m.matching?.calls || 0) + (m.condition_judgment?.calls || 0);
}

const OPERATION_LABELS: Record<string, string> = {
  extract_requirements: '02 명세 요구사항 추출',
  verify: '03 요구사항 코드 검증',
  generate_test_specification: '04 AI 테스트 사양서 생성',
  generate_tests: '04 AI 테스트 사양서 생성',
};

const AI_OPERATIONS = new Set([
  'extract_requirements',
  'verify',
  'generate_test_specification',
  'generate_tests',
]);

const STATUS_LABELS: Record<string, string> = {
  completed: '완료',
  running: '실행 중',
  failed: '실패',
  cancelled: '중단',
  queued: '대기',
};

interface UsageSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string | null;
  projectName?: string;
}

export const UsageSummaryModal: React.FC<UsageSummaryModalProps> = ({
  isOpen,
  onClose,
  projectId,
  projectName,
}) => {
  const [jobs, setJobs] = useState<UsageJobRecord[]>([]);
  const [llmConfig, setLlmConfig] = useState<{ provider?: string; model?: string }>({});
  const [loading, setLoading] = useState(false);

  // 작업 이력 및 현재 프로젝트 모델 설정 조회 로직
  useEffect(() => {
    if (!isOpen || !projectId) return;
    let active = true;
    void Promise.resolve().then(async () => {
      if (active) setLoading(true);
      try {
        const [list, llm] = await Promise.all([
          fetchAll<UsageJobRecord>(`/projects/${projectId}/jobs`),
          api<{ provider?: string; model?: string }>(`/projects/${projectId}/llm`).catch(() => ({})),
        ]);
        if (!active) return;
        const aiJobs = list.filter(
          (j) => AI_OPERATIONS.has(j.operation) && (j.usage || j.analysis_metrics)
        );
        setJobs(aiJobs);
        setLlmConfig(llm);
      } catch {
        if (active) setJobs([]);
      } finally {
        if (active) setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [isOpen, projectId]);

  if (!isOpen) return null;

  const totals = jobs.reduce(
    (acc, job) => {
      const m = job.analysis_metrics;
      const inTok =
        job.usage?.input_tokens ??
        (m?.matching?.usage?.input_tokens || 0) + (m?.condition_judgment?.usage?.input_tokens || 0);
      const outTok =
        job.usage?.output_tokens ??
        (m?.matching?.usage?.output_tokens || 0) + (m?.condition_judgment?.usage?.output_tokens || 0);
      const cacheRead =
        job.usage?.cache_read_input_tokens ??
        (m?.matching?.usage?.cache_read_input_tokens || 0) +
          (m?.condition_judgment?.usage?.cache_read_input_tokens || 0);
      acc.inputTokens += inTok;
      acc.outputTokens += outTok;
      acc.cacheReadTokens += cacheRead;
      acc.calls += getJobTotalCalls(job);
      acc.reusedCalls += getJobReusedCalls(job);
      acc.durationMs += getJobDurationMs(job);
      acc.costUsd += estimateJobCostUsd(job, llmConfig.model, llmConfig.provider);
      return acc;
    },
    {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      calls: 0,
      reusedCalls: 0,
      durationMs: 0,
      costUsd: 0,
    }
  );

  const formatTime = (iso?: string) => {
    if (!iso) return '-';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return `${d.getMonth() + 1}월 ${d.getDate()}일 ${String(d.getHours()).padStart(2, '0')}:${String(
      d.getMinutes()
    ).padStart(2, '0')}`;
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="AI 토큰 및 비용 현황"
      className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              AI 토큰 · 캐시 재사용 · 예상 비용 현황
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {projectName || '현재 프로젝트'}의 단계별 LLM 호출·응답 캐시 재사용·처리시간 및 예상 비용 집계입니다.
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={onClose}>
            닫기
          </Button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5">
          {/* 상단 요약 카드 영역 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
              <div className="text-[11px] font-medium text-slate-500">누적 입력 / 출력 토큰</div>
              <div className="text-sm font-bold text-slate-900 mt-1">
                {totals.inputTokens.toLocaleString()} / {totals.outputTokens.toLocaleString()}
              </div>
              {totals.cacheReadTokens > 0 && (
                <div className="text-[11px] text-slate-400 mt-0.5">
                  프롬프트 캐시 읽기 {totals.cacheReadTokens.toLocaleString()} 토큰
                </div>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
              <div className="text-[11px] font-medium text-slate-500">응답 캐시 재사용</div>
              <div className="text-sm font-bold text-slate-900 mt-1">
                {totals.reusedCalls}회 재사용
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                신규 LLM 호출 {totals.calls}회
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
              <div className="text-[11px] font-medium text-slate-500">총 처리시간</div>
              <div className="text-sm font-bold text-slate-900 mt-1">
                {formatMetricsDuration(totals.durationMs)}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                기록된 작업 {jobs.length}건 합계
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
              <div className="text-[11px] font-medium text-slate-500">총 예상 비용 (USD)</div>
              <div className="text-sm font-bold text-slate-900 mt-1">
                {formatUsd(totals.costUsd)}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                모델·캐시 단가 반영 추정치
              </div>
            </div>
          </div>

          {/* 작업별 상세 테이블 영역 */}
          {loading ? (
            <div className="py-10 text-center text-xs text-slate-500">
              작업별 사용량 기록을 불러오는 중입니다...
            </div>
          ) : jobs.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-500 border border-dashed border-slate-200 rounded-xl">
              아직 이 프로젝트에서 기록된 AI 실행(추출·검증·테스트 생성) 내역이 없습니다.
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <tr>
                    <th className="px-3 py-2.5">실행 시각</th>
                    <th className="px-3 py-2.5">단계</th>
                    <th className="px-2.5 py-2.5 text-center">상태</th>
                    <th className="px-2.5 py-2.5 text-right">입력 토큰</th>
                    <th className="px-2.5 py-2.5 text-right">출력 토큰</th>
                    <th className="px-2.5 py-2.5 text-center">호출 / 캐시 재사용</th>
                    <th className="px-2.5 py-2.5 text-right">처리시간</th>
                    <th className="px-3 py-2.5 text-right">예상 비용</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {jobs.map((job) => {
                    const m = job.analysis_metrics;
                    const inTok =
                      job.usage?.input_tokens ??
                      (m?.matching?.usage?.input_tokens || 0) +
                        (m?.condition_judgment?.usage?.input_tokens || 0);
                    const outTok =
                      job.usage?.output_tokens ??
                      (m?.matching?.usage?.output_tokens || 0) +
                        (m?.condition_judgment?.usage?.output_tokens || 0);
                    const calls = getJobTotalCalls(job);
                    const reused = getJobReusedCalls(job);
                    const dur = getJobDurationMs(job);
                    const cost = estimateJobCostUsd(job, llmConfig.model, llmConfig.provider);
                    return (
                      <tr key={job.id} className="hover:bg-slate-50/80">
                        <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">
                          {formatTime(job.created_at)}
                        </td>
                        <td className="px-3 py-2.5 font-medium text-slate-800">
                          <div>{OPERATION_LABELS[job.operation] || job.operation}</div>
                          {job.operation === 'verify' && (m?.matching || m?.condition_judgment) && (
                            <div className="text-[11px] text-slate-400 font-normal mt-0.5">
                              매칭: 호출 {m.matching?.calls || 0}·재사용 {m.matching?.reused_calls || 0} / 판정: 호출{' '}
                              {m.condition_judgment?.calls || 0}·재사용 {m.condition_judgment?.reused_calls || 0}
                            </div>
                          )}
                        </td>
                        <td className="px-2.5 py-2.5 text-center whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                            {STATUS_LABELS[job.status] || job.status}
                          </span>
                        </td>
                        <td className="px-2.5 py-2.5 text-right font-mono text-slate-700 whitespace-nowrap">
                          {inTok.toLocaleString()}
                        </td>
                        <td className="px-2.5 py-2.5 text-right font-mono text-slate-700 whitespace-nowrap">
                          {outTok.toLocaleString()}
                        </td>
                        <td className="px-2.5 py-2.5 text-center whitespace-nowrap text-slate-700">
                          {calls > 0 || reused > 0 ? (
                            <span>
                              호출 <strong>{calls}</strong> · 재사용 <strong>{reused}</strong>
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-2.5 py-2.5 text-right text-slate-700 whitespace-nowrap">
                          {formatMetricsDuration(dur)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold text-slate-800 whitespace-nowrap">
                          {formatUsd(cost)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
