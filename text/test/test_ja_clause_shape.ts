import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { endingOf, endingRuns } from "../packages/chaff/src/detectors/clause-shape.ts";

// 文の形を語から読む rule（repeated-sentence-ending, tari-unpaired, adverb-without-negation, yori-as-from,
// colloquial-opener）。例文はすべて自作。

before(async () => {
  await ja.prepare?.({ pos: true });
});

const findingsOf = (rule: string, source: string, level: "strict" | "normal" = "normal", genre = "business/report"): readonly string[] =>
  namedRuleRun(rule, source, ja, "a.md", genre, level).findings;

describe("endingOf: 文末の形", () => {
  const endings = (text: string): (string | undefined)[] => buildDocument("a.md", text, ja).sentences.map(endingOf);

  it("名詞の後は助動詞だけ、動詞はその形ごと", () => {
    assert.deepEqual(endings("必要です。重要です。確認しました。設定しました。と思います。"), ["です", "です", "しました", "しました", "思います"]);
  });

  it("助動詞で終わらない文は比べない", () => {
    assert.deepEqual(endings("手順の確認。資料を読む。"), [undefined, undefined]);
  });

  it("閉じ括弧と句点の前で見る", () => {
    assert.deepEqual(endings("「必要です。」"), ["です"]);
  });
});

describe("repeated-sentence-ending", () => {
  const RULE = "repeated-sentence-ending";

  it("同じ文末が三文続けば指し、二文なら指さない", () => {
    assert.deepEqual(findingsOf(RULE, "この機能は必要です。設定も簡単です。費用も無料です。\n"), ["「〜です」で終わる文が 3 文続いています（2 文まで）"]);
    assert.deepEqual(findingsOf(RULE, "この機能は必要です。設定も簡単です。\n"), []);
  });

  it("動詞が違えば別の文末", () => {
    assert.deepEqual(findingsOf(RULE, "資料を読みました。手順を書きました。結果を送りました。\n"), []);
    assert.deepEqual(findingsOf(RULE, "資料を確認しました。手順を修正しました。結果を報告しました。\n"), [
      "「〜しました」で終わる文が 3 文続いています（2 文まで）",
    ]);
  });

  it("間に違う文末が入れば続きが切れ、段落をまたいでも続かない", () => {
    assert.deepEqual(findingsOf(RULE, "この機能は必要です。設定も簡単です。費用はかかりません。保守も楽です。\n"), []);
    assert.deepEqual(findingsOf(RULE, "この機能は必要です。設定も簡単です。\n\n費用も無料です。\n"), []);
  });

  it("体言止めは比べず、続きを切る", () => {
    assert.deepEqual(findingsOf(RULE, "この機能は必要です。設定も簡単です。手順の確認。費用も無料です。\n"), []);
  });
});

describe("endingRuns", () => {
  it("比べられない文は一文の続きを作らない", () => {
    const sentences = buildDocument("a.md", "手順の確認。資料の確認。必要です。\n", ja).sentences;
    assert.deepEqual(
      endingRuns(sentences).map((run) => run.length),
      [1],
    );
  });
});

describe("tari-unpaired", () => {
  const RULE = "tari-unpaired";

  it("一つの「たり」の後に読点か別の述語が来れば指す", () => {
    assert.deepEqual(findingsOf(RULE, "休日は本を読んだり、映画を見ます。\n"), ["「だり」が一つだけで、対になる「〜たり」がありません"]);
    assert.deepEqual(findingsOf(RULE, "会議では資料を配ったり説明しました。\n"), ["「たり」が一つだけで、対になる「〜たり」がありません"]);
  });

  it("対になっていれば、また「する」で閉じれば指さない", () => {
    assert.deepEqual(findingsOf(RULE, "休日は本を読んだり、映画を見たりします。\n"), []);
    assert.deepEqual(findingsOf(RULE, "電車が遅れたりする。\n"), []);
    assert.deepEqual(findingsOf(RULE, "電車が遅れたりもします。\n"), []);
  });

  it("並べない「たり」と、鉤括弧の中は見ない", () => {
    assert.deepEqual(findingsOf(RULE, "一日たりとも休みません。\n"), []);
    assert.deepEqual(findingsOf(RULE, "彼は「本を読んだり、映画を見る」と書いた。\n"), []);
  });
});

describe("adverb-without-negation", () => {
  const RULE = "adverb-without-negation";

  it("打ち消しの無い「全然」を指す", () => {
    assert.deepEqual(findingsOf(RULE, "納期は全然大丈夫です。\n"), ["「全然」の後に打ち消しがありません"]);
    assert.deepEqual(findingsOf(RULE, "この手順は決して難しいです。\n"), ["「決して」の後に打ち消しがありません"]);
  });

  it("打ち消しの語か、打ち消しの頭を持つ語があれば指さない", () => {
    assert.deepEqual(findingsOf(RULE, "予算が全然足りない。\n"), []);
    assert.deepEqual(findingsOf(RULE, "全然問題ありません。\n"), []);
    assert.deepEqual(findingsOf(RULE, "結果は全然違います。\n"), []);
    assert.deepEqual(findingsOf(RULE, "説明が全然不十分だ。\n"), []);
    assert.deepEqual(findingsOf(RULE, "到底無理だ。\n"), []);
  });

  it("副詞ごとに見て、鉤括弧の中の打ち消しは数えない", () => {
    assert.deepEqual(findingsOf(RULE, "全然問題ありませんが、決して簡単です。\n"), ["「決して」の後に打ち消しがありません"]);
    assert.deepEqual(findingsOf(RULE, "決して簡単ですが、全然問題ありません。\n"), []);
    assert.deepEqual(findingsOf(RULE, "全然「問題ありません」と言いました。\n"), ["「全然」の後に打ち消しがありません"]);
  });

  it("鉤括弧の中と、ブログでは見ない", () => {
    assert.deepEqual(findingsOf(RULE, "彼は「全然大丈夫です」と言った。\n"), []);
    assert.deepEqual(findingsOf(RULE, "納期は全然大丈夫です。\n", "normal", "blog/tech"), []);
  });
});

describe("yori-as-from", () => {
  const RULE = "yori-as-from";

  it("起点の「より」を指す", () => {
    assert.deepEqual(findingsOf(RULE, "新しい窓口は4月1日より受付を開始します。\n"), ["起点の「より」は「から」と書けます"]);
    assert.deepEqual(findingsOf(RULE, "詳細は担当者よりご連絡いたします。\n"), ["起点の「より」は「から」と書けます"]);
    assert.deepEqual(findingsOf(RULE, "本日より順次発送します。\n"), ["起点の「より」は「から」と書けます"]);
    assert.deepEqual(findingsOf(RULE, "東京より参りました。\n"), ["起点の「より」は「から」と書けます"]);
    assert.deepEqual(findingsOf(RULE, "本日より、順次発送します。\n"), ["起点の「より」は「から」と書けます"]);
  });

  it("比べる「より」と「により」は指さない", () => {
    assert.deepEqual(findingsOf(RULE, "これより大きい。\n"), []);
    assert.deepEqual(findingsOf(RULE, "昨年より増えた。\n"), []);
    assert.deepEqual(findingsOf(RULE, "昨年より販売が増えた。\n"), []);
    assert.deepEqual(findingsOf(RULE, "法令により定める。\n"), []);
  });

  it("比べられている名詞は動作として読まない", () => {
    assert.deepEqual(findingsOf(RULE, "昨年より案内の数が多い。\n"), []);
  });
});

describe("colloquial-opener", () => {
  const RULE = "colloquial-opener";

  it("話し言葉の接続詞で始まる文を指す", () => {
    assert.deepEqual(findingsOf(RULE, "在庫が足りません。なので、出荷は来週になります。\n"), ["「なので」で始まる文が 1 個あります（1 個から）"]);
    assert.deepEqual(findingsOf(RULE, "費用は増えます。でも、作業は半分になります。\n"), ["「でも」で始まる文が 1 個あります（1 個から）"]);
  });

  it("文の途中と書き言葉の接続詞、ブログは指さない", () => {
    assert.deepEqual(findingsOf(RULE, "在庫が足りないので、出荷は来週になります。\n"), []);
    assert.deepEqual(findingsOf(RULE, "在庫が足りません。そのため、出荷は来週になります。\n"), []);
    assert.deepEqual(findingsOf(RULE, "在庫が足りません。なので、出荷は来週です。\n", "normal", "blog/tech"), []);
  });
});
