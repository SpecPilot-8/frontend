/**
 * - 담당 파트: 프런트 엔드
 * - 작성자: 이시형
 * - 페이지 개요: 서버에서 받은 코드 스냅샷 파일들을 로컬 워크스페이스 폴더에 안전하게 복원하는 유틸 파일
 * - 주요 기능:
 *   1) 폴더명 정제 및 상위 경로 이탈 방지 검증
 *   2) 기존 복원 표식 파일 확인 및 사용자 수정 여부 판별
 *   3) 복원 계획 수립 및 파일 해시 검증 후 디스크 기록
 */

import * as fs from "fs";
import * as path from "path";
import { createHash } from "crypto";

export const MANIFEST_NAME = ".specpilot.json";

export interface SnapshotFile {
  path: string;
  content: string;
  sha256: string;
}

export interface SnapshotPayload {
  snapshot_id: string;
  content_hash: string;
  file_count: number;
  files: SnapshotFile[];
}

export interface Manifest {
  version: 1;
  projectId: string;
  snapshotId: string;
  contentHash: string;
  restoredAt: string;
  files: Record<string, string>;
}

export type RestoreAction = "create" | "reuse" | "update";

export interface RestorePlan {
  action: RestoreAction;
  folder: string;
  alternate: boolean;
  fileCount: number;
}

const RESERVED_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

// 안전한 로컬 폴더명을 생성하는 로직
export function sanitizeFolderName(name: string): string {
  let value = name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").trim();
  value = value.replace(/[. ]+$/, "").slice(0, 80);
  if (!value || RESERVED_NAMES.test(value)) {
    value = `project_${value}`.replace(/_$/, "");
  }
  return value;
}

export function sha256Hex(data: string | Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

// 대상 폴더 내부 경로인지 검증하고 결합하는 로직
export function safeJoin(root: string, relative: string): string {
  const parts = relative.split("/");
  if (!relative || parts.some((p) => p === "" || p === "." || p === ".." || p.includes("\\") || p.includes(":"))) {
    throw new Error(`안전하지 않은 파일 경로입니다: ${relative}`);
  }
  const base = path.resolve(root);
  const target = path.resolve(base, ...parts);
  const rel = path.relative(base, target);
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(`폴더 밖을 가리키는 파일 경로입니다: ${relative}`);
  }
  return target;
}

// 복원 폴더의 표식 파일을 읽는 로직
export function readManifest(folder: string): Manifest | null {
  try {
    const value = JSON.parse(fs.readFileSync(path.join(folder, MANIFEST_NAME), "utf8"));
    if (value && value.version === 1 && typeof value.projectId === "string"
      && typeof value.snapshotId === "string" && value.files && typeof value.files === "object") {
      return value as Manifest;
    }
  } catch {
    // 표식 파일 읽기 실패 예외 무시
  }
  return null;
}

// 복원 이후 변경되거나 삭제된 파일 목록을 찾는 로직
export function findChanges(folder: string, manifest: Manifest): string[] {
  const changed: string[] = [];
  for (const [relative, hash] of Object.entries(manifest.files)) {
    try {
      if (sha256Hex(fs.readFileSync(safeJoin(folder, relative))) !== hash) {
        changed.push(relative);
      }
    } catch {
      changed.push(relative);
    }
  }
  return changed;
}

type Decision = RestoreAction | "blocked";

function decide(folder: string, projectId: string, snapshotId: string): Decision {
  if (!fs.existsSync(folder)) {
    return "create";
  }
  if (!fs.statSync(folder).isDirectory()) {
    return "blocked";
  }
  if (fs.readdirSync(folder).length === 0) {
    return "create";
  }
  const manifest = readManifest(folder);
  if (!manifest || manifest.projectId !== projectId) {
    return "blocked";
  }
  if (manifest.snapshotId === snapshotId) {
    return "reuse";
  }
  return findChanges(folder, manifest).length === 0 ? "update" : "blocked";
}

// 대상 폴더 상태에 따라 복원 방식을 결정하는 로직
export function planRestore(workspaceRoot: string, projectName: string, projectId: string, snapshot: SnapshotPayload): RestorePlan {
  const base = path.join(workspaceRoot, sanitizeFolderName(projectName));
  const fileCount = snapshot.files.length;
  const first = decide(base, projectId, snapshot.snapshot_id);
  if (first !== "blocked") {
    return { action: first, folder: base, alternate: false, fileCount };
  }
  const alternate = `${base}_${snapshot.snapshot_id.slice(0, 8)}`;
  const second = decide(alternate, projectId, snapshot.snapshot_id);
  if (second === "blocked") {
    throw new Error(`복원할 폴더를 정할 수 없습니다. 이미 다른 내용이 있습니다: ${alternate}`);
  }
  return { action: second, folder: alternate, alternate: true, fileCount };
}

// 복원 계획에 따라 스냅샷 파일과 표식 파일을 기록하는 로직
export function applyRestore(plan: RestorePlan, projectId: string, snapshot: SnapshotPayload): void {
  if (plan.action === "reuse") {
    return;
  }
  const hashes: Record<string, string> = {};
  for (const file of snapshot.files) {
    safeJoin(plan.folder, file.path);
    if (sha256Hex(file.content) !== file.sha256) {
      throw new Error(`서버가 보낸 파일 내용이 해시와 다릅니다: ${file.path}`);
    }
  }
  fs.mkdirSync(plan.folder, { recursive: true });
  for (const file of snapshot.files) {
    const target = safeJoin(plan.folder, file.path);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, file.content, "utf8");
    hashes[file.path] = file.sha256;
  }
  const manifest: Manifest = {
    version: 1,
    projectId,
    snapshotId: snapshot.snapshot_id,
    contentHash: snapshot.content_hash,
    restoredAt: new Date().toISOString(),
    files: hashes,
  };
  fs.writeFileSync(path.join(plan.folder, MANIFEST_NAME), JSON.stringify(manifest, null, 2), "utf8");
}
