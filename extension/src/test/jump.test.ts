import * as assert from "assert";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { resolveTargetFilePath } from "../pathResolver";

suite("resolveTargetFilePath", () => {
  let root: string;

  setup(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "specpilot-jump-"));
  });

  teardown(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  test("직접 매칭 경로를 올바르게 찾는다", () => {
    const file = path.join(root, "src", "NoticeController.java");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, "class NoticeController {}");

    const found = resolveTargetFilePath(root, "src/NoticeController.java");
    assert.strictEqual(found, file);

    const foundWindows = resolveTargetFilePath(root, "src\\NoticeController.java");
    assert.strictEqual(foundWindows, file);
  });

  test("루트 서브폴더가 한 겹 더 감싸진 경우 탐색한다", () => {
    // 예: zip 내용이 project-root/src/NoticeController.java 로 되어 있는 경우
    const file = path.join(root, "project-root", "src", "NoticeController.java");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, "class NoticeController {}");

    const found = resolveTargetFilePath(root, "src/NoticeController.java");
    assert.strictEqual(found, file);
  });

  test("반대로 경로에 서브폴더 접두사가 있는데 대상 폴더에는 없는 경우 탐색한다", () => {
    // 예: filePath가 project-root/src/NoticeController.java 인데 실제 폴더는 root/src/NoticeController.java
    const file = path.join(root, "src", "NoticeController.java");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, "class NoticeController {}");

    const found = resolveTargetFilePath(root, "project-root/src/NoticeController.java");
    assert.strictEqual(found, file);
  });

  test("파일명만 입력된 경우에도 하위 폴더에서 파일을 재귀적으로 찾는다", () => {
    const file = path.join(root, "specpilot", "src", "main", "NoticeController.java");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, "class NoticeController {}");

    const found = resolveTargetFilePath(root, "NoticeController.java");
    assert.strictEqual(found, file);
  });

  test("존재하지 않는 파일은 null을 반환한다", () => {
    const found = resolveTargetFilePath(root, "non/existent/File.java");
    assert.strictEqual(found, null);
  });
});
