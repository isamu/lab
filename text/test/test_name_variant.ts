import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { isNearWord, nameKey, nameVariants, type NameMention } from "../packages/chaff/src/name-variants.ts";

// 同じ名前の書き分け（name-variant）。例文はすべて自作。

const variants = (source: string, adapter = en): readonly string[] => namedRuleRun("name-variant", source, adapter, "a.md").findings;

const mention = (surface: string, offset: number, reading?: string, words: readonly string[] = surface.split(" ")): NameMention => ({
  surface,
  offset,
  reading,
  words,
});

describe("name-variant: 同じ名前の書き分け", () => {
  before(async () => {
    await en.prepare?.({ pos: true });
    await ja.prepare?.({ pos: true });
  });

  it("a brand written with other capitals", () => {
    assert.deepEqual(variants("The code lives on GitHub. Reviews happen on GitHub, and releases are tagged on Github.\n"), [
      '"Github" is written "GitHub" elsewhere in the document (case, width or punctuation)',
    ]);
  });

  it("a name with a letter dropped, when the usual form appears twice", () => {
    assert.deepEqual(variants("Microsoft builds the tool. Microsoft sells it. Microsft ships it.\n"), [
      '"Microsft" is one letter away from "Microsoft", which the document uses more than once',
    ]);
  });

  it("consistent names, and different short names, are not reported", () => {
    assert.deepEqual(variants("Microsoft builds the tool. Microsoft sells it to Contoso.\n"), []);
    assert.deepEqual(variants("Iran and Iraq signed. Iran and Iraq met again.\n"), []);
  });

  it("a plural or a label is not a misspelt name", () => {
    assert.deepEqual(variants("Send it to the Service. The Service replies. Other Services wait.\n"), []);
    assert.deepEqual(variants("See Appendix B. Appendix B lists fees. Appendix C lists dates.\n"), []);
  });

  it("名前の読みが同じで、一語だけ字が違う", () => {
    assert.deepEqual(variants("担当は山田太郎です。見積もりは山田太郎が作り、請求書は山田太朗が送ります。\n", ja), [
      "「山田太朗」は、ほかの所では同じ読みの「山田太郎」と書いています",
    ]);
  });
});

describe("the reading behind name-variant", () => {
  it("nameKey ignores width, case, spaces and marks", () => {
    assert.equal(nameKey("ＡＷＳ"), nameKey("AWS"));
    assert.equal(nameKey("Mac OS"), nameKey("macOS"));
    assert.equal(nameKey("ダイアン・津田"), nameKey("ダイアン津田"));
    assert.notEqual(nameKey("Acme"), nameKey("Acne"));
  });

  it("isNearWord: one replacement, a swap, or a letter dropped inside the word", () => {
    assert.equal(isNearWord("microsoft", "microsft"), true);
    assert.equal(isNearWord("microsoft", "microsfot"), true);
    assert.equal(isNearWord("walker", "waller"), true);
    assert.equal(isNearWord("service", "services"), false);
    assert.equal(isNearWord("state", "xstate"), false);
    assert.equal(isNearWord("iran", "iraq"), false);
    assert.equal(isNearWord("microsoft", "microsoft"), false);
    assert.equal(isNearWord("microsoft", "macrosaft"), false);
  });

  it("the usual form is the more frequent one, then the earlier one", () => {
    const found = nameVariants([mention("Github", 0), mention("GitHub", 10), mention("GitHub", 20)]);
    assert.deepEqual(
      found.map((variant) => `${variant.mention.surface}<${variant.usual}`),
      ["Github<GitHub"],
    );
    const tie = nameVariants([mention("GitHub", 0), mention("Github", 10)]);
    assert.deepEqual(
      tie.map((variant) => variant.mention.surface),
      ["Github"],
    );
  });

  it("names one letter apart need the usual form twice and the other once", () => {
    assert.deepEqual(nameVariants([mention("Walker", 0), mention("Waller", 10)]), []);
    assert.deepEqual(nameVariants([mention("Walker", 0), mention("Walker", 5), mention("Waller", 10), mention("Waller", 15)]), []);
    assert.equal(nameVariants([mention("Walker", 0), mention("Walker", 5), mention("Waller", 10)]).length, 1);
  });

  it("a more frequent unrelated name in the same group does not hide the pair", () => {
    const near = nameVariants([
      mention("Microsoft Foo", 0),
      mention("Microsoft Foo", 5),
      mention("Microsft Foo", 10),
      mention("Alphabet Foo", 15),
      mention("Alphabet Foo", 20),
      mention("Alphabet Foo", 25),
    ]);
    assert.deepEqual(
      near.map((variant) => `${variant.mention.surface}<${variant.usual}`),
      ["Microsft Foo<Microsoft Foo"],
    );
    const reading = (surface: string, offset: number, words: readonly string[]): NameMention => mention(surface, offset, "ヤマダタロウ", words);
    const homophones = nameVariants([
      reading("山田太郎", 0, ["山田", "太郎"]),
      reading("山田太郎", 5, ["山田", "太郎"]),
      reading("山田太朗", 10, ["山田", "太朗"]),
      reading("矢間田多労", 15, ["矢間田", "多労"]),
      reading("矢間田多労", 20, ["矢間田", "多労"]),
      reading("矢間田多労", 25, ["矢間田", "多労"]),
    ]);
    assert.deepEqual(
      homophones.map((variant) => `${variant.mention.surface}<${variant.usual}`),
      ["山田太朗<山田太郎"],
    );
  });

  it("a same-reading pair must share all but one word", () => {
    assert.deepEqual(nameVariants([mention("毅", 0, "ツヨシ", ["毅"]), mention("剛", 5, "ツヨシ", ["剛"])]), []);
    assert.equal(nameVariants([mention("山田太郎", 0, "ヤマダタロウ", ["山田", "太郎"]), mention("山田太朗", 9, "ヤマダタロウ", ["山田", "太朗"])]).length, 1);
  });
});
