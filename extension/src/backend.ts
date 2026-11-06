import type { SnapshotPayload } from "./restore";

export interface ProjectSummary {
  id: string;
  name: string;
}

export interface SnapshotSummary {
  id: string;
  file_count?: number;
  chunk_count?: number;
  created_at?: string;
}

async function getJson<T>(baseUrl: string, route: string): Promise<T> {
  const url = `${baseUrl.replace(/\/+$/, "")}${route}`;
  let response: Response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(60000) });
  } catch {
    throw new Error(`백엔드에 연결하지 못했습니다. 서버가 실행 중인지 확인하세요: ${url}`);
  }
  if (!response.ok) {
    let message = `백엔드 요청이 실패했습니다 (${response.status})`;
    try {
      const body = (await response.json()) as { error?: { message?: string } };
      if (body.error?.message) {
        message = `${body.error.message} (${response.status})`;
      }
    } catch {
      // 오류 본문이 JSON이 아니면 기본 메시지를 쓴다.
    }
    throw new Error(message);
  }
  return (await response.json()) as T;
}

export async function fetchProjects(baseUrl: string): Promise<ProjectSummary[]> {
  return (await getJson<{ items: ProjectSummary[] }>(baseUrl, "/projects?limit=200")).items;
}

export async function fetchSnapshots(baseUrl: string, projectId: string): Promise<SnapshotSummary[]> {
  const route = `/projects/${encodeURIComponent(projectId)}/code/snapshots?limit=200`;
  return (await getJson<{ items: SnapshotSummary[] }>(baseUrl, route)).items;
}

export async function fetchSnapshotFiles(baseUrl: string, projectId: string, snapshotId: string): Promise<SnapshotPayload> {
  const route = `/projects/${encodeURIComponent(projectId)}/code/snapshots/${encodeURIComponent(snapshotId)}/files`;
  return getJson<SnapshotPayload>(baseUrl, route);
}

