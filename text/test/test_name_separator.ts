import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { latinSpacing } from "./rule-run.ts";
import { isNameSeparator } from "../packages/chaff/src/name-separator.ts";
import { latinBoundaries, type Boundary } from "../packages/chaff/src/orthography.ts";
import type { Token } from "../packages/chaff/src/plugin.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";

// 名前だけを空白で並べた行（株式会社あおば電子 経営企画部 IR担当）の空白は、名前と名前の区切りで、英字の前後の空け方の好みではない。

const tokensOf = (text: string): Token[] => ja.segment(text).sentences.flatMap((sentence) => sentence.tokens ?? []);

/** text の中の、空けた英字の境目。 */
const spacedLetters = (text: string): Boundary[] => latinBoundaries(text).filter((boundary) => boundary.kind === "letter" && boundary.spaced);

/** text の空けた英字の境目ごとに、名前の区切りと読むか。 */
const separators = (text: string, tokens: readonly Token[] | undefined = tokensOf(text)): boolean[] =>
  spacedLetters(text).map((boundary) => isNameSeparator(text, boundary, tokens, 0));

describe("isNameSeparator", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("reads the space between names on a line of names as a separator", () => {
    assert.deepEqual(separators("株式会社あおば電子 経営企画部 IR担当"), [true]);
    assert.deepEqual(separators("営業部 IT推進課"), [true]);
    assert.deepEqual(separators("東京本社 PR室"), [true]);
    assert.deepEqual(separators("株式会社ABC 経営企画部"), [true]);
    assert.deepEqual(separators("担当：経営企画部 IR担当 山田"), [true]);
    assert.deepEqual(separators("- 経営企画部 IR担当"), [true]);
  });

  it("reads a line of names on its own, not with the sentence the lines were joined into", () => {
    assert.deepEqual(separators("株式会社あおば電子\n経営企画部 IR担当\nご不明な点はお問い合わせください。"), [true]);
  });

  it("does not read a space in a sentence, or around a word written in Latin letters alone", () => {
    assert.deepEqual(separators("この IT システムは便利です。"), [false, false]);
    assert.deepEqual(separators("経営企画部 IR担当までお問い合わせください。"), [false]);
    assert.deepEqual(separators("経営企画部 IR担当まで"), [false]);
    assert.deepEqual(separators("ジャーナル オープンアクセス HTML"), [false]);
    assert.deepEqual(separators("- Patch リリース"), [false]);
    assert.deepEqual(separators("- 言語：pt-BR 更新"), [false]);
    assert.deepEqual(separators("経営企画部 IR担当。"), [false]);
  });

  it("does not read a line without parts of speech, a touching boundary or a digit", () => {
    assert.deepEqual(
      spacedLetters("経営企画部 IR担当").map((boundary) => isNameSeparator("経営企画部 IR担当", boundary, undefined, 0)),
      [false],
    );
    assert.deepEqual(separators("経営企画部 IR担当", []), [false]);
    const touching = latinBoundaries("経営企画部IR担当").filter((boundary) => boundary.kind === "letter");
    assert.deepEqual(
      touching.map((boundary) => isNameSeparator("経営企画部IR担当", boundary, tokensOf("経営企画部IR担当"), 0)),
      touching.map(() => false),
    );
    const digits = latinBoundaries("営業部 2課").filter((boundary) => boundary.spaced);
    assert.deepEqual(
      digits.map((boundary) => isNameSeparator("営業部 2課", boundary, tokensOf("営業部 2課"), 0)),
      digits.map(() => false),
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

  it("still counts a space added before a Latin word in a sentence", () => {
    assert.deepEqual(spacing(`${BODY}この IT システムは便利です。\n`), ["英字:空けています", "英字:空けています"]);
    assert.deepEqual(spacing(`${BODY}ご不明な点は IR担当までお問い合わせください。\n`), ["英字:空けています"]);
  });
});
