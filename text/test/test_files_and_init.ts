import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { collectTargets } from "../packages/chaff/src/files.ts";
import { runInit } from "../packages/chaff/src/init.ts";

const tree = (): string => {
  const root = mkdtempSync(join(tmpdir(), "chaff-"));
  mkdirSync(join(root, "docs"));
  mkdirSync(join(root, "node_modules", "pkg"), { recursive: true });
  mkdirSync(join(root, "dist"));
  writeFileSync(join(root, "README.md"), "# a\n");
  writeFileSync(join(root, "docs", "one.md"), "# b\n");
  writeFileSync(join(root, "docs", "two.markdown"), "# c\n");
  writeFileSync(join(root, "docs", "notes.txt"), "d\n");
  writeFileSync(join(root, "node_modules", "pkg", "README.md"), "# e\n");
  writeFileSync(join(root, "dist", "out.md"), "# f\n");
  return root;
};

describe("検査対象の集め方", () => {
  it("ディレクトリを再帰的にたどる", () => {
    // 集合として比べる。順序はロケールで変わるので、ここで固定してはいけない。
    const root = tree();
    assert.deepEqual(new Set(collectTargets([root]).map((path) => basename(path))), new Set(["README.md", "one.md", "two.markdown"]));
  });

  it("入力の順序が違っても、出力の順序は同じになる", () => {
    // 指摘の並びは CI のログにも baseline にも入る。機械やロケールで揺れてはいけない。
    const root = tree();
    const a = collectTargets([join(root, "docs"), join(root, "README.md")]);
    const b = collectTargets([join(root, "README.md"), join(root, "docs")]);
    assert.deepEqual(a, b);
  });

  it("node_modules と dist を見ない", () => {
    // ここを通すと node_modules の README を延々と検査することになる。
    const found = collectTargets([tree()]);
    assert.ok(!found.some((path) => path.includes("node_modules")), found.join(", "));
    assert.ok(!found.some((path) => path.includes("dist")), found.join(", "));
  });

  it("Markdown 以外は拾わない", () => {
    assert.ok(!collectTargets([tree()]).some((path) => path.endsWith(".txt")));
  });

  it("ファイルを直接指定できる", () => {
    const root = tree();
    assert.deepEqual(
      collectTargets([join(root, "README.md")]).map((path) => basename(path)),
      ["README.md"],
    );
  });

  it("同じファイルを 2 回渡しても 1 件になる", () => {
    const root = tree();
    const file = join(root, "README.md");
    assert.equal(collectTargets([file, file, root]).filter((path) => path.endsWith("README.md")).length, 1);
  });

  it("何も見つからなければ空を返す（呼ぶ側が失敗にする）", () => {
    assert.deepEqual(collectTargets([join(tree(), "docs", "nothing-here")]), []);
  });
});

describe("chaff init", () => {
  it("chaff.yaml と .gitignore を作る", () => {
    const root = mkdtempSync(join(tmpdir(), "chaff-"));
    runInit(root, "business/proposal");
    const config = readFileSync(join(root, "chaff.yaml"), "utf8");
    assert.match(config, /genre: business\/proposal/u);
    // 非エンジニアが開いて意味が分かること。4 語と「数字は要らない」が書かれている。
    ["strict", "normal", "relaxed", "off"].forEach((word) => assert.match(config, new RegExp(word, "u"), `${word} の説明がない`));
    assert.match(config, /数字を書く必要はありません/u);
    assert.match(readFileSync(join(root, ".gitignore"), "utf8"), /\.chaff-cache\//u);
  });

  it("既にある chaff.yaml を上書きしない", () => {
    const root = mkdtempSync(join(tmpdir(), "chaff-"));
    writeFileSync(join(root, "chaff.yaml"), "genre: blog/essay\n", "utf8");
    runInit(root, "blog/tech");
    assert.equal(readFileSync(join(root, "chaff.yaml"), "utf8"), "genre: blog/essay\n");
  });

  it(".gitignore に同じ行を二重に足さない", () => {
    const root = mkdtempSync(join(tmpdir(), "chaff-"));
    writeFileSync(join(root, ".gitignore"), "node_modules/\n.chaff-cache/\n", "utf8");
    runInit(root, "blog/tech");
    const body = readFileSync(join(root, ".gitignore"), "utf8");
    assert.equal(body.split("\n").filter((line) => line === ".chaff-cache/").length, 1);
  });

  it("既存の .gitignore を消さずに追記する", () => {
    const root = mkdtempSync(join(tmpdir(), "chaff-"));
    writeFileSync(join(root, ".gitignore"), "node_modules/\n", "utf8");
    runInit(root, "blog/tech");
    const body = readFileSync(join(root, ".gitignore"), "utf8");
    assert.match(body, /node_modules\//u);
    assert.match(body, /\.chaff-cache\//u);
  });
});
