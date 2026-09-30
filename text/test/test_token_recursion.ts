import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { runCli } from "./cli-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { digitRunAround, placeChainBefore } from "../packages/chaff/src/number-name.ts";
import { isAddressRun } from "../packages/chaff/src/detectors/place-run.ts";
import { namesQuantity } from "../packages/chaff/src/detectors/superlative-name.ts";
import { phraseEnd } from "../packages/chaff/src/detectors/superlative-scope.ts";
import { loadProfiles } from "../packages/chaff/src/profile/load.ts";
import { relativeMentions } from "../packages/chaff/src/structure/relative-find.ts";
import { withoutClosedPairs } from "../packages/chaff/src/structure/closed-pairs.ts";
import { depthOf, renderTree, treeJson } from "../packages/chaff/src/commands/tree.ts";
import { toSexp } from "../packages/chaff/src/structure/sexp.ts";
import type { DocumentProfile, StructureNode, StructurePatterns, Token } from "../packages/chaff/src/plugin.ts";

// A run of digits, of joined nouns or of place names, or brackets nested inside each other, can be as long as the text.
// The functions that read along such a run keep a cursor instead of calling themselves once per character or token.

/** Longer than the call stack holds for one frame per character or token. */
const LONG = 100_000;

/** Removing the innermost pair again and again reads the text once per level: at LONG levels that does not end in time. */
const DEEP_TIMEOUT_MS = 30_000;

const token = (surface: string, start: number, pos: string, features?: Readonly<Record<string, string>>): Token => ({
  surface,
  span: { start, end: start + surface.length },
  pos,
  ...(features === undefined ? {} : { features }),
});

describe("digitRunAround: the run of digits, points and hyphens around a character", () => {
  const run = "1".repeat(LONG);

  it("walks back from the last character and forward from the first", () => {
    assert.deepEqual(digitRunAround(`は${run}回`, LONG), { start: 1, end: LONG + 1 });
    assert.deepEqual(digitRunAround(`は${run}回`, 1), { start: 1, end: LONG + 1 });
  });

  it("stops at the edges of the text and at a character outside the run", () => {
    assert.deepEqual(digitRunAround("12-3.4", 2), { start: 0, end: 6 });
    assert.deepEqual(digitRunAround("a12b", 1), { start: 1, end: 3 });
    assert.equal(digitRunAround("a12b", 0), undefined);
  });
});

describe("placeChainBefore: the place names written together before a position, nearest first", () => {
  it(`follows ${String(LONG)} place names`, () => {
    const tokens = Array.from({ length: LONG }, (_, index) => token("区", index, "NOUN", { NameType: "GeoUnit" }));
    const chain = placeChainBefore(tokens, LONG);
    assert.equal(chain.length, LONG);
    assert.equal(chain[0], tokens.at(-1));
    assert.equal(chain.at(-1), tokens[0]);
  });

  it("stops at a word that is not a place, and at a gap", () => {
    const tokens = [
      token("東京", 0, "PROPN", { NameType: "Geo" }),
      token("の", 2, "ADP"),
      token("港", 3, "PROPN", { NameType: "Geo" }),
      token("区", 4, "NOUN", { NameType: "GeoUnit" }),
      token("港", 6, "PROPN", { NameType: "Geo" }),
    ];
    assert.deepEqual(
      placeChainBefore(tokens, 5).map((found) => found.surface),
      ["区", "港"],
    );
    assert.deepEqual(placeChainBefore(tokens, 7), [tokens[4]]);
    assert.deepEqual(placeChainBefore(tokens, 6), []);
  });

  it("takes the first place name among those ending at the same position", () => {
    const tokens = [token("東", 0, "PROPN", { NameType: "Geo" }), token("東京", 0, "PROPN", { NameType: "Geo" }), token("京", 1, "PROPN", { NameType: "Geo" })];
    assert.deepEqual(placeChainBefore(tokens, 2), [tokens[1]]);
  });

  it("stops at a place name without width instead of looping", () => {
    const empty: Token = { surface: "", span: { start: 3, end: 3 }, pos: "PROPN", features: { NameType: "Geo" } };
    assert.deepEqual(placeChainBefore([empty, token("港", 2, "PROPN", { NameType: "Geo" })], 3), [empty]);
  });

  it("does not take a position that is not a number as the end of a place name", () => {
    const lost: Token = { surface: "区", span: { start: Number.NaN, end: 5 }, pos: "NOUN", features: { NameType: "GeoUnit" } };
    const nowhere: Token = { surface: "港", span: { start: 0, end: Number.NaN }, pos: "PROPN", features: { NameType: "Geo" } };
    assert.deepEqual(placeChainBefore([nowhere, lost], 5), [lost]);
  });
});

describe("isAddressRun: a town name the analyser split into one-character pieces", () => {
  const split = (unit: string): Token[] => [
    token("東京", 0, "PROPN", { NameType: "Geo" }),
    ...Array.from({ length: LONG }, (_, index) => token("紀", 2 + index, "NOUN")),
    token(unit, LONG + 2, "NOUN", { NameType: "GeoUnit" }),
  ];
  // Only the first piece, the unit and the name are asked about: the pieces between are read by the walk from the first piece.
  const covering = [0, 1, LONG + 1];

  it(`closes after ${String(LONG)} pieces with a unit below a prefecture`, () => {
    assert.equal(isAddressRun(split("町"), covering, new Set(["都"])), true);
    assert.equal(isAddressRun(split("特別区"), covering, new Set(["都"])), true);
  });

  it("does not close with a prefecture's unit, or with an ordinary word in between", () => {
    assert.equal(isAddressRun(split("都"), covering, new Set(["都"])), false);
    const broken = split("町");
    broken[LONG / 2] = token("政策", LONG / 2, "NOUN");
    assert.equal(isAddressRun(broken, covering, new Set(["都"])), false);
  });
});

describe("namesQuantity: a superlative joined to a run of nouns", () => {
  const joined = (last: string): Token[] => [
    token("最大", 0, "NOUN"),
    ...Array.from({ length: LONG }, (_, index) => token("風", 2 + index, "NOUN")),
    token(last, LONG + 2, "NOUN"),
  ];
  const quantities = [{ pattern: "風速" }];

  it(`reads to the last of ${String(LONG)} joined nouns`, () => {
    assert.equal(namesQuantity(joined("風速"), { start: 0, end: 1 }, quantities), true);
    assert.equal(namesQuantity(joined("効果"), { start: 0, end: 1 }, quantities), false);
  });

  it("stops at a space or a particle", () => {
    const spaced = [token("最大", 0, "NOUN"), token("風", 3, "NOUN"), token("風速", 4, "NOUN")];
    assert.equal(namesQuantity(spaced, { start: 0, end: 1 }, quantities), false);
    const particle = [token("最大", 0, "NOUN"), token("風速", 2, "NOUN"), token("の", 4, "ADP"), token("風速", 5, "NOUN")];
    assert.equal(namesQuantity(particle, { start: 0, end: 1 }, quantities), true);
  });
});

describe("phraseEnd: the end of the noun phrase after a superlative", () => {
  it(`reads a phrase of ${String(LONG)} words`, () => {
    const words = Array.from({ length: LONG }, (_, index) => token("pizza", index * 6, "NOUN"));
    assert.equal(phraseEnd([...words, token("in", LONG * 6, "ADP")], 0), LONG);
  });

  it("takes modifiers before the first noun and only nouns after it", () => {
    const words = [token("most", 0, "ADV"), token("famous", 5, "ADJ"), token("pizza", 12, "NOUN"), token("big", 18, "ADJ")];
    assert.equal(phraseEnd(words, 0), 3);
    assert.equal(phraseEnd(words, 0, true), 0);
    assert.equal(phraseEnd(words, 3), 4);
  });
});

const patterns = (): StructurePatterns => {
  if (ja.structure === undefined) throw new Error("lang-ja has no structure");
  return ja.structure;
};

const nested = (depth: number): string => `${"（".repeat(depth)}${"）".repeat(depth)}`;

describe("withoutClosedPairs: closed pairs removed with what they hold", () => {
  const cases: readonly (readonly [string, string])[] = [
    ["a（b）c", "ac"],
    ["a（b（c）d）e", "ae"],
    ["（a）（b）c", "c"],
    ["a（b", "a（b"],
    ["a）b（c）", "a）b"],
    ["（a（b）", "（a"],
    ["）（", "）（"],
    ["", ""],
    ["a（😀）b😀", "ab😀"],
  ];
  cases.forEach(([text, expected]) => {
    it(`${text} → ${expected}`, () => {
      assert.equal(withoutClosedPairs(text, "（", "）"), expected);
    });
  });

  it("pairs the same character from the left when it both opens and closes", () => {
    assert.equal(withoutClosedPairs("|a|b|c", "|", "|"), "b|c");
  });

  it("takes a character outside the Basic Multilingual Plane as a bracket", () => {
    assert.equal(withoutClosedPairs("a🄐b🄑c", "🄐", "🄑"), "ac");
  });

  it(`removes pairs nested ${String(LONG)} deep`, () => {
    assert.equal(withoutClosedPairs(`a${nested(LONG)}b`, "（", "）"), "ab");
  });
});

describe("relativeMentions: a bare 第二項 after an aside nested deep", () => {
  const statute = loadProfiles().find((definition) => definition.id === "statute")?.languages["ja"];
  if (statute?.relative === undefined) throw new Error("profiles/statute.yaml has no relative vocabulary");
  const vocabulary = statute.relative;
  const foundWith = (profile: DocumentProfile, text: string): string[] =>
    relativeMentions(text, profile, patterns().number, patterns().references(text)).map(
      (mention) => `${String(mention.attrs["label"])}:${String(mention.attrs["relative"])}`,
    );
  const found = (text: string): string[] => foundWith(statute, text);

  it(`continues the reference before an aside ${String(LONG)} deep`, { timeout: DEEP_TIMEOUT_MS }, () => {
    assert.deepEqual(found(`前条${nested(LONG)}第二項`), ["前条:before", "第二項:continue"]);
  });

  it("does not continue past words that are not joins", () => {
    assert.deepEqual(found(`前条${nested(3)}の例により第二項`), ["前条:before", "第二項:current"]);
  });

  it("reads an aside written with two characters on each side", () => {
    const doubled: DocumentProfile = { ...statute, relative: { ...vocabulary, aside: { open: "((", close: "))" } } };
    assert.deepEqual(foundWith(doubled, "前条((ただし書))第二項"), ["前条:before", "第二項:continue"]);
    assert.deepEqual(foundWith(doubled, "前条((ただし書)第二項"), ["前条:before", "第二項:current"]);
    assert.deepEqual(foundWith(doubled, "前条((((ただし書))))第二項"), ["前条:before", "第二項:continue"]);
  });
});

describe("the ja references: a law's name carried across parentheses nested deep", () => {
  const documents = (text: string): string[] =>
    patterns()
      .references(text)
      .map((mention) => `${String(mention.attrs["label"])}@${String(mention.attrs["document"])}`);

  it(`carries 民法 across parentheses ${String(LONG)} deep`, { timeout: DEEP_TIMEOUT_MS }, () => {
    assert.deepEqual(documents(`民法第一条${nested(LONG)}、第二条`), ["第一条@民法", "第二条@民法"]);
  });

  it("does not carry it past words that are not connectors", () => {
    assert.deepEqual(documents(`民法第一条${nested(3)}の例により第二条`), ["第一条@民法", "第二条@undefined"]);
    assert.deepEqual(documents("民法第一条）、第二条"), ["第一条@民法", "第二条@undefined"]);
  });
});

const chain = (depth: number): StructureNode => {
  const holder: { node: StructureNode } = { node: { kind: "item", address: "", span: { start: 0, end: 1 }, line: 1, attrs: {}, children: [] } };
  Array.from({ length: depth }).forEach((_, index) => {
    holder.node = { kind: "section", address: String(index), span: { start: 0, end: 1 }, line: 1, attrs: { label: "x" }, children: [holder.node] };
  });
  return holder.node;
};

describe("treeJson: the tree as indented JSON", () => {
  it("is what JSON.stringify writes", () => {
    const tree = chain(3);
    assert.equal(treeJson(tree), JSON.stringify(tree, null, 2));
  });

  it(`says it cannot write a tree ${String(LONG)} levels deep instead of crashing`, () => {
    assert.equal(treeJson(chain(LONG)), undefined);
  });
});

describe("treeJson: an error that is not about size", () => {
  it("is thrown, not taken as a tree too deep", () => {
    const children: StructureNode[] = [];
    const loop: StructureNode = { kind: "doc", address: "", span: { start: 0, end: 0 }, line: 1, attrs: {}, children };
    children.push(loop);
    assert.throws(() => treeJson(loop), TypeError);
  });
});

describe("renderTree: what chaff tree prints", () => {
  it("writes JSON or the S-expression", () => {
    const tree = chain(3);
    assert.deepEqual(renderTree(tree, "json"), { text: JSON.stringify(tree, null, 2) });
    assert.deepEqual(renderTree(tree, "sexp"), { text: toSexp(tree) });
    assert.deepEqual(renderTree(tree, undefined), { text: toSexp(tree) });
  });

  it("names the depth of a tree too deep for JSON", () => {
    assert.deepEqual(renderTree(chain(LONG), "json"), { tooDeep: LONG + 1 });
  });

  it("counts the root as the first level and takes the deepest branch", () => {
    const leaf = chain(0);
    assert.equal(depthOf(leaf), 1);
    assert.equal(depthOf({ ...leaf, children: [chain(1), chain(4), chain(2)] }), 6);
  });
});

describe("the command line on a run as long as the text", () => {
  // Japanese enough that the document is read as Japanese.
  const prose = "これは日本語の文書です。読みやすさを確かめるために、ふつうの文をいくつか置いておきます。\n\n".repeat(80);
  const documents: readonly (readonly [string, string, string])[] = [
    ["a split town name", `# 住所\n\n${prose}所在地は東京${"紀".repeat(20_000)}町です。\n`, "ja_JP.UTF-8"],
    ["an English noun phrase", `# Pizza\n\nThis is the best ${"pizza sauce ".repeat(10_000)}in Chicago.\n`, "en_US.UTF-8"],
  ];
  documents.forEach(([label, body, lang]) => {
    it(`lint reads ${label}`, async () => {
      const run = await runCli({ "long.md": body }, ["long.md", "--compact", "--experimental"], lang);
      assert.ok(run.code === 0 || run.code === 1, run.err);
      assert.match(run.out, /long\.md/u);
    });
  });
});
