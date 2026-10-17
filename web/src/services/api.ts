import type {
  AIModelOption,
  RecentProject,
  ProjectSetupData,
  RequirementItem,
  DocumentOutlineNode,
  VerificationResultItem,
  TestSpecificationGroup,
} from '../types';

import {
  mockAIModels,
  mockRecentProjects,
  mockProjectSetup,
  mockRequirements,
  mockDocumentOutline,
  mockVerificationResults,
  mockTestSpecifications,
} from '../mocks/data';

// 00 시작 페이지 API
export const fetchRecentProjects = async (): Promise<RecentProject[]> => {
  // 추후 FastAPI 연동: return (await fetch('/api/projects')).json();
  return Promise.resolve([...mockRecentProjects]);
};

// 01 프로젝트 설정 API
export const fetchAIModels = async (): Promise<AIModelOption[]> => {
  // 추후 FastAPI 연동: return (await fetch('/api/ai/models')).json();
  return Promise.resolve([...mockAIModels]);
};

export const fetchProjectSetup = async (): Promise<ProjectSetupData> => {
  return Promise.resolve({ ...mockProjectSetup });
};

export const saveProjectSetup = async (
  data: Partial<ProjectSetupData>
): Promise<{ success: boolean; data: ProjectSetupData }> => {
  // 추후 FastAPI 연동: return (await fetch('/api/projects/setup', { method: 'POST', body: JSON.stringify(data) })).json();
  return Promise.resolve({
    success: true,
    data: { ...mockProjectSetup, ...data },
  });
};

// 02 명세 분석 API
export const fetchRequirements = async (): Promise<RequirementItem[]> => {
  // 추후 FastAPI 연동: return (await fetch('/api/requirements')).json();
  return Promise.resolve([...mockRequirements]);
};

export const fetchDocumentOutline = async (): Promise<DocumentOutlineNode[]> => {
  // 추후 FastAPI 연동: return (await fetch('/api/spec/outline')).json();
  return Promise.resolve([...mockDocumentOutline]);
};

// 03 검증 결과 API
export const fetchVerificationResults = async (): Promise<VerificationResultItem[]> => {
  // 추후 FastAPI 연동: return (await fetch('/api/verifications')).json();
  return Promise.resolve([...mockVerificationResults]);
};

// 04 테스트 사양서 API
export const fetchTestSpecifications = async (
  requirementId: string
): Promise<TestSpecificationGroup | null> => {
  // 추후 FastAPI 연동: return (await fetch(`/api/tests?reqId=${requirementId}`)).json();
  const spec = mockTestSpecifications[requirementId];
  return Promise.resolve(spec ? { ...spec } : null);
};