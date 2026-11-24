import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { inScope, scopeSelectorOf, scopesOf, TEXT_SCOPES, writtenScope, type ScopeRead } from "../packages/chaff/src/text-scope.ts";
import { headingMarkers, quoteMarkers } from "../packages/chaff/src/scope-markers.ts";
import type { ScopeSelector, TextScope } from "../packages/chaff/src/plugin.ts";

const selectorOf = (raw: unknown): ScopeSelector => {
  const read = scopeSelectorOf(raw);
  assert.ok("selector" in read, `${JSON.stringify(raw)} should read`);
  return read.selector;
};

const problemOf = (raw: unknown): string => {
  const read: ScopeRead = scopeSelectorOf(raw);
  assert.ok("problem" in read, `${JSON.stringify(raw)} should be refused`);
  return `${read.problem.kind}:${read.problem.written}`;
};

/** Every non-empty set of parts a passage could be in. */
const EVERY_PLACE: readonly (readonly TextScope[])[] = Array.from({ length: 2 ** TEXT_SCOPES.length - 1 }, (_unused, index) =>
  TEXT_SCOPES.filter((_scope, bit) => ((index + 1) & (1 << bit)) !== 0),
);

/** Every way to write a scope with each part at most once: absent, chosen, or taken away. */
const EVERY_WRITING: readonly string[][] = Array.from({ length: 3 ** TEXT_SCOPES.length }, (_unused, index) =>
  TEXT_SCOPES.flatMap((scope, digit) => {
    const state = Math.floor(index / 3 ** digit) % 3;
    if (state === 0) return [];
    return [state === 1 ? scope : `~${scope}`];
  }),
).filter((written) => written.length > 0);

const negated = (scope: string): string => `~${scope}`;

const anyRead = (selector: ScopeSelector): boolean => EVERY_PLACE.some((place) => inScope(selector, place));

const isIn = (place: readonly TextScope[], name: string): boolean => place.some((scope) => scope === name);

/** The rule as the docs state it: positives choose (none: every part), negatives then take away. */
const readByTheRule = (written: readonly string[], place: readonly TextScope[]): boolean => {
  const positives = written.filter((name) => !name.startsWith("~"));
  const negatives = written.filter((name) => name.startsWith("~")).map((name) => name.slice(1));
  const chosen = positives.length === 0 || positives.some((name) => isIn(place, name));
  return chosen && !negatives.some((name) => isIn(place, name));
};

/** Every place read with the negative added is read without it. */
const narrowsOnly = (written: readonly string[], selector: ScopeSelector, scope: TextScope): void => {
  const narrowed = scopeSelectorOf([...written, negated(scope)]);
  if (!("selector" in narrowed)) return;
  EVERY_PLACE.filter((place) => inScope(narrowed.selector, place)).forEach((place) => assert.ok(inScope(selector, place)));
};

/** Each writing that reads, with what it reads as. */
const READ_WRITINGS = EVERY_WRITING.flatMap((written) => {
  const read = scopeSelectorOf(written);
  return "selector" in read ? [{ written, selector: read.selector }] : [];
});

const followsTheRule = (written: readonly string[], selector: ScopeSelector): void =>
  EVERY_PLACE.forEach((place) => assert.equal(inScope(selector, place), readByTheRule(written, place), `${written.join(",")} at ${place.join(",")}`));

/** Each writing that reads, paired with each part a further negative could take away. */
const NARROWINGS = READ_WRITINGS.flatMap((reading) => TEXT_SCOPES.map((scope) => ({ ...reading, scope })));

describe("text scope", () => {
  describe("scopeSelectorOf reads the names", () => {
    it("reads one name, a list, and negations", () => {
      assert.deepEqual(selectorOf("heading"), { include: ["heading"], exclude: [] });
      assert.deepEqual(selectorOf(["list", "table"]), { include: ["list", "table"], exclude: [] });
      assert.deepEqual(selectorOf(["~quote"]), { include: [], exclude: ["quote"] });
      assert.deepEqual(selectorOf(["list", "~quote"]), { include: ["list"], exclude: ["quote"] });
      assert.deepEqual(selectorOf("~quote"), { include: [], exclude: ["quote"] });
    });

    it("trims the names and drops repeats, in the order of the vocabulary", () => {
      assert.deepEqual(selectorOf([" table ", "heading", "heading", "~ quote"]), { include: ["heading", "table"], exclude: ["quote"] });
    });

    it("refuses an unknown name and names it", () => {
      assert.equal(problemOf(["headline"]), "unknown:headline");
      assert.equal(problemOf(["list", "blockquote"]), "unknown:blockquote");
      assert.equal(problemOf(["~"]), "unknown:~");
      assert.equal(problemOf([""]), "unknown:");
      assert.equal(problemOf(["Heading"]), "unknown:Heading");
      assert.equal(problemOf(["~~quote"]), "unknown:~~quote");
      assert.equal(problemOf(["!quote"]), "unknown:!quote");
      assert.equal(problemOf(["heading, list"]), "unknown:heading, list");
    });

    it("refuses what is not a name or a list of names", () => {
      assert.equal(problemOf(null), "not-a-list:null");
      assert.equal(problemOf(3), "not-a-list:3");
      assert.equal(problemOf(true), "not-a-list:true");
      assert.equal(problemOf({ heading: true }), 'not-a-list:{"heading":true}');
      assert.equal(problemOf(["heading", 2]), 'not-a-list:["heading",2]');
      assert.equal(problemOf([["heading"]]), 'not-a-list:[["heading"]]');
    });

    it("refuses a scope that leaves nothing to read", () => {
      assert.equal(problemOf([]), "empty:[]");
      assert.equal(problemOf(["quote", "~quote"]), 'empty:["quote","~quote"]');
      const everyNegated = TEXT_SCOPES.map(negated);
      assert.equal(problemOf(everyNegated), `empty:${JSON.stringify(everyNegated)}`);
    });

    it("refuses a scope as empty exactly when no passage, wherever it is, would be read", () => {
      EVERY_WRITING.forEach((written) => {
        const read = scopeSelectorOf(written);
        if ("selector" in read) assert.ok(anyRead(read.selector), written.join(","));
        else assert.equal(read.problem.kind, "empty", written.join(","));
      });
    });

    it("writes back what it read", () => {
      EVERY_WRITING.forEach((written) => {
        const read = scopeSelectorOf(written);
        if ("selector" in read) assert.deepEqual(selectorOf(writtenScope(read.selector).slice(1, -1).split(", ")), read.selector);
      });
      assert.equal(writtenScope({ include: ["list"], exclude: ["quote"] }), "[list, ~quote]");
    });
  });

  describe("inScope: positives choose where, negatives then take away", () => {
    it("reads a passage in a chosen part", () => {
      assert.equal(inScope(selectorOf(["heading"]), ["heading"]), true);
      assert.equal(inScope(selectorOf(["heading"]), ["paragraph"]), false);
      assert.equal(inScope(selectorOf(["list", "table"]), ["table"]), true);
      assert.equal(inScope(selectorOf(["list", "table"]), ["quote"]), false);
    });

    it("with only negatives, reads every part but those", () => {
      assert.equal(inScope(selectorOf(["~quote"]), ["paragraph"]), true);
      assert.equal(inScope(selectorOf(["~quote"]), ["heading"]), true);
      assert.equal(inScope(selectorOf(["~quote"]), ["quote"]), false);
      assert.equal(inScope(selectorOf(["~quote"]), ["list", "quote"]), false);
    });

    it("takes away a chosen part's passages that are also in a negated part", () => {
      assert.equal(inScope(selectorOf(["list", "~quote"]), ["list"]), true);
      assert.equal(inScope(selectorOf(["list", "~quote"]), ["list", "quote"]), false);
      assert.equal(inScope(selectorOf(["quote", "~list"]), ["quote"]), true);
      assert.equal(inScope(selectorOf(["quote", "~list"]), ["list", "quote"]), false);
    });

    it("reads nothing in no part", () => {
      assert.equal(inScope(selectorOf(["~quote"]), []), false);
      assert.equal(inScope(selectorOf(["heading"]), []), false);
    });

    it("holds the rule for every writing and every place", () => {
      READ_WRITINGS.forEach(({ written, selector }) => followsTheRule(written, selector));
    });

    it("never reads more for a negative added", () => {
      NARROWINGS.forEach(({ written, selector, scope }) => narrowsOnly(written, selector, scope));
    });
  });

  describe("scopesOf: the parts a passage is in", () => {
    const regions = { list: [{ start: 10, end: 20 }], quote: [{ start: 15, end: 40 }] };

    it("is paragraph outside every other part", () => {
      assert.deepEqual(scopesOf({ start: 0, end: 5 }, regions), ["paragraph"]);
      assert.deepEqual(scopesOf({ start: 40, end: 45 }, regions), ["paragraph"]);
    });

    it("finds the list item and the quotation around it, both at once", () => {
      assert.deepEqual(scopesOf({ start: 10, end: 12 }, regions), ["list"]);
      assert.deepEqual(scopesOf({ start: 16, end: 18 }, regions), ["list", "quote"]);
      assert.deepEqual(scopesOf({ start: 25, end: 30 }, regions), ["quote"]);
    });

    it("keeps what the passage itself is", () => {
      assert.deepEqual(scopesOf({ start: 0, end: 5 }, regions, "heading"), ["heading"]);
      assert.deepEqual(scopesOf({ start: 25, end: 30 }, regions, "heading"), ["heading", "quote"]);
      assert.deepEqual(scopesOf({ start: 0, end: 5 }, regions, "table"), ["table"]);
    });

    it("reads a passage by where it starts, and no region at all as paragraph", () => {
      assert.deepEqual(scopesOf({ start: 8, end: 12 }, regions), ["paragraph"]);
      assert.deepEqual(scopesOf({ start: 20, end: 22 }, regions), ["quote"]);
      assert.deepEqual(scopesOf({ start: 3, end: 4 }, { list: [], quote: [] }), ["paragraph"]);
    });
  });

  describe("scope markers: the syntax a heading or a quotation reads without", () => {
    const blanked = (text: string, spans: readonly { start: number; end: number }[]): string =>
      spans.reduce((current, span) => `${current.slice(0, span.start)}${" ".repeat(span.end - span.start)}${current.slice(span.end)}`, text);

    it("blanks the > of each line, nested ones too", () => {
      assert.equal(blanked("> 一行目\n> 二行目", quoteMarkers("> 一行目\n> 二行目")), "  一行目\n  二行目");
      assert.equal(blanked("> > 入れ子", quoteMarkers("> > 入れ子")), "    入れ子");
      assert.equal(blanked(">密着", quoteMarkers(">密着")), " 密着");
      assert.equal(blanked("  > 字下げ", quoteMarkers("  > 字下げ")), "    字下げ");
    });

    it("leaves a > inside a line alone", () => {
      assert.deepEqual(quoteMarkers("a > b"), []);
      assert.deepEqual(quoteMarkers(""), []);
    });

    it("blanks a heading's # runs and a setext underline", () => {
      assert.equal(blanked("## 概要。", headingMarkers("## 概要。")), "   概要。");
      assert.equal(blanked("# Title #", headingMarkers("# Title #")), "  Title  ");
      assert.equal(blanked("Title\n===", headingMarkers("Title\n===")), "Title\n   ");
      assert.equal(blanked("Title\n---", headingMarkers("Title\n---")), "Title\n   ");
    });

    it("keeps a # that is a word", () => {
      assert.equal(blanked("## C#", headingMarkers("## C#")), "   C#");
      assert.equal(blanked("## #1 の話", headingMarkers("## #1 の話")), "   #1 の話");
      assert.deepEqual(headingMarkers("概要"), []);
      assert.deepEqual(headingMarkers(""), []);
    });
  });
});
