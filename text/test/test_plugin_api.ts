import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { API_VERSION, defineRule, definePlugin, type Detector } from "../packages/chaff/src/api.ts";
import { ruleDocumentOf } from "../packages/chaff/src/extension/document-view.ts";
import { returnedFindings, describeValue } from "../packages/chaff/src/extension/returned-findings.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import type { ProseDocument } from "../packages/chaff/src/plugin.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";

// The plugin API (chaffjs/api): what a detector sees, and what chaff accepts back. Example sentences are self-written.

const SOURCE = "# Plan\n\nThe launch is TBD. We ship in May.\n\n- one\n- two\n\nSee [the notes](notes.md).\n";

const noFindings: Detector = () => [];

const byName = (left: string, right: string): number => left.localeCompare(right, "en");

describe("the plugin API", () => {
  before(async () => {
    await en.prepare?.({ pos: true });
    await ja.prepare?.({ pos: true });
  });

  describe("defineRule and definePlugin", () => {
    it("stamp the API version and keep what was written", () => {
      assert.equal(API_VERSION, 1);
      const rule = defineRule({ detect: noFindings, id: "x", level: "info" });
      assert.deepEqual([rule.apiVersion, rule.id, rule.level, rule.detect], [API_VERSION, "x", "info", noFindings]);
      const plugin = definePlugin({ name: "foo", rules: [rule] });
      assert.deepEqual([plugin.apiVersion, plugin.name, plugin.rules?.length], [API_VERSION, "foo", 1]);
    });
  });

  describe("ruleDocumentOf: the document a detector reads", () => {
    const doc = buildDocument("plan.md", SOURCE, en);

    it("has the public fields and none of chaff's own", () => {
      const view = ruleDocumentOf(doc);
      assert.deepEqual(Object.keys(view).toSorted(byName), [
        "language",
        "lengthUnit",
        "lexicons",
        "links",
        "listItems",
        "lists",
        "markup",
        "paragraphs",
        "path",
        "sections",
        "sentences",
        "source",
      ]);
      const sentenceFields = new Set(view.sentences.flatMap((sentence) => Object.keys(sentence)));
      assert.deepEqual([...sentenceFields].toSorted(byName), ["span", "text"]);
      assert.deepEqual(Object.keys(view.sections[0] ?? {}).toSorted(byName), ["depth", "heading", "sentences", "span"]);
      assert.deepEqual(
        view.sentences.map((sentence) => sentence.text),
        doc.sentences.map((sentence) => sentence.text),
      );
      assert.deepEqual(
        view.lists.map((list) => list.itemLengths.length),
        [2],
      );
      assert.deepEqual(
        view.markup.links.map((link) => link.destination),
        ["notes.md"],
      );
    });

    it("is frozen all the way down, so one rule cannot change what the next reads", () => {
      const view = ruleDocumentOf(doc);
      const sentence = view.sentences[0];
      assert.ok(sentence !== undefined);
      assert.throws(() => Reflect.set(view, "source", "x") || assert.fail("not frozen"));
      assert.equal(Object.isFrozen(sentence), true);
      assert.equal(Object.isFrozen(ruleDocumentOf(buildDocument("a.md", "会議を行った。\n", ja)).sentences[0]?.tokens?.[0]?.span), true);
      assert.equal(Object.isFrozen(view.markup.headings), true);
      assert.equal(Object.isFrozen(view.lexicons), true);
    });

    it("shares one copy of a sentence between the document, its paragraphs and its sections", () => {
      const view = ruleDocumentOf(doc);
      const inParagraph = view.paragraphs[0]?.sentences[0];
      assert.ok(inParagraph !== undefined);
      assert.ok(view.sentences.includes(inParagraph));
      assert.ok(view.sections.some((section) => section.sentences.includes(inParagraph)));
    });

    it("is made once per document, and reads the markup only when asked", () => {
      const reads = { count: 0 };
      const counted: ProseDocument = new Proxy(doc, {
        get: (target, key, receiver): unknown => {
          if (key === "markup") reads.count += 1;
          return Reflect.get(target, key, receiver);
        },
      });
      const view = ruleDocumentOf(counted);
      assert.equal(ruleDocumentOf(counted), view);
      assert.equal(reads.count, 0);
      assert.equal(view.markup.markdown, true);
      assert.equal(view.markup, view.markup);
      assert.equal(reads.count, 1);
    });

    it("gives tokens with parts of speech and lemmas when the adapter read them", () => {
      const view = ruleDocumentOf(buildDocument("a.md", "会議を行った。\n", ja));
      const verb = view.sentences[0]?.tokens?.find((token) => token.pos === "VERB");
      assert.equal(verb?.lemma, "行う");
    });
  });

  describe("returnedFindings: what a detector gave back", () => {
    const doc = buildDocument("plan.md", SOURCE, en);
    const at = SOURCE.indexOf("TBD");

    it("places each finding, quotes its sentence and fills {matched}", () => {
      const result = returnedFindings(
        [{ start: at, end: at + 3 }, { start: at, values: { matched: "launch date", count: 2 } }, { start: at }],
        doc.source,
        doc.sentences,
      );
      assert.ok("findings" in result);
      assert.deepEqual(
        result.findings.map((finding) => [finding.quote, finding.values]),
        [
          ["The launch is TBD.", { matched: "TBD", offset: at }],
          ["The launch is TBD.", { matched: "launch date", count: 2, offset: at }],
          ["The launch is TBD.", { matched: "", offset: at }],
        ],
      );
    });

    it("quotes the line when the place is in no sentence", () => {
      const result = returnedFindings([{ start: 2 }], doc.source, doc.sentences);
      assert.ok("findings" in result);
      assert.equal(result.findings[0]?.quote, "# Plan");
    });

    it("an empty list is no findings", () => {
      assert.deepEqual(returnedFindings([], doc.source, doc.sentences), { findings: [] });
    });

    const wrong: readonly (readonly [string, unknown, string])[] = [
      ["a Promise", Promise.resolve([]), "not-a-list"],
      ["undefined", undefined, "not-a-list"],
      ["one finding, not a list", { start: 0 }, "not-a-list"],
      ["a number in the list", [3], "not-a-finding"],
      ["no start", [{ end: 3 }], "bad-start"],
      ["a start past the end", [{ start: SOURCE.length + 1 }], "bad-start"],
      ["a start that is not whole", [{ start: 1.5 }], "bad-start"],
      ["an end before the start", [{ start: 5, end: 4 }], "bad-end"],
      ["values that are not text or numbers", [{ start: 0, values: { at: [1] } }], "bad-values"],
      ["a value that is not finite", [{ start: 0, values: { count: Number.NaN } }], "bad-values"],
    ];
    wrong.forEach(([what, returned, kind]) => {
      it(`refuses ${what} as a whole`, () => {
        const result = returnedFindings(returned, doc.source, doc.sentences);
        assert.ok("problem" in result);
        assert.equal(result.problem.kind, kind);
      });
    });

    it("says what came back in a few words", () => {
      assert.deepEqual([Promise.resolve(), undefined, null, {}, [], "x", 1].map(describeValue), [
        "a Promise",
        "undefined",
        "null",
        "an object",
        "a list",
        "a string",
        "a number",
      ]);
    });
  });
});
