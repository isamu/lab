import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { isQuotationParagraph, quotationParagraphIndexes } from "../packages/chaff/src/detectors/quotation-paragraph.ts";

// A block quotation of an earlier opinion keeps that opinion's wording, so its which does not vote. The quoted passages are
// from United States v. Nixon, 418 U.S. 683 (1974), a U.S. Supreme Court opinion in the public domain.

const findingsOf = (source: string): readonly string[] => namedRuleRun("which-that-consistency", source, en, "a.md", "legal/judgment").findings;

const THAT_THREE = "The job that builds the site runs nightly. The script that checks links runs hourly. The task that sends mail runs daily.";
const WHICH_REPORTED = ['This restrictive clause opens with "which"; the document mostly uses "that"'];

describe("which-that-consistency: a block quotation does not vote", () => {
  before(async () => {
    await en.prepare?.({ pos: true });
  });

  it("a paragraph that continues a quotation in lowercase is not counted", () => {
    const source = `${THAT_THREE} This setting assures there is\n\nthat concrete adverseness which sharpens the presentation of issues upon which the court so largely depends.\n\nBaker v. Carr, 369 U.S. at 204.\n`;
    assert.deepEqual(findingsOf(source), []);
  });

  it("a lowercase paragraph after a closed sentence is the writer's own and still counts", () => {
    const source = `${THAT_THREE}\n\nsee the file which stores the keys, kept apart from the code.\n`;
    assert.deepEqual(findingsOf(source), WHICH_REPORTED);
  });

  it("a paragraph that opens with a bracketed alteration ([T]he) is not counted", () => {
    const source = `${THAT_THREE}\n\n[T]he guard is to be looked for in the conduct of a court; not in any circumstance which is to precede their being issued.\n\nUnited States v. Burr, 25 F.Cas. at 34.\n`;
    assert.deepEqual(findingsOf(source), []);
  });

  it("a Markdown block quotation is not counted", () => {
    assert.deepEqual(findingsOf(`${THAT_THREE}\n\n> The file which stores the keys is encrypted.\n`), []);
  });

  it("the same which in the writer's own paragraph is still reported", () => {
    assert.deepEqual(findingsOf(`${THAT_THREE}\n\nThe file which stores the keys is encrypted.\n`), WHICH_REPORTED);
    assert.deepEqual(findingsOf(`${THAT_THREE}\n\n- The file which stores the keys is encrypted.\n`), WHICH_REPORTED);
  });
});

describe("isQuotationParagraph and quotationParagraphIndexes", () => {
  it("> and a bracketed capital are quotations; a lowercase opening is one after a paragraph left open", () => {
    assert.equal(isQuotationParagraph("> quoted", "Done."), true);
    assert.equal(isQuotationParagraph("  [T]he guard, furnished to", "Done."), true);
    assert.equal(isQuotationParagraph("that concrete adverseness which sharpens", "This setting assures there is"), true);
  });

  it("a lowercase opening after a closed sentence, a capital, a name with capitals, a list marker, a lone word or nothing is not", () => {
    assert.equal(isQuotationParagraph("see the file which stores the keys.", "Keys are kept apart."), false);
    assert.equal(isQuotationParagraph("npm install chaffjs", "Install it:"), false);
    assert.equal(isQuotationParagraph("that concrete adverseness", ""), false);
    assert.equal(isQuotationParagraph("The file which stores", "there is"), false);
    assert.equal(isQuotationParagraph("macOS is required.", "there is"), false);
    assert.equal(isQuotationParagraph("- the file which stores", "there is"), false);
    assert.equal(isQuotationParagraph("[1] Smith, cited above", "there is"), false);
    assert.equal(isQuotationParagraph("done", "there is"), false);
    assert.equal(isQuotationParagraph("", "there is"), false);
  });

  it("reads each paragraph against the one before it", () => {
    const source = "It holds that\n\nthe court which decides is bound.\n\nthe end of it.";
    const spans = [
      { start: 0, end: 13 },
      { start: 15, end: 48 },
      { start: 50, end: source.length },
    ];
    assert.deepEqual([...quotationParagraphIndexes(source, spans)], [1]);
    assert.deepEqual([...quotationParagraphIndexes(source, [])], []);
  });
});
