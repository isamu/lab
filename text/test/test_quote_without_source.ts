import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { firedRules, namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { unsourcedQuotes, type QuoteParagraph } from "../packages/chaff/src/detectors/quote-without-source.ts";

// 人の言葉として引いた文に出典がない（quote-without-source）。例文はすべて自作。

const RULE = "quote-without-source";
const findingsOf = (source: string, adapter = ja, genre = "blog/tech"): readonly string[] => namedRuleRun(RULE, source, adapter, "a.md", genre).findings;

/** One paragraph of one sentence, starting at 0. */
const paragraph = (text: string): QuoteParagraph => ({ source: text, sentences: [{ start: 0, text }] });

describe("quote-without-source: 人の言葉として引いた文に出典がない", () => {
  it("誰かに帰した引用で、段落に出典が無いものを指す", () => {
    assert.deepEqual(findingsOf("ある研究者は「遅れているプロジェクトに人を足すと、さらに遅れる」と述べている。\n"), [
      "「遅れているプロジェクトに人を足すと、さらに遅れる」を人の言葉として引いていますが、出典（リンク、脚注、書誌）がありません",
    ]);
    assert.equal(findingsOf('As one engineer put it, "adding people to a late project only makes it later."\n', en).length, 1);
    assert.equal(findingsOf("先輩によれば「設計は会話の形をそのまま写したものになる」らしい。\n").length, 1);
    ["と語りました", "と語られた", "と説きました"].forEach((cue) =>
      assert.equal(findingsOf(`ある研究者は「遅れているプロジェクトに人を足すと、さらに遅れる」${cue}。\n`).length, 1, cue),
    );
  });

  it("同じ段落にリンク、URL、脚注、番号の引用、括弧の中の年があれば出典がある", () => {
    const quote = "ある研究者は「遅れているプロジェクトに人を足すと、さらに遅れる」と述べている";
    assert.deepEqual(findingsOf(`${quote}（[出典](https://example.com/a)）。\n`), []);
    assert.deepEqual(findingsOf(`${quote}。https://example.com/a\n`), []);
    assert.deepEqual(findingsOf(`${quote}[^1]。\n\n[^1]: 架空の本、1975年。\n`), []);
    assert.deepEqual(findingsOf(`${quote}[3]。\n`), []);
    assert.deepEqual(findingsOf(`${quote}（1975）。\n`), []);
    assert.deepEqual(findingsOf(`${quote}（架空の本、1975年）。\n`), []);
  });

  it("誰にも帰していない引用、短い鉤括弧、引用の中の言い回しは見ない", () => {
    assert.deepEqual(findingsOf("画面の「保存」を押すと言っていた。\n"), []);
    assert.deepEqual(findingsOf("見出しは「遅れているプロジェクトに人を足す前に」とした。\n"), []);
    assert.deepEqual(findingsOf("見出しは「遅れているプロジェクトに人を足す前に」と言い換えた。\n"), []);
    assert.deepEqual(findingsOf("「彼はそう述べていたが、本当かは分からない」と書いたメモがある。\n").length, 1);
    assert.deepEqual(findingsOf("メモの題は「彼はそう述べていたが、本当かは分からない」だ。\n"), []);
  });

  it("言い方の勧め（「…」と述べる方が適切です）は人の言葉として引いていない", () => {
    assert.deepEqual(findingsOf("この場合であれば、「便利なメソッドを紹介します」と述べる方が適切です。\n"), []);
    assert.deepEqual(findingsOf("見出しには「設定の手順をひとつずつ説明します」と書くべきです。\n"), []);
    assert.equal(findingsOf("ある研究者は「便利なメソッドを紹介する記事は役に立つ」と述べている。\n").length, 1);
    assert.equal(findingsOf("ある研究者は「便利なメソッドを紹介する記事は役に立つ」と述べ、方針を変えた。\n").length, 1);
    assert.equal(findingsOf("山田氏は講演では「道具はあくまで人が使うものにすぎない」と述べる方が多い。\n").length, 1);
    assert.equal(findingsOf("山田氏によれば「道具はあくまで人が使うものにすぎない」と言う方が適切だという。\n").length, 1);
  });

  it("記事と論文では既定で動き、組織の記事、報告、仕様、手順書、契約、小説、話し言葉のジャンルでは止まっている", () => {
    const quote = "ある研究者は「遅れているプロジェクトに人を足すと、さらに遅れる」と述べている。\n";
    ["blog/tech", "blog/essay", "academic/paper"].forEach((genre) => assert.ok(firedRules(ja, quote, genre).includes(RULE), genre));
    ["blog/owned-media", "business/report", "technical/spec", "docs/manual", "legal/contract", "literature/fiction", "speech/transcript"].forEach((genre) =>
      assert.ok(!firedRules(ja, quote, genre).includes(RULE), genre),
    );
  });
});

describe("unsourcedQuotes", () => {
  const cues = [{ pattern: "と述べ", position: "after" as const }, { pattern: "によれば", position: "before" as const }, { pattern: "said" }];

  it("勧めの続きが閉じ括弧のすぐ後ろにあれば、言い回しに当たっても引用ではない", () => {
    const advice = [
      { pattern: "と述べる", group: "say" },
      { pattern: "方が", group: "advice" },
    ];
    assert.deepEqual(unsourcedQuotes([paragraph("「遅れているプロジェクトは遅れる」と述べる方が良い。")], cues, advice), []);
    assert.equal(unsourcedQuotes([paragraph("「遅れているプロジェクトは遅れる」と述べた。")], cues, advice).length, 1);
    assert.equal(unsourcedQuotes([paragraph("「遅れているプロジェクトは遅れる」と述べる人が多い。")], cues, advice).length, 1);
    assert.equal(unsourcedQuotes([paragraph("「遅れているプロジェクトは遅れる」と述べる方が良い。")], cues, [{ pattern: "", group: "say" }]).length, 1);
  });

  it("位置は文書の中の位置で、引用の中身を返す", () => {
    const text = "彼は「遅れているプロジェクトは遅れる」と述べた。";
    assert.deepEqual(unsourcedQuotes([{ source: text, sentences: [{ start: 40, text }] }], cues), [{ offset: 43, quote: "遅れているプロジェクトは遅れる" }]);
  });

  it("言い回しは引用のすぐ後ろか、少し前にあるときだけ引用を人に帰する", () => {
    assert.equal(unsourcedQuotes([paragraph("彼は「遅れているプロジェクトは遅れる」と述べた。")], cues).length, 1);
    assert.deepEqual(unsourcedQuotes([paragraph("「遅れているプロジェクトは遅れる」を見出しにして、長い説明を足したと述べた。")], cues), []);
    // 引用の後ろに立つ言い回しは、引用の前にあっても帰さない（「バレる」と述べたが、「このlintが検出する」の意味だ）。
    assert.deepEqual(unsourcedQuotes([paragraph("「短い」と述べたが、正確には「この道具が見つけるもの」の意味だ。")], cues), []);
    assert.equal(unsourcedQuotes([paragraph("先輩によれば「遅れているプロジェクトは遅れる」らしい。")], cues).length, 1);
    // 後ろの言い回しは、閉じ括弧のすぐ後ろだけ。「…」などと書く、は書き方の例。
    assert.deepEqual(unsourcedQuotes([paragraph("「遅れているプロジェクトは遅れる」などと述べると伝わる。")], cues), []);
    assert.deepEqual(unsourcedQuotes([paragraph("「遅れているプロジェクトは遅れる」先輩によれば。")], cues), []);
    assert.equal(unsourcedQuotes([paragraph('As the report said, "the late project gets later still."')], cues).length, 1);
    const far = `He said it once. ${"x".repeat(60)} "the late project gets later still."`;
    assert.deepEqual(unsourcedQuotes([paragraph(far)], cues), []);
  });

  it("括弧の中の年は、引用の年の形のときだけ出典と見る（(Brooks 1975) は出典、(port 2000) は違う）", () => {
    const said = 'He said, "the late project gets later still."';
    assert.deepEqual(unsourcedQuotes([paragraph(`${said} (Brooks 1975)`)], cues), []);
    assert.deepEqual(unsourcedQuotes([paragraph(`${said} (1975a)`)], cues), []);
    assert.equal(unsourcedQuotes([paragraph(`${said} (port 2000)`)], cues).length, 1);
    assert.equal(unsourcedQuotes([paragraph(`${said} (version 2000)`)], cues).length, 1);
  });

  it("大文字小文字を問わず、位置は文のままで数える（İ は小文字にすると二字になる）", () => {
    assert.equal(unsourcedQuotes([paragraph('"İaaaaaaaaa," SAID Brooks.')], cues).length, 1);
  });

  it("英語の言い回しは、長い語の一部では当てない", () => {
    assert.equal(unsourcedQuotes([paragraph('He said, "the late project gets later still."')], cues).length, 1);
    assert.deepEqual(unsourcedQuotes([paragraph('The unsaid "the late project gets later still."')], cues), []);
  });

  it("空の段落、空の語の一覧、引用の無い文は何も返さない", () => {
    assert.deepEqual(unsourcedQuotes([], cues), []);
    assert.deepEqual(unsourcedQuotes([paragraph("彼は「遅れているプロジェクトは遅れる」と述べた。")], []), []);
    assert.deepEqual(unsourcedQuotes([paragraph("彼はそう述べた。")], cues), []);
    assert.deepEqual(unsourcedQuotes([paragraph("")], cues), []);
  });
});
