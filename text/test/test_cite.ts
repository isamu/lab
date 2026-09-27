import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { buildStructure } from "../packages/chaff/src/structure/of.ts";
import { checkCitations, type Citation } from "../packages/chaff/src/structure/cite.ts";
import { parseCitations, runCite } from "../packages/chaff/src/commands/cite.ts";
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

describe("chaff cite exits 1 when any citation is off", () => {
  const ROOT = fileURLToPath(new URL("./fixtures/structure/ja/contract.txt", import.meta.url));
  const dir = mkdtempSync(join(tmpdir(), "chaff-cite-"));
  const flag = (argv: readonly string[], name: string): string | undefined => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : undefined);
  const context = { config: { ...EMPTY, language: "ja", baseDir: dir }, flag };
  const run = async (citations: string): Promise<number> => {
    const path = join(dir, "claims.json");
    writeFileSync(path, citations);
    const silent = { log: console.log, error: console.error };
    console.log = () => undefined;
    console.error = () => undefined;
    try {
      return await runCite([ROOT, path], ["cite", ROOT, path], context);
    } finally {
      console.log = silent.log;
      console.error = silent.error;
    }
  };

  it("0 when every citation holds", async () => {
    assert.equal(await run('[{"address":"4.2","quote":"前項の委託料を支払わなければならない"}]'), 0);
  });

  it("1 when one does not", async () => {
    assert.equal(await run('[{"address":"4.2","quote":"前項の委託料を支払わなければならない"},{"address":"5","quote":"年3%"}]'), 1);
  });

  it("1 when the file is not a list of citations", async () => {
    assert.equal(await run('{"address":"4.2"}'), 1);
  });
});
