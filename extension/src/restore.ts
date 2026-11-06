import * as fs from "fs";
import * as path from "path";
import { createHash } from "crypto";

/** 복원한 폴더 루트에 두는 표식 파일. 어느 스냅샷을 복원했는지와 파일별 해시를 기록한다. */
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
  /** 같은 이름의 폴더를 보호하려고 `_스냅샷ID` 접미사 폴더를 쓰는 경우 true */
  alternate: boolean;
  fileCount: number;
}

const RESERVED_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

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

/** 스냅샷 경로를 대상 폴더 안의 실제 경로로 바꾼다. 폴더 밖으로 나가는 경로는 거부한다. */
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

export function readManifest(folder: string): Manifest | null {
  try {
    const value = JSON.parse(fs.readFileSync(path.join(folder, MANIFEST_NAME), "utf8"));
    if (value && value.version === 1 && typeof value.projectId === "string"
      && typeof value.snapshotId === "string" && value.files && typeof value.files === "object") {
      return value as Manifest;
    }
  } catch {
    // 표식이 없거나 손상된 폴더는 SpecPilot이 만든 폴더로 보지 않는다.
  }
  return null;
}

/** 복원 이후 사용자가 수정하거나 삭제한 파일 경로 목록. */
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

/**
 * 어느 폴더에 어떻게 복원할지 정한다. 아무것도 쓰지 않는다.
 * - 같은 스냅샷이 이미 복원돼 있으면 재사용한다 (사용자가 수정했어도 그대로 둔다).
 * - 다른 스냅샷이고 사용자 수정이 없으면 같은 폴더를 갱신한다.
 * - 사용자 수정이 있거나 SpecPilot이 만들지 않은 폴더면 `<이름>_<스냅샷ID 앞 8자>` 폴더를 쓴다.
 */
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

/**
 * 계획대로 파일을 쓴다. 표식 파일은 마지막에 쓰므로 중간에 실패하면 표식이 남지 않는다.
 * 파일은 삭제하지 않는다. 갱신 시 새 스냅샷에 없는 옛 파일은 폴더에 남을 수 있다.
 */
export function applyRestore(plan: RestorePlan, projectId: string, snapshot: SnapshotPayload): void {
  if (plan.action === "reuse") {
    return;
  }
  const hashes: Record<string, string> = {};
  // 파일을 하나라도 쓰기 전에 전부 검증한다. 하나라도 이상하면 아무것도 쓰지 않는다.
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
