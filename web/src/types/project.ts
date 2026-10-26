// 명세 파일 정보
export interface SpecFileInfo {
  fileName: string;
  pageCount?: number;
  version?: string;
  uploaded?: boolean;
  [key: string]: unknown;
}

// 소스코드 소스 정보
export interface CodeSourceInfo {
  type: string;
  sourceName: string;
  fileCount?: number;
  snapshotId?: string;
  [key: string]: unknown;
}

// 백엔드에서 내려오는 모델 프로필 타입
export interface AIModelProfile {
  id: string;
  provider: string;
  model: string;
  display_name: string;
  adapter_status: string;
  enabled: boolean;
  credential_required: boolean;
}

// 프로젝트 설정 전체 데이터
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