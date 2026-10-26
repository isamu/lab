import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { superlativeReported } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";

// 比べて言い切ってはいない最上級（問い・求めるもの・どれかを指す述語・誰にとっての・場の名詞 + で・決まった言い方）。
// 英文は 18F（米連邦政府、パブリックドメイン）の記事からの短い抜き書きか自作、和文は首相官邸の訓示・演説からの抜き書きか自作。

await ja.prepare?.({ pos: true });
await en.prepare?.({ pos: true });

const quiet = (adapter: typeof en, sentences: readonly string[]): void =>
  sentences.forEach((sentence) => assert.equal(superlativeReported(adapter, sentence), false, sentence));

const reported = (adapter: typeof en, sentences: readonly string[]): void =>
  sentences.forEach((sentence) => assert.equal(superlativeReported(adapter, sentence), true, sentence));

describe("unqualified-superlative: a question claims nothing", () => {
  it("does not report a superlative in a question", () => {
    quiet(en, [
      "What takes the longest or is the most challenging when building out websites?",
      "What do we need to learn more about before we can determine the best path forward?",
      "**Which of these is the best fit for your team?**",
    ]);
    quiet(ja, ["どの案が最も速いでしょうか？"]);
  });

  it("still reports the same superlative stated as a claim", () => {
    reported(en, ["This is the most challenging task.", "Our product is the best fit for your team."]);
    reported(ja, ["この案が最も速いです。"]);
  });
});

describe("unqualified-superlative: what is sought or chosen", () => {
  it("does not report a superlative a goal or choice verb governs", () => {
    quiet(en, [
      "Evaluating early iterations helps the team adjust the next iterations to achieve the best results overall.",
      "We compare several routes before deciding the best way to bring capability into the team.",
      "We tested these fonts with designers to identify which font was the most legible.",
      "Pick the most important sections first, see what you learn, and go from there.",
      "Everyone fully understands the problem and has come to the best solution.",
    ]);
  });

  it("does not report a superlative the predicate asks for (求められる・べき・なければならない)", () => {
    quiet(ja, [
      "同時に、自衛隊には、最高の規律が求められます。",
      "自衛隊員には最高の栄誉が与えられるべきと考えております。",
      "自衛隊には、最高の規律が求められると同時に、最高の栄誉が与えられなければなりません。",
      "最高の栄誉であり、最高の規律、それが自衛隊に求められるものであります。",
    ]);
  });

  it("still reports a superlative the verb does not govern", () => {
    reported(en, [
      "We will walk through the best ways to protect your photo library.",
      "We achieved our goals, and our product is the best on offer.",
      "The best way to scale is to focus on user needs.",
    ]);
    reported(ja, ["当社は最高の品質を誇ります。", "最高の規律を求める声があることは承知しています。ただ、当社の製品は最高です。"]);
  });
});

describe("unqualified-superlative: a predicate that points at one of a set", () => {
  it("does not report a superlative subject whose predicate says which one", () => {
    quiet(en, ["The best backup plan is the one you will actually keep, so start simple.", "The most important divergence is the second."]);
  });

  it("still reports a superlative subject with a claim for its predicate", () => {
    reported(en, ["The best content is conversational.", "The best way to build big is to start small."]);
  });
});

describe("unqualified-superlative: a set named after the noun", () => {
  it("reads about, at, and of or for with a gerund as naming the set", () => {
    quiet(en, [
      "The best thing about this gathering is that it helps us clear our minds.",
      "Growing sums will be paid for access to the best models at the frontier.",
      "Professional fact-checking remains the most common form of debunking used at scale.",
      "Fact-checking has become the most prominent intervention for combating online misinformation.",
      "Recruitment is one of the most important tools for creating the culture a team needs.",
    ]);
  });

  it("does not read for with a noun as a set: it names who gains", () => {
    reported(en, ["We believe the most significant opportunity for government is exploring new tools."]);
  });
});

describe("unqualified-superlative: whose view and which realm (ja)", () => {
  it("reads にとって in the same clause and 世界で as a scope", () => {
    quiet(ja, ["自分にとって今日は最高のクリスマスだった。", "世界で唯一の被爆国である我が国に対して、参加を求める声があります。"]);
  });

  it("does not read にとって across a comma, nor a means before で", () => {
    reported(ja, ["顧客にとって、それは最高の製品です。", "最少の費用で最大の効果を上げる。"]);
  });
});

describe("unqualified-superlative: set phrases", () => {
  it("does not report idioms of effort, time and frequency, or the writer's own order", () => {
    quiet(en, [
      "A short guide for mentees on how to get the most out of the relationship.",
      "Focus your limited time where it will do the most good.",
      "Support was added for the most recent hour.",
      "From west to east, the most common options are these.",
    ]);
    quiet(ja, ["最も重要なことは、両国が共存することです。"]);
  });

  it("still reports the same words outside the phrase", () => {
    reported(en, ["Our team does the most innovative work."]);
    reported(ja, ["最も重要な製品です。"]);
  });
});
