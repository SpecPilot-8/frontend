/**
 * - 담당 파트: 프런트 엔드
 * - 작성자: 이시형
 * - 페이지 개요: AI 작업별 토큰 사용량, 캐시 재사용, 소요 시간 및 예상 비용을 계산하는 유틸리티
 * - 주요 기능:
 *   1) 모델 단가 기준 입력·출력·프롬프트 캐시 토큰의 예상 달러 비용 계산
 *   2) 작업 메타데이터 기반 비용·소요시간·호출 및 캐시 재사용 횟수 집계
 */

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
