import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { unknownFrontMatterGenre, unknownGenres, writtenGenres } from "../packages/chaff/src/genre-check.ts";
import { GENRES } from "../packages/chaff/src/genre.ts";
import { main } from "../packages/chaff/src/cli.ts";

const nothing = { flag: undefined, config: undefined, byPath: [] };

describe("書かれたジャンルのうち、知らないもの", () => {
  it("何も書いていなければ無い", () => assert.deepEqual(unknownGenres(nothing, GENRES), []));

  it("知っているジャンルはどこに書いても通す", () => {
    GENRES.forEach((genre) => {
      const written = { flag: genre, config: genre, byPath: [{ files: ["*.md"], genre }] };
      assert.deepEqual(unknownGenres(written, GENRES), [], genre);
    });
  });

  it("by_path で genre を書かない行は見ない", () => {
    assert.deepEqual(unknownGenres({ ...nothing, byPath: [{ files: ["*.md"], genre: undefined }] }, GENRES), []);
  });

  const unknownCases: readonly (readonly [string, Parameters<typeof unknownGenres>[0], ReturnType<typeof unknownGenres>])[] = [
    ["--genre", { ...nothing, flag: "tech" }, [{ where: "--genre", genre: "tech", files: [] }]],
    ["chaff.yaml の genre", { ...nothing, config: "tech" }, [{ where: "config", genre: "tech", files: [] }]],
    ["by_path の genre", { ...nothing, byPath: [{ files: ["docs/*.md"], genre: "tech" }] }, [{ where: "by_path", genre: "tech", files: ["docs/*.md"] }]],
    // ジャンルの頭だけでも、rule の use_for には当たらないことがある。--genre と同じく一覧にあるものだけを通す。
    ["頭だけ", { ...nothing, config: "blog" }, [{ where: "config", genre: "blog", files: [] }]],
    ["空", { ...nothing, config: "" }, [{ where: "config", genre: "", files: [] }]],
    ["大文字違い", { ...nothing, config: "Blog/Tech" }, [{ where: "config", genre: "Blog/Tech", files: [] }]],
    ["前後の空白", { ...nothing, flag: " blog/tech" }, [{ where: "--genre", genre: " blog/tech", files: [] }]],
  ];
  unknownCases.forEach(([label, written, expected]) => {
    it(`知らないジャンル: ${label}`, () => assert.deepEqual(unknownGenres(written, GENRES), expected));
  });

  it("全部を、--genre、chaff.yaml、by_path の順に返す", () => {
    const written = {
      flag: "a",
      config: "b",
      byPath: [
        { files: ["x.md"], genre: "c" },
        { files: ["y.md"], genre: "blog/tech" },
        { files: ["z.md", "w.md"], genre: "d" },
      ],
    };
    assert.deepEqual(
      unknownGenres(written, GENRES).map((entry) => `${entry.where}:${entry.genre}:${entry.files.join(",")}`),
      ["--genre:a:", "config:b:", "by_path:c:x.md", "by_path:d:z.md,w.md"],
    );
  });

  it("--genre が正しくても、chaff.yaml の間違いは言う", () => {
    assert.deepEqual(
      unknownGenres({ ...nothing, flag: "blog/tech", config: "tech" }, GENRES).map((entry) => entry.where),
      ["config"],
    );
  });
});

describe("コマンドが読むジャンル", () => {
  const config = { genre: "tech", byPath: [{ files: ["*.md"], genre: "x" }] };

  it("ジャンルを読むコマンドは、--genre と chaff.yaml の両方", () => {
    ["lint", "a.md", ".", "test", "eval", "rules", "explain", "baseline", "suppressions", "feedback"].forEach((command) =>
      assert.deepEqual(writtenGenres(command, "y", config), { flag: "y", config: "tech", byPath: config.byPath }, command),
    );
  });

  it("ジャンルを読まないコマンドは --genre だけ", () => {
    ["init", "genres", "skill", "relax", "strict", "off", "tree", "cite"].forEach((command) =>
      assert.deepEqual(writtenGenres(command, "y", config), { flag: "y", config: undefined, byPath: [] }, command),
    );
  });
});

describe("front matter の genre のうち、読まなかったもの", () => {
  const cases: readonly (readonly [string, string, string | undefined])[] = [
    ["知らない genre", "---\ngenre: tech\n---\n本文", "tech"],
    ["引用符とコメントを外して言う", '---\ngenre: "jazz" # 音楽\n---\n本文', "jazz"],
    ["知っている genre", "---\ngenre: blog/essay\n---\n本文", undefined],
    // type は Zenn などほかの道具の欄。知らない値でも、ジャンルを書いたつもりではない。
    ["知らない type", '---\ntype: "tech"\n---\n本文', undefined],
    ["type がジャンルで genre が知らない値", "---\ngenre: jazz\ntype: blog/essay\n---\n本文", "jazz"],
    ["front matter が無い", "genre: tech\n\n本文", undefined],
    ["値が無い", "---\ngenre:\n---\n本文", undefined],
  ];
  cases.forEach(([label, source, expected]) => {
    it(label, () => assert.equal(unknownFrontMatterGenre(source, GENRES), expected));
  });
});

type Run = { readonly code: number; readonly out: string; readonly err: string };

const DOC = "# 見出し\n\nこれは、とても長い文章であり、読みにくいかもしれないのですが、とにかく書いてみることにしましたので、よろしくお願いします。\n";

const runIn = async (files: Readonly<Record<string, string>>, args: readonly string[], lang = "ja_JP.UTF-8"): Promise<Run> => {
  const dir = mkdtempSync(join(tmpdir(), "chaff-genre-check-"));
  Object.entries(files).forEach(([name, body]) => writeFileSync(join(dir, name), body));
  const out: string[] = [];
  const err: string[] = [];
  const saved = { log: console.log, error: console.error, cwd: process.cwd(), lang: process.env["LANG"], all: process.env["LC_ALL"] };
  console.log = (...parts: unknown[]) => {
    out.push(parts.join(" "));
  };
  console.error = (...parts: unknown[]) => {
    err.push(parts.join(" "));
  };
  delete process.env["LC_ALL"];
  process.env["LANG"] = lang;
  process.chdir(dir);
  try {
    return { code: await main(args), out: out.join("\n"), err: err.join("\n") };
  } finally {
    process.chdir(saved.cwd);
    console.log = saved.log;
    console.error = saved.error;
    if (saved.lang === undefined) delete process.env["LANG"];
    else process.env["LANG"] = saved.lang;
    if (saved.all !== undefined) process.env["LC_ALL"] = saved.all;
  }
};

const assertStopped = (result: Run, genre: string, where: RegExp): void => {
  assert.equal(result.code, 1);
  assert.equal(result.out, "", "何も検査しない");
  assert.match(result.err, new RegExp(`"${genre}"`, "u"));
  assert.match(result.err, where);
  GENRES.forEach((known) => assert.ok(result.err.includes(known), `${known} を挙げていない`));
};

describe("知らないジャンルを CLI はどう扱うか", () => {
  it("chaff.yaml の genre: 何も検査せずに止め、使えるジャンルを挙げる", async () => {
    assertStopped(await runIn({ "chaff.yaml": "genre: tech\n", "a.md": DOC }, ["a.md"]), "tech", /chaff\.yaml の genre/u);
  });

  it("chaff.yaml の by_path の genre: 何も検査せずに止め、どの files の行かを言う", async () => {
    const config = 'by_path:\n  - files: "*.md"\n    genre: tech\n';
    assertStopped(await runIn({ "chaff.yaml": config, "a.md": DOC }, ["a.md"]), "tech", /by_path.*\*\.md/u);
  });

  it("--genre: 何も検査せずに止め、使えるジャンルを挙げる", async () => {
    assertStopped(await runIn({ "a.md": DOC }, ["a.md", "--genre", "tech"]), "tech", /--genre/u);
  });

  it("英語でも言う", async () => {
    const result = await runIn({ "chaff.yaml": "genre: tech\nlanguage: en\n", "a.md": DOC }, ["a.md"], "C");
    assertStopped(result, "tech", /There is no genre "tech" \(genre in chaff\.yaml\)/u);
  });

  it("ジャンルを読むコマンドはどれも止める", async () => {
    const files = { "chaff.yaml": "genre: tech\n", "a.md": DOC };
    const commands: readonly (readonly string[])[] = [
      ["test", "a.md", "--dry-run"],
      ["eval", "."],
      ["rules", "--json"],
      ["explain", "max-sentence-length"],
      ["baseline"],
    ];
    await commands.reduce(async (previous, args) => {
      await previous;
      assert.equal((await runIn(files, args)).code, 1, args.join(" "));
    }, Promise.resolve());
  });

  it("ジャンルを読まないコマンドは止めない（genres は正しい名前を知る手段）", async () => {
    const result = await runIn({ "chaff.yaml": "genre: tech\n" }, ["genres"]);
    assert.equal(result.code, 0);
    assert.match(result.out, /business\/meeting-notes/u);
  });

  it("front matter の genre: 検査は止めず、読まなかったと言い、既定のジャンルの rule を動かす", async () => {
    const result = await runIn({ "a.md": `---\ngenre: tech\n---\n${DOC}` }, ["a.md"]);
    assert.equal(result.code, 0);
    assert.match(result.err, /a\.md: front matter の genre "tech"/u);
    assert.match(result.out, /blog\/tech · 日本語 {3}ジャンルは既定から/u);
    assert.match(result.out, /件の rule は動いていません/u);
  });

  it("front matter の断りは、その文書の言語で言う（端末とも chaff.yaml とも違っても）", async () => {
    const english = await runIn({ "a.md": "---\ngenre: tech\n---\n# Notes\n\nThis is a short note.\n" }, ["a.md"], "ja_JP.UTF-8");
    assert.match(english.err, /a\.md: the front matter's genre "tech" is not a genre/u);
    const config = 'language: en\nby_path:\n  - files: "*.md"\n    language: ja\n';
    const japanese = await runIn({ "chaff.yaml": config, "a.md": `---\ngenre: tech\n---\n${DOC}` }, ["a.md"], "C");
    assert.match(japanese.err, /a\.md: front matter の genre "tech"/u);
  });

  it("front matter の type（Zenn）は何も言わない", async () => {
    const result = await runIn({ "a.md": `---\ntype: "tech"\n---\n${DOC}` }, ["a.md"]);
    assert.equal(result.err, "");
  });

  it("chaff.yaml が genre を決めていれば、front matter は読まないので何も言わない", async () => {
    const result = await runIn({ "chaff.yaml": "genre: blog/essay\n", "a.md": `---\ngenre: tech\n---\n${DOC}` }, ["a.md"]);
    assert.equal(result.code, 0);
    assert.equal(result.err, "");
    assert.match(result.out, /blog\/essay/u);
  });

  it("知っているジャンルなら、どこに書いても何も言わない", async () => {
    const sources: readonly (readonly [Readonly<Record<string, string>>, readonly string[]])[] = [
      [{ "chaff.yaml": "genre: business/report\n", "a.md": DOC }, ["a.md"]],
      [{ "chaff.yaml": 'by_path:\n  - files: "*.md"\n    genre: business/report\n', "a.md": DOC }, ["a.md"]],
      [{ "a.md": DOC }, ["a.md", "--genre", "business/report"]],
      [{ "a.md": `---\ngenre: business/report\n---\n${DOC}` }, ["a.md"]],
    ];
    await sources.reduce(async (previous, [files, args]) => {
      await previous;
      const result = await runIn(files, args);
      assert.equal(result.code, 0, result.err);
      assert.equal(result.err, "");
      assert.match(result.out, /business\/report/u);
    }, Promise.resolve());
  });
});
