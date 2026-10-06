import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { prepare } from "../packages/lang-ja/src/pos.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { listNumberBreaks, writtenNumbers } from "../packages/chaff/src/structure/list-numbering.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// numbering-gap は、Markdown の番号付きの箇条書きに書いた番号も比べる。表示は最初の番号から数え直すが、
// 原文を読む人と「手順4を参照」は書いた番号を見る。例文は自作。

const lines = (...rows: string[]): string => rows.join("\n");

const gapsOf = (adapter: LanguageAdapter, source: string, genre = "docs/manual"): string[] =>
  runRules(buildDocument("m.md", source, adapter), loadRules(adapter.id), {}, false, genre)
    .findings.filter((finding) => finding.rule === "numbering-gap")
    .map((finding) => `${String(finding.line)} ${String(finding.values["previous"])} ${String(finding.values["label"])}`);

const item = (offset: number, number: number): { offset: number; number: number; label: string } => ({ offset, number, label: `${String(number)}.` });

before(async () => prepare());

describe("listNumberBreaks", () => {
  it("reports an item that skips or repeats a number", () => {
    assert.deepEqual(
      listNumberBreaks([item(0, 1), item(5, 2), item(10, 4)]).map((issue) => issue.values),
      [{ previous: "2.", label: "4.", expected: 3, found: 4 }],
    );
    assert.deepEqual(
      listNumberBreaks([item(0, 1), item(5, 2), item(10, 2)]).map((issue) => issue.offset),
      [10],
    );
  });

  it("reads nothing in a list numbered by the renderer, a list counted in order, or a 1 that starts again", () => {
    assert.deepEqual(listNumberBreaks([item(0, 1), item(5, 1), item(10, 1)]), []);
    assert.deepEqual(listNumberBreaks([item(0, 3), item(5, 4), item(10, 5)]), []);
    assert.deepEqual(listNumberBreaks([item(0, 1), item(5, 2), item(10, 1), item(15, 2)]), []);
    assert.deepEqual(listNumberBreaks([item(0, 4)]), []);
    assert.deepEqual(listNumberBreaks([]), []);
  });
});

describe("writtenNumbers", () => {
  it("reads 1. and 1) at an item's start, and nothing from a bulleted item", () => {
    const source = "1. a\n2) b\n- c\n";
    assert.deepEqual(
      writtenNumbers(source, [
        { start: 0, end: 4 },
        { start: 5, end: 9 },
      ])?.map((entry) => entry.label),
      ["1.", "2)"],
    );
    assert.equal(
      writtenNumbers(source, [
        { start: 0, end: 4 },
        { start: 10, end: 13 },
      ]),
      undefined,
    );
    assert.deepEqual(writtenNumbers(source, []), []);
  });
});

describe("numbering-gap on a Markdown list", () => {
  it("ja: a step that skips a number", () => {
    const source = lines("# 手順", "", "1. 置きます。", "2. 確かめます。", "3. 直します。", "5. 送ります。", "");
    assert.deepEqual(gapsOf(ja, source), ["6 3. 5."]);
    assert.deepEqual(gapsOf(ja, source.replace("5. 送り", "4. 送り")), []);
  });

  it("en: a step that skips a number, in a README too", () => {
    const source = lines("# Steps", "", "1. Put the files in place.", "2. Run the check.", "4. Send the files.", "");
    assert.deepEqual(gapsOf(en, source), ["5 2. 4."]);
    assert.deepEqual(gapsOf(en, source, "technical/readme"), ["5 2. 4."]);
    assert.deepEqual(gapsOf(en, source.replace("4. Send", "3. Send")), []);
  });

  it("does not read a list written with 1. on every item, a bulleted list, or two lists each counted in order", () => {
    assert.deepEqual(gapsOf(en, lines("# Steps", "", "1. One.", "1. Two.", "1. Three.", "")), []);
    assert.deepEqual(gapsOf(en, lines("# Notes", "", "- One.", "- Two.", "")), []);
    assert.deepEqual(gapsOf(en, lines("# Steps", "", "1. One.", "2. Two.", "", "Then:", "", "1. Again.", "2. More.", "")), []);
  });

  it("does not read a list quoted as an example; reads a list numbered from 1000", () => {
    assert.deepEqual(gapsOf(en, lines("# Guide", "", "> Example input:", ">", "> 1. Install", "> 3. Deploy", "")), []);
    assert.deepEqual(gapsOf(en, lines("# Checklist", "", "1000. Create the tenant.", "1002. Configure the tenant.", "")), ["4 1000. 1002."]);
  });

  it("reports a gap the article structure also reads only once", () => {
    const source = lines("# 契約", "", "## 第1条（目的）", "", "1. 甲は、乙に委託する。", "2. 乙は、受託する。", "4. 甲は、支払う。", "");
    assert.deepEqual(gapsOf(ja, source, "legal/contract"), ["7 2. 4."]);
  });
});
