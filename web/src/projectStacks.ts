/**
 * - 담당 파트: 프런트 엔드
 * - 작성자: 이시형
 * - 페이지 개요: 프로젝트에서 선택 가능한 기술 스택 목록과 라벨 변환 함수를 정의한 상수 파일
 * - 주요 기능:
 *   1) 지원 기술 스택 선택지 목록 정의
 *   2) 기술 스택 코드값에 대응하는 화면 표시용 라벨 반환
 */

export const PROJECT_STACKS = [
  { value: "auto", label: "자동 감지 (기본)" },
  { value: "spring", label: "Java / Spring Boot" },
  { value: "react", label: "JavaScript / React · Express" },
  { value: "typescript", label: "TypeScript (텍스트 분석)" },
];

export const projectStackLabel = (value?: string) =>
  PROJECT_STACKS.find((stack) => stack.value === value)?.label || PROJECT_STACKS[0].label;
