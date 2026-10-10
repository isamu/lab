import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";
import { headingKey, phrasesAfter, phrasesBefore, squeezed, type ItemToken, type ItemWords } from "../packages/chaff/src/structure/unlisted-items.ts";

// 一覧に無い材料や道具を手順で使っている（unlisted-item-used）。手順の、物を使う形の名詞だけを、手順より前に書いたものと照らす。

const findings = (source: string, adapter: LanguageAdapter, language: string): string[] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(language), { "unlisted-item-used": "normal" }, false, "docs/manual")
    .findings.filter((finding) => finding.rule === "unlisted-item-used")
    .map((finding) => `${String(finding.values["item"])}@${finding.line}`);

const unlistedJa = (...lines: string[]): string[] => findings(lines.join("\n"), ja, "ja");
const unlistedEn = (...lines: string[]): string[] => findings(lines.join("\n"), en, "en");

const RECIPE_JA = ["# 卵焼き", "", "## 材料", "", "- 卵 2個", "- 塩 少々", "- 砂糖 小さじ1", "", "## 作り方", ""];
const TOOLS_JA = ["# 棚を組み立てる", "", "## 用意するもの", "", "- ドライバー", "- 木ねじ 8本", "", "## 手順", ""];
const RECIPE_EN = ["# Omelette", "", "## Ingredients", "", "- 2 eggs", "- A pinch of salt", "- 1 teaspoon sugar", "", "## Method", ""];
const TOOLS_EN = ["# Build a shelf", "", "## What you need", "", "- A screwdriver", "- Eight wood screws", "", "## Steps", ""];

before(async () => {
  await ja.prepare?.({ pos: true });
  await en.prepare?.({ pos: true });
});

describe("unlisted-item-used: reported (ja)", () => {
  it("reports an ingredient joined with listed ones as the object of a use verb", () => {
    assert.deepEqual(unlistedJa(...RECIPE_JA, "1. ボウルに卵、塩、こしょうを入れて混ぜます。"), ["こしょう@11"]);
  });
  it("reports a thing a step puts something into, when the list holds tools", () => {
    assert.deepEqual(unlistedJa(...TOOLS_JA, "1. 木ねじを水を張ったバケツに沈めます。"), ["バケツ@10"]);
  });
  it("reports a tool a step works with, when the list holds tools", () => {
    assert.deepEqual(unlistedJa(...TOOLS_JA, "1. 板の角をブラシで磨きます。"), ["ブラシ@10"]);
  });
  it("reports a thing once, at the step that first uses it", () => {
    assert.deepEqual(unlistedJa(...RECIPE_JA, "1. 卵にこしょうを加えます。", "2. こしょうを少し足します。"), ["こしょう@11"]);
  });
});

describe("unlisted-item-used: not reported (ja)", () => {
  it("does not read a document without a list heading", () => {
    assert.deepEqual(unlistedJa("# 卵焼き", "", "1. ボウルに卵、こしょうを入れます。"), []);
  });
  it("takes an amount off the name (塩少々 is 塩) and leaves out what is always at hand", () => {
    assert.deepEqual(unlistedJa(...RECIPE_JA, "1. 卵に塩少々と砂糖、水大さじ1を加えます。"), []);
  });
  it("does not read a container or a tool in a document whose list holds only ingredients", () => {
    assert.deepEqual(unlistedJa(...RECIPE_JA, "1. ボウルに卵を入れ、菜箸で混ぜます。"), []);
  });
  it("does not read a noun that is not the object of a use verb", () => {
    assert.deepEqual(unlistedJa(...RECIPE_JA, "1. 生地を型に詰めます。"), []);
  });
  it("does not report a use the step denies", () => {
    assert.deepEqual(unlistedJa(...TOOLS_JA, "1. 金づちを使わずに、手で押し込みます。"), []);
  });
  it("does not report heat or hands, which end in an at-hand word", () => {
    assert.deepEqual(unlistedJa(...TOOLS_JA, "1. 強火で炊き、手で混ぜます。"), []);
  });
  it("does not report what the title or an earlier step wrote", () => {
    assert.deepEqual(unlistedJa(...RECIPE_JA, "1. 卵を割ります。", "2. 割った卵を加えます。"), []);
  });
});

describe("unlisted-item-used: reported (en)", () => {
  it("reports an ingredient joined with listed ones after a use verb", () => {
    assert.deepEqual(unlistedEn(...RECIPE_EN, "1. Beat the eggs and add the salt and pepper."), ["pepper@11"]);
  });
  it("reports a container after 'in a', when the list holds tools", () => {
    assert.deepEqual(unlistedEn(...TOOLS_EN, "1. Soak the screws in a bucket of water."), ["bucket@10"]);
  });
  it("reports a tool after 'with the', when the list holds tools", () => {
    assert.deepEqual(unlistedEn(...TOOLS_EN, "1. Tap the shelf into place with the hammer."), ["hammer@10"]);
  });
});

describe("unlisted-item-used: not reported (en)", () => {
  it("does not read a document without a list heading", () => {
    assert.deepEqual(unlistedEn("# Omelette", "", "1. Add the pepper."), []);
  });
  it("takes amounts off the name and leaves out water", () => {
    assert.deepEqual(unlistedEn(...RECIPE_EN, "1. Add a pinch of salt, 2 cups water and the sugar."), []);
  });
  it("ends the list of things at a verb the tagger reads as a noun", () => {
    assert.deepEqual(unlistedEn(...RECIPE_EN, "1. Add the eggs and stir until smooth."), []);
  });
  it("does not read a container in a document whose list holds only ingredients", () => {
    assert.deepEqual(unlistedEn(...RECIPE_EN, "1. Put the eggs in a bowl and whisk with a fork."), []);
  });
  it("does not report a use the step denies", () => {
    assert.deepEqual(unlistedEn(...RECIPE_EN, "1. Do not add butter."), []);
  });
  it("does not report a use denied a few words before the verb", () => {
    assert.deepEqual(unlistedEn(...RECIPE_EN, "1. Do not ever add pepper."), []);
  });
  it("reads a thing written before by its lemma (berries, berry)", () => {
    assert.deepEqual(unlistedEn("# Smoothie", "", "## Ingredients", "", "- Two cups of berries", "", "## Method", "", "1. Add one more berry."), []);
  });
  it("does not read a general verb such as use as using a thing", () => {
    assert.deepEqual(unlistedEn(...TOOLS_EN, "1. Use caution when you lift the shelf."), []);
  });
  it("reads a numbered step written under the list heading itself", () => {
    assert.deepEqual(unlistedEn("# Omelette", "", "## Ingredients", "", "- 2 eggs", "", "1. Beat the eggs and add pepper."), ["pepper@7"]);
  });
  it("reads a hyphenated name the same as the list's", () => {
    assert.deepEqual(unlistedEn(...TOOLS_EN, "1. Fix the shelf with the screw-driver."), []);
  });
  it("does not report what the title wrote inside a longer word", () => {
    assert.deepEqual(unlistedEn("# Meatloaf", "", ...RECIPE_EN.slice(1), "1. Put the meat and the eggs in a bowl."), []);
  });
});

const token = (surface: string, pos: string, start: number): ItemToken => ({ surface, pos, lemma: surface, start, end: start + surface.length });

const WORDS: ItemWords = {
  ingredientHeadings: [],
  toolHeadings: [],
  markers: [],
  verbs: {},
  negations: [],
  actions: ["stir"],
  joiners: ["、", "と", ",", "and"],
  partitives: ["of"],
  amounts: ["少々", "pinch"],
  atHand: [],
};

const names = (phrases: readonly (readonly ItemToken[])[]): string[] => phrases.map((phrase) => phrase.map((part) => part.surface).join(" "));

describe("unlisted-item-used: reading the things a step names", () => {
  it("reads joined nouns backwards from a particle, past amounts and asides, up to another word", () => {
    const tokens = ["ボウル/NOUN", "に/ADP", "塩/NOUN", "少々/NOUN", "、/PUNCT", "卵/NOUN", "（/PUNCT", "2/NOUN", "個/NOUN", "）/PUNCT", "を/ADP"].map(
      (pair, at) => {
        const [surface = "", pos = ""] = pair.split("/");
        return token(surface, pos, at);
      },
    );
    assert.deepEqual(
      names(phrasesBefore(tokens, 10, WORDS)).toSorted((left, right) => left.localeCompare(right, "ja")),
      ["卵", "塩"].toSorted((left, right) => left.localeCompare(right, "ja")),
    );
  });
  it("reads nothing before a particle that follows a verb", () => {
    assert.deepEqual(phrasesBefore([token("洗っ", "VERB", 0), token("を", "ADP", 2)], 1, WORDS), []);
  });
  it("reads joined nouns forwards, restarting after 'of' and stopping at an action", () => {
    const tokens = ["add/VERB", "a/DET", "pinch/NOUN", "of/ADP", "sea/NOUN", "salt/NOUN", "and/CCONJ", "stir/NOUN"].map((pair, at) => {
      const [surface = "", pos = ""] = pair.split("/");
      return token(surface, pos, at * 10);
    });
    assert.deepEqual(names(phrasesAfter(tokens, 0, WORDS)), ["sea salt"]);
  });
  it("reads nothing after the last word", () => {
    assert.deepEqual(phrasesAfter([token("add", "VERB", 0)], 0, WORDS), []);
  });
});

describe("unlisted-item-used: comparing names", () => {
  it("compares a heading by its words before a bracket or a colon", () => {
    assert.equal(headingKey("材料（2～3人分）"), "材料");
    assert.equal(headingKey("Ingredients  (for 4)"), "ingredients");
    assert.equal(headingKey("Tools: optional"), "tools");
    assert.equal(headingKey(""), "");
  });
  it("ignores spaces, hyphens and case", () => {
    assert.equal(squeezed("Multi-Tool"), squeezed("multitool"));
    assert.equal(squeezed("tea bag"), "teabag");
    assert.equal(squeezed(""), "");
  });
});
