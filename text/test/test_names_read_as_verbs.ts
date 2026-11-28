import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { namesReadAsVerbs, rereadAsNames, type NameReadings } from "../packages/lang-en/src/names-read-as-verbs.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { Token } from "../packages/chaff/src/plugin.ts";
import { firedRules } from "./rule-run.ts";

// 小文字の綴りが動詞や代名詞である名前（AI、the US）を、解析器が動詞と読まないようにする。例文はすべて自作。

type Word = { value: string; pos: string; lemma?: string };

const words = (...pairs: readonly (readonly [string, string])[]): Word[] => pairs.map(([value, pos]) => ({ value, pos }));

const READINGS: NameReadings = {
  contractionHeads: new Set(["ai", "ca", "wo", "sha"]),
  opensNounPhrase: (word) => ["a", "an", "the"].includes(word.value.toLowerCase()) || word.pos === "POS" || word.pos === "PRP$",
};

describe("namesReadAsVerbs", () => {
  it("n't の付かない縮約の前半は名前（AI is、in CA、an AI assistant）", () => {
    assert.deepEqual(namesReadAsVerbs(words(["AI", "VBP"], ["is", "VBZ"], ["changing", "VBG"]), READINGS), [0]);
    assert.deepEqual(namesReadAsVerbs(words(["in", "IN"], ["CA", "MD"], ["now", "RB"]), READINGS), [1]);
    assert.deepEqual(namesReadAsVerbs(words(["an", "DT"], ["AI", "VBP"], ["assistant", "NN"]), READINGS), [1]);
  });

  it("n't が続けば縮約のまま（can't、AIN'T）", () => {
    assert.deepEqual(namesReadAsVerbs(words(["I", "PRP"], ["ca", "MD"], ["n't", "RB"], ["go", "VB"]), READINGS), []);
    assert.deepEqual(namesReadAsVerbs(words(["IT", "PRP"], ["AI", "VBP"], ["N'T", "RB"]), READINGS), []);
  });

  it("冠詞・所有の語の直後の大文字は名前（the US、our IT、the company's IS）", () => {
    assert.deepEqual(namesReadAsVerbs(words(["the", "DT"], ["US", "PRP"], ["team", "NN"]), READINGS), [1]);
    assert.deepEqual(namesReadAsVerbs(words(["our", "PRP$"], ["IT", "PRP"], ["team", "NN"]), READINGS), [1]);
    assert.deepEqual(namesReadAsVerbs(words(["company", "NN"], ["'s", "POS"], ["IS", "VBZ"], ["staff", "NN"]), READINGS), [2]);
    assert.deepEqual(namesReadAsVerbs(words(["the", "DT"], ["CAN", "MD"], ["bus", "NN"]), READINGS), [1]);
  });

  it("強調の大文字の動詞は動詞のまま（I AM here、It IS done、That IS correct）", () => {
    assert.deepEqual(namesReadAsVerbs(words(["I", "PRP"], ["AM", "VBP"], ["here", "RB"]), READINGS), []);
    assert.deepEqual(namesReadAsVerbs(words(["It", "PRP"], ["IS", "VBZ"], ["done", "VBN"]), READINGS), []);
    assert.deepEqual(namesReadAsVerbs(words(["That", "DT"], ["IS", "VBZ"], ["correct", "JJ"]), READINGS), []);
  });

  it("冠詞の後でも、小文字の語や名詞と読めた語には触れない（the is、the AI already a name）", () => {
    assert.deepEqual(namesReadAsVerbs(words(["the", "DT"], ["is", "VBZ"]), READINGS), []);
    assert.deepEqual(namesReadAsVerbs(words(["the", "DT"], ["NASA", "NNP"]), READINGS), []);
    assert.deepEqual(namesReadAsVerbs(words(["the", "DT"], ["A", "DT"]), READINGS), []);
  });

  it("空の文、文頭の語には前の語が無い", () => {
    assert.deepEqual(namesReadAsVerbs([], READINGS), []);
    assert.deepEqual(namesReadAsVerbs(words(["US", "PRP"]), READINGS), []);
  });
});

describe("rereadAsNames", () => {
  const entries = words(["The", "DT"], ["US", "PRP"], ["team", "VBP"], ["met", "VBD"]);

  it("読み直した文が語ごとに揃えば、名前は固有名詞、ほかは読み直しの品詞", () => {
    const again = words(["The", "DT"], ["XQZ", "NNP"], ["team", "NN"], ["met", "VBD"]);
    assert.deepEqual(rereadAsNames(entries, again, [1], "XQZ"), [
      { value: "The", pos: "DT" },
      { value: "US", pos: "NNP", lemma: "us" },
      { value: "team", pos: "NN" },
      { value: "met", pos: "VBD" },
    ]);
  });

  it("揃わなければ（語数や語が違う）、名前だけを固有名詞にする", () => {
    const expected = [
      { value: "The", pos: "DT" },
      { value: "US", pos: "NNP", lemma: "us" },
      { value: "team", pos: "VBP" },
      { value: "met", pos: "VBD" },
    ];
    assert.deepEqual(rereadAsNames(entries, words(["The", "DT"], ["XQZ", "NNP"], ["team", "NN"]), [1], "XQZ"), expected);
    assert.deepEqual(rereadAsNames(entries, words(["The", "DT"], ["XQ", "NNP"], ["team", "NN"], ["met", "VBD"]), [1], "XQZ"), expected);
    assert.deepEqual(rereadAsNames(entries, [], [1], "XQZ"), expected);
  });
});

describe("英語の文書で、名前は動詞と読まない", () => {
  before(async () => {
    await en.prepare?.({ pos: true });
  });

  const tokensOf = (source: string): readonly Token[] => buildDocument("t.md", source, en).sentences.flatMap((sentence) => sentence.tokens ?? []);

  const tagOf = (source: string, surface: string): string | undefined => tokensOf(source).find((token) => token.surface === surface)?.pos;

  it("AI は名前（an extended AI assistant、AI is changing、the AI team）", () => {
    ["We built an extended AI assistant.", "AI is changing the work.", "The AI team met.", "We use AI to sort mail."].forEach((source) =>
      assert.equal(tagOf(source, "AI"), "PROPN", source),
    );
    assert.equal(tokensOf("AI is changing the work.").find((token) => token.surface === "AI")?.lemma, "ai");
  });

  it("冠詞・所有の語の後の US、IT、IS、CAN は名前で、続く名詞は名詞のまま", () => {
    assert.equal(tagOf("The US team met.", "US"), "PROPN");
    assert.equal(tagOf("The US team met.", "team"), "NOUN");
    assert.equal(tagOf("We sent it to the US.", "US"), "PROPN");
    assert.equal(tagOf("Our IT team met.", "IT"), "PROPN");
    assert.equal(tagOf("The company's IS staff met.", "IS"), "PROPN");
    assert.equal(tagOf("Use the CAN bus.", "CAN"), "PROPN");
    assert.equal(tagOf("He lives in CA now.", "CA"), "PROPN");
  });

  it("動詞は動詞のまま（縮約、強調の大文字、小文字の動詞）", () => {
    assert.equal(tagOf("I can't go.", "ca"), "AUX");
    assert.equal(tagOf("It ain't right.", "ai"), "VERB");
    assert.equal(tagOf("I CAN'T GO.", "CA"), "AUX");
    assert.equal(tagOf("I AM here.", "AM"), "VERB");
    assert.equal(tagOf("It IS done.", "IS"), "VERB");
    assert.equal(tagOf("That IS correct.", "IS"), "VERB");
    assert.equal(tagOf("The team is ready.", "is"), "VERB");
    assert.equal(tagOf("Send us the report.", "us"), "PRON");
  });

  // SHA は shall の縮約（sha|n't）の前半と同じ綴りで、動詞と読まれていた間は article-sound に見えていなかった。
  it("名前と読んだ語の冠詞は article-sound が確かめる（SHA は両様に読むので a も an も通り、a AI assistant は報告）", () => {
    const articleSound = (source: string): number => firedRules(en, source).filter((rule) => rule === "article-sound").length;
    assert.equal(articleSound("We store a SHA-256 hash of each file."), 0);
    assert.equal(articleSound("We store an SHA-1 hash of each file."), 0);
    assert.equal(articleSound("We built an AI assistant for the team."), 0);
    assert.equal(articleSound("We built a AI assistant for the team."), 1);
  });
});
