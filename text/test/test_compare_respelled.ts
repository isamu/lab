import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { readMarkdown } from "../packages/chaff/src/markdown-read.ts";
import { extractFacts } from "../packages/chaff/src/compare/extract.ts";
import { outcomeOf, type Outcome } from "../packages/chaff/src/compare/outcome.ts";
import { renderCompact, renderFriendly, renderJson } from "../packages/chaff/src/compare/render.ts";
import { COMPARE_TEXT } from "../packages/chaff/src/compare/text.ts";
import { isRespelling, nameCount, pairRespelled } from "../packages/chaff/src/compare/respelled.ts";
import type { Atom, AtomKind } from "../packages/chaff/src/compare/atom.ts";

// chaff compare: a name whose spelling the rewrite corrected is one fact respelled, not a fact dropped and one added.
// Every text here is written for the test.

const atom = (key: string, line = 1, kind: AtomKind = "name"): Atom => ({ kind, key, text: key, line });

const compareText = (beforeText: string, afterText: string): Outcome => {
  const facts = (source: string) => {
    const doc = buildDocument("a.md", source, en, { jargon: [], requiredSections: [], names: [] });
    return extractFacts({ doc, root: readMarkdown(doc.source).root, structure: en.structure, names: [] });
  };
  return outcomeOf({ path: "before.md", extraction: facts(beforeText) }, { path: "after.md", extraction: facts(afterText) });
};

const pairs = (outcome: Outcome): string[] => outcome.respelled.map((pair) => `${pair.before.text}→${pair.after.text}`);
const texts = (atoms: readonly Atom[]): string[] => atoms.map((found) => `${found.kind}:${found.text}`);

before(async () => {
  await en.prepare?.({ pos: true });
});

describe("pairRespelled", () => {
  it("pairs a change of case", () => {
    const paired = pairRespelled([atom("Northwind")], [atom("NorthWind")], "");
    assert.deepEqual(
      paired.respelled.map((pair) => [pair.before.key, pair.after.key]),
      [["Northwind", "NorthWind"]],
    );
    assert.deepEqual([paired.dropped, paired.added], [[], []]);
  });

  it("pairs a one-letter change only where the original wrote the old spelling once and the new one twice or more", () => {
    const usual = "Marianna Holloway signs. Mariana Holloway pays. Marianna Holloway files.";
    assert.equal(isRespelling(atom("Mariana Holloway"), atom("Marianna Holloway"), usual), true);
    assert.equal(isRespelling(atom("Mariana Holloway"), atom("Marianna Holloway"), "Nobody else is named."), false);
    assert.equal(isRespelling(atom("Miller"), atom("Muller"), "Miller and Muller attended."), false);
    assert.equal(isRespelling(atom("Miller"), atom("Muller"), "Miller, Miller and Muller, Muller."), false);
  });

  it("does not pair two different names, a change of two letters, or another word count", () => {
    assert.equal(isRespelling(atom("Holloway"), atom("Galloway"), "Galloway"), false);
    assert.equal(isRespelling(atom("Jane Holloway"), atom("Jane Holloway Smith"), "Jane Holloway Smith"), false);
    assert.equal(isRespelling(atom("Iran"), atom("Iraq"), "Iraq"), false);
  });

  it("pairs names only, never a quotation or a number of the same letters", () => {
    assert.equal(isRespelling(atom("Basic", 1, "quote"), atom("BASIC", 1, "quote"), ""), false);
    assert.deepEqual(pairRespelled([atom("Basic", 1, "quote")], [atom("BASIC", 1, "quote")], "").respelled, []);
  });

  it("prefers a change of case to a one-letter change, and pairs each atom once", () => {
    const paired = pairRespelled([atom("Northwind", 1), atom("Northwind", 2)], [atom("Nortwind", 3), atom("NorthWind", 4)], "Northwind Nortwind Nortwind");
    assert.deepEqual(
      paired.respelled.map((pair) => [pair.before.line, pair.after.line]),
      [
        [1, 4],
        [2, 3],
      ],
    );
  });

  it("leaves empty input and unmatched atoms as they are", () => {
    assert.deepEqual(pairRespelled([], [], ""), { dropped: [], added: [], respelled: [] });
    const paired = pairRespelled([atom("Holloway")], [], "");
    assert.deepEqual([paired.dropped.length, paired.added.length, paired.respelled.length], [1, 0, 0]);
  });
});

describe("nameCount", () => {
  it("counts a whole name, not one inside a longer word", () => {
    assert.equal(nameCount("Signed by Aldo Ferri and Aldo Ferri.", "Aldo Ferri"), 2);
    assert.equal(nameCount("Signed by Aaldo Ferri.", "Aldo Ferri"), 0);
    assert.equal(nameCount("Signed by Aldo Ferrino.", "Aldo Ferri"), 0);
    assert.equal(nameCount("", "Aldo"), 0);
    assert.equal(nameCount("Aldo", ""), 0);
  });
});

describe("chaff compare reports a corrected spelling as respelled", () => {
  const BEFORE = "# Partners\n\nThe managers are Jane Holloway and Omar Reyes of Northwind Traders.\n\nNorthWind Traders pays the invoices.\n";
  const AFTER = "# Partners\n\nThe managers are Jane Holloway and Omar Reyes of Northwind Traders.\n\nNorthwind Traders pays the invoices.\n";

  it("passes, with the pair listed", () => {
    const outcome = compareText(BEFORE, AFTER);
    assert.deepEqual(pairs(outcome), ["NorthWind Traders→Northwind Traders"]);
    assert.deepEqual([texts(outcome.dropped), texts(outcome.added)], [[], []]);
    assert.equal(outcome.ok, true);
  });

  it("shows the pair in every output", () => {
    const outcome = compareText(BEFORE, AFTER);
    assert.match(renderFriendly(outcome, COMPARE_TEXT.en), /i 1 name respelled[^\n]*\n {2}name: NorthWind Traders → Northwind Traders/u);
    assert.match(renderFriendly(outcome, COMPARE_TEXT.ja), /i 綴りを直した名前 1 件/u);
    assert.match(renderCompact(outcome, COMPARE_TEXT.en), /respelled name NorthWind Traders → Northwind Traders/u);
    assert.match(renderCompact(outcome, COMPARE_TEXT.en), /, 1 respelled$/u);
    assert.match(renderJson(outcome), /"respelled": \[\n\s+\{\n\s+"kind": "name",\n\s+"key": "NorthWind Traders"/u);
  });

  it("still fails a rewrite that put another name in", () => {
    const outcome = compareText(BEFORE, AFTER.replace("Omar Reyes", "Omar Castillo"));
    assert.deepEqual(pairs(outcome), ["NorthWind Traders→Northwind Traders"]);
    assert.equal(outcome.ok, false);
    assert.ok(
      texts(outcome.added).some((added) => added.includes("Castillo")),
      texts(outcome.added).join(" | "),
    );
  });

  it("says nothing of respelling when nothing was respelled", () => {
    const outcome = compareText(AFTER, AFTER);
    assert.deepEqual(outcome.respelled, []);
    assert.doesNotMatch(renderFriendly(outcome, COMPARE_TEXT.en), /respelled/u);
    assert.doesNotMatch(renderCompact(outcome, COMPARE_TEXT.en), /respelled/u);
  });
});
