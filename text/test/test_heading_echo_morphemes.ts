import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { newContentMorphemes } from "../packages/chaff/src/detectors/content-morphemes.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import type { Token } from "../packages/chaff/src/plugin.ts";

// In Japanese, heading-echo measures what the first sentence adds in content morphemes the heading does not have.
// Characters say nothing: 「会社に勤めています」 carries two new words in nine characters, 「について説明します」 none.

before(async () => {
  await ja.prepare?.({ pos: true });
});

const tokensOf = (text: string): Token[] => ja.segment(text).sentences.flatMap((sentence) => sentence.tokens ?? []);

const featureOf = (text: string, surface: string, name: string): string | undefined =>
  tokensOf(text).find((token) => token.surface === surface)?.features?.[name];

describe("lang-ja marks the morphemes that do not stand as words by themselves", () => {
  it("a dependent verb, prefix and suffix are bound (非自立・接頭詞・接尾)", () => {
    assert.equal(featureOf("会社に勤めています。", "い", "Bound"), "Yes");
    assert.equal(featureOf("ご案内します。", "ご", "Bound"), "Yes");
    assert.equal(featureOf("こころさんの場合", "さん", "Bound"), "Yes");
    assert.equal(featureOf("それは使うことです。", "こと", "Bound"), "Yes");
  });

  it("する and いたす after a verbal noun are light verbs; the noun carries the meaning", () => {
    assert.equal(featureOf("仕組みを説明します。", "し", "VerbType"), "Light");
    assert.equal(featureOf("ご案内いたします。", "いたし", "VerbType"), "Light");
  });

  it("a word that stands by itself is neither", () => {
    assert.equal(featureOf("会社に勤めています。", "勤め", "Bound"), undefined);
    assert.equal(featureOf("ご案内します。", "案内", "Bound"), undefined);
    assert.equal(featureOf("毎週テニスをします。", "し", "VerbType"), undefined);
    assert.equal(featureOf("会社に勤めています。", "勤め", "VerbType"), undefined);
  });
});

describe("newContentMorphemes over lang-ja tokens", () => {
  const cases: readonly (readonly [string, string, number])[] = [
    // 会社, 勤める
    ["みどりさんのおじいさんの場合", "みどりさんのおじいさんは、会社に勤めています。", 2],
    // 説明 only: について is a particle, します a light verb and an auxiliary
    ["キャッシュの仕組み", "キャッシュの仕組みについて説明します。", 1],
    ["キャッシュの仕組み", "キャッシュの仕組みについて。", 0],
    // matched by base form: 変え is 変える
    ["設定を変える", "設定を変えました。", 0],
    // a pronoun, a determiner and a conjunction point at what is there already
    ["料金", "しかし、この料金はそれです。", 0],
    ["", "会社に勤めています。", 2],
    ["見出し", "", 0],
  ];
  cases.forEach(([heading, sentence, count]) => {
    it(`${JSON.stringify(heading)} → ${JSON.stringify(sentence)}: ${String(count)}`, () =>
      assert.equal(newContentMorphemes(tokensOf(heading), tokensOf(sentence)), count));
  });
});

const token = (surface: string, pos: string, extra: Partial<Token> = {}): Token => ({ span: { start: 0, end: surface.length }, surface, pos, ...extra });

describe("newContentMorphemes over tokens as given", () => {
  it("counts nouns, proper nouns, verbs, adjectives, adverbs and numerals", () => {
    const words = [
      token("会社", "NOUN"),
      token("東京", "PROPN"),
      token("勤め", "VERB", { lemma: "勤める" }),
      token("高い", "ADJ"),
      token("ゆっくり", "ADV"),
      token("3", "NUM"),
    ];
    assert.equal(newContentMorphemes([], words), 6);
  });

  it("does not count function words, punctuation, symbols or unknowns", () => {
    const words = ["ADP", "AUX", "PART", "SCONJ", "CCONJ", "DET", "PRON", "INTJ", "PUNCT", "SYM", "X"].map((pos) => token("x", pos));
    assert.equal(newContentMorphemes([], words), 0);
  });

  it("does not count a bound morpheme or a light verb", () => {
    const words = [token("さん", "NOUN", { features: { Bound: "Yes" } }), token("し", "VERB", { lemma: "する", features: { VerbType: "Light" } })];
    assert.equal(newContentMorphemes([], words), 0);
  });

  it("matches by lemma, and by surface when there is no lemma", () => {
    assert.equal(newContentMorphemes([token("変える", "VERB", { lemma: "変える" })], [token("変え", "VERB", { lemma: "変える" })]), 0);
    assert.equal(newContentMorphemes([token("AI", "NOUN")], [token("AI", "NOUN")]), 0);
    assert.equal(newContentMorphemes([token("AI", "NOUN")], [token("ai", "NOUN")]), 0);
  });

  it("a heading word matches only as a content word of the heading", () => {
    // 「の」 in the heading does not make a sentence's content noun 「の」 old
    assert.equal(newContentMorphemes([token("こと", "NOUN", { features: { Bound: "Yes" } })], [token("こと", "NOUN")]), 1);
  });

  it("counts every occurrence, the way characters and words are counted", () => {
    assert.equal(newContentMorphemes([], [token("会社", "NOUN"), token("会社", "NOUN")]), 2);
  });

  it("never exceeds the sentence's own content morphemes, over generated pairs", () => {
    const pool = [
      token("会社", "NOUN"),
      token("の", "ADP"),
      token("勤め", "VERB", { lemma: "勤める" }),
      token("さん", "NOUN", { features: { Bound: "Yes" } }),
      token("。", "PUNCT"),
    ];
    Array.from({ length: 200 }, (__unused, seed) => seed).forEach((seed) => {
      const pick = (count: number, offset: number): Token[] =>
        Array.from({ length: count }, (__unused, index) => pool[(seed * 3 + index * 7 + offset) % pool.length] ?? pool[0]).flatMap((one) =>
          one === undefined ? [] : [one],
        );
      const heading = pick(seed % 4, 1);
      const sentence = pick(seed % 7, 2);
      const count = newContentMorphemes(heading, sentence);
      assert.ok(count >= 0 && count <= newContentMorphemes([], sentence), `seed ${String(seed)}`);
      assert.equal(newContentMorphemes(sentence, sentence), 0, `seed ${String(seed)}: a sentence repeats all of itself`);
    });
  });
});

const echoes = (source: string): number => {
  const doc = buildDocument("a.md", source, ja);
  return runRules(doc, loadRules("ja"), {}, false, "technical/readme").findings.filter((finding) => finding.rule === "heading-echo").length;
};

describe("heading-echo in Japanese counts the new content morphemes", () => {
  it("valid: a short sentence that says something new (こころさんのお父さんの場合, nta-kids)", () => {
    assert.equal(echoes("## みどりさんのおじいさんの場合\n\nみどりさんのおじいさんは、会社に勤めています。\n"), 0);
    assert.equal(echoes("## みどりさんのおばあさんの場合\n\nみどりさんのおばあさんは、自分で花屋を経営しています。\n"), 0);
  });

  it("invalid: a sentence that adds only function words, however long", () => {
    assert.equal(echoes("## キャッシュの仕組み\n\nキャッシュの仕組みについて説明します。\n"), 1);
    assert.equal(echoes("## 料金の支払い方法\n\n料金の支払い方法につきましては、以下のとおりでございます。\n"), 1);
  });
});
