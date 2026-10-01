import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { stetBlockEnd } from "../packages/chaff/src/stet-block.ts";
import { applySuppressions } from "../packages/chaff/src/stet.ts";
import type { Finding } from "../packages/chaff/src/plugin.ts";

const RULE = "unqualified-superlative";
const STET = `<!-- stet: ${RULE} — 理由 -->`;

const at = (line: number): Finding => ({ rule: RULE, severity: "warning", line, column: 1, quote: "最大", values: {} });

/** The lines of the findings a `stet` leaves, of one finding on every line of the text. */
const keptLines = (text: string): number[] => {
  const lines = text.split("\n");
  const findings = lines.map((_, index) => at(index + 1));
  return applySuppressions(text, findings, [{ start: 0, end: text.length }]).kept.map((finding) => finding.line);
};

describe("stet covers the block right below it", () => {
  it("not the next paragraph, however close (#401)", () => {
    const text = ["# 試し", "", STET, "普通の段落です。", "", "これは最大の理由です。"].join("\n");
    assert.deepEqual(keptLines(text), [1, 2, 5, 6]);
  });

  it("a paragraph wrapped over many lines, to its last line", () => {
    const body = Array.from({ length: 10 }, (_, index) => `折り返した行 ${String(index + 1)}。`);
    const text = [STET, ...body, "", "次の段落。"].join("\n");
    assert.deepEqual(keptLines(text), [12, 13]);
  });

  it("past blank lines between the stet and the block", () => {
    const text = [STET, "", "", "段落。", "続き。", "", "次。"].join("\n");
    assert.deepEqual(keptLines(text), [6, 7]);
  });

  it("a heading alone, even with text right under it", () => {
    assert.deepEqual(keptLines([STET, "## 第4条（返却）", "本文。", "", "次。"].join("\n")), [3, 4, 5]);
    assert.deepEqual(keptLines([STET, "## 第4条（返却）", "", "本文。"].join("\n")), [3, 4]);
  });

  it("a paragraph up to a heading that follows it without a blank line", () => {
    assert.deepEqual(keptLines([STET, "段落。", "# 見出し", "本文。"].join("\n")), [3, 4]);
  });

  it("a whole list, tight or with blank lines between its items, and not the paragraph after it", () => {
    const tight = [STET, "- 一つ目", "- 二つ目", "  続き", "- 三つ目", "", "段落。"].join("\n");
    assert.deepEqual(keptLines(tight), [6, 7]);
    const loose = [STET, "1. 一つ目", "", "2. 二つ目", "", "   続き", "", "3. 三つ目", "", "段落。"].join("\n");
    assert.deepEqual(keptLines(loose), [9, 10]);
    const headed = [STET, "- 一つ目", "", "   # 見出し", "本文。"].join("\n");
    assert.deepEqual(keptLines(headed), [3, 4, 5]);
  });

  it("a whole table", () => {
    const text = [STET, "| a | b |", "| --- | --- |", "| 1 | 2 |", "", "段落。"].join("\n");
    assert.deepEqual(keptLines(text), [5, 6]);
  });

  it("the rest of the line when text follows the comment", () => {
    const text = [`${STET} 段落の始まり。`, "続き。", "", "次。"].join("\n");
    assert.deepEqual(keptLines(text), [3, 4]);
    assert.deepEqual(keptLines([`${STET} 一行の段落。`, "", "次。"].join("\n")), [2, 3]);
  });

  it("the block after a comment that spans lines", () => {
    const text = [`<!-- stet: ${RULE} — 長い`, "理由 -->", "段落。", "", "次。"].join("\n");
    assert.deepEqual(keptLines(text), [4, 5]);
    const apart = [`<!-- stet: ${RULE} — 長い`, "理由 -->", "", "段落。", "", "次。"].join("\n");
    assert.deepEqual(keptLines(apart), [5, 6]);
  });

  it("only its own line at the end of the text", () => {
    assert.deepEqual(keptLines(["段落。", "", STET, "", ""].join("\n")), [1, 2, 4, 5]);
  });

  it("never a line above it", () => {
    const text = ["段落。", STET, "段落。"].join("\n");
    assert.deepEqual(keptLines(text), [1]);
  });
});

describe("stet-section and stet-file keep their reach", () => {
  it("stet-section runs to the next heading, across paragraphs", () => {
    const text = ["# A", `<!-- stet-section: ${RULE} — 理由 -->`, "段落。", "", "段落。", "# B", "段落。"].join("\n");
    const sections = [
      { start: 0, end: text.indexOf("# B") },
      { start: text.indexOf("# B"), end: text.length },
    ];
    const findings = text.split("\n").map((_, index) => at(index + 1));
    const kept = applySuppressions(text, findings, sections).kept.map((finding) => finding.line);
    assert.deepEqual(kept, [1, 7]);
  });

  it("stet-file covers every line", () => {
    const text = ["段落。", `<!-- stet-file: ${RULE} — 理由 -->`, "", "段落。"].join("\n");
    assert.deepEqual(keptLines(text), []);
  });
});

describe("stetBlockEnd", () => {
  it("counts lines from 1", () => {
    assert.equal(stetBlockEnd([STET, "段落。"], 1, false), 2);
    assert.equal(stetBlockEnd([STET], 1, false), 1);
    assert.equal(stetBlockEnd([], 1, false), 1);
  });

  it("reads a long block without recursing per line", () => {
    const lines = [STET, ...Array.from({ length: 200_000 }, () => "行。")];
    assert.equal(stetBlockEnd(lines, 1, false), lines.length);
  });
});
