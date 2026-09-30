import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { prepare } from "../packages/lang-ja/src/pos.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { inDocumentOrder } from "../packages/chaff/src/structure/issues.ts";
import { LEAD_REACH, onLine, wrappedLine } from "../packages/chaff/src/structure/wrapped-tail.ts";
import type { LanguageAdapter, Mention, StructureNode } from "../packages/chaff/src/plugin.ts";

// A text wrapped at 72 columns can put the document's name at the end of one line and the reference at the start of the
// next ("… in RFC 7657\n(Sections 5.1 and 6)"). The line before is joined too, so the name is read before the reference.
// Sentences are self-written.

const lines = (...rows: string[]): string => rows.join("\n");

const dangling = (adapter: LanguageAdapter, source: string, path = "c.txt"): string[] =>
  runRules(buildDocument(path, source, adapter), loadRules(adapter.id), {}, true, "business/contract")
    .findings.filter((finding) => finding.rule === "dangling-reference")
    .map((finding) => String(finding.values["label"]));

const treeOf = (adapter: LanguageAdapter, source: string): StructureNode => {
  const tree = buildDocument("c.txt", source, adapter).structure;
  if (tree === undefined) throw new Error("no structure");
  return tree;
};

before(async () => prepare());

describe("a reference whose document is named at the end of the line before", () => {
  it("RFC 7657 at the end of one line and (Sections 5.1 and 6) on the next", () => {
    const source = lines("1.  Scope", "", "   The same limit is discussed in RFC 7657", "   (Sections 5.1 and 6), which covers it.", "");
    assert.deepEqual(dangling(en, source), []);
  });

  it("a code's title number and name at the end of one line, the section sign on the next", () => {
    const source = lines("1.  Scope", "", "   Filing is governed by 35 CFR", "   § 122 and the rules.", "");
    assert.deepEqual(dangling(en, source), []);
  });

  it("the same in Markdown, where the lines are one paragraph", () => {
    const source = lines("## 1. Scope", "", "The same limit is discussed in RFC 7657", "(Sections 5.1 and 6), which covers it.", "");
    assert.deepEqual(dangling(en, source, "c.md"), []);
  });

  it("no document at the end of the line before: the reference is still this document's, and missing", () => {
    const source = lines("1.  Scope", "", "   The same limit is discussed in the note", "   (Sections 5.1 and 6), which covers it.", "");
    assert.deepEqual(dangling(en, source), ["Sections 5.1", "6"]);
  });

  it("a blank line between the name and the reference ends the paragraph", () => {
    const source = lines("1.  Scope", "", "   The same limit is discussed in RFC 7657", "", "   (Sections 5.1 and 6) covers it.", "");
    assert.deepEqual(dangling(en, source), ["Sections 5.1", "6"]);
  });

  it("a heading does not run into the line after it", () => {
    const source = lines("## 1. Scope", "", "## RFC 7657", "(Sections 5.1 and 6) covers it.", "");
    assert.deepEqual(dangling(en, source, "c.md"), ["Sections 5.1", "6"]);
  });

  it("a table row is not the line before a paragraph, nor a paragraph line before a row", () => {
    const lazyRow = lines("## 1. Scope", "", "Doc | Note", "--- | ---", "RFC 7657 | prior row", "(Sections 5.1 and 6) covers it.", "");
    assert.deepEqual(dangling(en, lazyRow, "c.md"), ["Sections 5.1", "6"]);
    const listAfter = lines("## 1. Scope", "", "Doc | Note", "--- | ---", "a | RFC 7657", "- (Sections 5.1 and 6) covers it.", "");
    assert.deepEqual(dangling(en, listAfter, "c.md"), ["Sections 5.1", "6"]);
    const headerAfter = lines("## 1. Scope", "", "The limit is discussed in RFC 7657", "Section 9 | Note", "--- | ---", "a | b", "");
    assert.deepEqual(dangling(en, headerAfter, "c.md"), ["Section 9"]);
  });

  it("a reference on the line before does not lend its document to a parenthesis on this line", () => {
    const source = lines("Section 1 Scope", "Section 2 Duties", "(b) Article 58 of the Regulation (powers),", "(and see also the duty under section 2).", "");
    const documents = inDocumentOrder(treeOf(en, source)).flatMap((node) => (node.kind === "reference" ? [node.attrs["document"]] : []));
    assert.deepEqual(documents, ["Regulation", undefined]);
  });

  it("a numbered line starts a new unit and does not take the line before", () => {
    const source = lines("1.  Scope", "", "   The limit is discussed in RFC 7657", "1.1  Section 9 applies", "");
    assert.deepEqual(dangling(en, source), ["Section 9"]);
  });

  it("a reference on the line before is still read once, on its own line", () => {
    const source = lines("1.  Scope", "", "   See Section 7 and", "   Section 8 for the rest.", "");
    assert.deepEqual(dangling(en, source), ["Section 7", "Section 8"]);
  });

  it("Japanese: the line before does not run into a statute's name at the start of the line", () => {
    const source = lines("第1条 目的", "", "附属学校を置く各公立大学法人担当課", "構造改革特別区域法第12条第1項の認定を受けた学校", "");
    const documents = inDocumentOrder(treeOf(ja, source)).flatMap((node) => (node.kind === "reference" ? [node.attrs["document"]] : []));
    assert.deepEqual(documents, ["構造改革特別区域法"]);
  });

  it("Japanese: without the statute's name the article is this document's, and missing", () => {
    const source = lines("第1条 目的", "", "この規則は次の", "第九十条の定めによる。", "");
    assert.deepEqual(dangling(ja, source), ["第九十条"]);
  });
});

describe("wrappedLine with the line before", () => {
  it("joins the line before with one space and counts its length", () => {
    assert.deepEqual(wrappedLine("(Sections 5.1 and 6)", false, undefined, "   in RFC 7657  "), {
      line: "(Sections 5.1 and 6)",
      text: "in RFC 7657 (Sections 5.1 and 6)",
      lineLength: "(Sections 5.1 and 6)".length,
      leadLength: "in RFC 7657 ".length,
    });
  });

  it("joins both sides", () => {
    assert.deepEqual(wrappedLine("see Section 9", false, "of X", "as in"), {
      line: "see Section 9",
      text: "as in see Section 9 of X",
      lineLength: 13,
      leadLength: 6,
    });
  });

  it("no line before, an empty one, or a heading: the line as before", () => {
    const alone = { line: "see Section 9", text: "see Section 9", lineLength: 13 };
    assert.deepEqual(wrappedLine("see Section 9", false, undefined), alone);
    assert.deepEqual(wrappedLine("see Section 9", false, undefined, ""), alone);
    assert.deepEqual(wrappedLine("see Section 9", false, undefined, " \t "), alone);
    assert.deepEqual(wrappedLine("see Section 9", true, undefined, "RFC 7657"), alone);
  });

  it("a long line before is cut to its end, at a space, so no word is cut in half", () => {
    const long = `${"word ".repeat(LEAD_REACH)}xRFC 7657`;
    const wrapped = wrappedLine("(Section 5)", false, undefined, long);
    const lead = wrapped.text.slice(0, wrapped.leadLength ?? 0);
    assert.ok(lead.length <= LEAD_REACH + 1);
    assert.ok(lead.endsWith("xRFC 7657 "));
    assert.ok(lead.startsWith("word "));
  });

  it("a line before with no space in its reach is left out, not cut inside a word", () => {
    const wrapped = wrappedLine("(Section 5)", false, undefined, "x".repeat(LEAD_REACH * 2));
    assert.deepEqual(wrapped, { line: "(Section 5)", text: "(Section 5)", lineLength: 11 });
  });

  it("onLine keeps what starts at or after the lead and ends on the line, on the line's own positions", () => {
    const wrapped = wrappedLine("Section 5 and", false, "6 apply", "see");
    const mention = (start: number, end: number): Mention => ({ start, end, attrs: {} });
    const found = [mention(0, 3), mention(2, 13), mention(4, 13), mention(4, 17), mention(15, 17), mention(15, 18), mention(18, 19)];
    assert.deepEqual(onLine(found, wrapped), [mention(0, 9), mention(0, 13), mention(11, 13)]);
  });
});
