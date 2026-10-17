// 공통 단계 ID
export type StepId = 'HOME' | 'SETUP' | 'ANALYSIS' | 'VERIFICATION' | 'TEST_SPEC' | (string & {});

// AI 모델 옵션
export interface AIModelOption {
  id: string;
  name: string;
  provider: string;
  [key: string]: any;
}

// 시작 페이지 최근 프로젝트
export interface RecentProject {
  id: string;
  name: string;
  updatedAt: string;
  techStack: string;
  status: string;
  [key: string]: any;
}