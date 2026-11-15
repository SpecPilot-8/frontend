/**
 * - 담당 파트: 프런트 엔드
 * - 작성자: 이시형
 * - 페이지 개요: 각 화면 상단 헤더와 입력 라벨에서 공통으로 사용하는 타이포그래피 스타일 상수 파일
 * - 주요 기능:
 *   1) 단계 태그와 제목 및 설명 텍스트 스타일 정의
 *   2) 입력 폼 필드 라벨 스타일 정의
 */

export const VIEW_HEADER = {
  stepTag: 'text-[11px] font-bold text-blue-600 tracking-wider',
  title: 'text-2xl font-bold text-slate-900 mt-0.5',
  desc: 'text-xs text-slate-500 mt-1',
  fieldLabel: 'text-xs font-semibold text-slate-700 block mb-1.5',
} as const;