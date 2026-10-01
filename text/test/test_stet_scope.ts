import { describe, it } from "node:test";
import assert from "node:assert/strict";
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

  it("a Setext heading alone, up to its underline", () => {
    assert.deepEqual(keptLines([STET, "A Setext Heading", "================", "Body paragraph.", "", "Next."].join("\n")), [4, 5, 6]);
    assert.deepEqual(keptLines([STET, "見出し", "---", "本文。"].join("\n")), [4]);
  });

  it("a paragraph up to a heading that follows it without a blank line", () => {
    assert.deepEqual(keptLines([STET, "段落。", "# 見出し", "本文。"].join("\n")), [3, 4]);
  });

  it("a whole list, tight or with blank lines between its items, and not what follows it", () => {
    const tight = [STET, "- 一つ目", "- 二つ目", "  続き", "- 三つ目", "", "段落。"].join("\n");
    assert.deepEqual(keptLines(tight), [6, 7]);
    const loose = [STET, "1. 一つ目", "", "2. 二つ目", "", "   続き", "", "3. 三つ目", "", "段落。"].join("\n");
    assert.deepEqual(keptLines(loose), [9, 10]);
    assert.deepEqual(keptLines([STET, "- 一つ目", "", "# 見出し", "本文。"].join("\n")), [3, 4, 5]);
  });

  it("inside a list item, the item's next block, not the next item", () => {
    const text = ["- 一つ目", `  ${STET}`, "  この続きだけ", "- 二つ目"].join("\n");
    assert.deepEqual(keptLines(text), [1, 4]);
  });

  it("a whole table, and a line right under it is one of its rows, as GFM renders it", () => {
    assert.deepEqual(keptLines([STET, "| a | b |", "| --- | --- |", "| 1 | 2 |", "", "段落。"].join("\n")), [5, 6]);
    assert.deepEqual(keptLines([STET, "| a |", "| --- |", "| 1 |", "段落。"].join("\n")), []);
  });

  it("a whole fenced code block, blank lines inside it included", () => {
    assert.deepEqual(keptLines([STET, "~~~", "前", "", "後", "~~~", "", "次。"].join("\n")), [7, 8]);
  });

  it("a whole quote", () => {
    assert.deepEqual(keptLines([STET, "> 引用一", ">", "> 引用二", "", "次。"].join("\n")), [5, 6]);
  });

  it("only the line itself when text follows the comment on it", () => {
    assert.deepEqual(keptLines([`${STET} 一行の段落。`, "", "次。"].join("\n")), [2, 3]);
  });

  it("the rest of its paragraph when the comment sits inside one", () => {
    assert.deepEqual(keptLines(["段落の始まり、", `ここに ${STET} があり、`, "続く。", "", "次。"].join("\n")), [1, 4, 5]);
    assert.deepEqual(keptLines([`始まり、${STET}`, "**強調**の行、", "続く。", "", "次。"].join("\n")), [4, 5]);
  });

  it("the block after a comment that spans lines", () => {
    assert.deepEqual(keptLines([`<!-- stet: ${RULE} — 長い`, "理由 -->", "段落。", "", "次。"].join("\n")), [4, 5]);
    assert.deepEqual(keptLines([`<!-- stet: ${RULE} — 長い`, "理由 -->", "", "段落。", "", "次。"].join("\n")), [5, 6]);
  });

  it("only its own line at the end of the text", () => {
    assert.deepEqual(keptLines(["段落。", "", STET, "", ""].join("\n")), [1, 2, 4, 5]);
  });

  it("never a line above it", () => {
    assert.deepEqual(keptLines(["段落。", STET, "段落。"].join("\n")), [1]);
  });

  it("plain text: up to the blank line", () => {
    assert.deepEqual(keptLines([STET, "第四条　本文の一行目。", "　二行目。", "", "第五条　次。"].join("\n")), [4, 5]);
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
    assert.deepEqual(keptLines(["段落。", `<!-- stet-file: ${RULE} — 理由 -->`, "", "段落。"].join("\n")), []);
  });
});

describe("stet on large documents", () => {
  it("thousands of stets, each covering its own paragraph", { timeout: 60_000 }, () => {
    const text = Array.from({ length: 2000 }, (_, index) => `${STET}\n段落 ${String(index)}。`).join("\n\n");
    const blanks = text.split("\n").flatMap((line, index) => (line === "" ? [index + 1] : []));
    assert.deepEqual(keptLines(text), blanks);
  });

  it("a deeply nested quote", () => {
    const depth = ">".repeat(10_000);
    assert.deepEqual(keptLines([`${depth} ${STET}`, `${depth} 段落。`, "", "次。"].join("\n")), [3, 4]);
  });

  it("a long paragraph and a long loose list", () => {
    const paragraph = [STET, ...Array.from({ length: 20_000 }, () => "行。"), "", "次。"].join("\n");
    assert.deepEqual(keptLines(paragraph).slice(0, 2), [20_002, 20_003]);
    const list = [STET, ...Array.from({ length: 10_000 }, (_, index) => (index % 2 === 0 ? `- 項目 ${String(index)}` : "")), "段落。"];
    assert.deepEqual(keptLines(list.join("\n")), [list.length - 1, list.length]);
  });
});
