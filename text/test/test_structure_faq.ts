import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import type { LanguageAdapter, Lexicon, Section } from "../packages/chaff/src/plugin.ts";
import { headedSections, structureFeaturesOf } from "../packages/chaff/src/structure-shape/features.ts";
import { underFaq } from "../packages/chaff/src/structure-shape/faq-sections.ts";

// The headings under an FAQ heading are the readers' questions: the stock heading form measure leaves them out. Every
// text here is written for the test.

const lines = (...rows: string[]): string => rows.join("\n");

const headedOf = (adapter: LanguageAdapter, source: string): Section[] => headedSections(buildDocument("a.md", source, adapter).sections);

const headingForms = (adapter: LanguageAdapter, source: string): number | undefined =>
  structureFeaturesOf(buildDocument("a.md", source, adapter)).find((feature) => feature.id === "heading-forms")?.value;

const FAQ: Lexicon = [{ pattern: "faq" }, { pattern: "faqs" }, { pattern: "よくある質問" }];

const section = (depth: number, heading: string): string[] => [`${"#".repeat(depth)} ${heading}`, "", "We keep the notes in one shared folder.", ""];

describe("underFaq", () => {
  it("marks every heading below an FAQ heading, at any depth, up to the next heading as high", () => {
    const source = lines(
      "# Title",
      "",
      ...section(2, "Running a meeting"),
      ...section(2, "Meeting FAQs"),
      ...section(3, "What is a remote meeting?"),
      ...section(4, "What are the tools?"),
      ...section(3, "How do I join?"),
      ...section(2, "Next steps"),
      ...section(3, "What is next?"),
    );
    assert.deepEqual(underFaq(headedOf(en, source), FAQ), [false, false, true, true, true, false, false]);
  });

  it("reads よくある質問 in a Japanese heading", () => {
    const source = lines("# 題", "", ...section(2, "よくある質問"), ...section(3, "会議とは"), ...section(2, "次に"));
    assert.deepEqual(underFaq(headedOf(ja, source), FAQ), [false, true, false]);
  });

  it("marks nothing without an FAQ heading, nor with an empty lexicon", () => {
    const source = lines("# Title", "", ...section(2, "Meeting FAQ"), ...section(3, "What is it?"));
    assert.deepEqual(underFaq(headedOf(en, source), []), [false, false]);
    assert.deepEqual(underFaq([], FAQ), []);
    assert.deepEqual(underFaq(headedOf(en, lines("# Title", "", ...section(2, "FAQtory tour"), ...section(3, "What is it?"))), FAQ), [false, false]);
  });
});

describe("heading-forms: an FAQ's questions are not the writer's stock form", () => {
  const body = ["How we plan", "Running the meeting", "After the meeting", "What is a remote meeting?"].flatMap((heading) => section(2, heading));
  const questions = ["What are the benefits?", "What are the challenges?", "How do I prepare?", "What is a board meeting?"];

  it("leaves the questions under an FAQ heading out of the share", () => {
    const source = lines("# Meetings", "", ...body, ...section(2, "Remote meeting FAQ's"), ...questions.flatMap((heading) => section(3, heading)));
    assert.equal(headingForms(en, source), 20);
  });

  it("still counts the same questions written as the outline's own headings", () => {
    const source = lines("# Meetings", "", ...body, ...section(2, "Remote meetings"), ...questions.flatMap((heading) => section(3, heading)));
    assert.equal(headingForms(en, source), 44);
  });

  it("does the same for よくある質問 in Japanese", () => {
    const jaBody = ["計画", "進め方", "終わった後", "会議とは"].flatMap((heading) => section(2, heading));
    const jaQuestions = ["遠隔会議とは", "準備とは", "記録とは"].flatMap((heading) => section(3, heading));
    assert.equal(headingForms(ja, lines("# 会議", "", ...jaBody, ...section(2, "よくある質問"), ...jaQuestions)), 20);
    assert.equal(headingForms(ja, lines("# 会議", "", ...jaBody, ...section(2, "遠隔会議"), ...jaQuestions)), 50);
  });
});
