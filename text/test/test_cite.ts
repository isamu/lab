import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { buildStructure } from "../packages/chaff/src/structure/of.ts";
import { checkCitations, type Citation } from "../packages/chaff/src/structure/cite.ts";
import { runCite } from "../packages/chaff/src/commands/cite.ts";
import { bySource, parseCitations, sourceProblem, type Claim } from "../packages/chaff/src/commands/cite-claims.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";
import { EMPTY } from "../packages/chaff/src/config/load.ts";

// 回答の引用が原文にあるか。番地の有無、引用文の有無、書いてある場所の食い違いを、日英と Markdown で確かめる。

const lines = (...rows: string[]): string => rows.join("\n");

type Outcome = readonly [string, string | undefined];

const check = (adapter: LanguageAdapter, source: string, citations: readonly Citation[], markdown = false): Outcome[] => {
  if (adapter.structure === undefined) throw new Error("no structure");
  const tree = buildStructure({ path: "c", source, language: adapter.id, markdown }, adapter.structure);
  return checkCitations(source, tree, citations).map((result) => [result.status, result.foundAt]);
};

const CONTRACT = lines(
  "第1条（目的）",
  "甲は、乙に対し、本件業務を委託する。",
  "第2条（支払）",
  "甲は、検収後30日以内に委託料を支払わなければならない。",
  "２　支払が遅れたときは、年3%の遅延損害金を加算する。",
  "第3条（解除）",
  "甲は、第2条に違反したときは解除できる。",
);

describe("日本語の契約書", () => {
  const cases: readonly (readonly [string, Citation, Outcome])[] = [
    ["番地と引用文が合う", { address: "2", quote: "検収後30日以内に委託料を支払わなければならない" }, ["ok", undefined]],
    ["項の中の文", { address: "2.2", quote: "年3%の遅延損害金" }, ["ok", undefined]],
    ["条を指せば、その項の文も条の範囲", { address: "2", quote: "年3%の遅延損害金" }, ["ok", undefined]],
    ["番号の無い第 1 項（2.1）は、第2条そのもの", { address: "2.1", quote: "検収後30日以内に委託料を支払わなければならない" }, ["ok", undefined]],
    ["全角数字と改行で書き写しても一致", { address: "2", quote: "検収後３０日以内に\n委託料を支払わなければならない。" }, ["ok", undefined]],
    ["引用文が別の条にある", { address: "3", quote: "検収後30日以内" }, ["quote-elsewhere", "2"]],
    ["引用文がいちばん内側の番地で示される", { address: "1", quote: "遅延損害金" }, ["quote-elsewhere", "2.2"]],
    ["無い条", { address: "9", quote: "" }, ["missing-address", undefined]],
    ["数字を書き換えた引用", { address: "2", quote: "検収後60日以内" }, ["quote-not-found", undefined]],
    ["言い換えた引用", { address: "2", quote: "30日以内に払う" }, ["quote-not-found", undefined]],
    ["引用文が空なら番地だけを見る", { address: "3", quote: "" }, ["ok", undefined]],
    ["空白だけの引用も番地だけ", { address: "3", quote: " \n　" }, ["ok", undefined]],
  ];
  cases.forEach(([name, citation, expected]) => {
    it(name, () => assert.deepEqual(check(ja, CONTRACT, [citation]), [expected]));
  });

  it("半角カナの濁点や結合文字も、一文字として揃えて比べる", () => {
    const source = lines("第1条（名称）", "名称はガイドとバスとする。");
    assert.deepEqual(
      check(ja, source, [
        { address: "1", quote: "ｶﾞｲﾄﾞ" },
        { address: "1", quote: "ハ\u3099ス" },
      ]),
      [
        ["ok", undefined],
        ["ok", undefined],
      ],
    );
  });

  it("附則が第1条から振り直しても、どちらの第1条に書いてあれば一致", () => {
    const source = lines("第1条（目的）", "本規程は業務を定める。", "附則", "第1条（施行）", "本規程は令和6年4月1日から施行する。");
    assert.deepEqual(
      check(ja, source, [
        { address: "1", quote: "本規程は業務を定める" },
        { address: "1", quote: "令和6年4月1日から施行する" },
      ]),
      [
        ["ok", undefined],
        ["ok", undefined],
      ],
    );
  });

  it("隣り合う項にまたがる引用は、両方を含む条の範囲なら一致", () => {
    assert.deepEqual(check(ja, CONTRACT, [{ address: "2", quote: "支払わなければならない。２　支払が遅れたときは" }]), [["ok", undefined]]);
  });

  it("互換文字（㈱）も NFKC で揃えて比べる", () => {
    assert.deepEqual(check(ja, lines("第1条（当事者）", "委託者は(株)アルファとする。"), [{ address: "1", quote: "㈱アルファ" }]), [["ok", undefined]]);
  });
});

describe("an English contract", () => {
  const source = lines(
    "Section 1 Scope",
    "The Provider shall perform the Services.",
    "Section 2 Fees",
    "(a) The Customer shall pay within 30 days.",
    "(b) Late amounts bear interest at 1.5 percent.",
  );
  const cases: readonly (readonly [string, Citation, Outcome])[] = [
    ["an exact quote", { address: "2.a", quote: "The Customer shall pay within 30 days." }, ["ok", undefined]],
    ["the section covers its items", { address: "2", quote: "interest at 1.5 percent" }, ["ok", undefined]],
    ["wrapped differently", { address: "2.b", quote: "Late amounts bear\n  interest" }, ["ok", undefined]],
    ["quoted from the wrong item", { address: "2.a", quote: "1.5 percent" }, ["quote-elsewhere", "2.b"]],
    ["a changed number", { address: "2.a", quote: "within 60 days" }, ["quote-not-found", undefined]],
    ["an address that does not exist", { address: "2.c", quote: "anything" }, ["missing-address", undefined]],
    ["a quote running past the end of the item it names", { address: "2.a", quote: "30 days. (b) Late amounts" }, ["quote-elsewhere", "2"]],
    ["a quote starting before the item it names", { address: "2.b", quote: "30 days. (b) Late amounts" }, ["quote-elsewhere", "2"]],
  ];
  cases.forEach(([name, citation, expected]) => {
    it(name, () => assert.deepEqual(check(en, source, [citation]), [expected]));
  });
});

describe("the line reported for a citation", () => {
  const linesOf = (citations: readonly Citation[]): (number | undefined)[] => {
    if (ja.structure === undefined) throw new Error("no structure");
    const tree = buildStructure({ path: "c", source: CONTRACT, language: "ja", markdown: false }, ja.structure);
    return checkCitations(CONTRACT, tree, citations).map((result) => result.line);
  };

  it("is the quote's own line when it matches, not the article's", () => {
    assert.deepEqual(linesOf([{ address: "2", quote: "年3%の遅延損害金" }]), [5]);
  });

  it("is the line where the quote actually is when it is elsewhere", () => {
    assert.deepEqual(linesOf([{ address: "3", quote: "年3%の遅延損害金" }]), [5]);
  });

  it("is the address's line when the quote is empty", () => {
    assert.deepEqual(linesOf([{ address: "3", quote: "" }]), [6]);
  });
});

describe("a quote written in more than one place", () => {
  it("reports the first place it appears", () => {
    const source = lines("第1条（甲）", "期限は月末とする。", "第2条（乙）", "本文。", "第3条（丙）", "期限は月末とする。");
    assert.deepEqual(check(ja, source, [{ address: "2", quote: "期限は月末とする" }]), [["quote-elsewhere", "1"]]);
  });

  it("is ok when the address it names is one of them", () => {
    const source = lines("第1条（甲）", "期限は月末とする。", "第2条（乙）", "本文。", "第3条（丙）", "期限は月末とする。");
    assert.deepEqual(check(ja, source, [{ address: "3", quote: "期限は月末とする" }]), [["ok", undefined]]);
  });
});

describe("Markdown headings without numbers", () => {
  const manual = lines("# Guide", "", "## Install", "", "Run the installer.", "", "## Configure", "", "Set the password.");
  it("cites by heading address", () => {
    assert.deepEqual(
      check(
        en,
        manual,
        [
          { address: "h1.1", quote: "Run the installer." },
          { address: "h1.1", quote: "Set the password." },
        ],
        true,
      ),
      [
        ["ok", undefined],
        ["quote-elsewhere", "h1.2"],
      ],
    );
  });
});

describe("characters outside the basic plane", () => {
  const source = lines("Section 1 Setup", "Pair with A 👩‍💻 B before you start.", "Section 2 Use", "Run the tool 😀 twice.");
  it("an emoji quote inside its section", () => {
    assert.deepEqual(check(en, source, [{ address: "1", quote: "A 👩‍💻 B" }]), [["ok", undefined]]);
  });

  it("a quote after an emoji keeps its place", () => {
    assert.deepEqual(
      check(en, source, [
        { address: "2", quote: "😀 twice" },
        { address: "1", quote: "tool 😀 twice" },
      ]),
      [
        ["ok", undefined],
        ["quote-elsewhere", "2"],
      ],
    );
  });
});

describe("code in a manual is part of its section", () => {
  // 木がコードを覆うのは、コードの中の「Section 9」を番号や参照と読まないため。コードがその節の中身であることは変わらない。
  it("a quoted command inside a code block counts for its section", () => {
    const manual = lines("# Guide", "", "## Install", "", "Run this:", "", "```sh", "npm install chaffjs", "```");
    assert.deepEqual(check(en, manual, [{ address: "h1.1", quote: "npm install chaffjs" }], true), [["ok", undefined]]);
  });
});

describe("parseCitations", () => {
  const cases: readonly (readonly [string, string, boolean])[] = [
    ["an array of citations", '[{"address":"3","quote":"x"}]', true],
    ["an empty array", "[]", true],
    ["not JSON", "[{", false],
    ["an object, not an array", '{"address":"3","quote":"x"}', false],
    ["a missing quote", '[{"address":"3"}]', false],
    ["a numeric address", '[{"address":3,"quote":"x"}]', false],
    ["null inside", "[null]", false],
  ];
  cases.forEach(([name, text, ok]) => {
    it(name, () => assert.equal("citations" in parseCitations(text), ok));
  });

  it("keeps only address and quote", () => {
    assert.deepEqual(parseCitations('[{"address":"3","quote":"x","note":"y"}]'), { citations: [{ address: "3", quote: "x" }] });
  });
});

describe("parseCitations and a missing address", () => {
  const cases: readonly (readonly [string, string, boolean])[] = [
    ["no address", '[{"quote":"x"}]', true],
    ["an empty address", '[{"address":"","quote":"x"}]', true],
    ["an address of null", '[{"address":null,"quote":"x"}]', false],
    ["neither an address nor a quote", '[{"address":"","quote":""}]', false],
    ["no address and a blank quote", '[{"quote":" \\n"}]', false],
    ["an address and an empty quote", '[{"address":"3","quote":""}]', true],
  ];
  cases.forEach(([name, text, ok]) => {
    it(name, () => assert.equal("citations" in parseCitations(text), ok));
  });

  it("reads a missing address as empty", () => {
    assert.deepEqual(parseCitations('[{"quote":"x"}]'), { citations: [{ address: "", quote: "x" }] });
  });

  it("names the entry that is empty", () => {
    assert.deepEqual(parseCitations('[{"quote":"x"},{"quote":""}]', "en"), {
      error: "Entry 2 has neither an address nor a quote, so there is nothing to check",
    });
  });
});

describe("a citation with no address is looked for anywhere in the source", () => {
  type Found = readonly [string, string | undefined, number | undefined];
  const located = (source: string, citations: readonly Citation[], markdown = false): Found[] => {
    if (ja.structure === undefined) throw new Error("no structure");
    const tree = buildStructure({ path: "c", source, language: "ja", markdown }, ja.structure);
    return checkCitations(source, tree, citations).map((result) => [result.status, result.foundAt, result.line]);
  };

  it("matches, with the innermost address and the line it is on", () => {
    assert.deepEqual(located(CONTRACT, [{ address: "", quote: "年3%の遅延損害金" }]), [["ok", "2.2", 5]]);
  });

  it("a blank address is the same as none", () => {
    assert.deepEqual(located(CONTRACT, [{ address: "  ", quote: "本件業務を委託する" }]), [["ok", "1", 2]]);
  });

  it("a source with no addresses still gives the line", () => {
    const article = lines("ブログの本文です。", "", "設計の本には「変更は小さく、頻繁に」と書いてある。");
    assert.deepEqual(located(article, [{ address: "", quote: "変更は小さく、頻繁に" }], true), [["ok", undefined, 3]]);
  });

  it("is not found when the words are not there", () => {
    assert.deepEqual(located(CONTRACT, [{ address: "", quote: "検収後60日以内" }]), [["quote-not-found", undefined, undefined]]);
  });

  it("an empty quote with no address is not a match: it names nothing", () => {
    assert.deepEqual(located(CONTRACT, [{ address: "", quote: " \n" }]), [["missing-address", undefined, undefined]]);
  });
});

describe("chaff cite exits 1 when any citation is off", () => {
  const ROOT = fileURLToPath(new URL("./fixtures/structure/ja/contract.txt", import.meta.url));
  const dir = mkdtempSync(join(tmpdir(), "chaff-cite-"));
  const flag = (argv: readonly string[], name: string): string | undefined => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : undefined);
  const context = { config: { ...EMPTY, language: "ja", baseDir: dir }, flag };
  const printed: string[] = [];
  const run = async (citations: string): Promise<number> => {
    const path = join(dir, "claims.json");
    writeFileSync(path, citations);
    printed.length = 0;
    const silent = { log: console.log, error: console.error };
    console.log = (text: string) => printed.push(text);
    console.error = (text: string) => printed.push(text);
    try {
      return await runCite([ROOT, path], ["cite", ROOT, path], context);
    } finally {
      console.log = silent.log;
      console.error = silent.error;
    }
  };

  it("a quote with no address says where it was found", async () => {
    assert.equal(await run('[{"quote":"前項の委託料を支払わなければならない"}]'), 0);
    assert.match(printed.join("\n"), /^✓ （番地なし）「前項の委託料を支払わなければならない」: 一致（4\.2、\d+ 行目）$/u);
  });

  it("a quote with no address that is not there", async () => {
    assert.equal(await run('[{"quote":"前項の委託料を支払うものとする"}]'), 1);
    assert.equal(printed.join("\n"), "✗ （番地なし）「前項の委託料を支払うものとする」: 引用文が原文のどこにもありません");
  });

  it("0 when every citation holds", async () => {
    assert.equal(await run('[{"address":"4.2","quote":"前項の委託料を支払わなければならない"}]'), 0);
  });

  it("1 when one does not", async () => {
    assert.equal(await run('[{"address":"4.2","quote":"前項の委託料を支払わなければならない"},{"address":"5","quote":"年3%"}]'), 1);
  });

  it("1 when the file is not a list of citations", async () => {
    assert.equal(await run('{"address":"4.2"}'), 1);
  });

  it("1 when a claim names its own source and a source is given too", async () => {
    assert.equal(await run('[{"source":"other.txt","quote":"前項の委託料を支払わなければならない"}]'), 1);
    assert.match(printed.join("\n"), /1 件目が source を書いていますが/u);
  });
});

describe("claims that name their own source", () => {
  const parsed = (text: string): readonly Claim[] => {
    const result = parseCitations(text);
    if (!("citations" in result)) throw new Error(result.error);
    return result.citations;
  };

  it("keeps source when it is given, and only then", () => {
    assert.deepEqual(parsed('[{"source":"a.md","quote":"x"},{"quote":"y"}]'), [
      { source: "a.md", address: "", quote: "x" },
      { address: "", quote: "y" },
    ]);
  });

  it("a source that is not a string is a bad entry", () => {
    assert.equal("error" in parseCitations('[{"source":3,"quote":"x"}]'), true);
  });

  const problems: readonly (readonly [string, string, boolean, string | undefined])[] = [
    ["every claim names one, none on the command line", '[{"source":"a.md","quote":"x"}]', false, undefined],
    ["one on the command line, none in the claims", '[{"quote":"x"}]', true, undefined],
    ["an empty source is no source", '[{"source":" ","quote":"x"}]', true, undefined],
    ["a claim with no source and none on the command line", '[{"source":"a.md","quote":"x"},{"source":"","quote":"y"}]', false, "Entry 2 has no source"],
    ["a claim with a source and one on the command line too", '[{"quote":"x"},{"source":"a.md","quote":"y"}]', true, "Entry 2 names a source"],
  ];
  problems.forEach(([name, text, sourceGiven, expected]) => {
    it(name, () => {
      const problem = sourceProblem(parsed(text), sourceGiven, "en");
      if (expected === undefined) assert.equal(problem, undefined);
      else assert.ok(problem?.startsWith(expected), problem ?? "no problem");
    });
  });

  it("groups claims by source in the order the sources first appear", () => {
    const claims = parsed('[{"source":"b.md","quote":"1"},{"source":"a.md","quote":"2"},{"source":" b.md ","quote":"3"}]');
    assert.deepEqual(
      bySource(claims).map((group) => [group.source, group.claims.map((claim) => claim.quote)]),
      [
        ["b.md", ["1", "3"]],
        ["a.md", ["2"]],
      ],
    );
  });
});

describe("chaff cite <claims.json> reads each claim's own source", () => {
  const dir = mkdtempSync(join(tmpdir(), "chaff-cite-sources-"));
  writeFileSync(join(dir, "talk.md"), "# Talk\n\nAdding people to a late project makes it later.\n");
  writeFileSync(join(dir, "notes.md"), "# Notes\n\n## Rollbacks\n\nA rollback you have never run is not a rollback.\n");
  const flag = (argv: readonly string[], name: string): string | undefined => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : undefined);
  const context = { config: { ...EMPTY, language: "en", baseDir: dir }, flag, ui: "en" as const };
  const printed: string[] = [];
  const run = async (claims: string, extra: readonly string[] = []): Promise<number> => {
    const path = join(dir, "claims.json");
    writeFileSync(path, claims);
    printed.length = 0;
    const saved = { log: console.log, error: console.error };
    console.log = (text: string) => printed.push(text);
    console.error = (text: string) => printed.push(text);
    try {
      return await runCite([path], ["cite", path, ...extra], context);
    } finally {
      console.log = saved.log;
      console.error = saved.error;
    }
  };

  it("checks each claim against its own file, next to the claims file, in the claims' order", async () => {
    const code = await run(
      JSON.stringify([
        { source: "notes.md", address: "h1.1", quote: "never run" },
        { source: "talk.md", quote: "late project makes it later" },
        { source: "notes.md", quote: "a rollback is free" },
      ]),
    );
    assert.equal(code, 1);
    assert.deepEqual(printed.join("\n").split("\n"), [
      '✓ notes.md h1.1 "never run": matches',
      '✓ talk.md (anywhere) "late project makes it later": matches (h1, line 3)',
      '✗ notes.md (anywhere) "a rollback is free": the quotation is nowhere in the source',
    ]);
  });

  it("JSON results carry each claim's source", async () => {
    assert.equal(await run(JSON.stringify([{ source: "talk.md", quote: "late project" }]), ["--format", "json"]), 0);
    const results: unknown = JSON.parse(printed.join("\n"));
    assert.deepEqual(results, [{ citation: { source: "talk.md", address: "", quote: "late project" }, status: "ok", line: 3, foundAt: "h1" }]);
  });

  it("1, with the reason, when a claim has no source", async () => {
    assert.equal(await run(JSON.stringify([{ source: "", quote: "late project" }])), 1);
    assert.match(printed.join("\n"), /Entry 1 has no source/u);
  });

  it("a source written with Windows separators names the same file", async () => {
    mkdirSync(join(dir, "sources"), { recursive: true });
    writeFileSync(join(dir, "sources", "talk.md"), "# Talk\n\nAdding people to a late project makes it later.\n");
    assert.equal(await run(JSON.stringify([{ source: "sources\\talk.md", quote: "late project" }])), 0);
  });

  it("1 when a source cannot be read", async () => {
    assert.equal(await run(JSON.stringify([{ source: "missing.md", quote: "late project" }])), 1);
    assert.match(printed.join("\n"), /missing\.md/u);
  });
});

describe("chaff cite --scaffold", () => {
  const dir = mkdtempSync(join(tmpdir(), "chaff-cite-scaffold-"));
  const flag = (argv: readonly string[], name: string): string | undefined => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : undefined);
  const context = { config: { ...EMPTY, language: "en", baseDir: dir }, flag, ui: "en" as const };
  const captured = async (run: () => Promise<number>): Promise<{ readonly code: number; readonly out: string }> => {
    const out: string[] = [];
    const saved = { log: console.log, error: console.error };
    console.log = (text: string) => out.push(text);
    console.error = (text: string) => out.push(text);
    try {
      return { code: await run(), out: out.join("\n") };
    } finally {
      console.log = saved.log;
      console.error = saved.error;
    }
  };
  const scaffold = async (document: string, targets?: readonly string[]): Promise<{ readonly code: number; readonly out: string }> => {
    const path = join(dir, "post.md");
    writeFileSync(path, document);
    const given = targets ?? [path];
    return captured(() => runCite(given, ["cite", "--scaffold", ...given], context));
  };

  const POST = [
    "# Notes",
    "",
    'Dana Reyes said "most outages start with a change nobody reviewed".',
    "",
    'The slides are at https://example.com/a, and they claim "a rollback you never ran is no rollback".',
    "",
    "> A change you cannot undo is a change you have not finished.",
    ">",
    "> — Kim Lee",
    "",
  ].join("\n");

  it("writes one claim for each quotation with no source, with source and address to fill in", async () => {
    const { code, out } = await scaffold(POST);
    assert.equal(code, 0);
    assert.deepEqual(JSON.parse(out), [
      { source: "", address: "", quote: "most outages start with a change nobody reviewed" },
      { source: "", address: "", quote: "A change you cannot undo is a change you have not finished." },
    ]);
  });

  it("an empty list when every quotation names a source", async () => {
    const { code, out } = await scaffold("# Notes\n\nNo one is quoted here.\n");
    assert.equal(code, 0);
    assert.deepEqual(JSON.parse(out), []);
  });

  it("the scaffold, filled in with a source, is checked by chaff cite <claims.json>", async () => {
    const claims: unknown = JSON.parse((await scaffold(POST)).out);
    assert.ok(Array.isArray(claims));
    writeFileSync(join(dir, "talk.md"), "# Talk\n\nShe said most outages start with a change nobody reviewed.\n");
    const filled = claims.map((claim: unknown) => ({ ...(typeof claim === "object" ? claim : {}), source: "talk.md" }));
    const claimsPath = join(dir, "claims.json");
    writeFileSync(claimsPath, JSON.stringify(filled));
    const { code, out } = await captured(() => runCite([claimsPath], ["cite", claimsPath], context));
    assert.equal(code, 1);
    assert.deepEqual(out.split("\n"), [
      '✓ talk.md (anywhere) "most outages start with a change nobody …": matches (h1, line 3)',
      '✗ talk.md (anywhere) "A change you cannot undo is a change you…": the quotation is nowhere in the source',
    ]);
  });

  it("1 and the usage for a format cite does not know", async () => {
    const path = join(dir, "post.md");
    writeFileSync(path, POST);
    const { code, out } = await captured(() => runCite([path], ["cite", "--scaffold", path, "--format", "xml"], context));
    assert.equal(code, 1);
    assert.match(out, /^usage:/u);
  });

  it("1 and the usage without exactly one document", async () => {
    const { code, out } = await scaffold(POST, []);
    assert.equal(code, 1);
    assert.match(out, /--scaffold/u);
  });
});
