import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { superlativeReported } from "./rule-run.ts";
import { inPhrase, ownedBefore } from "../packages/chaff/src/detectors/superlative-phrase.ts";
import { phraseEnd } from "../packages/chaff/src/detectors/superlative-scope.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter, Lexicon, Token } from "../packages/chaff/src/plugin.ts";

// unqualified-superlative and a superlative that claims nothing: inside a set phrase (even the best, 最高裁判所), after a
// named owner (芭蕉の最も有名な作品), scoped after a hyphenated modifier, or next to a full-width number (最大５億ドル).
// Every sentence is self-written.

await ja.prepare?.({ pos: true });
await en.prepare?.({ pos: true });

const reported = (adapter: LanguageAdapter, sentences: readonly string[], expected: boolean): void =>
  sentences.forEach((sentence) => assert.equal(superlativeReported(adapter, sentence), expected, sentence));

const tokensOf = (adapter: LanguageAdapter, text: string): readonly Token[] => adapter.segment(text).sentences.flatMap((sentence) => sentence.tokens ?? []);

const at = (tokens: readonly Token[], surface: string): number => tokens.findIndex((token) => token.surface.toLowerCase() === surface);

describe("unqualified-superlative: a superlative inside a set phrase", () => {
  it("does not report a concession or a hypothetical (en)", () => {
    reported(
      en,
      [
        "Even on the best teams, plans need to be checked and changed.",
        "Even the best plan will not help a team that is too small.",
        "In the best case scenario, the team ships a week early.",
        "Plan for the best-case outcome and for the worst.",
      ],
      false,
    );
  });

  it("still reports a superlative outside the phrases (en)", () => {
    reported(en, ["Our team is the best.", "This is the best plan, even now.", "It is the most powerful tool."], true);
  });

  it("does not report a title or a distance (ja)", () => {
    reported(ja, ["最高裁判所が判断を示しました。", "最高経営責任者が説明しました。", "最も近い駅は北口です。"], false);
  });

  it("still reports a superlative outside the phrases (ja)", () => {
    reported(ja, ["当社の製品は最も優れています。", "最高の品質をお届けします。", "最も速い回線です。"], true);
  });

  it("inPhrase needs the whole superlative inside one phrase that starts and ends at word edges", () => {
    const phrases: Lexicon = [{ pattern: "even the best" }];
    const tokens = tokensOf(en, "Even the best plan fails.");
    const best = at(tokens, "best");
    assert.equal(inPhrase(tokens, { start: best - 1, end: best + 1 }, phrases), true);
    assert.equal(inPhrase(tokens, { start: best - 1, end: best + 2 }, phrases), false);
    assert.equal(inPhrase(tokens, { start: best - 1, end: best + 1 }, []), false);
    const inside = tokensOf(en, "Steven the best plan fails.");
    const insideBest = at(inside, "best");
    assert.equal(inPhrase(inside, { start: insideBest - 1, end: insideBest + 1 }, phrases), false);
  });

  it("inPhrase reads a phrase the analyser splits differently inside a sentence", () => {
    const tokens = tokensOf(ja, "最高裁判所が判断を示しました。");
    assert.equal(inPhrase(tokens, { start: 0, end: 1 }, [{ pattern: "最高裁判所" }]), true);
    assert.equal(inPhrase(tokens, { start: 0, end: 1 }, [{ pattern: "最高裁判所が判断を示す" }]), false);
  });
});

describe("unqualified-superlative: a named owner right before the superlative", () => {
  it("does not report a superlative after a name and の", () => {
    reported(ja, ["芭蕉の最も有名な句です。", "国連の最も大きな目標は、平和を守ることです。"], false);
  });

  it("still reports a superlative after a noun that is not a name, or with no owner joined to it", () => {
    reported(ja, ["最大の課題は、人手不足です。", "そのあとの最大の山場です。", "この町の最大の行事は夏祭りです。", "当社は最も速い。"], true);
  });

  it("ownedBefore needs a name, the word, and the superlative, with no space between", () => {
    const owners: Lexicon = [{ pattern: "の" }];
    const tokens = tokensOf(ja, "芭蕉の最も有名な句です。");
    const most = at(tokens, "最も");
    assert.equal(ownedBefore(tokens, { start: most, end: most + 1 }, owners), true);
    assert.equal(ownedBefore(tokens, { start: most, end: most + 1 }, []), false);
    assert.equal(ownedBefore(tokens, { start: 0, end: 1 }, owners), false);
    const apart = tokensOf(ja, "芭蕉の 最も有名な句です。");
    const spaced = at(apart, "最も");
    assert.equal(ownedBefore(apart, { start: spaced, end: spaced + 1 }, owners), false);
  });
});

describe("unqualified-superlative: a hyphenated modifier and a full-width number", () => {
  it("reads a scope after a hyphenated modifier", () => {
    reported(
      en,
      [
        "These are the most widely-used tools in the world.",
        "It is the most well-known bridge of the three.",
        "This is the most award-winning bakery in the city.",
        "This is the most state-of-the-art lab in the country.",
      ],
      false,
    );
    reported(en, ["These are the most widely-used tools."], true);
  });

  it("phraseEnd reads through a hyphen joined on both sides only", () => {
    const joined = tokensOf(en, "the most widely-used tools in");
    assert.equal(joined[phraseEnd(joined, 2)]?.surface, "in");
    const spaced = tokensOf(en, "the most widely - used tools in");
    assert.equal(spaced[phraseEnd(spaced, 2)]?.surface, "-");
  });

  it("does not report a superlative next to a full-width number, and still reports one with none", () => {
    reported(ja, ["最大５億ドルを拠出します。", "最大５名まで参加できます。"], false);
    reported(ja, ["最大の効果を上げます。"], true);
  });
});
