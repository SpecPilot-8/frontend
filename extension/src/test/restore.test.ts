import * as assert from "assert";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  MANIFEST_NAME,
  SnapshotPayload,
  applyRestore,
  planRestore,
  safeJoin,
  sanitizeFolderName,
  sha256Hex,
} from "../restore";

function snapshot(id: string, files: Record<string, string>): SnapshotPayload {
  return {
    snapshot_id: id,
    content_hash: `hash-${id}`,
    file_count: Object.keys(files).length,
    files: Object.entries(files).map(([p, content]) => ({ path: p, content, sha256: sha256Hex(content) })),
  };
}

suite("restore", () => {
  let root: string;
  setup(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "specpilot-restore-"));
  });
  teardown(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  test("sanitizeFolderName 은 윈도우 금지 문자와 예약어를 정리한다", () => {
    assert.strictEqual(sanitizeFolderName("내 프로젝트"), "내 프로젝트");
    assert.strictEqual(sanitizeFolderName('a/b\\c:d*e?f"g<h>i|j'), "a_b_c_d_e_f_g_h_i_j");
    assert.strictEqual(sanitizeFolderName("name. "), "name");
    assert.strictEqual(sanitizeFolderName("CON"), "project_CON");
    assert.strictEqual(sanitizeFolderName("   "), "project");
  });

  test("safeJoin 은 폴더 밖으로 나가는 경로를 거부한다", () => {
    for (const bad of ["../x.js", "a/../../x.js", "/x.js", "C:/x.js", "a\\b.js", "", "a//b.js"]) {
      assert.throws(() => safeJoin(root, bad), Error, bad);
    }
    assert.strictEqual(safeJoin(root, "src/a.js"), path.join(root, "src", "a.js"));
  });

  test("빈 위치에는 새로 만들고 파일과 표식을 기록한다", () => {
    const snap = snapshot("aaaaaaaa-1", { "src/main/A.java": "class A {}\r\n", "application.yml": "limit: 10\n" });
    const plan = planRestore(root, "데모", "p1", snap);
    assert.deepStrictEqual([plan.action, plan.alternate, plan.fileCount], ["create", false, 2]);
    applyRestore(plan, "p1", snap);
    assert.strictEqual(fs.readFileSync(path.join(plan.folder, "src", "main", "A.java"), "utf8"), "class A {}\r\n");
    const manifest = JSON.parse(fs.readFileSync(path.join(plan.folder, MANIFEST_NAME), "utf8"));
    assert.strictEqual(manifest.snapshotId, "aaaaaaaa-1");
    assert.strictEqual(manifest.files["application.yml"], sha256Hex("limit: 10\n"));
  });

  test("같은 스냅샷은 사용자가 수정했어도 그대로 재사용한다", () => {
    const snap = snapshot("aaaaaaaa-1", { "a.js": "1" });
    const plan = planRestore(root, "데모", "p1", snap);
    applyRestore(plan, "p1", snap);
    fs.writeFileSync(path.join(plan.folder, "a.js"), "edited");
    const again = planRestore(root, "데모", "p1", snap);
    assert.strictEqual(again.action, "reuse");
    applyRestore(again, "p1", snap);
    assert.strictEqual(fs.readFileSync(path.join(plan.folder, "a.js"), "utf8"), "edited");
  });

  test("다른 스냅샷이고 수정이 없으면 같은 폴더를 갱신한다", () => {
    const first = snapshot("aaaaaaaa-1", { "a.js": "1" });
    applyRestore(planRestore(root, "데모", "p1", first), "p1", first);
    const second = snapshot("bbbbbbbb-2", { "a.js": "2", "b.js": "3" });
    const plan = planRestore(root, "데모", "p1", second);
    assert.deepStrictEqual([plan.action, plan.alternate], ["update", false]);
    applyRestore(plan, "p1", second);
    assert.strictEqual(fs.readFileSync(path.join(plan.folder, "a.js"), "utf8"), "2");
    assert.strictEqual(JSON.parse(fs.readFileSync(path.join(plan.folder, MANIFEST_NAME), "utf8")).snapshotId, "bbbbbbbb-2");
  });

  test("사용자 수정이 있으면 덮어쓰지 않고 새 폴더를 만든다", () => {
    const first = snapshot("aaaaaaaa-1", { "a.js": "1" });
    const original = planRestore(root, "데모", "p1", first);
    applyRestore(original, "p1", first);
    fs.writeFileSync(path.join(original.folder, "a.js"), "edited");
    const second = snapshot("bbbbbbbb-2", { "a.js": "2" });
    const plan = planRestore(root, "데모", "p1", second);
    assert.deepStrictEqual([plan.action, plan.alternate], ["create", true]);
    assert.strictEqual(path.basename(plan.folder), "데모_bbbbbbbb");
    applyRestore(plan, "p1", second);
    assert.strictEqual(fs.readFileSync(path.join(original.folder, "a.js"), "utf8"), "edited");
  });

  test("SpecPilot이 만들지 않은 폴더는 건드리지 않는다", () => {
    fs.mkdirSync(path.join(root, "데모"));
    fs.writeFileSync(path.join(root, "데모", "mine.txt"), "mine");
    const snap = snapshot("aaaaaaaa-1", { "a.js": "1" });
    const plan = planRestore(root, "데모", "p1", snap);
    assert.deepStrictEqual([plan.action, plan.alternate], ["create", true]);
    applyRestore(plan, "p1", snap);
    assert.deepStrictEqual(fs.readdirSync(path.join(root, "데모")), ["mine.txt"]);
  });

  test("해시가 다르거나 경로가 위험한 스냅샷은 아무것도 쓰지 않는다", () => {
    const tampered = snapshot("aaaaaaaa-1", { "a.js": "1" });
    tampered.files[0].content = "changed";
    const plan = planRestore(root, "데모", "p1", tampered);
    assert.throws(() => applyRestore(plan, "p1", tampered));
    assert.ok(!fs.existsSync(plan.folder));

    const escape = snapshot("aaaaaaaa-1", { "../evil.js": "x" });
    const escapePlan = planRestore(root, "데모", "p1", escape);
    assert.throws(() => applyRestore(escapePlan, "p1", escape));
    assert.ok(!fs.existsSync(path.join(root, "evil.js")));
    assert.ok(!fs.existsSync(escapePlan.folder));
  });
});
