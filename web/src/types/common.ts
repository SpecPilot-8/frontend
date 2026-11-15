/**
 * - 담당 파트: 프런트 엔드
 * - 작성자: 이시형
 * - 페이지 개요: 애플리케이션 전반에서 공통으로 사용하는 단계 식별자와 최근 프로젝트 타입을 정의한 파일
 * - 주요 기능:
 *   1) 워크플로우 단계 식별자 타입 정의
 *   2) 모델 선택 옵션 및 최근 프로젝트 요약 정보 인터페이스 정의
 */

export type StepId =
  | "HOME"
  | "SETUP"
  | "ANALYSIS"
  | "VERIFICATION"
  | "TEST_SPEC"
  | (string & {});

export interface AIModelOption {
  id: string;
  name: string;
  provider: string;
  [key: string]: unknown;
}

export interface RecentProject {
  id: string;
  name: string;
  updatedAt: string;
  techStack: string;
  status: string;
  [key: string]: unknown;
}
