import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { superlativeReported } from "./rule-run.ts";
import { namesAmount } from "../packages/chaff/src/detectors/superlative-amount.ts";
import { restricted, type Restrictors } from "../packages/chaff/src/detectors/superlative-clause.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter, Lexicon, Token } from "../packages/chaff/src/plugin.ts";

// "the most work" names an amount; "the best we have measured" and "the best education possible" say what the superlative
// is the most of. Every sentence is self-written.

const LISTS: readonly string[] = ["superlative-amount", "relative-word", "superlative-bound", "subject-pronoun"];

await ja.prepare?.({ pos: true });
await en.prepare?.({ pos: true });

const listOf = (adapter: LanguageAdapter, name: string): Lexicon => adapter.lexicons[name] ?? [];

const tokensOf = (adapter: LanguageAdapter, text: string): Token[] => adapter.segment(text).sentences.flatMap((sentence) => sentence.tokens ?? []);

/** Where the superlative (a run of words) first stands in the sentence. */
const rangeOf = (tokens: readonly Token[], superlative: readonly string[], text: string): { start: number; end: number } => {
  const start = tokens.findIndex((_token, at) => superlative.every((word, offset) => tokens[at + offset]?.surface.toLowerCase() === word));
  if (start === -1) throw new Error(`${superlative.join(" ")} is not in ${text}`);
  return { start, end: start + superlative.length };
};

const isAmount = (text: string, superlative: readonly string[] = ["the", "most"]): boolean => {
  const tokens = tokensOf(en, text);
  return namesAmount(tokens, rangeOf(tokens, superlative, text), listOf(en, "superlative-amount"));
};

const restrictorsOf = (): Restrictors => ({
  relatives: listOf(en, "relative-word"),
  bounds: listOf(en, "superlative-bound"),
  subjects: listOf(en, "subject-pronoun"),
});

const isRestricted = (text: string, superlative: readonly string[]): boolean => {
  const tokens = tokensOf(en, text);
  return restricted(tokens, rangeOf(tokens, superlative, text), restrictorsOf());
};

describe("namesAmount", () => {
  it("the most + a noun that heads its phrase is an amount", () => {
    assert.ok(isAmount("Whoever does the most work will make the most mistakes."));
    assert.ok(isAmount("The school enrolls the most students."));
    assert.ok(isAmount("For the most part, the project is on track."));
    assert.ok(isAmount("These features drive the most value for users."));
    assert.ok(isAmount("Those rules apply to the most users."));
    assert.ok(isAmount("They did the most work"));
  });

  it("the most + an adjective or a participle is a claim", () => {
    assert.ok(!isAmount("It is the most powerful tool."));
    assert.ok(!isAmount("It is the most trusted brand."));
    assert.ok(!isAmount("It is the most important thing."));
  });

  it("a noun followed by another noun, a hyphen or an adjective may be a mistagged adjective, so it stays a claim", () => {
    // The tagger reads "frigid" and "cost" as nouns here.
    assert.ok(!isAmount("Only the most frigid weather stops the walk."));
    assert.ok(!isAmount("Pick the most cost-effective option."));
  });

  it("the most with nothing after it is not an amount", () => {
    assert.ok(!isAmount("This one matters the most."));
  });

  it("only a superlative the list names can name an amount", () => {
    assert.ok(!isAmount("It is the best work.", ["the", "best"]));
    const tokens = tokensOf(en, "The school enrolls the most students.");
    assert.ok(!namesAmount(tokens, rangeOf(tokens, ["the", "most"], ""), []));
  });
});

describe("restricted", () => {
  it("a relative clause after the superlative's noun phrase restricts it", () => {
    assert.ok(isRestricted("These are the most dangerous threats that we have seen in decades.", ["the", "most"]));
    assert.ok(isRestricted("The most important thing that managers can do is listen.", ["the", "most"]));
    assert.ok(isRestricted("It is the most consistent issue that has defined the term.", ["the", "most"]));
    assert.ok(isRestricted("It is the best option which we chose.", ["the", "best"]));
    assert.ok(isRestricted("They are the best people who work here.", ["the", "best"]));
    assert.ok(isRestricted("She is the best candidate whom we interviewed.", ["the", "best"]));
    assert.ok(isRestricted("She is the best candidate who we interviewed.", ["the", "best"]));
    assert.ok(isRestricted("It is the best plan that the team made.", ["the", "best"]));
    assert.ok(isRestricted("It is the best option that this offers.", ["the", "best"]));
  });

  it("a relative word with no verb after it, or after a predicate, opens no clause", () => {
    assert.ok(!isRestricted("They picked the best solution that day.", ["the", "best"]));
    assert.ok(!isRestricted("The best is that we win.", ["the", "best"]));
  });

  it("a clause with no relative word restricts it too", () => {
    assert.ok(isRestricted("It is the best we have measured.", ["the", "best"]));
    assert.ok(isRestricted("It is the best option they could find.", ["the", "best"]));
    assert.ok(isRestricted("We did the most we could.", ["the", "most"]));
    ["I", "you", "he", "she", "it", "we", "they"].forEach((pronoun) => {
      assert.ok(isRestricted(`It is the best option ${pronoun} could find.`, ["the", "best"]), pronoun);
    });
    assert.ok(isRestricted("This is the best option the team selected.", ["the", "best"]));
    assert.ok(!isRestricted("The best teams all adapt quickly.", ["the", "best"]));
    assert.ok(!isRestricted("The best players each week get a bonus.", ["the", "best"]));
    assert.ok(!isRestricted("The best players themselves get a bonus.", ["the", "best"]));
    assert.ok(!isRestricted("Is the best option it or the other one?", ["the", "best"]));
    assert.ok(!isRestricted("The best option itself changed quickly.", ["the", "best"]));
    assert.ok(!isRestricted("Give the best students the prize.", ["the", "best"]));
  });

  it("a past participle after the noun restricts it; one that takes an object or stands as a predicate is the sentence's verb", () => {
    assert.ok(isRestricted("Controlled assessment, the most scalable option discussed, was hard to grade.", ["the", "most"]));
    assert.ok(isRestricted("The best results obtained were poor.", ["the", "best"]));
    assert.ok(isRestricted("We chose the best option discussed.", ["the", "best"]));
    assert.ok(!isRestricted("The best solution proposed a fix.", ["the", "best"]));
    assert.ok(!isRestricted("We saw that the best solution proposed a fix.", ["the", "best"]));
    assert.ok(!isRestricted("We knew the best solution proposed a fix.", ["the", "best"]));
    assert.ok(!isRestricted("The best option changed.", ["the", "best"]));
    assert.ok(!isRestricted("The best option changed quickly and won.", ["the", "best"]));
  });

  it("possible or available right after the superlative or after its noun bounds it", () => {
    assert.ok(isRestricted("He answered in the most restrained manner possible.", ["the", "most"]));
    assert.ok(isRestricted("Students should receive the best education possible.", ["the", "best"]));
    assert.ok(isRestricted("We aim for the best possible outcome.", ["the", "best"]));
    assert.ok(isRestricted("Use the best evidence available.", ["the", "best"]));
  });

  it("an unrestricted superlative is not restricted", () => {
    assert.ok(!isRestricted("It is the best solution on the market.", ["the", "best"]));
    assert.ok(!isRestricted("It is the most powerful tool.", ["the", "most"]));
    assert.ok(!isRestricted("It is the best solution ever.", ["the", "best"]));
    assert.ok(!isRestricted("The best teams adapt quickly.", ["the", "best"]));
    assert.ok(!isRestricted("Give the best students their grades.", ["the", "best"]));
    assert.ok(!isRestricted("Give the best players their running shoes.", ["the", "best"]));
    assert.ok(!isRestricted("Pick the best tool yourself.", ["the", "best"]));
    assert.ok(!isRestricted("It is the best tool here.", ["the", "best"]));
    assert.ok(!isRestricted("Feedback is the best way to improve.", ["the", "best"]));
  });

  it("a language without relative words gets no clause, participle or bound reading", () => {
    const tokens = tokensOf(en, "It is the best we have measured.");
    assert.ok(!restricted(tokens, rangeOf(tokens, ["the", "best"], ""), { ...restrictorsOf(), relatives: [] }));
    const bounded = tokensOf(en, "Use the best evidence available.");
    assert.ok(!restricted(bounded, rangeOf(bounded, ["the", "best"], ""), { ...restrictorsOf(), bounds: [] }));
  });
});

describe("unqualified-superlative (en): amounts, clauses and bounds", () => {
  it("does not report them", () => {
    [
      "Whoever does the most work will make the most mistakes.",
      "The school enrolls the most students.",
      "For the most part, the project is on track.",
      "These are the most dangerous threats that we have seen in decades.",
      "It is the best we have measured.",
      "Controlled assessment, the most scalable option discussed, was hard to grade.",
      "He answered in the most restrained manner possible.",
      "We aim for the best possible outcome.",
    ].forEach((sentence) => {
      assert.ok(!superlativeReported(en, sentence), sentence);
    });
  });

  it("still reports an unqualified superlative", () => {
    [
      "It is the best solution on the market.",
      "It is the most powerful tool.",
      "It is the best solution ever.",
      "Only the most frigid weather stops the walk.",
      "The best solution proposed a fix.",
      "The best option changed.",
      "The best option changed quickly and won.",
      "Feedback is the best way to improve.",
    ].forEach((sentence) => {
      assert.ok(superlativeReported(en, sentence), sentence);
    });
  });

  it("reports a sentence where one superlative is an amount and another is a claim", () => {
    assert.ok(superlativeReported(en, "They did the most work and built the most powerful tool."));
  });

  it("Japanese has none of these lists and its findings are unchanged", () => {
    LISTS.forEach((name) => {
      assert.equal(ja.lexicons[name], undefined, name);
    });
    assert.ok(superlativeReported(ja, "最も人気の店です。"));
  });

  it("a language without the lists reads none of these forms, and the rule still runs", () => {
    const withoutLists: LanguageAdapter = { ...en, lexicons: Object.fromEntries(Object.entries(en.lexicons).filter(([list]) => !LISTS.includes(list))) };
    ["The school enrolls the most students.", "It is the best we have measured.", "We aim for the best possible outcome."].forEach((sentence) => {
      assert.ok(superlativeReported(withoutLists, sentence), sentence);
    });
  });
});
