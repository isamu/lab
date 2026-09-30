import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { adapter } from "../packages/lang-ja/src/index.ts";
import { insideBrackets, startsWithCloser } from "../packages/lang-ja/src/inside-brackets.ts";

// 括弧・引用符の中の句点は文を閉じない。sentence-splitter は同じ種類の括弧が入れ子になると数え損ね（「（…（…）…。以下同じ。）に」）、
// 曲がった二重引用符（“…”）は組として数えない。そこで切れた文を、括弧・引用符が閉じるまでつなぐ。
// 法令の文は個人情報の保護に関する法律・会社法から（著作権法 13 条により権利の目的とならない）。ほかは自作の文。

const textsOf = (source: string): string[] => adapter.segment(source).sentences.map((sentence) => sentence.text);

const STATUTE =
  "一　当該情報に含まれる氏名その他の記述等（文書、図画若しくは電磁的記録（電磁的方式（電子的方式、磁気的方式その他人の知覚によっては認識することができない方式をいう。次項第二号において同じ。）で作られる記録をいう。以下同じ。）に記載され、又は記録された一切の事項をいう。以下同じ。）により特定の個人を識別することができるもの";

describe("入れ子の括弧の中の句点で切らない", () => {
  it("法令の定義の括書きは一つの文", () => {
    assert.deepEqual(textsOf(STATUTE), [STATUTE]);
  });

  it("閉じ括弧だけが残っていた文も、前の文の末尾に付く", () => {
    const source = "株式会社の目的を定める（第十条第二項に規定する場合を含む。以下この条において同じ。）次に進む。";
    assert.deepEqual(textsOf(source), [source]);
    assert.deepEqual(textsOf("前項の規定を準用する（同項第四号に係る部分に限る。（第五項において同じ。））"), [
      "前項の規定を準用する（同項第四号に係る部分に限る。（第五項において同じ。））",
    ]);
  });

  it("括弧の中の番号の閉じ（事例5））で数えがずれても、文頭に残った閉じ括弧は前の文に付く", () => {
    const source = "漏えいした場合（入力する予定の個人情報を含む。以下、事例5）まで同じ。）が漏えいした場合に報告する。";
    assert.deepEqual(textsOf(source), [source]);
  });

  it("括弧が閉じた後の句点では、前と同じく切る", () => {
    assert.deepEqual(textsOf("これを定める（以下「規程」という。）。次に進む。"), ["これを定める（以下「規程」という。）。", "次に進む。"]);
    assert.deepEqual(textsOf("（（注）確認した。）次に進む。終わり。"), ["（（注）確認した。）次に進む。", "終わり。"]);
  });

  it("鍵括弧の中の句点は前と同じく切らない", () => {
    assert.deepEqual(textsOf("彼は「やめておく。」と言った。それだけだ。"), ["彼は「やめておく。」と言った。", "それだけだ。"]);
    assert.deepEqual(textsOf("「終わったか？」誰も知らなかった。"), ["「終わったか？」誰も知らなかった。"]);
  });
});

describe("曲がった二重引用符の中の句点で切らない", () => {
  it("閉じ引用符は前の文の末尾に付き、鍵括弧と同じく後ろへつながる", () => {
    assert.deepEqual(textsOf("“終わった？”誰も知らない。"), ["“終わった？”誰も知らない。"]);
    assert.deepEqual(textsOf("“終わった。” 誰も知らない。次へ。"), ["“終わった。” 誰も知らない。", "次へ。"]);
    assert.deepEqual(textsOf("彼は«終わった。»と言った。"), ["彼は«終わった。»と言った。"]);
  });

  it("開き引用符で始まる文は、前の文につながない", () => {
    assert.deepEqual(textsOf('不具合を直した。"#"を含むパスでも動く。'), ["不具合を直した。", '"#"を含むパスでも動く。']);
    assert.deepEqual(textsOf("名前を決めた。“K8s”と書く。"), ["名前を決めた。", "“K8s”と書く。"]);
  });
});

describe("閉じない括弧・対の無い閉じ括弧", () => {
  it("番号の閉じ括弧（1）2)）は後ろの文をつながない", () => {
    assert.deepEqual(textsOf("1）準備した。2）次に進む。"), ["1）準備した。", "2）次に進む。"]);
    assert.deepEqual(textsOf("a) 準備した。b) 次に進む。"), ["a) 準備した。", "b) 次に進む。"]);
  });

  it("閉じない括弧・同上の印の「“」は、後ろの文をつながない", () => {
    assert.deepEqual(textsOf("価格は100円。“ 同上。次の項目です。"), ["価格は100円。", "“ 同上。", "次の項目です。"]);
    assert.deepEqual(textsOf("（（注）未完。次の文です。その次です。"), ["（（注）未完。", "次の文です。", "その次です。"]);
  });

  it("閉じ括弧で始まる行も、前の行にはつながない（\\r だけの改行でも）", () => {
    ["\n", "\r\n", "\r"].forEach((lineBreak) => assert.deepEqual(textsOf(`前の文。${lineBreak}）次の文。`), ["前の文。", "）次の文。"]));
  });

  it("前の行で開いた括弧は、次の行の閉じ括弧と組にしない", () => {
    assert.deepEqual(textsOf("（（注）未完。\n次の行です。その次です。）"), ["（（注）未完。", "次の行です。", "その次です。）"]);
  });

  it("文の位置は元の文字列のまま", () => {
    const source = `${STATUTE}。\n“終わった？”誰も知らない。`;
    adapter.segment(source).sentences.forEach((sentence) => assert.equal(source.slice(sentence.span.start, sentence.span.end), sentence.text));
  });
});

describe("insideBrackets: 各位置の手前で、同じ行に開いたままの括弧・二重引用符があるか", () => {
  const openAt = (text: string): string =>
    insideBrackets(text)
      .map((open) => (open ? "1" : "0"))
      .join("");

  it("結果の長さは文字列の長さ + 1。先頭は閉じている", () => {
    assert.equal(insideBrackets("").length, 1);
    assert.equal(insideBrackets("")[0], false);
    assert.equal(insideBrackets("𝐀（あ）").length, "𝐀（あ）".length + 1);
  });

  [
    ["丸括弧", "あ（い）う", "001100"],
    ["入れ子", "（（）。）", "011110"],
    ["鍵括弧と丸括弧", "「（。」）", "011110"],
    ["曲がった二重引用符", "“あ”い", "01100"],
    ["山括弧の引用符", "«あ»", "0110"],
    ["半角の括弧", "(a)", "0110"],
  ].forEach(([label, text, expected]) => {
    it(`valid: ${String(label)}`, () => assert.equal(openAt(String(text)), expected));
  });

  [
    ["対の無い閉じ括弧は数えない", "1）あ（い）", "0000110"],
    ["閉じない開き括弧は数えない", "））（あ", "00000"],
    ["同上の印の「“」は閉じないので数えない", "“ 同上。", "000000"],
    ["行をまたいで組にしない", "（あ\nい）", "000000"],
    ["\\r でも行が変わる", "（あ\r\nい）", "0000000"],
    ["一重引用符はアポストロフィと見分けられないので数えない", "‘don’t’", "00000000"],
    ["直線の引用符は分割器が組として数えるので数えない", '"あ"', "0000"],
  ].forEach(([label, text, expected]) => {
    it(`abnormal: ${String(label)}`, () => assert.equal(openAt(String(text)), expected));
  });
});

describe("startsWithCloser: 閉じ括弧・閉じの二重引用符で始まるか", () => {
  [
    ["丸括弧", "）が漏えいした場合", true],
    ["鍵括弧", "」と言った。", true],
    ["二重引用符", "”誰も知らない。", true],
    ["前の空白は飛ばす", " ）", true],
    ["開き括弧", "（注）", false],
    ["直線の引用符は開きと閉じが同じ字なので見ない", '"#"を含む', false],
    ["一重引用符はアポストロフィと見分けられないので見ない", "’90年代", false],
    ["字", "次に進む。", false],
    ["空", "", false],
    ["空白だけ", "  ", false],
  ].forEach(([label, text, expected]) => {
    it(String(label), () => assert.equal(startsWithCloser(String(text)), expected));
  });
});
