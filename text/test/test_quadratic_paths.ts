import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { runCli } from "./cli-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { latinBoundaries } from "../packages/chaff/src/orthography.ts";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BASELINE_FILE, fingerprint, fingerprints, readBaseline, splitByBaseline } from "../packages/chaff/src/baseline.ts";
import { doubledIn } from "../packages/chaff/src/detectors/doubled-word.ts";
import { depthsOf } from "../packages/chaff/src/detectors/list-sentence.ts";
import { tokenize } from "../packages/lang-en/src/pos.ts";
import { renderFriendly } from "../packages/chaff/src/render/friendly.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { loadProfiles } from "../packages/chaff/src/profile/load.ts";
import { relativeMentions } from "../packages/chaff/src/structure/relative-find.ts";
import { asideDepth, openAsidesAt } from "../packages/chaff/src/structure/aside-depth.ts";
import { knownMentions } from "../packages/chaff/src/structure/known-mentions.ts";
import { firedRules } from "./rule-run.ts";
import type { DocumentProfile, Finding, Mention, StructurePatterns, Token } from "../packages/chaff/src/plugin.ts";

// A run of digits, a sentence of many words or findings, or a line of many references can be as long as the text.
// Each of these reads its run once, not once per character, word, finding or reference.

const LONG = 100_000;

/** The old code took minutes on LONG; the new code takes well under a second. */
const LONG_TIMEOUT_MS = 30_000;

const kinds = (text: string): string[] => latinBoundaries(text).map((boundary) => `${boundary.kind}:${boundary.spaced ? "spaced" : "touching"}`);

describe("latinBoundaries: a run of digits is read once", () => {
  it(`reads a run of ${String(LONG)} digits between Japanese`, { timeout: LONG_TIMEOUT_MS }, () => {
    assert.deepEqual(kinds(`記録は${"1".repeat(LONG)}回`), ["before-digit:touching", "after-digit:touching"]);
    assert.deepEqual(kinds(`第${"1".repeat(LONG)}条`), []);
    assert.deepEqual(kinds(`番号は${"1-".repeat(LONG)}1 へ`), []);
  });

  it("still does not count an ordinal or a code, and still counts a quantity", () => {
    assert.deepEqual(kinds("第3条と第 4 条"), []);
    assert.deepEqual(kinds("電話は073-489-5909 へ"), []);
    assert.deepEqual(kinds("第3条の3GBの容量"), ["before-digit:touching", "after-digit:touching"]);
    assert.deepEqual(kinds("期間は1-3ヶ月"), ["before-digit:touching", "after-digit:touching"]);
    assert.deepEqual(kinds("記録は 3 回"), ["before-digit:spaced", "after-digit:spaced"]);
  });
});

const finding = (rule: string, quote: string): Finding => ({ rule, severity: "warning", line: 1, column: 1, quote, values: {} });

describe("fingerprints: one per finding, computed once per sentence and rule", () => {
  it("gives each finding the fingerprint it gets on its own", () => {
    const shared = "the the  cat\n sat";
    const findings = [finding("a", shared), finding("b", shared), finding("a", ` ${shared} `.trim()), finding("a", "the the cat sat"), finding("a", "other")];
    assert.deepEqual(
      fingerprints("x.md", findings),
      findings.map((one) => fingerprint("x.md", one)),
    );
  });

  it("does not reuse a fingerprint across rules or across sentences", () => {
    const [first, second, third] = fingerprints("x.md", [finding("a", "s"), finding("b", "s"), finding("a", "t")]);
    assert.notEqual(first, second);
    assert.notEqual(first, third);
  });

  it("shelves by the same fingerprints as before", () => {
    const findings = [finding("a", "s"), finding("b", "s"), finding("a", "s")];
    const split = splitByBaseline("x.md", findings, { version: 1, created: "2026-10-01", entries: [fingerprint("x.md", finding("a", "s"))] });
    assert.deepEqual(split, { fresh: [findings[1]], shelved: 2 });
  });

  it(`lints and writes a baseline for ${String(LONG / 5)} doubled words in one sentence`, { timeout: LONG_TIMEOUT_MS }, async () => {
    const source = `${"This is an ordinary sentence.\n\n".repeat(5)}It was ${"go go ".repeat(LONG / 5)}done.\n`;
    const written = await runCli({ "a.md": source }, ["baseline", "--experimental"], "en_US.UTF-8");
    assert.equal(written.code, 0);
    const baseline = readFileSync(join(written.dir, BASELINE_FILE), "utf8");
    assert.ok((readBaseline(join(written.dir, BASELINE_FILE))?.entries.length ?? 0) >= LONG / 5);
    const linted = await runCli({ "a.md": source, [BASELINE_FILE]: baseline }, ["a.md", "--compact", "--experimental"], "en_US.UTF-8");
    assert.doesNotMatch(linted.out, /doubled-word/u);
    assert.equal(linted.code, 0);
  });
});

const token = (surface: string, start: number, pos: string): Token => ({ surface, span: { start, end: start + surface.length }, pos });

const tokensOf = (words: readonly (readonly [string, string])[]): { source: string; tokens: Token[] } => {
  const tokens: Token[] = [];
  let at = 0;
  words.forEach(([surface, pos]) => {
    tokens.push(token(surface, at, pos));
    at += surface.length + 1;
  });
  return { source: words.map(([surface]) => surface).join(" "), tokens };
};

describe("doubledIn: whether a pair opens the sentence is decided once per sentence", () => {
  const pairs = (words: readonly (readonly [string, string])[]): string[] => {
    const { source, tokens } = tokensOf(words);
    return doubledIn(source, tokens, true, []).map((doubled) => `${doubled.first.surface} ${doubled.second.surface}`);
  };

  it("reads a capitalised word followed by the same word in lower case as a name, except at the start", () => {
    assert.deepEqual(
      pairs([
        ["Go", "VERB"],
        ["go", "VERB"],
      ]),
      ["Go go"],
    );
    assert.deepEqual(
      pairs([
        ["1", "NUM"],
        [".", "PUNCT"],
        ["Go", "VERB"],
        ["go", "VERB"],
      ]),
      ["Go go"],
    );
    assert.deepEqual(
      pairs([
        ["We", "PRON"],
        ["Go", "VERB"],
        ["go", "VERB"],
      ]),
      [],
    );
    assert.deepEqual(pairs([]), []);
  });

  it(`finds ${String(LONG / 2)} doubled words in one sentence`, { timeout: LONG_TIMEOUT_MS }, () => {
    const words = Array.from({ length: LONG }, (): [string, string] => ["go", "VERB"]);
    assert.equal(pairs(words).length, LONG - 1);
  });
});

describe("English: one sentence of many words", () => {
  before(async () => {
    await en.prepare?.({ pos: true });
  });

  it(`reads ${String(LONG / 2)} past participles in one sentence`, { timeout: LONG_TIMEOUT_MS }, () => {
    const tokens = tokenize(`The plans were ${"reviewed ".repeat(LONG / 2)}today.`) ?? [];
    assert.ok(tokens.length > LONG / 2);
    assert.deepEqual(tokens[3]?.features, { VerbForm: "Part", Voice: "Pass" });
  });

  it("still reads a participle after be as passive, and one in a relative clause as not", () => {
    const features = (sentence: string, word: string): unknown => (tokenize(sentence) ?? []).find((token) => token.surface === word)?.features;
    assert.deepEqual(features("The decision was made.", "made"), { VerbForm: "Part", Voice: "Pass" });
    assert.deepEqual(features("The report that was published is here.", "published"), { VerbForm: "Part" });
    assert.deepEqual(features("That was decided.", "decided"), { VerbForm: "Part", Voice: "Pass" });
  });

  it(`tags and judges a list of ${String(LONG / 5)} words`, { timeout: LONG_TIMEOUT_MS }, () => {
    const words = Array.from({ length: LONG / 5 }, (_, index) => (index % 7 === 3 ? "(apples)," : "pears,")).join(" ");
    assert.deepEqual(firedRules(en, `We bought ${words} and plums today.\n`).includes("oxford-comma-consistency"), false);
  });
});

const patterns = (): StructurePatterns => {
  if (ja.structure === undefined) throw new Error("lang-ja has no structure");
  return ja.structure;
};

const statute = loadProfiles().find((definition) => definition.id === "statute")?.languages["ja"];
if (statute?.relative === undefined) throw new Error("profiles/statute.yaml has no relative vocabulary");
const vocabulary = statute.relative;

const foundWith = (profile: DocumentProfile, text: string, absolute?: readonly Mention[]): string[] =>
  relativeMentions(text, profile, patterns().number, absolute ?? patterns().references(text)).map((mention) => {
    const back = mention.attrs["continues"] === undefined ? "" : `<${String(mention.attrs["continues"])}`;
    return `${String(mention.attrs["label"])}:${String(mention.attrs["relative"])}${back}`;
  });

const found = (text: string, absolute?: readonly Mention[]): string[] => foundWith(statute, text, absolute);

const mention = (start: number, end: number, relative = "absolute"): Mention => ({ start, end, attrs: { label: "x", relative } });

describe("relativeMentions: a bare 第一項 on a line of many references", () => {
  it(`reads ${String(LONG / 5)} references on one line`, { timeout: LONG_TIMEOUT_MS }, () => {
    const line = Array.from({ length: LONG / 5 }, (_, index) => (index % 4 === 1 ? "（第二号）" : "第一項、")).join("");
    const mentions = found(`前条${line}`);
    assert.equal(mentions.length, LONG / 5);
    assert.deepEqual(mentions.slice(0, 4), ["前条第一項:before", "第二号:current", "第一項:continue<11", "第一項:continue<4"]);
  });

  it("continues the nearest earlier reference at the same depth", () => {
    assert.deepEqual(found("第三条（第二項）及び第一項"), ["第二項:continue<4", "第一項:continue<10"]);
    assert.deepEqual(found("第三条及び第一項（第二項及び第三項）"), ["第一項:continue<5", "第二項:continue<4", "第三項:continue<5"]);
  });

  it("takes the later of two references ending at the same place", () => {
    // 行き先を決められない参照（opaque）の続きは、参照にしない。
    assert.deepEqual(found("ab、第一項", [mention(0, 2), mention(1, 2, "opaque")]), []);
    assert.deepEqual(found("ab、第一項", [mention(1, 2, "opaque"), mention(0, 2)]), ["第一項:continue<3"]);
  });

  it("inside an aside opened right after a reference, continues that reference, the first one ending there", () => {
    assert.deepEqual(found("ab（の例により第一項）", [mention(0, 2), mention(1, 2, "opaque")]), ["第一項:continue<8"]);
    assert.deepEqual(found("ab（の例により第一項）", [mention(1, 2, "opaque"), mention(0, 2)]), []);
    assert.deepEqual(found("ab（の例により第一項）", [mention(0, 1)]), ["第一項:current"]);
  });

  it("skips a bare reference that overlaps a known one, and keeps one that only touches it", () => {
    assert.deepEqual(found("第一項", [mention(2, 3)]), []);
    assert.deepEqual(found("第一項", [mention(0, 1)]), []);
    assert.deepEqual(found("第一項", [mention(3, 4)]), ["第一項:current"]);
    assert.deepEqual(found("第一項", [mention(0, 0)]), ["第一項:continue<0"]);
  });

  it("does not continue across a different depth", () => {
    assert.deepEqual(found("第三条（第二項、第一項"), ["第二項:continue<4", "第一項:continue<4"]);
    assert.deepEqual(found("（第三条）第一項"), ["第一項:current"]);
    assert.deepEqual(found("第三条（第二項）第一項"), ["第二項:continue<4", "第一項:continue<8"]);
  });

  it("reads asides of two characters, and without asides, as before", () => {
    const doubled: DocumentProfile = { ...statute, relative: { ...vocabulary, aside: { open: "((", close: "))" } } };
    assert.deepEqual(foundWith(doubled, "第三条((第二項))及び第一項"), ["第二項:current", "第一項:current"]);
    const none: DocumentProfile = { ...statute, relative: { ...vocabulary, aside: undefined } };
    assert.deepEqual(foundWith(none, "第三条（第二項）第一項"), ["第二項:current", "第一項:current"]);
  });
});

describe("asideDepth: the open asides at a position, read once", () => {
  const aside = { open: "（", close: "）" };
  const text = "a（b（😀）c）（d";
  const positions = [-100, -3, -1, -0.5, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 99, 2.5, Number.NaN, Infinity, -Infinity];

  it("answers as reading the text up to the position would", () => {
    const depth = asideDepth(text, aside);
    positions.forEach((at) => {
      const opens = openAsidesAt(text, at, aside);
      assert.equal(depth.depth(at), opens.length, `depth at ${String(at)}`);
      assert.equal(depth.innermost(at), opens.at(-1), `innermost at ${String(at)}`);
    });
  });

  it("reads a position that is not a number as the start of the text", () => {
    const opening = asideDepth("（a）", aside);
    assert.deepEqual([opening.depth(Number.NaN), opening.depth(1), opening.innermost(Number.NaN)], [0, 1, undefined]);
  });

  it("reads the middle of a two-unit character as the text cut there", () => {
    const pair = { open: "😀", close: "）" };
    assert.deepEqual([asideDepth("😀a", pair).depth(1), asideDepth("😀a", pair).depth(2)], [0, 1]);
  });

  it("has no asides without an aside, or with an opener that closes itself", () => {
    assert.deepEqual([asideDepth(text, undefined).depth(5), asideDepth(text, undefined).innermost(5)], [0, undefined]);
    assert.equal(asideDepth("（（", { open: "（", close: "（" }).depth(2), 0);
  });
});

describe("knownMentions: the references known on a line", () => {
  const flat = (): number => 0;

  it("finds an overlap among the known ones whatever their order", () => {
    const known = knownMentions([mention(10, 12), mention(0, 8), mention(4, 5), mention(Number.NaN, 3), mention(20, Number.NaN)], flat);
    assert.deepEqual(
      [
        [7, 9],
        [8, 10],
        [12, 13],
        [11, 11.5],
        [-1, 0],
      ].map(([start, end]) => known.overlaps(start ?? 0, end ?? 0)),
      [true, false, false, true, false],
    );
  });

  it("takes the previous one by end, then by the order it was known, at the same depth", () => {
    const depthOf = (at: number): number => (at >= 100 ? 1 : 0);
    const [a, b, c, d] = [mention(0, 5), mention(1, 5), mention(2, 4), mention(0, 101)];
    const known = knownMentions([a, b, c, d], depthOf);
    assert.equal(known.previous(5, 0), b);
    assert.equal(known.previous(4, 0), c);
    assert.equal(known.previous(3, 0), undefined);
    assert.equal(known.previous(200, 1), d);
    const added = mention(5, 5);
    known.add(added, 0);
    assert.equal(known.previous(6, 0), added);
  });

  it("finds the first one ending at a position, known before added", () => {
    const [a, b] = [mention(0, 3), mention(1, 3)];
    const known = knownMentions([a, b], flat);
    const [c, d] = [mention(2, 7), mention(5, 7)];
    known.add(c, 0);
    known.add(d, 0);
    known.add(mention(1, 3), 0);
    assert.equal(known.endingAt(3), a);
    assert.equal(known.endingAt(7), c);
    assert.equal(known.endingAt(8), undefined);
  });
});

describe("renderFriendly: each finding shows its own sentence", () => {
  it("quotes each sentence once per finding, whichever came first", () => {
    const rules = loadRules("en");
    const result = {
      findings: [finding("doubled-word", "First  one."), finding("doubled-word", "Second one."), finding("doubled-word", "First  one.")],
      skipped: [],
      forcedExperimental: [],
      presetExperimental: [],
    };
    const text = renderFriendly("h", result, rules, "en");
    assert.equal(text.split("    First one.").length - 1, 2);
    assert.equal(text.split("    Second one.").length - 1, 1);
  });
});

describe("chaff baseline: what stet silences is not shelved", () => {
  it("writes no fingerprint for a finding silenced by stet", async () => {
    const plain = "The the parser runs.\n";
    const silenced = "<!-- stet: doubled-word — quoted as written -->\n\nThe the parser runs.\n";
    const entries = async (source: string): Promise<readonly string[]> => {
      const run = await runCli({ "a.md": source }, ["baseline", "--experimental"], "en_US.UTF-8");
      return readBaseline(join(run.dir, BASELINE_FILE))?.entries ?? [];
    };
    const [before, after] = [await entries(plain), await entries(silenced)];
    assert.ok(before.length > after.length, `${String(before.length)} → ${String(after.length)}`);
  });
});

describe("depthsOf: the parentheses open before each token", () => {
  const depths = (surfaces: readonly string[]): number[] => depthsOf(surfaces.map((surface, index) => token(surface, index, "X")));

  it("counts an opening before the tokens after it, and a closing from the token after it", () => {
    assert.deepEqual(depths(["a", "(", "b", ",", "c", ")", "d"]), [0, 0, 1, 1, 1, 1, 0]);
    assert.deepEqual(depths(["(", "(", ")", "x"]), [0, 1, 2, 1]);
  });

  it("does not go below zero on a closing without an opening", () => {
    assert.deepEqual(depths([")", ")", "(", "a"]), [0, 0, 0, 1]);
    assert.deepEqual(depths([]), []);
  });
});
