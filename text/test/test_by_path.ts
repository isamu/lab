import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyByPath, matches, type PathRule } from "../packages/chaff/src/config/by-path.ts";
import { loadConfig } from "../packages/chaff/src/config/read.ts";
import { byPathOf } from "../packages/chaff/src/config/load.ts";
import { byPathProblems } from "../packages/chaff/src/config/by-path-problems.ts";

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

describe("byPathOf: by_path の読み", () => {
  it("files のある項目を読み、読めない項目だけを返す", () => {
    const read = byPathOf([{ files: "a/*.md", genre: "docs/manual" }, { genre: "x" }, "a/*.md", null, { files: [] }]);
    assert.deepEqual(read.rules, [{ files: ["a/*.md"], genre: "docs/manual", language: undefined, profile: undefined }]);
    assert.deepEqual(read.unreadable, ['{"genre":"x"}', '"a/*.md"', "null", '{"files":[]}']);
  });

  it("並びでない値は丸ごと読めない。書いていなければ何も無い", () => {
    assert.deepEqual(byPathOf({ guides: "docs/manual" }), { rules: [], unreadable: ['{"guides":"docs/manual"}'] });
    assert.deepEqual(byPathOf("guides"), { rules: [], unreadable: ['"guides"'] });
    assert.deepEqual(byPathOf(undefined), { rules: [], unreadable: [] });
    assert.deepEqual(byPathOf(null), { rules: [], unreadable: [] });
    assert.deepEqual(byPathOf([]), { rules: [], unreadable: [] });
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

  it("files が無い項目は落とし、読めなかったと言う", () => {
    const config = loadConfig(write("by_path:\n  - genre: business/report\n"));
    assert.deepEqual(config.byPath, []);
    assert.equal(byPathProblems(config).length, 1);
  });

  it("by_path が無くても落ちず、何も言わない", () => {
    const config = loadConfig(write("genre: blog/tech\n"));
    assert.deepEqual(config.byPath, []);
    assert.deepEqual(byPathProblems(config), []);
  });

  it("並びでなく、フォルダとジャンルの対で書いた by_path は使わず、書き方を両方の言語で言う", () => {
    const config = loadConfig(write("by_path:\n  guides: docs/manual\n"));
    assert.deepEqual(config.byPath, []);
    const [jaProblem] = byPathProblems(config, "ja");
    const [enProblem] = byPathProblems(config, "en");
    assert.match(jaProblem ?? "", /by_path/u);
    assert.match(jaProblem ?? "", /guides/u);
    assert.match(jaProblem ?? "", /files/u);
    assert.match(enProblem ?? "", /by_path/u);
    assert.match(enProblem ?? "", /files/u);
  });

  it("文書の種類（profile）を、全体とパスごとに読む", () => {
    const config = loadConfig(write(["profile: none", "by_path:", '  - files: ["laws/**/*.txt"]', "    profile: statute"].join("\n")));
    assert.equal(config.profile, "none");
    assert.equal(applyByPath(config.byPath, config.baseDir, join(config.baseDir, "laws", "a.txt")).profile, "statute");
    assert.equal(applyByPath(config.byPath, config.baseDir, join(config.baseDir, "a.txt")).profile, undefined);
    assert.equal(loadConfig(write("genre: blog/tech\n")).profile, undefined);
  });
});
