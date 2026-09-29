import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { digitRunAround, isNumberName, placeChainBefore, sequenceLabelStarts } from "../packages/chaff/src/number-name.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import type { Token } from "../packages/chaff/src/plugin.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";

// 番号・識別子として書かれた数（見出し番号、注の番号、電話番号）は、日本語との空け方の好みとして数えない。

describe("digitRunAround", () => {
  const cases: readonly (readonly [string, number, string | undefined])[] = [
    ["電話：073-489-5912 ファックス", 5, "073-489-5912"],
    ["「3.1 リサーチ」", 2, "3.1"],
    ["3回", 0, "3"],
    ["あ3", 1, "3"],
    ["あい", 0, undefined],
    ["", 0, undefined],
    ["3", 5, undefined],
    ["3", -1, undefined],
  ];
  cases.forEach(([text, at, expected]) => {
    it(`${text} @${String(at)}`, () => {
      const run = digitRunAround(text, at);
      assert.equal(run === undefined ? undefined : text.slice(run.start, run.end), expected);
    });
  });
});

describe("sequenceLabelStarts", () => {
  const numbersAt = (text: string): string[] => [...sequenceLabelStarts(text)].map((start) => (/^\d+/u.exec(text.slice(start)) ?? [""])[0]);
  const cases: readonly (readonly [string, string, readonly string[]])[] = [
    ["white-paper notes, one per paragraph", "9 首相に\n\n10 日本経済新聞\n\n11 欧州", ["9", "10", "11"]],
    ["a note continued on the next line, and one with Latin after it", "12 世界経済\nNHK NEWS WEB\n\n13 BBC NEWS\n\n14 「焦点」", ["12", "13", "14"]],
    ["a pair is a sequence", "1 エキスパート\n\n2 亀田", ["1", "2"]],
    ["list items", "- 1 氏名\n- 2 年月", ["1", "2"]],
    ["indented, with a tab", "  3\t注\n  4\t注", ["3", "4"]],
    ["one number alone", "223 言語に対応する。", []],
    ["years opening a table's rows", "2025 予算\n2026 予算", []],
    ["numbers with gaps (codes)", "- 1122 医療費\n- 1124 出産", []],
    ["descending", "3 注\n\n2 注", []],
    ["the same number twice", "2 ページ\n2 ページ", []],
    ["an ordered list marker is not the number", "1. 4 番\n2. 5 番", []],
    ["a number glued to the word", "9首相\n10新聞", []],
    ["a number in the middle of a line", "注 9 首相\n注 10 新聞", []],
    ["nothing after the number", "9 \n10 ", []],
    ["empty", "", []],
  ];
  cases.forEach(([name, text, expected]) => {
    it(name, () => assert.deepEqual(numbersAt(text), expected));
  });

  it("gives the position of the number, not of the line", () => {
    assert.deepEqual([...sequenceLabelStarts("前\n- 1 氏名\n- 2 年月")], [4, 11]);
  });
});

describe("isNumberName", () => {
  const token = (start: number, surface: string, pos: string, features?: Record<string, string>): Token => ({
    span: { start, end: start + surface.length },
    surface,
    pos,
    ...(features === undefined ? {} : { features }),
  });
  const runOf = (text: string, digits: string): { start: number; end: number } => ({ start: text.indexOf(digits), end: text.indexOf(digits) + digits.length });

  it("reads a numbered section at the head of a sentence or a list item as a label", () => {
    const text = "2.1 注文の登録";
    assert.equal(isNumberName(text, runOf(text, "2.1"), [token(4, "注文", "NOUN")], 0), true);
    const item = "- 3.1.2 アクセシビリティ";
    assert.equal(isNumberName(item, runOf(item, "3.1.2"), [token(8, "アクセシビリティ", "NOUN")], 0), true);
  });

  it("reads a number right after a quoting bracket or a note mark as a label", () => {
    const quoted = "「3.1 リサーチの原則」";
    assert.equal(isNumberName(quoted, runOf(quoted, "3.1"), [token(5, "リサーチ", "NOUN")], 0), true);
    const chapter = "「5 インフォームド・コンセント」";
    assert.equal(isNumberName(chapter, runOf(chapter, "5"), [token(3, "インフォームド", "NOUN")], 0), true);
    const note = "※1 特定の条件";
    assert.equal(isNumberName(note, runOf(note, "1"), [token(3, "特定", "NOUN")], 0), true);
  });

  it("reads a postal code after 〒 as a label, even without a part starting with 0", () => {
    const postal = "〒100-8916 東京都";
    assert.equal(isNumberName(postal, runOf(postal, "100-8916"), [token(10, "東京", "PROPN", { NameType: "Geo" })], 0), true);
    const spaced = "〒 100-8916 東京都";
    assert.equal(isNumberName(spaced, runOf(spaced, "100-8916"), [token(11, "東京", "PROPN", { NameType: "Geo" })], 0), false);
    const plain = "郵送 100-8916 東京都";
    assert.equal(isNumberName(plain, runOf(plain, "100-8916"), [token(12, "東京", "PROPN", { NameType: "Geo" })], 0), false);
  });

  const TOP_UNITS = new Set(["都", "道", "府", "県"]);
  const geo = (start: number, surface: string): Token => token(start, surface, "PROPN", { NameType: "Geo" });
  const unit = (start: number, surface: string): Token => token(start, surface, "NOUN", { NameType: "GeoUnit" });

  it("collects the place words that touch, nearest first, and stops at a gap or another word", () => {
    const tokens = [token(0, "住所", "NOUN"), geo(2, "東京"), unit(4, "都"), geo(5, "千代田"), unit(8, "区"), geo(10, "紀尾井町")];
    assert.deepEqual(
      placeChainBefore(tokens, 9).map((word) => word.surface),
      ["区", "千代田", "都", "東京"],
    );
    assert.deepEqual(
      placeChainBefore(tokens, 14).map((word) => word.surface),
      ["紀尾井町"],
    );
    assert.deepEqual(placeChainBefore(tokens, 2), []);
    assert.deepEqual(placeChainBefore([], 3), []);
  });

  it("reads a hyphen-joined number right after a place below a prefecture as an address", () => {
    const text = "千代田区紀尾井町1-3 東京ガーデンテラス";
    const tokens = [geo(0, "千代田"), unit(3, "区"), geo(4, "紀尾井町"), geo(12, "東京")];
    assert.equal(isNumberName(text, runOf(text, "1-3"), tokens, 0, new Set(), TOP_UNITS), true);
    const ward = "千代田区2-1 ビル";
    assert.equal(isNumberName(ward, runOf(ward, "2-1"), [geo(0, "千代田"), unit(3, "区"), token(8, "ビル", "NOUN")], 0, new Set(), TOP_UNITS), true);
  });

  it("keeps a range after a region or a prefecture, a number with no hyphen, and a place away from the number", () => {
    const region = "北海道2-3 営業日";
    assert.equal(isNumberName(region, runOf(region, "2-3"), [geo(0, "北海道"), token(7, "営業", "NOUN")], 0, new Set(), TOP_UNITS), false);
    const prefecture = "東京都2-3 営業日";
    assert.equal(isNumberName(prefecture, runOf(prefecture, "2-3"), [geo(0, "東京"), unit(2, "都"), token(7, "営業", "NOUN")], 0, new Set(), TOP_UNITS), false);
    const unhyphenated = "千代田区23 番";
    assert.equal(
      isNumberName(unhyphenated, runOf(unhyphenated, "23"), [geo(0, "千代田"), unit(3, "区"), token(7, "番", "NOUN")], 0, new Set(), TOP_UNITS),
      false,
    );
    const apart = "千代田区 2-1 ビル";
    assert.equal(isNumberName(apart, runOf(apart, "2-1"), [geo(0, "千代田"), unit(3, "区"), token(9, "ビル", "NOUN")], 0, new Set(), TOP_UNITS), false);
    const range = "期間は3-5 営業日";
    assert.equal(isNumberName(range, runOf(range, "3-5"), [token(2, "は", "ADP"), token(7, "営業", "NOUN")], 0, new Set(), TOP_UNITS), false);
    const counted = "千代田区1-3 日";
    assert.equal(
      isNumberName(counted, runOf(counted, "1-3"), [geo(0, "千代田"), unit(3, "区"), token(8, "日", "NOUN", { NounType: "Class" })], 0, new Set(), TOP_UNITS),
      false,
    );
  });

  it("keeps a number without levels at the head of a sentence, a list item or in parentheses: it counts things", () => {
    const head = "223 言語に対応";
    assert.equal(isNumberName(head, runOf(head, "223"), [token(4, "言語", "NOUN")], 0), false);
    const item = "- 1122 医療費控除";
    assert.equal(isNumberName(item, runOf(item, "1122"), [token(7, "医療費", "NOUN")], 0), false);
    const parens = "（113 クローン）";
    assert.equal(isNumberName(parens, runOf(parens, "113"), [token(5, "クローン", "NOUN")], 0), false);
  });

  it("reads a number at the head of a line in a note sequence as a label, unless a word bound to numbers follows it", () => {
    const note = "10 日本経済新聞";
    const tokens = [token(103, "日本経済新聞", "PROPN")];
    assert.equal(isNumberName(note, runOf(note, "10"), tokens, 100, new Set([100])), true);
    assert.equal(isNumberName(note, runOf(note, "10"), tokens, 100, new Set([0])), false);
    assert.equal(isNumberName(note, runOf(note, "10"), tokens, 100), false);
    const counted = "10 回で止める";
    assert.equal(isNumberName(counted, runOf(counted, "10"), [token(3, "回", "NOUN", { NounType: "Class" })], 0, new Set([0])), false);
    const conjunction = "31 ただし、課題もある";
    assert.equal(isNumberName(conjunction, runOf(conjunction, "31"), [token(3, "ただし", "CCONJ")], 0, new Set([0])), true);
    assert.equal(isNumberName(conjunction, runOf(conjunction, "31"), [token(3, "ただし", "CCONJ")], 0), false);
    const joined = "※1 又は 2";
    assert.equal(isNumberName(joined, runOf(joined, "1"), [token(3, "又は", "CCONJ")], 0), false);
    const particle = "200 のまま";
    assert.equal(isNumberName(particle, runOf(particle, "200"), [token(4, "の", "ADP")], 0, new Set([0])), false);
    const numeral = "2 万人";
    assert.equal(isNumberName(numeral, runOf(numeral, "2"), [token(2, "万", "NUM", { NumType: "Card" })], 0, new Set([0])), false);
    assert.equal(isNumberName(note, runOf(note, "10"), [], 100, new Set([100])), false);
    assert.equal(isNumberName(note, runOf(note, "10"), undefined, 100, new Set([100])), false);
  });

  it("keeps a section number in the middle of a sentence", () => {
    const text = "見直し 2.3 リサーチの説明";
    assert.equal(isNumberName(text, runOf(text, "2.3"), [token(8, "リサーチ", "NOUN")], 0), false);
  });

  it("keeps a decimal at the head of a sentence when a numeral follows it", () => {
    const text = "26.7 万行を読む";
    assert.equal(isNumberName(text, runOf(text, "26.7"), [token(5, "万", "NOUN", { NumType: "Card" })], 0), false);
  });

  it("reads a hyphen-joined number (a telephone number) anywhere as an identifier", () => {
    const text = "電話：073-489-5912 ファックス";
    assert.equal(isNumberName(text, runOf(text, "073-489-5912"), [token(16, "ファックス", "NOUN")], 0), true);
  });

  it("measures the next word in the document's coordinates", () => {
    const text = "※29 総務省";
    assert.equal(isNumberName(text, runOf(text, "29"), [token(104, "総務省", "PROPN")], 100), true);
    assert.equal(isNumberName(text, runOf(text, "29"), [token(4, "総務省", "PROPN")], 100), false);
  });

  it("keeps a quantity: a counter after the number, even at the head of a line or in a hyphenated range", () => {
    const head = "「10 回で止める」";
    assert.equal(isNumberName(head, runOf(head, "10"), [token(4, "回", "NOUN", { NounType: "Class" })], 0), false);
    const range = "3-5 日かかる";
    assert.equal(isNumberName(range, runOf(range, "3-5"), [token(4, "日", "NOUN", { NounType: "Class" })], 0), false);
  });

  // 三つ以上つないだ番号（2026-10-12）は、orthography.ts が境目を作る前に外すので、ここでは読まない。
  it("reads only a hyphen-joined number with a part starting with 0 as an identifier", () => {
    const shaped = (digits: string): boolean => isNumberName(`${digits} 担当`, runOf(`${digits} 担当`, digits), [token(digits.length + 1, "担当", "NOUN")], 0);
    assert.equal(shaped("073-489-5912"), true);
    assert.equal(shaped("102-0094"), true);
    assert.equal(shaped("03-3501"), true);
    assert.equal(shaped("2026-06-02"), true);
    assert.equal(shaped("2026-10-12"), false);
    assert.equal(shaped("4-1-3"), false);
    assert.equal(shaped("3-5"), false);
    assert.equal(shaped("1-3"), false);
    assert.equal(shaped("10-20"), false);
    assert.equal(shaped("05"), false);
  });

  it("keeps a number followed by a particle or an auxiliary", () => {
    const text = "「200 のまま」";
    assert.equal(isNumberName(text, runOf(text, "200"), [token(5, "の", "ADP")], 0), false);
    const aux = "073-489-5912 です";
    assert.equal(isNumberName(aux, runOf(aux, "073-489-5912"), [token(13, "です", "AUX")], 0), false);
  });

  it("keeps a plain number in the middle of a sentence, whatever follows it", () => {
    const text = "年間 10 万人が訪れる";
    assert.equal(isNumberName(text, runOf(text, "10"), [token(6, "万", "NOUN", { NumType: "Card" })], 0), false);
    const noun = "氏名 2 療養";
    assert.equal(isNumberName(noun, runOf(noun, "2"), [token(5, "療養", "NOUN")], 0), false);
  });

  it("does not decide without parts of speech, or when no word starts right after the number", () => {
    const text = "※29 総務省";
    assert.equal(isNumberName(text, runOf(text, "29"), undefined, 0), false);
    assert.equal(isNumberName(text, runOf(text, "29"), [], 0), false);
    assert.equal(isNumberName(text, runOf(text, "29"), [token(5, "務省", "NOUN")], 0), false);
    const twoSpaces = "※29  総務省";
    assert.equal(isNumberName(twoSpaces, runOf(twoSpaces, "29"), [token(5, "総務省", "PROPN")], 0), false);
  });
});

describe("latin-spacing with parts of speech", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  const spacing = (source: string): string[] => {
    const doc = buildDocument("a.md", source, ja);
    return runRules(doc, loadRules("ja"), { "latin-spacing": "normal" }, false, "technical/readme")
      .findings.filter((finding) => finding.rule === "latin-spacing")
      .map((finding) => `${String(finding.values["kind"])}:${String(finding.values["style"])}`);
  };

  it("does not count a section number quoted before its title", () => {
    assert.deepEqual(spacing("# 意見\n\n- 「1.2 背景と課題」を読み、3回確認した。\n- 「2.4 同意の要件」は5件直す。\n- 以下3点を直す。\n"), []);
  });

  it("does not count a note number after ※", () => {
    assert.deepEqual(spacing("# 注\n\n本文では3回と5件を扱う。\n\n※1 特定の条件を満たす区域による。\n"), []);
  });

  it("still counts a number that counts things, at the head of a line or in parentheses", () => {
    assert.deepEqual(spacing("# 対応\n\n3回呼び、5件直した。\n\n223 言語に対応する。\n"), ["前の数字:空けています"]);
    assert.deepEqual(spacing("# 対応\n\n3回呼び、5件直した（113 クローン）。\n"), ["前の数字:空けています"]);
  });

  it("does not count the number of a note in a numbered run of notes", () => {
    assert.deepEqual(spacing("# 注\n\n本文では3回と5件を扱う。\n\n9 首相の発言。\n\n10 新聞の記事。\n\n11 ただし、課題もある。\n"), []);
  });

  it("still counts numbered lines that count things, and a note number standing alone", () => {
    assert.deepEqual(spacing("# 手順\n\n3回呼び、5件直した。\n\n1 回目で止める。\n\n2 回目で直す。\n"), ["前の数字:空けています", "前の数字:空けています"]);
    assert.deepEqual(spacing("# 注\n\n本文では3回と5件を扱う。\n\n9 首相の発言。\n"), ["前の数字:空けています"]);
    assert.deepEqual(spacing("# 値\n\n3回呼び、5件直した。\n\n200 のままにする。\n\n201 のままにする。\n"), ["前の数字:空けています", "前の数字:空けています"]);
    assert.deepEqual(spacing("# 注\n\n本文では3回と5件を扱う。\n\n```\n8 x\n```\n\n9 首相の発言。\n"), ["前の数字:空けています"]);
  });

  it("does not count a telephone number before the next item", () => {
    assert.deepEqual(spacing("# 問い合わせ\n\n受付は3回まで、5日以内です。\n\n電話：073-489-5912 ファックス：073-489-2510\n"), []);
  });

  it("does not count the space before an address number either", () => {
    assert.deepEqual(spacing("# 所在地\n\n受付を3回、確認を5回行う。\n\n所在地：〒102-0094 東京都千代田区\n"), []);
    assert.deepEqual(spacing("# 連絡\n\n受付を3回、確認を5回行う。\n\n内線 03-3501 担当 山田\n"), []);
  });

  it("does not count the space after a postal code with no part starting with 0, nor after the address number", () => {
    assert.deepEqual(spacing("# 提出先\n\n受付を3回、確認を5回行う。\n\n郵送 〒100-8916 東京都千代田区霞が関1-2-2\n"), []);
    assert.deepEqual(spacing("# 所在地\n\n受付を3回、確認を5回行う。\n\n所在地：〒102-0094 東京都千代田区紀尾井町1-3 東京ガーデンテラス紀尾井町\n"), []);
  });

  it("still counts a range after a region or a prefecture", () => {
    assert.deepEqual(spacing("# 配送\n\n本州は2営業日、九州は3営業日、北海道2-3 営業日です。\n"), ["前の数字:空けています"]);
    assert.deepEqual(spacing("# 配送\n\n本州は2営業日、九州は3営業日、東京都2-3 営業日です。\n"), ["前の数字:空けています"]);
  });

  it("still counts a quantity written the other way, at the head of a line too", () => {
    assert.deepEqual(spacing("# 使い方\n\n3回呼び、5回待ち、10 回で止める。\n"), ["前の数字:空けています"]);
    assert.deepEqual(spacing("# 使い方\n\n10 回で止める。3回呼び、5回待つ。\n"), ["前の数字:空けています"]);
    assert.deepEqual(spacing("# 使い方\n\n3日、5日と待ち、3-5 日で終わる。\n"), ["前の数字:空けています"]);
    assert.deepEqual(spacing("# 使い方\n\n受付は3営業日、確認は5営業日、終了は3-5 営業日です。\n"), ["前の数字:空けています"]);
    assert.deepEqual(spacing("# 使い方\n\n3回呼び、5回待つ。\n\n1.5 万人が来る。\n"), ["前の数字:空けています"]);
  });
});
