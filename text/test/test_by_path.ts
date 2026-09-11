import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyByPath, matches, type PathRule } from "../packages/chaff/src/config/by-path.ts";
import { loadConfig } from "../packages/chaff/src/config/load.ts";

describe("glob の照合", () => {
  const hit = (glob: string, path: string): boolean => matches(glob, "base", join("base", path));

  it("**/ はディレクトリ 0 個にも当たる", () => {
    // ここを落とすと docs/**/*.md が docs/a.md に当たらない。
    // glob の典型的な落とし穴で、設定を書いた人は当たらない理由に気づけない。
    assert.equal(hit("docs/**/*.md", "docs/a.md"), true);
  });

  it("**/ は何階層でも当たる", () => {
    assert.equal(hit("docs/**/*.md", "docs/a/b/c.md"), true);
  });

  it("別のディレクトリには当たらない", () => {
    assert.equal(hit("docs/**/*.md", "blog/a.md"), false);
  });

  it("* は区切りをまたがない", () => {
    assert.equal(hit("docs/*.md", "docs/a.md"), true);
    assert.equal(hit("docs/*.md", "docs/a/b.md"), false);
  });

  it("? は 1 文字だけ", () => {
    assert.equal(hit("a?.md", "ab.md"), true);
    assert.equal(hit("a?.md", "abc.md"), false);
  });

  it("拡張子のドットを正規表現として扱わない", () => {
    // "." をそのまま置くと a-md にも当たる。
    assert.equal(hit("*.md", "axmd"), false);
    assert.equal(hit("*.md", "a.md"), true);
  });

  it("実行した場所ではなく、設定ファイルの場所から見る", () => {
    assert.equal(matches("blog/*.md", "/proj/text", "/proj/text/blog/a.md"), true);
    assert.equal(matches("blog/*.md", "/proj", "/proj/text/blog/a.md"), false);
  });
});

describe("パスごとの上書き", () => {
  const rules: PathRule[] = [
    { files: ["**/*.md"], genre: "blog/tech", language: undefined },
    { files: ["business/**/*.md"], genre: "business/report", language: undefined },
    { files: ["en/**/*.md"], genre: undefined, language: "en" },
  ];

  it("当たったものを返す", () => {
    assert.deepEqual(applyByPath(rules, "base", join("base", "business", "a.md")), { genre: "business/report" });
  });

  it("後に書いたものが勝つ", () => {
    // 「全体はこう、ここだけは違う」と書けるようにするため。
    assert.equal(applyByPath(rules, "base", join("base", "business", "a.md")).genre, "business/report");
  });

  it("ジャンルと言語を別々に上書きできる", () => {
    const got = applyByPath(rules, "base", join("base", "en", "a.md"));
    assert.equal(got.language, "en");
    assert.equal(got.genre, "blog/tech");
  });

  it("当たらなければ何も返さない", () => {
    assert.deepEqual(applyByPath(rules, "base", join("base", "a.txt")), {});
  });

  it("規則が無ければ何も返さない", () => {
    assert.deepEqual(applyByPath([], "base", join("base", "a.md")), {});
  });
});

describe("設定ファイルからの読み込み", () => {
  const write = (body: string): string => {
    const dir = mkdtempSync(join(tmpdir(), "chaff-"));
    const path = join(dir, "chaff.yaml");
    writeFileSync(path, body, "utf8");
    return path;
  };

  it("by_path を読み、設定ファイルの場所を基準にする", () => {
    const path = write(["genre: blog/tech", "by_path:", '  - files: ["business/**/*.md"]', "    genre: business/report"].join("\n"));
    const config = loadConfig(path);
    assert.equal(config.byPath.length, 1);
    assert.equal(config.byPath[0]?.genre, "business/report");
    assert.equal(applyByPath(config.byPath, config.baseDir, join(config.baseDir, "business", "a.md")).genre, "business/report");
  });

  it("files が 1 つの文字列でも書ける", () => {
    const config = loadConfig(write(['by_path:\n  - files: "docs/*.md"\n    genre: business/report'].join("\n")));
    assert.deepEqual(config.byPath[0]?.files, ["docs/*.md"]);
  });

  it("files が無い項目は落とす", () => {
    assert.deepEqual(loadConfig(write("by_path:\n  - genre: business/report\n")).byPath, []);
  });

  it("by_path が無くても落ちない", () => {
    assert.deepEqual(loadConfig(write("genre: blog/tech\n")).byPath, []);
  });
});
