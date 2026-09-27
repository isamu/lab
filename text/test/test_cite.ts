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
  ];
  cases.forEach(([name, citation, expected]) => {
    it(name, () => assert.deepEqual(check(en, source, [citation]), [expected]));
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
