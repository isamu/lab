import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { blockQuotations } from "../packages/chaff/src/detectors/block-quotation.ts";
import { unsourcedBlockQuotes } from "../packages/chaff/src/detectors/quote-without-source.ts";
import { readMarkdown } from "../packages/chaff/src/markdown-read.ts";

// A block quotation given to someone by a dash line (> … / — Name), for quote-without-source. All text is self-written.

const lines = (...rows: string[]): string => rows.join("\n");
const RULE = "quote-without-source";
const QUOTE = "Adding people to a late project only makes it later.";

const quotationsOf = (source: string): { readonly quote: string; readonly at: string }[] =>
  blockQuotations(readMarkdown(source).root, source).map((found) => ({ quote: found.quote, at: source.slice(found.offset, found.offset + 6) }));

const unsourced = (source: string): string[] => unsourcedBlockQuotes(blockQuotations(readMarkdown(source).root, source)).map((found) => found.quote);

describe("blockQuotations: a block quotation and its dash line", () => {
  const given: readonly (readonly [string, string])[] = [
    ["the dash line inside the quotation", lines(`> ${QUOTE}`, ">", "> — Dana Reyes")],
    ["the dash line right after it, as its own paragraph", lines(`> ${QUOTE}`, "", "— Dana Reyes")],
    ["the dash line as a lazy continuation", lines(`> ${QUOTE}`, "— Dana Reyes")],
    ["two em dashes", lines(`> ${QUOTE}`, "", "—— Dana Reyes")],
    ["a horizontal bar", lines(`> ${QUOTE}`, "", "― Dana Reyes")],
    ["an en dash", lines(`> ${QUOTE}`, "", "– Dana Reyes")],
    ["no space after the dash", lines(`> ${QUOTE}`, "", "—Dana Reyes")],
    ["a Japanese name after a horizontal bar", lines(`> ${QUOTE}`, "", "― 佐藤")],
    ["inside a list item", lines(`- Notes:`, "", `  > ${QUOTE}`, "  >", "  > — Dana Reyes")],
  ];
  given.forEach(([name, source]) => {
    it(name, () => assert.deepEqual(quotationsOf(source), [{ quote: QUOTE, at: "Adding" }]));
  });

  const notGiven: readonly (readonly [string, string])[] = [
    ["no dash line", lines(`> ${QUOTE}`, "", "Dana Reyes said this.")],
    ["a dash line two paragraphs later", lines(`> ${QUOTE}`, "", "A paragraph between.", "", "— Dana Reyes")],
    ["a single hyphen opens a list item", lines(`> ${QUOTE}`, "", "- Dana Reyes")],
    ["a dash with no name after it", lines(`> ${QUOTE}`, "", "— 2024")],
    ["a long line opening with a dash is a sentence", lines(`> ${QUOTE}`, "", `— ${"and then it went on ".repeat(8)}`)],
    ["a GitHub alert is the writer's own text", lines("> [!NOTE]", `> ${QUOTE}`, ">", "> — Dana Reyes")],
    ["a dash line alone in the quotation quotes nothing", lines("> — Dana Reyes")],
    ["a dash line in a code block", lines("```", `> ${QUOTE}`, "— Dana Reyes", "```")],
    ["a dash line that goes on a sentence", lines(`> ${QUOTE}`, "", "— and then the schedule slipped again.")],
    ["an email signature after a reply", lines("> On Tuesday, Alice wrote:", `> ${QUOTE}`, "", "-- Dana Reyes")],
    ["code in the quotation is not its words", lines("> ```", `> ${QUOTE}`, "> ```", "> — Dana Reyes")],
  ];
  notGiven.forEach(([name, source]) => {
    it(name, () => assert.deepEqual(quotationsOf(source), []));
  });

  it("a quotation inside a quotation is read on its own", () => {
    assert.deepEqual(quotationsOf(lines("> Context from the writer.", ">", `> > ${QUOTE}`, "> > — Dana Reyes")), [{ quote: QUOTE, at: "Adding" }]);
    assert.deepEqual(quotationsOf(lines(`> > ${QUOTE}`, "> > — Dana Reyes", ">", "> — Kim Lee")), [{ quote: QUOTE, at: "Adding" }]);
  });

  it("an outer quotation given to someone is read whole, and the one inside is not read again", () => {
    assert.deepEqual(quotationsOf(lines(`> ${QUOTE}`, ">", "> > Another line, quoted inside.", ">", "> Yet more words.", ">", "> — Kim Lee")), [
      { quote: `${QUOTE} Yet more words.`, at: "Adding" },
    ]);
  });

  it("joins English lines with a space and Japanese lines with nothing", () => {
    assert.deepEqual(
      quotationsOf(lines("> Adding people to a late", "> project makes it later.", "> — Dana Reyes"))[0]?.quote,
      "Adding people to a late project makes it later.",
    );
    assert.deepEqual(
      quotationsOf(lines("> 遅れているプロジェクトに", "> 人を足すと、さらに遅れる。", "> ― 佐藤"))[0]?.quote,
      "遅れているプロジェクトに人を足すと、さらに遅れる。",
    );
  });

  it("an empty document and one with no quotation give nothing", () => {
    assert.deepEqual(quotationsOf(""), []);
    assert.deepEqual(quotationsOf("— Dana Reyes"), []);
  });
});

describe("unsourcedBlockQuotes: a source in the quotation or on its dash line", () => {
  it("a name alone is no source", () => {
    assert.deepEqual(unsourced(lines(`> ${QUOTE}`, "", "— Dana Reyes")), [QUOTE]);
  });

  const sourced: readonly (readonly [string, string])[] = [
    ["a year in brackets", "— Dana Reyes, Late Projects (1975)"],
    ["a link", "— [Dana Reyes](https://example.com/talk)"],
    ["a URL", "— Dana Reyes, https://example.com/talk"],
    ["a footnote", "— Dana Reyes[^1]"],
  ];
  sourced.forEach(([name, line]) => {
    it(name, () => assert.deepEqual(unsourced(lines(`> ${QUOTE}`, "", line)), []));
  });

  it("a footnote inside the quotation", () => {
    assert.deepEqual(unsourced(lines(`> ${QUOTE}[^1]`, "", "— Dana Reyes")), []);
  });

  it("a short quotation is a word or a label, not someone's words", () => {
    assert.deepEqual(unsourced(lines("> Ship it.", "", "— Dana Reyes")), []);
  });
});

describe("quote-without-source reads block quotations", () => {
  const findingsOf = (source: string, adapter = en, path = "a.md"): readonly string[] => namedRuleRun(RULE, source, adapter, path, "blog/tech").findings;

  it("an English block quotation with only a name", () => {
    assert.deepEqual(findingsOf(lines("# Notes", "", `> ${QUOTE}`, "", "— Dana Reyes", "")), [
      `"${QUOTE}" is given to someone, but no source (a link, a footnote, a reference) is given`,
    ]);
  });

  it("a Japanese block quotation with only a name", () => {
    assert.equal(findingsOf(lines("# 記録", "", "> 遅れているプロジェクトに人を足すと、さらに遅れる。", ">", "> ― 佐藤", ""), ja).length, 1);
  });

  it("a block quotation whose dash line names a work and a year", () => {
    assert.deepEqual(findingsOf(lines("# Notes", "", `> ${QUOTE}`, "", "— Dana Reyes, Late Projects (1975)", "")), []);
  });

  it("a plain-text document has no block quotations", () => {
    assert.deepEqual(findingsOf(lines(`> ${QUOTE}`, "", "— Dana Reyes", ""), en, "a.txt"), []);
  });
});
