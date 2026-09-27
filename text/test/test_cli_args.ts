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
    ["--rule の値は対象ではない（eval）", ["docs/", "--rule", "max-sentence-length"], ["docs/"]],
    ["値を取るのは --sarif と --genre だけ（--why と --format は別のコマンドのもの）", ["a.md", "--format", "b.md", "--why", "c.md"], ["a.md", "b.md", "c.md"]],
    ["値の無い --genre で終わる", ["a.md", "--genre"], ["a.md"]],
    ["空", [], []],
  ];
  cases.forEach(([label, args, expected]) => {
    it(label, () => assert.deepEqual(targetsOf(args), expected));
  });
});

describe("--genre で、この実行のジャンルを決める", () => {
  const lintWith = async (args: readonly string[], command?: string): Promise<{ code: number; out: string; err: string }> => {
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
      const code = await main([...(command === undefined ? [] : [command]), "a.md", ...args]);
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

  it("ほかのコマンドでも、無いジャンルは何かする前に止める", async () => {
    const result = await lintWith(["--genre", "business/novel"], "baseline");
    assert.equal(result.code, 1);
    assert.match(result.err, /business\/novel/u);
  });

  it("eval にも届く: by_path で分かれたジャンルを、--genre で 1 つにそろえて測れる", async () => {
    const dir = mkdtempSync(join(tmpdir(), "chaff-genre-eval-"));
    writeFileSync(join(dir, "chaff.yaml"), 'language: ja\ngenre: blog/tech\nby_path:\n  - files: ["b.md"]\n    genre: business/email\n');
    writeFileSync(join(dir, "a.md"), "# 手順\n\n設定を開きます。\n");
    writeFileSync(join(dir, "b.md"), "# 連絡\n\n資料を送ります。\n");
    const saved = { log: console.log, error: console.error, cwd: process.cwd() };
    const err: string[] = [];
    console.log = () => undefined;
    console.error = (...parts: unknown[]) => {
      err.push(parts.join(" "));
    };
    process.chdir(dir);
    try {
      const mixed = await main(["eval", "."]);
      const forced = await main(["eval", ".", "--genre", "blog/tech"]);
      assert.equal(mixed, 1, "by_path だけなら混ざっている");
      assert.match(err.join("\n"), /混ざっています/u);
      assert.equal(forced, 0, err.join("\n"));
    } finally {
      process.chdir(saved.cwd);
      console.log = saved.log;
      console.error = saved.error;
    }
  });

  it("無いジャンルは止めて、一覧の出し方を言う", async () => {
    const result = await lintWith(["--genre", "business/novel"]);
    assert.equal(result.code, 1);
    assert.match(result.err, /business\/novel/u);
    assert.match(result.err, /chaff genres/u);
  });
});
