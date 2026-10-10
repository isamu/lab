import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { latinSpacing } from "./rule-run.ts";
import { isNameSeparator, type OrganizationWords } from "../packages/chaff/src/name-separator.ts";
import { latinBoundaries, type Boundary } from "../packages/chaff/src/orthography.ts";
import type { Token } from "../packages/chaff/src/plugin.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { loadLexicons } from "../packages/lang-ja/src/lexicons.ts";

// 名前だけを空白で並べた行（株式会社あおば電子 経営企画部 IR担当）で、両側が組織の名前の空白は、名前と名前の区切りで、英字の前後の空け方の好みではない。

const patternsOf = (id: string): string[] => (loadLexicons()[id] ?? []).map((entry) => entry.pattern);
const WORDS: OrganizationWords = { units: new Set(patternsOf("organization-unit")), forms: patternsOf("company-form") };
const NO_WORDS: OrganizationWords = { units: new Set(), forms: [] };

const tokensOf = (text: string): Token[] => ja.segment(text).sentences.flatMap((sentence) => sentence.tokens ?? []);

/** text の中の、英字の境目（spaced のものか、詰めたものか）。 */
const letterBoundaries = (text: string, spaced = true): Boundary[] =>
  latinBoundaries(text).filter((boundary) => boundary.kind === "letter" && boundary.spaced === spaced);

/** text の空けた英字の境目ごとに、名前の区切りと読むか。 */
const separators = (text: string, tokens: readonly Token[] | undefined = tokensOf(text), words = WORDS): boolean[] =>
  letterBoundaries(text).map((boundary) => isNameSeparator(text, boundary, tokens, 0, words));

describe("isNameSeparator", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("reads the space between names of departments, offices, roles and companies on a line of names as a separator", () => {
    assert.deepEqual(separators("株式会社あおば電子 経営企画部 IR担当"), [true]);
    assert.deepEqual(separators("営業部 IT推進課"), [true]);
    assert.deepEqual(separators("東京本社 PR室"), [true]);
    assert.deepEqual(separators("広報グループ SNS担当チーム"), [true]);
    assert.deepEqual(separators("株式会社ABC 経営企画部"), [true]);
    assert.deepEqual(separators("IT推進課 ABC株式会社"), [true]);
    assert.deepEqual(separators("担当：経営企画部 IR担当 山田"), [true]);
    assert.deepEqual(separators("- 経営企画部 IR担当"), [true]);
  });

  it("reads a line of names on its own, not with the sentence the lines were joined into", () => {
    assert.deepEqual(separators("株式会社あおば電子\n経営企画部 IR担当\nご不明な点はお問い合わせください。"), [true]);
  });

  it("does not read a space between words that are not names of an organisation", () => {
    assert.deepEqual(separators("生成AI 活用事例"), [false]);
    assert.deepEqual(separators("社内IT 推進室"), [false]);
    assert.deepEqual(separators("経営企画部 IR"), [false]);
    assert.deepEqual(separators("IR 担当"), [false]);
    assert.deepEqual(separators("株式会社 ABC推進室"), [false]);
    assert.deepEqual(separators("全部 IT細部"), [false]);
    assert.deepEqual(separators("- Patch リリース"), [false]);
    assert.deepEqual(separators("- 言語：pt-BR 更新"), [false]);
  });

  it("does not read a space in a sentence", () => {
    assert.deepEqual(separators("この IT システムは便利です。"), [false, false]);
    assert.deepEqual(separators("窓口は経営企画部 IR担当 です"), [false]);
    assert.deepEqual(separators("経営企画部 IR担当。"), [false]);
  });

  it("does not read a line without parts of speech or words, a touching boundary or a digit", () => {
    const text = "経営企画部 IR担当";
    assert.deepEqual(
      letterBoundaries(text).map((boundary) => isNameSeparator(text, boundary, undefined, 0, WORDS)),
      [false],
    );
    assert.deepEqual(separators(text, []), [false]);
    assert.deepEqual(separators("株式会社ABC 株式会社あおば", []), [false]);
    assert.deepEqual(separators("株式会社ABC 株式会社あおば"), [true]);
    assert.deepEqual(separators(text, tokensOf(text), NO_WORDS), [false]);
    const touching = "経営企画部IR担当";
    assert.deepEqual(
      letterBoundaries(touching, false).map((boundary) => isNameSeparator(touching, boundary, tokensOf(touching), 0, WORDS)),
      [false, false],
    );
    const digits = "営業部 2課";
    assert.deepEqual(
      latinBoundaries(digits).map((boundary) => isNameSeparator(digits, boundary, tokensOf(digits), 0, WORDS)),
      latinBoundaries(digits).map(() => false),
    );
  });

  it("reads tokens in document coordinates from the sentence's start", () => {
    const text = "東京本社 PR室";
    const shifted = tokensOf(text).map((token) => ({ ...token, span: { start: token.span.start + 100, end: token.span.end + 100 } }));
    assert.deepEqual(
      letterBoundaries(text).map((boundary) => isNameSeparator(text, boundary, shifted, 100, WORDS)),
      [true],
    );
    assert.deepEqual(
      letterBoundaries(text).map((boundary) => isNameSeparator(text, boundary, shifted, 0, WORDS)),
      [false],
    );
  });
});

describe("latin-spacing and lines of names", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  const spacing = (source: string): string[] => latinSpacing(ja, source, "business/report");
  const BODY = "# 決算\n\n表はExcelで作り、Wordに貼ります。図はPowerPointで描き、最後にPDFにします。\n\n";

  it("does not count the space between names in a contact or signature line", () => {
    assert.deepEqual(spacing(`${BODY}## お問い合わせ\n\n株式会社あおば電子 経営企画部 IR担当\n`), []);
    assert.deepEqual(spacing(`${BODY}## 連絡先\n\n東京本社 PR室\n営業部 IT推進課\n`), []);
  });

  it("still counts a space added before a Latin word in a sentence or between words that are not names", () => {
    assert.deepEqual(spacing(`${BODY}この IT システムは便利です。\n`), ["英字:空けています", "英字:空けています"]);
    assert.deepEqual(spacing(`${BODY}ご不明な点は IR担当までお問い合わせください。\n`), ["英字:空けています"]);
    assert.deepEqual(spacing(`${BODY}生成AI 活用事例\n`), ["英字:空けています"]);
  });
});
