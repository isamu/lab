import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { prepare } from "../packages/lang-ja/src/pos.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";

// numbering-gap and dangling-reference: 「##第二条」 (no space after the hashes) is a paragraph to CommonMark, but the writer
// meant the article's heading. The article numbers are read through it. Example text is self-written.

const lines = (...rows: string[]): string => rows.join("\n");

const structureFindings = (source: string, path = "c.md"): [string, unknown][] =>
  runRules(buildDocument(path, source, ja), loadRules(ja.id), {}, true, "legal/contract")
    .findings.filter((finding) => finding.rule === "numbering-gap" || finding.rule === "dangling-reference")
    .map((finding) => [finding.rule, finding.values["label"]]);

const contract = (second: string, third = "## 第三条 （免責）"): string =>
  lines(
    "# 業務委託契約書",
    "",
    "## 第一条 （目的）",
    "",
    "本契約は、業務の委託について定める。",
    "",
    second,
    "",
    "本条の定めは、契約の終了後も効力を有する。",
    "",
    third,
    "",
    "甲は、天災による遅延について責任を負わない。",
  );

before(async () => prepare());

describe("numbering-gap: an article heading written without the space after the hashes", () => {
  it("reads 「##第二条」 as article 2, so there is no gap and no reference to a missing article", () => {
    assert.deepEqual(structureFindings(contract("##第二条 （存続条項）")), []);
  });

  it("reads it at any heading depth and with a full-width number", () => {
    const source = lines(
      "# 規程",
      "",
      "### 第１条 （目的）",
      "",
      "本規程の目的。",
      "",
      "###第２条 （適用）",
      "",
      "全員に適用する。",
      "",
      "### 第３条 （改廃）",
      "",
      "改廃する。",
    );
    assert.deepEqual(structureFindings(source), []);
  });

  it("reads a chapter written the same way", () => {
    const source = lines(
      "# 規程",
      "",
      "## 第一章 総則",
      "",
      "総則を定める。",
      "",
      "##第二章 雑則",
      "",
      "雑則を定める。",
      "",
      "## 第三章 附則",
      "",
      "附則を定める。",
    );
    assert.deepEqual(structureFindings(source), []);
  });

  it("still reports a real gap next to such a heading", () => {
    assert.deepEqual(structureFindings(contract("##第二条 （存続条項）", "## 第四条 （免責）")), [["numbering-gap", "第四条"]]);
  });

  it("still reports the gap when the unspaced line is not an article", () => {
    assert.deepEqual(structureFindings(contract("#存続について")), [["numbering-gap", "第三条"]]);
  });

  it("leaves a plain-text file alone: there are no headings to repair", () => {
    const source = lines("第一条 （目的）", "本契約の目的。", "", "##第二条 （存続条項）", "存続する。", "", "第三条 （免責）", "免責する。");
    assert.deepEqual(
      structureFindings(source, "c.txt").map(([rule]) => rule),
      ["dangling-reference", "numbering-gap"],
    );
  });

  it("keeps the hash of a setext heading's title: 「#第二条」 underlined is a title, not article 2", () => {
    assert.deepEqual(structureFindings(contract("#第二条\n====")), [["dangling-reference", "第二条"]]);
  });

  it("does not read seven hashes as a heading", () => {
    assert.deepEqual(structureFindings(contract("#######第二条 （存続条項）")), [
      ["dangling-reference", "第二条"],
      ["numbering-gap", "第三条"],
    ]);
  });
});
