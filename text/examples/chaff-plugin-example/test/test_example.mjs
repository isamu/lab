// @ts-check
// A plugin's rules are plain functions of a document, so they can be tested without running chaff: build the few
// fields a detector reads, call it, and compare what it returns. test/test_example_plugin.ts at the repository's root
// runs the same plugin through chaff itself.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { API_VERSION } from "chaffjs/api";
import plugin from "../index.mjs";
import { noTbdDates } from "../rules/no-tbd-dates.mjs";
import { WEASEL, weaselWords } from "../rules/weasel-words.mjs";

/** @import { Finding, RuleDocument } from "chaffjs/api" */

/**
 * A document of one sentence per line, with nothing else in it. Enough for detectors that read sentences.
 * @param {string} source
 * @param {string} language
 * @returns {RuleDocument}
 */
const documentOf = (source, language) => {
  const lines = source.split("\n");
  const sentences = lines.map((text, index) => {
    const start = lines.slice(0, index).join("\n").length + (index === 0 ? 0 : 1);
    return { span: { start, end: start + text.length }, text };
  });
  return {
    path: "test.md",
    source,
    language,
    lengthUnit: language === "ja" ? "char" : "word",
    sentences,
    paragraphs: [],
    sections: [],
    lists: [],
    listItems: [],
    links: [],
    lexicons: {},
    markup: { markdown: false, headings: [], images: [], links: [], ids: [], texts: [] },
  };
};

/**
 * What each finding covers in the source.
 * @param {RuleDocument} doc
 * @param {readonly Finding[]} findings
 */
const covered = (doc, findings) => findings.map((finding) => doc.source.slice(finding.start, finding.end ?? finding.start));

describe("chaff-plugin-example", () => {
  it("targets this chaff's plugin API, under the name example", () => {
    assert.equal(plugin.apiVersion, API_VERSION);
    assert.equal(plugin.name, "example");
  });

  describe("no-tbd-dates", () => {
    it("finds an undecided date in either language", () => {
      const en = documentOf("The launch date is TBD.\nThe team is TBD.", "en");
      assert.deepEqual(covered(en, noTbdDates(en, { lexicon: undefined })), ["TBD"]);
      const ja = documentOf("公開日は未定です。\n担当は未定です。", "ja");
      assert.deepEqual(covered(ja, noTbdDates(ja, { lexicon: undefined })), ["未定"]);
    });

    it("leaves a decided date alone", () => {
      const doc = documentOf("The launch date is 1 October.", "en");
      assert.deepEqual(noTbdDates(doc, { lexicon: undefined }), []);
    });
  });

  describe("weasel-words", () => {
    it("finds each word of the list it is given, ignoring case", () => {
      const doc = documentOf("Some say it works. Arguably, some say more.", "en");
      const lexicon = WEASEL.en.map((pattern) => ({ pattern }));
      assert.deepEqual(covered(doc, weaselWords(doc, { lexicon })), ["Some say", "some say", "Arguably"]);
    });

    it("finds nothing without a list", () => {
      const doc = documentOf("Some say it works.", "en");
      assert.deepEqual(weaselWords(doc, { lexicon: undefined }), []);
    });
  });
});
