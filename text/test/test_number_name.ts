import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { digitRunAround, isNumberName } from "../packages/chaff/src/number-name.ts";
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

  it("keeps a number without levels at the head of a sentence, a list item or in parentheses: it counts things", () => {
    const head = "223 言語に対応";
    assert.equal(isNumberName(head, runOf(head, "223"), [token(4, "言語", "NOUN")], 0), false);
    const item = "- 1122 医療費控除";
    assert.equal(isNumberName(item, runOf(item, "1122"), [token(7, "医療費", "NOUN")], 0), false);
    const parens = "（113 クローン）";
    assert.equal(isNumberName(parens, runOf(parens, "113"), [token(5, "クローン", "NOUN")], 0), false);
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

  it("reads only a hyphen-joined number of three parts or with a part starting with 0 as an identifier", () => {
    const shaped = (digits: string): boolean => isNumberName(`${digits} 担当`, runOf(`${digits} 担当`, digits), [token(digits.length + 1, "担当", "NOUN")], 0);
    assert.equal(shaped("073-489-5912"), true);
    assert.equal(shaped("102-0094"), true);
    assert.equal(shaped("03-3501"), true);
    assert.equal(shaped("2026-06-02"), true);
    assert.equal(shaped("2026-10-12"), true);
    assert.equal(shaped("4-1-3"), true);
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

  it("does not count a telephone number before the next item", () => {
    assert.deepEqual(spacing("# 問い合わせ\n\n受付は3回まで、5日以内です。\n\n電話：073-489-5912 ファックス：073-489-2510\n"), []);
  });

  it("does not count the space before an address number either", () => {
    assert.deepEqual(spacing("# 所在地\n\n受付を3回、確認を5回行う。\n\n所在地：〒102-0094 東京都千代田区\n"), []);
    assert.deepEqual(spacing("# 連絡\n\n受付を3回、確認を5回行う。\n\n電話 03-3501-1511 担当 山田\n"), []);
  });

  it("still counts a quantity written the other way, at the head of a line too", () => {
    assert.deepEqual(spacing("# 使い方\n\n3回呼び、5回待ち、10 回で止める。\n"), ["前の数字:空けています"]);
    assert.deepEqual(spacing("# 使い方\n\n10 回で止める。3回呼び、5回待つ。\n"), ["前の数字:空けています"]);
    assert.deepEqual(spacing("# 使い方\n\n3日、5日と待ち、3-5 日で終わる。\n"), ["前の数字:空けています"]);
    assert.deepEqual(spacing("# 使い方\n\n受付は3営業日、確認は5営業日、終了は3-5 営業日です。\n"), ["前の数字:空けています"]);
  });
});
