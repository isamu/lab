import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { withCutNounsJoined } from "../packages/chaff/src/split-noun.ts";
import type { Sentence, Token } from "../packages/chaff/src/plugin.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { namedRuleRun } from "./rule-run.ts";

// 形態素解析が二つに切った名詞（申 と 込み）を、文書がほかで書く名詞を手がかりに一語に戻す（split-noun.ts）。例文はすべて自作。

const sentenceOf = (pieces: readonly (readonly [string, string, Partial<Token>?])[]): Sentence => {
  const tokens = pieces.reduce<Token[]>((all, [surface, pos, extra]) => {
    const start = all.at(-1)?.span.end ?? 0;
    return [...all, { span: { start, end: start + surface.length }, surface, pos, ...extra }];
  }, []);
  return { span: { start: 0, end: tokens.at(-1)?.span.end ?? 0 }, text: tokens.map((token) => token.surface).join(""), tokens };
};

const BOUND = { features: { Bound: "Yes" } };
const cut = sentenceOf([
  ["申", "NOUN", { reading: "サル" }],
  ["込み", "NOUN", { reading: "コミ", ...BOUND }],
  ["は", "ADP"],
]);
const surfacesOf = (sentence: Sentence): string[] => (sentence.tokens ?? []).map((token) => token.surface);

describe("withCutNounsJoined", () => {
  it("文書がほかで 申込（モウシコミ）を名詞として書けば、申 と 込み を一語の名詞 申込み として読む", () => {
    const joined = withCutNounsJoined(cut, new Set(["申込|モウシコミ"]));
    assert.deepEqual(surfacesOf(joined), ["申込み", "は"]);
    assert.deepEqual(joined.tokens?.[0], { span: { start: 0, end: 3 }, surface: "申込み", pos: "NOUN", lemma: "申込み", reading: "モウシコミ" });
  });

  it("その名詞が無いとき、読みが二つあるとき、名詞の一覧が空のときは切ったまま", () => {
    [new Set(["受付|ウケツケ"]), new Set(["申込|モウシコミ", "申込|サルコミ"]), new Set<string>()].forEach((nouns) =>
      assert.equal(withCutNounsJoined(cut, nouns), cut),
    );
  });

  it("後ろが拘束でない名詞、かなだけの語、漢字だけの語、離れた語、前が名詞でない語は戻さない", () => {
    const nouns = new Set(["申込|モウシコミ", "日付|ヒヅケ"]);
    const notCut = [
      sentenceOf([
        ["申", "NOUN"],
        ["込み", "NOUN"],
      ]),
      sentenceOf([
        ["申", "NOUN"],
        ["こみ", "NOUN", BOUND],
      ]),
      sentenceOf([
        ["申", "NOUN"],
        ["込", "NOUN", BOUND],
      ]),
      sentenceOf([
        ["申", "VERB"],
        ["込み", "NOUN", BOUND],
      ]),
      sentenceOf([
        ["もう", "NOUN"],
        ["込み", "NOUN", BOUND],
      ]),
      {
        span: { start: 0, end: 4 },
        text: "申 込み",
        tokens: [
          { span: { start: 0, end: 1 }, surface: "申", pos: "NOUN" },
          { span: { start: 2, end: 4 }, surface: "込み", pos: "NOUN", ...BOUND },
        ],
      },
      sentenceOf([["申込み", "NOUN"]]),
      { span: { start: 0, end: 0 }, text: "" },
    ];
    notCut.forEach((sentence) => assert.deepEqual(surfacesOf(withCutNounsJoined(sentence, nouns)), surfacesOf(sentence)));
  });
});

describe("withCutNounsJoined: て で切れた名詞", () => {
  const te = (head: string, reading: string, pos = "ADP"): Sentence =>
    sentenceOf([
      [head, "NOUN", { reading }],
      ["て", pos, { reading: "テ" }],
      ["又は", "CCONJ"],
    ]);

  it("読みが テ で終わる漢字の名詞と て（申立 と て）は一語の 申立て。読みは名詞のもの", () => {
    [te("申立", "モウシタテ"), te("申立", "モウシタテ", "SCONJ")].forEach((sentence) => {
      const joined = withCutNounsJoined(sentence, new Set());
      assert.deepEqual(surfacesOf(joined), ["申立て", "又は"]);
      assert.equal(joined.tokens?.[0]?.reading, "モウシタテ");
    });
  });

  it("読みが テ で終わらない名詞、て でない仮名（長野 の）、助詞でない て は戻さない", () => {
    assert.deepEqual(surfacesOf(withCutNounsJoined(te("漢字", "カンジ"), new Set())), ["漢字", "て", "又は"]);
    assert.deepEqual(surfacesOf(withCutNounsJoined(te("申立", "モウシタテ", "VERB"), new Set())), ["申立", "て", "又は"]);
    const nagano = sentenceOf([
      ["長野", "NOUN", { reading: "ナガノ" }],
      ["の", "ADP", { reading: "ノ" }],
    ]);
    assert.equal(withCutNounsJoined(nagano, new Set(["長野|ナガノ"])), nagano);
  });
});

describe("orthographic-variant: 文頭と の の前で切れた 申込み", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  const findingsOf = (source: string): readonly string[] => namedRuleRun("orthographic-variant", source, ja).findings;

  it("文頭の 申込み と、ほかの 申し込み を比べる", () => {
    assert.deepEqual(findingsOf("会場で申し込みを受け付ける。期限までに申し込みをする。申込みは窓口でもできる。\n"), [
      "「申込み」と書いています（この文書はふつう「申し込み」と書く語です。3 箇所のうち 1 箇所が違う）",
    ]);
  });

  it("申立て の て が切れた所と、名詞の 申立て を比べない（同じ書き方）", () => {
    assert.deepEqual(findingsOf("申立ての期間は三月とする。申立て又は審査の開始は更新とみなす。申立てがあったときは通知する。\n"), []);
  });

  it("どこでも 申込み と書く文書、ほかに名詞の無い文書は何も言わない", () => {
    assert.deepEqual(findingsOf("会場で申込みを受け付ける。期限までに申込みをする。申込みは窓口でもできる。\n"), []);
    assert.deepEqual(findingsOf("申込みは窓口でもできる。会場で申し込む。\n"), []);
  });
});
