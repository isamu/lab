import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { targetsOf } from "../packages/chaff/src/cli-args.ts";
import { main } from "../packages/chaff/src/cli.ts";

describe("検査するものの取り出し", () => {
  const cases: readonly (readonly [string, readonly string[], readonly string[]])[] = [
    ["ファイルだけ", ["a.md", "docs/"], ["a.md", "docs/"]],
    ["値を取らないオプションは除く", ["a.md", "--compact", "--experimental"], ["a.md"]],
    ["--sarif の値は対象ではない", ["a.md", "--sarif", "out.sarif"], ["a.md"]],
    ["--genre の値は対象ではない", ["--genre", "business/email", "a.md"], ["a.md"]],
    ["--why の値は対象ではない", ["rule", "--why", "理由"], ["rule"]],
    ["--format の値は対象ではない", ["a.md", "--format", "json"], ["a.md"]],
    ["値の無い --genre で終わる", ["a.md", "--genre"], ["a.md"]],
    ["空", [], []],
  ];
  cases.forEach(([label, args, expected]) => {
    it(label, () => assert.deepEqual(targetsOf(args), expected));
  });
});

describe("--genre で、この実行のジャンルを決める", () => {
  const lintWith = async (args: readonly string[]): Promise<{ code: number; out: string; err: string }> => {
    const dir = mkdtempSync(join(tmpdir(), "chaff-genre-"));
    writeFileSync(join(dir, "chaff.yaml"), "genre: blog/tech\nlanguage: ja\n");
    writeFileSync(join(dir, "a.md"), "# 手順\n\n設定を開きます。\n");
    const out: string[] = [];
    const err: string[] = [];
    const saved = { log: console.log, error: console.error, cwd: process.cwd() };
    console.log = (...parts: unknown[]) => {
      out.push(parts.join(" "));
    };
    console.error = (...parts: unknown[]) => {
      err.push(parts.join(" "));
    };
    process.chdir(dir);
    try {
      const code = await main(["a.md", ...args]);
      return { code, out: out.join("\n"), err: err.join("\n") };
    } finally {
      process.chdir(saved.cwd);
      console.log = saved.log;
      console.error = saved.error;
    }
  };

  it("chaff.yaml の genre より優先し、どこから決めたかを出す", async () => {
    const result = await lintWith(["--genre", "business/email"]);
    assert.equal(result.code, 0, result.err);
    assert.match(result.out, /business\/email/u);
    assert.match(result.out, /--genre/u);
  });

  it("指定しなければ chaff.yaml の genre のまま", async () => {
    const result = await lintWith([]);
    assert.match(result.out, /blog\/tech/u);
    assert.doesNotMatch(result.out, /--genre/u);
  });

  it("無いジャンルは止めて、一覧の出し方を言う", async () => {
    const result = await lintWith(["--genre", "business/novel"]);
    assert.equal(result.code, 1);
    assert.match(result.err, /business\/novel/u);
    assert.match(result.err, /chaff genres/u);
  });
});
