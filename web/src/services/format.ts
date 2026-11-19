/**
 * - 담당 파트: 프런트 엔드
 * - 작성자: 이시형
 * - 페이지 개요: 실행 시각, 소요 시간, 실행 상태 라벨 등 화면 전반의 공통 포맷 유틸리티
 * - 주요 기능:
 *   1) ISO 실행 시각을 한국어 날짜·시간 문자열로 변환
 *   2) 밀리초 소요 시간을 분·초 단위 문자열로 변환
 *   3) 검증·작업·사양서 상태 코드의 한국어 라벨 매핑
 */

export const RUN_STATUS_LABELS: Record<string, string> = {
  completed: '완료',
  running: '분석 중',
  failed: '실패',
  queued: '대기',
  blocked: '미연결',
  cancelled: '중단',
  draft: '초안',
};

// 상태 코드를 한국어 라벨로 변환하는 로직
export function formatRunStatus(status: string): string {
  return RUN_STATUS_LABELS[status] || status;
}

// 실행 시각을 한국어 날짜와 시간으로 변환하는 로직
export function formatRunDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    const m = d.getMonth() + 1;
    const day = d.getDate();
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${m}월 ${day}일 ${h}:${min}`;
  } catch {
    return isoString;
  }
}

// 소요 시간을 분과 초 단위로 변환하는 로직
export function formatDuration(ms: number): string {
  if (!ms || ms <= 0) return '-';
  const totalSec = Math.round(ms / 1000);
  if (totalSec >= 60) {
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return sec > 0 ? `${min}분 ${sec}초` : `${min}분`;
  }
  return `${(ms / 1000).toFixed(1)}초`;
}
