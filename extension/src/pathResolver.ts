/**
 * - 담당 파트: 프런트 엔드
 * - 작성자: 이시형
 * - 페이지 개요: 복원된 로컬 프로젝트 폴더 안에서 상대 경로나 파일명으로 실제 파일 위치를 찾는 유틸 파일
 * - 주요 기능:
 *   1) 기본 상대 경로 직접 매칭
 *   2) 상위 폴더 중첩 여부를 고려한 유연한 경로 탐색
 *   3) 파일명 기준 하위 폴더 재귀 탐색
 */

import * as fs from "fs";
import * as path from "path";

// 복원된 폴더 안에서 대상 파일의 실제 경로를 찾는 로직
export function resolveTargetFilePath(
  folder: string,
  relativePath: string,
): string | null {
  const normalized = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");

  const direct = path.join(folder, ...normalized.split("/"));
  if (fs.existsSync(direct) && fs.statSync(direct).isFile()) {
    return direct;
  }

  try {
    const entries = fs.readdirSync(folder, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith(".")) {
        const subDirect = path.join(
          folder,
          entry.name,
          ...normalized.split("/"),
        );
        if (fs.existsSync(subDirect) && fs.statSync(subDirect).isFile()) {
          return subDirect;
        }
      }
    }

    const segments = normalized.split("/");
    if (segments.length > 1) {
      const stripped = segments.slice(1).join("/");
      const subDirect = path.join(folder, ...stripped.split("/"));
      if (fs.existsSync(subDirect) && fs.statSync(subDirect).isFile()) {
        return subDirect;
      }
    }

    const fileName = path.basename(normalized);
    const foundByName = findFileRecursively(folder, fileName);
    if (foundByName) {
      return foundByName;
    }
  } catch {
    // 폴더 탐색 실패 예외 무시
  }

  return null;
}

// 하위 디렉토리를 순회하며 파일명으로 일치하는 파일을 찾는 로직
function findFileRecursively(dir: string, targetName: string): string | null {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".")) {
        continue;
      }
      const full = path.join(dir, entry.name);
      if (
        entry.isFile() &&
        entry.name.toLowerCase() === targetName.toLowerCase()
      ) {
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
    // 하위 폴더 탐색 실패 예외 무시
  }
  return null;
}
