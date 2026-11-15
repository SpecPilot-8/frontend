/**
 * - 담당 파트: 프런트 엔드
 * - 작성자: 이시형
 * - 페이지 개요: 프로젝트 기본 설정과 업로드 파일 및 모델 프로필 정보를 담는 타입 정의 파일
 * - 주요 기능:
 *   1) 기획서 문서와 소스 코드 파일 메타데이터 인터페이스 정의
 *   2) 모델 프로필 및 프로젝트 전체 설정 인터페이스 정의
 */

export interface SpecFileInfo {
  fileName: string;
  pageCount?: number;
  version?: string;
  uploaded?: boolean;
  [key: string]: unknown;
}

export interface CodeSourceInfo {
  type: string;
  sourceName: string;
  fileCount?: number;
  snapshotId?: string;
  [key: string]: unknown;
}

export interface AIModelProfile {
  id: string;
  provider: string;
  model: string;
  display_name: string;
  adapter_status: string;
  enabled: boolean;
  credential_required: boolean;
}

export interface ProjectSetupData {
  projectName: string;
  version?: number;
  specFile: SpecFileInfo | null;
  codeSource: CodeSourceInfo | null;
  techStack: string;
  aiConfig: {
    modelId: string;
    apiKey: string;
    isConnected: boolean;
    configVersion?: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}