import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { straightApostrophes } from "../packages/lang-en/src/apostrophe.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { prepare, tokenize } from "../packages/lang-en/src/pos.ts";

describe("straightApostrophes: 字に挟まれた ’ を ' に置き換える", () => {
  const cases: readonly (readonly [string, string, string])[] = [
    ["空", "", ""],
    ["短縮形", "that’s", "that's"],
    ["否定の短縮形", "don’t", "don't"],
    ["所有", "the team’s plan", "the team's plan"],
    ["数字の後ろの所有", "the 1990’s", "the 1990's"],
    ["一つの語に二つ", "rock’n’roll", "rock'n'roll"],
    ["人名", "O’Brien", "O'Brien"],
    ["閉じの引用符は残す", "‘like this’ and", "‘like this’ and"],
    ["文末の閉じの引用符も残す", "‘like this’.", "‘like this’."],
    ["複数形の所有は閉じの引用符と見分けられないので残す", "the users’ files", "the users’ files"],
    ["語頭の省略は残す", "the ’90s", "the ’90s"],
    ["前後が空白でも残す", "rock ’n’ roll", "rock ’n’ roll"],
    ["後ろが数字なら残す", "5’10", "5’10"],
    ["’ だけ", "’", "’"],
    ["開きの引用符は字に挟まれても触らない", "don‘t", "don‘t"],
    ["ʼ は引用符に使わないので、どこでも置き換える", "isnʼt ʼ90s ʼ", "isn't '90s '"],
    ["ラテン文字以外の字にも挟まれれば置き換える", "café’s", "café's"],
    ["サロゲートの字", "𝐀’s", "𝐀's"],
  ];
  cases.forEach(([label, input, expected]) => {
    it(label, () => {
      const result = straightApostrophes(input);
      assert.equal(result, expected);
      assert.equal(result.length, input.length);
    });
  });
});

type Reading = { readonly span: string; readonly pos: string; readonly lemma: string | undefined };

const readingOf = (text: string): Reading[] =>
  (tokenize(text) ?? []).map((token) => ({ span: `${String(token.span.start)}-${String(token.span.end)}`, pos: token.pos, lemma: token.lemma }));

describe("曲がったアポストロフィの英文を、まっすぐなアポストロフィと同じに読む", () => {
  before(() => prepare());

  const sentences = [
    "That’s fine.",
    "The team’s plan works.",
    "We don’t ship on Fridays.",
    "It’s done.",
    "We’re here.",
    "I’m here.",
    "O’Brien signed the 1990’s lease.",
    "It isnʼt far.",
    "In the ’90s we shipped.",
  ];
  sentences.forEach((curly) => {
    it(curly, () => {
      const straight = curly.replaceAll(/[’ʼ]/gu, "'");
      assert.deepEqual(readingOf(curly), readingOf(straight));
    });
  });

  it("語は本文の字のまま返す。位置が本文を指す", () => {
    const text = "We don’t know what that’s for.";
    const tokens = tokenize(text) ?? [];
    tokens.forEach((token) => assert.equal(token.surface, text.slice(token.span.start, token.span.end)));
    assert.ok(tokens.some((token) => token.surface === "n’t"));
    assert.ok(tokens.some((token) => token.surface === "’s"));
  });

  it("閉じの一重引用符は引用符のまま。語に付かない", () => {
    const tokens = tokenize("She said ‘like this’ and left.") ?? [];
    const closing = tokens.find((token) => token.surface.includes("’"));
    assert.equal(closing?.surface, "’");
    assert.ok(tokens.some((token) => token.surface === "this"));
  });
});

describe("oxford-comma-consistency: 曲がったアポストロフィで並びを読み違えない", () => {
  // 18F Handbook（one-on-ones）の一節。合衆国政府の著作物で public domain。
  const excerpt =
    "(In fact, if you’re really getting into a solid feedback/coaching rhythm, you’ll probably find it even more effective to deliver feedback even more regularly and granularly. But, that’s a difficult and harder skill to develop, and starting with weekly is good practice for taking that next step.)";
  const oxfordQuotes = (paragraph: string): string[] => {
    const source = `# One-on-ones\n\nWe fix desks, lamps, and chairs. We sell pens, ink, and paper.\n\n${paragraph}\n`;
    return runRules(buildDocument("t.md", source, en), loadRules("en"), {}, true, "blog/tech")
      .findings.filter((finding) => finding.rule === "oxford-comma-consistency")
      .map((finding) => finding.quote);
  };

  before(() => prepare());

  it("曲がった形とまっすぐな形で結果が同じ", () => {
    assert.deepEqual(oxfordQuotes(excerpt), oxfordQuotes(excerpt.replaceAll("’", "'")));
  });

  it("並びでない文を Oxford comma の無い並びと読まない", () => {
    assert.deepEqual(oxfordQuotes(excerpt), []);
  });
});
