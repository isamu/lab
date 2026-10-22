import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { firedRules } from "./rule-run.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { boldEmphasis, emphasisSpanCount } from "../packages/chaff/src/detectors/bold-emphasis.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// bold-emphasis: bold phrases scattered mid-sentence through a whole document. Every example is self-written.

const RULE = "bold-emphasis";

const fires = (source: string, adapter: LanguageAdapter, genre = "blog/tech"): boolean => firedRules(adapter, source, genre).includes(RULE);

/** Just over 200 words of plain prose, in paragraphs, with no bold: two bold spans in it pass the normal rate. */
const SHORT_EN = Array.from(
  { length: 10 },
  (_unused, index) => `Paragraph ${index + 1} says what the team did that week and what it will do next, in plain words with no emphasis at all.`,
).join("\n\n");

/** About 340 words of plain prose. */
const PLAIN_EN = SHORT_EN.concat("\n\n", "We met on Monday, wrote the notes the same day and shared them with everyone in the group before lunch. ".repeat(6));

/** About 800 characters of plain Japanese prose. */
const PLAIN_JA = "私たちの課では、毎週月曜の朝に短い打ち合わせを開き、先週の仕事と今週の仕事を一人ずつ話します。\n\n".repeat(16);

const emphasised = (count: number): string =>
  Array.from({ length: count }, (_unused, index) => `Step ${index + 1} is **really important** for the result.`).join("\n\n");

before(async () => {
  await ja.prepare?.({ pos: true });
  await en.prepare?.({ pos: true });
});

describe("emphasisSpanCount: bold in the prose, less the labels", () => {
  const countOf = (source: string): number => emphasisSpanCount(buildDocument("t.md", source, en));

  it("counts bold mid-sentence", () => assert.equal(countOf("# T\n\nSome **bold** and **more** text.\n"), 2));
  it("leaves out a bold label opening a list item, but keeps bold later in the item", () =>
    assert.equal(countOf("# T\n\n- **Speed**: fast and **cheap**.\n- **Cost**: low.\n"), 1));
  it("leaves out bold in headings and tables", () => assert.equal(countOf("# T **x**\n\n| a | **b** |\n|---|---|\n| 1 | 2 |\n\nText.\n"), 0));
  it("is zero without bold", () => assert.equal(countOf("# T\n\nPlain text.\n"), 0));
  it("leaves out a list item labelled in bold code", () => assert.equal(countOf("# T\n\n- **`--flag`**: what it does.\n- **`--other`**: more.\n"), 0));
  it("keeps a bold lead without a colon: emphasis, not a label", () =>
    assert.equal(countOf("# T\n\n- **Same pay.** No cut.\n- **Fridays off.** For all.\n"), 2));
});

describe("bold-emphasis", () => {
  it("invalid: bold scattered through a short English post is reported", () => {
    assert.ok(fires(`# Post\n\n${emphasised(4)}\n\n${PLAIN_EN}\n`, en));
  });

  it("quotes the first sentence with bold, not the section's first sentence", () => {
    const doc = buildDocument("t.md", `# Post\n\nNo bold here at all.\n\n${emphasised(4)}\n\n${SHORT_EN}\n`, en);
    const [finding] = boldEmphasis(doc, { limit: 6 });
    assert.equal(finding?.quote, "Step 1 is really important for the result.");
  });

  it("invalid: the same in a business report", () => {
    assert.ok(fires(`# Report\n\n${emphasised(4)}\n\n${PLAIN_EN}\n`, en, "business/report"));
  });

  it("valid: two bold spans are what a careful writer keeps", () => {
    assert.ok(!fires(`# Post\n\n${emphasised(2)}\n\n${SHORT_EN}\n`, en));
    assert.ok(fires(`# Post\n\n${emphasised(3)}\n\n${SHORT_EN}\n`, en));
  });

  it("valid: plain prose without bold", () => {
    assert.ok(!fires(`# Post\n\n${PLAIN_EN}\n`, en));
  });

  it("valid: a short document is not measured", () => {
    assert.ok(!fires(`# Post\n\n${emphasised(4)}\n`, en));
  });

  it("valid: bold labels opening list items are bold-label-list's to count", () => {
    const labels = Array.from({ length: 6 }, (_unused, index) => `- **Item ${index + 1}**: what it does.`).join("\n");
    assert.ok(!fires(`# Post\n\n${labels}\n\n${PLAIN_EN}\n`, en));
  });

  it("valid: bold in a table is a label, not emphasis", () => {
    const rows = Array.from({ length: 6 }, (_unused, index) => `| **Row ${index + 1}** | value |`).join("\n");
    assert.ok(!fires(`# Post\n\n| Name | Value |\n|---|---|\n${rows}\n\n${PLAIN_EN}\n`, en));
  });

  it("valid: a README, a contract and meeting notes are not checked", () => {
    ["technical/readme", "legal/contract", "business/meeting-notes"].forEach((genre) =>
      assert.ok(!fires(`# Notes\n\n${emphasised(6)}\n\n${PLAIN_EN}\n`, en, genre), genre),
    );
  });

  it("invalid: bold scattered through a Japanese post past the Japanese limit", () => {
    const bold = Array.from({ length: 10 }, (_unused, index) => `手順 ${index + 1} は**とても大事**です。`).join("\n\n");
    assert.ok(fires(`# 記事\n\n${bold}\n\n${PLAIN_JA}\n`, ja));
  });

  it("valid: a few bold spans in a long Japanese post stay under the Japanese limit", () => {
    const bold = Array.from({ length: 3 }, (_unused, index) => `手順 ${index + 1} は**とても大事**です。`).join("\n\n");
    assert.ok(!fires(`# 記事\n\n${bold}\n\n${PLAIN_JA}\n`, ja));
  });
});
