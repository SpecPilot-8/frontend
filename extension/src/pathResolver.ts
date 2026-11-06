import * as fs from "fs";
import * as path from "path";

/**
 * 복원된 폴더 내에서 filePath를 찾는다.
 * ZIP 압축 구조에 따라 최상위 폴더가 한 겹 더 있거나 없을 수 있으므로 유연하게 탐색한다.
 */
export function resolveTargetFilePath(folder: string, relativePath: string): string | null {
  const normalized = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");

  // 1. 직접 매칭 (가장 일반적인 경우)
  const direct = path.join(folder, ...normalized.split("/"));
  if (fs.existsSync(direct) && fs.statSync(direct).isFile()) {
    return direct;
  }

  // 2. 만약 zip 안에 루트 폴더가 1개 더 감싸져 있는 경우 탐색 (예: Test1/specpilot/src/... vs Test1/src/...)
  try {
    const entries = fs.readdirSync(folder, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith(".")) {
        const subDirect = path.join(folder, entry.name, ...normalized.split("/"));
        if (fs.existsSync(subDirect) && fs.statSync(subDirect).isFile()) {
          return subDirect;
        }
      }
    }

    // 3. 반대로 normalized의 첫 번째 세그먼트를 떼고 찾기 (예: normalized가 "specpilot/src/..."인데 folder가 이미 그 안인 경우)
    const segments = normalized.split("/");
    if (segments.length > 1) {
      const stripped = segments.slice(1).join("/");
      const subDirect = path.join(folder, ...stripped.split("/"));
      if (fs.existsSync(subDirect) && fs.statSync(subDirect).isFile()) {
        return subDirect;
      }
    }

    // 4. 경로가 아니라 파일명만 입력된 경우, 폴더 내에서 해당 파일명을 재귀 탐색
    const fileName = path.basename(normalized);
    const foundByName = findFileRecursively(folder, fileName);
    if (foundByName) {
      return foundByName;
    }
  } catch {
    // 폴더 접근 불가 시 null
  }

  return null;
}

function findFileRecursively(dir: string, targetName: string): string | null {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".")) {
        continue;
      }
      const full = path.join(dir, entry.name);
      if (entry.isFile() && entry.name.toLowerCase() === targetName.toLowerCase()) {
        return full;
      }
      if (entry.isDirectory()) {
        const res = findFileRecursively(full, targetName);
        if (res) {
          return res;
        }
      }
    }
  } catch {
    // 접근 불가 시 무시
  }
  return null;
}

