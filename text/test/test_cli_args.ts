import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { runCli, type CliRun } from "./cli-run.ts";
import { targetsOf } from "../packages/chaff/src/cli-args.ts";
import { main } from "../packages/chaff/src/cli.ts";
import { versionLines } from "../packages/chaff/src/version.ts";

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
  const lintWith = async (args: readonly string[], command?: string): Promise<CliRun> =>
    runCli({ "chaff.yaml": "genre: blog/tech\nlanguage: ja\n", "a.md": "# 手順\n\n設定を開きます。\n" }, [
      ...(command === undefined ? [] : [command]),
      "a.md",
      ...args,
    ]);

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
    const files = {
      "chaff.yaml": 'language: ja\ngenre: blog/tech\nby_path:\n  - files: ["b.md"]\n    genre: business/email\n',
      "a.md": "# 手順\n\n設定を開きます。\n",
      "b.md": "# 連絡\n\n資料を送ります。\n",
    };
    const mixed = await runCli(files, ["eval", "."]);
    const forced = await runCli(files, ["eval", ".", "--genre", "blog/tech"]);
    assert.equal(mixed.code, 1, "by_path だけなら混ざっている");
    assert.match(mixed.err, /混ざっています/u);
    assert.equal(forced.code, 0, forced.err);
  });

  it("無いジャンルは止めて、一覧の出し方を言う", async () => {
    const result = await lintWith(["--genre", "business/novel"]);
    assert.equal(result.code, 1);
    assert.match(result.err, /business\/novel/u);
    assert.match(result.err, /chaff genres/u);
  });
});

describe("--version", () => {
  it("chaffjs と、同梱の言語パッケージ（@chaffjs/lang-*）の版を名前順に並べる。ほかの依存は出さない", () => {
    const manifest = { version: "1.2.3", dependencies: { yaml: "^2.9.0", "@chaffjs/lang-ja": "0.9.0", "@chaffjs/lang-en": "0.8.0" } };
    assert.deepEqual(versionLines(manifest), ["chaffjs 1.2.3", "@chaffjs/lang-en 0.8.0", "@chaffjs/lang-ja 0.9.0"]);
  });

  it("版や依存の書き方が読めなければ、読めるものだけ", () => {
    assert.deepEqual(versionLines({ dependencies: { "@chaffjs/lang-ja": 9 } }), ["chaffjs 0.0.0"]);
    assert.deepEqual(versionLines(undefined), ["chaffjs 0.0.0"]);
  });

  ["--version", "-v"].forEach((flag) => {
    it(`${flag} は版を出して 0 で終わる。ファイルとして探さない`, async () => {
      const printed: string[] = [];
      const log = console.log;
      console.log = (line: unknown) => printed.push(String(line));
      try {
        assert.equal(await main([flag]), 0);
      } finally {
        console.log = log;
      }
      assert.match(printed.join("\n"), /^chaffjs \d+\.\d+\.\d+\n@chaffjs\/lang-en \S+\n@chaffjs\/lang-ja \S+$/u);
    });
  });
});
