import { projectStackLabel } from "../projectStacks";
import type { TestSpecification } from "../types/test";
import type {
  AIModelOption,
  RecentProject,
  ProjectSetupData,
  RequirementItem,
  DocumentOutlineNode,
} from "../types";

export const BASE_URL =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v2";

export class APIError extends Error {
  code?: string;
  details?: unknown;
  missing_features?: unknown[];
  
  constructor(message: string, errorData?: { code?: string, details?: unknown, missing_features?: unknown[] }) {
    super(message);
    this.name = 'APIError';
    this.code = errorData?.code;
    this.details = errorData?.details;
    this.missing_features = errorData?.missing_features;
  }
}

export const handleResponse = async (res: Response) => {
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new APIError(
      errorData.error?.message || `서버 통신 에러가 발생했습니다. (${res.status})`,
      errorData.error
    );
  }
  return res.json();
};

export const fetchRecentProjects = async (): Promise<RecentProject[]> => {
  try {
    const data = { items: await fetchAll<{ id: string; name: string; created_at: string; tech_stack?: string }>("/projects") };
    return data.items.map(
      (p: { id: string; name: string; created_at: string; tech_stack?: string }) => ({
        id: p.id,
        name: p.name,
        updatedAt: p.created_at.split("T")[0],
        techStack: projectStackLabel(p.tech_stack),
        status: "대기 중",
      }),
    );
  } catch (error) {
    console.error("프로젝트 목록 조회 실패:", error);
    throw error;
  }
};

export const deleteProject = async (projectId: string): Promise<void> => {
  const res = await fetch(`${BASE_URL}/projects/${encodeURIComponent(projectId)}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new APIError(
      errorData.error?.message || `프로젝트 삭제에 실패했습니다. (${res.status})`,
      errorData.error,
    );
  }
};

export const fetchAIModels = async (): Promise<AIModelOption[]> => {
  try {
    const res = await fetch(`${BASE_URL}/model-profiles`);
    const data = await handleResponse(res);
    return data.items.map(
      (m: { id: string; display_name: string; provider: string }) => ({
        id: m.id,
        name: m.display_name,
        provider: m.provider,
      }),
    );
  } catch (error) {
    console.error("모델 목록 조회 실패:", error);
    return [];
  }
};

export const fetchProjectSetup = async (
  projectId?: string,
): Promise<ProjectSetupData | null> => {
  if (!projectId) return null;
  try {
    const res = await fetch(`${BASE_URL}/projects/${projectId}`);
    const data = await handleResponse(res);
    return {
      projectName: data.name,
      version: data.version,
      techStack: data.tech_stack || "auto",
    } as unknown as ProjectSetupData;
  } catch (error) {
    console.error("프로젝트 정보 조회 실패:", error);
    return null;
  }
};

export const saveProjectSetup = async (
  data: { projectName?: string; techStack?: string },
  projectId?: string,
  baseVersion: number = 1,
): Promise<{
  success: boolean;
  data?: unknown;
  projectId?: string;
  error?: string;
}> => {
  try {
    let res;
    if (projectId) {
      res = await fetch(`${BASE_URL}/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.projectName || "새 프로젝트",
          tech_stack: data.techStack || "auto",
          base_version: baseVersion,
        }),
      });
    } else {
      res = await fetch(`${BASE_URL}/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.projectName || "새 프로젝트",
          tech_stack: data.techStack || "auto",
        }),
      });
    }

    const projectData = await handleResponse(res);
    return { success: true, data: projectData, projectId: projectData.id };
  } catch (error: unknown) {
    console.error("프로젝트 저장 오류:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "알 수 없는 오류",
    };
  }
};

export const uploadDocument = async (projectId: string, file: File) => {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${BASE_URL}/projects/${projectId}/documents`, {
    method: "POST",
    body: formData,
  });
  return await handleResponse(res);
};

export const uploadSourceCode = async (projectId: string, file: File) => {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${BASE_URL}/projects/${projectId}/code/sources`, {
    method: "POST",
    body: formData,
  });
  return await handleResponse(res);
};

export const fetchRequirements = async (
  projectId: string,
): Promise<RequirementItem[]> => {
  return fetchAll<RequirementItem>(`/projects/${projectId}/requirements`);
};

export const fetchDocumentOutline = async (): Promise<
  DocumentOutlineNode[]
> => {
  return [];
};

export const fetchVerificationRuns = async (projectId: string) => {
  return (await fetchAll<{ id: string; created_at: string }>(`/projects/${projectId}/verification-runs`)).reverse();
};

export const fetchTestSpecifications = async (projectId: string) => {
  return (await fetchAll<TestSpecification>(`/projects/${projectId}/test-specifications`)).reverse();
};

const ACTIVE_JOB_PREFIX = "specpilot:activeJob:";

export type JobTaskType = "extraction" | "verification" | "test_generation";

export function saveActiveJob(projectId: string, task: JobTaskType, jobId: string) {
  try {
    sessionStorage.setItem(`${ACTIVE_JOB_PREFIX}${projectId}:${task}`, jobId);
  } catch (e) {
    console.warn("세션 스토리지에 Job ID 저장 실패:", e);
  }
}

export function getActiveJob(projectId: string, task: JobTaskType): string | null {
  try {
    return sessionStorage.getItem(`${ACTIVE_JOB_PREFIX}${projectId}:${task}`);
  } catch {
    return null;
  }
}

export function clearActiveJob(projectId: string, task: JobTaskType) {
  try {
    sessionStorage.removeItem(`${ACTIVE_JOB_PREFIX}${projectId}:${task}`);
  } catch (e) {
    console.warn("세션 스토리지 Job ID 삭제 실패:", e);
  }
}

export interface PollJobOptions {
  signal?: AbortSignal;
  maxConsecutiveErrors?: number;
}

export async function pollJobStatus(
  projectId: string,
  jobId: string,
  onProgress?: (job: {
    progress?: { stage: string; completed: number; total: number };
    status?: string;
  }) => void,
  options?: PollJobOptions,
): Promise<unknown> {
  const maxAttempts = 900; 
  let attempts = 0;
  let delay = 1000;
  let consecutiveErrors = 0;
  const maxConsecutiveErrors = options?.maxConsecutiveErrors ?? 5;

  while (attempts < maxAttempts) {
    if (options?.signal?.aborted) {
      throw new APIError("작업 조회가 중단되었습니다.", { code: "ABORTED" });
    }

    try {
      const res = await fetch(
        `${BASE_URL}/projects/${projectId}/jobs/${jobId}`,
        { signal: options?.signal },
      );
      const job = await handleResponse(res);
      consecutiveErrors = 0;

      if (onProgress) {
        onProgress(job);
      }

      if (
        job.status === "completed" ||
        job.status === "failed" ||
        job.status === "blocked" ||
        job.status === "cancelled"
      ) {
        return job;
      }
    } catch (error) {
      if (options?.signal?.aborted) {
        throw new APIError("작업 조회가 중단되었습니다.", { code: "ABORTED" });
      }
      if (error instanceof APIError && error.code !== "POLLING_TIMEOUT") throw error;
      consecutiveErrors++;
      console.error(
        `Job 폴링 중 네트워크 에러 (${consecutiveErrors}/${maxConsecutiveErrors}):`,
        error,
      );

      if (consecutiveErrors >= maxConsecutiveErrors) {
        throw new APIError(
          "서버와의 연결이 끊겨 작업 진행 상태를 확인할 수 없습니다. 서버 상태를 확인하고 새로고침해 주세요.",
          { code: "NETWORK_ERROR" },
        );
      }

      delay = Math.min(delay * 1.5, 5000);
    }

    if (options?.signal?.aborted) {
      throw new APIError("작업 조회가 중단되었습니다.", { code: "ABORTED" });
    }

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, delay);
      if (options?.signal) {
        const onAbort = () => {
          clearTimeout(timer);
          reject(new APIError("작업 조회가 중단되었습니다.", { code: "ABORTED" }));
        };
        options.signal.addEventListener("abort", onAbort, { once: true });
      }
    });
    attempts++;
  }

  throw new APIError("AI 분석 작업 대기 시간이 초과되었습니다. 페이지를 새로고침하여 진행 상태를 확인해 주세요.", { code: "POLLING_TIMEOUT" });
}

export const saveProjectCredentials = async (projectId: string, profileId: string, apiKey: string) => {
  const res = await fetch(`${BASE_URL}/projects/${projectId}/credentials`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ profile_id: profileId, api_key: apiKey }),
  });
  return await handleResponse(res);
};

export const updateProjectLLMConfig = async (projectId: string, profileId: string, baseVersion: number, credentialRef?: string) => {
  const res = await fetch(`${BASE_URL}/projects/${projectId}/llm`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ 
      base_version: baseVersion, 
      profile_id: profileId, 
      credential_ref: credentialRef || null 
    }),
  });
  return await handleResponse(res);
};

export const verifyLLMConnection = async (projectId: string, configVersion: number) => {
  const res = await fetch(`${BASE_URL}/projects/${projectId}/llm/connection-check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ config_version: configVersion }),
  });
  return await handleResponse(res);
};

export const fetchTestCases = async (projectId: string, specId: string) => {
  const res = await fetch(`${BASE_URL}/projects/${projectId}/test-cases?test_specification_id=${specId}&limit=200`);
  const data = await handleResponse(res);
  return data.items || [];
};

export const fetchTestExecutions = async (projectId: string, caseId: string) => {
  const res = await fetch(`${BASE_URL}/projects/${projectId}/test-cases/${caseId}/executions`);
  const data = await handleResponse(res);
  return data.items || [];
};

export const saveTestBatch = async (projectId: string, specId: string, payload: unknown) => {
  const res = await fetch(`${BASE_URL}/projects/${projectId}/test-specifications/${specId}/edit-batches`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return await handleResponse(res);
};

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  return handleResponse(await fetch(`${BASE_URL}${path}`, init));
}
export const jsonRequest = (method: string, body: unknown): RequestInit => ({
  method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
});
export async function fetchAll<T>(path: string): Promise<T[]> {
  const items: T[] = [];
  let total = Infinity;
  while (items.length < total) {
    const query = path.includes("?") ? "&" : "?";
    const page = await api<{ items: T[]; total: number }>(`${path}${query}limit=200&offset=${items.length}`);
    items.push(...page.items);
    total = page.total;
    if (!page.items.length) break;
  }
  return items;
}
export function errorMessage(error: unknown): string {
  if (error instanceof APIError) return `${error.message}${error.code ? ` (${error.code})` : ""}`;
  return error instanceof Error ? error.message : "요청을 처리할 수 없습니다";
}
