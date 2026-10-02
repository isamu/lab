import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { bracketDepth, clauseCount, topicDistance } from "../packages/chaff/src/sentence-load.ts";

// 一文の負荷（bracket-nesting、clause-chain、topic-predicate-distance）。例文はすべて自作。

before(async () => {
  await ja.prepare?.({ pos: true });
  await en.prepare?.({ pos: true });
});

const findingsOf = (rule: string, source: string, adapter = ja): readonly string[] => namedRuleRun(rule, source, adapter).findings;

const tokensOf = (text: string) => ja.segment(text).sentences[0]?.tokens ?? [];

describe("bracketDepth: 括弧の重なり", () => {
  it("重なった深さを数える", () => {
    assert.equal(bracketDepth("費用は本部が負担します。"), 0);
    assert.equal(bracketDepth("計画（案）を出す。"), 1);
    assert.equal(bracketDepth("（注（a）を参照）"), 2);
    assert.equal(bracketDepth("（ただし、出張費（交通費（特急料金を除く）を含む）は各部）"), 3);
    assert.equal(bracketDepth("「彼は『はい（たぶん）』と言った」"), 3);
  });

  it("並んだ括弧は重ならない。いちばん深い所を覚えておく", () => {
    assert.equal(bracketDepth("（a）と（b）と（c）"), 1);
    assert.equal(bracketDepth("（注（a（b）））と（c）"), 3);
  });

  it("いちばん内側の括弧を閉じない閉じ括弧は、紛れこんだ字として読む", () => {
    assert.equal(bracketDepth("（a「b）（c）」"), 3);
  });

  it("開きの無い閉じ括弧、閉じない開き括弧、数式、波括弧", () => {
    assert.equal(bracketDepth("1) 準備 2) 実行"), 0);
    assert.equal(bracketDepth("（閉じない（まま"), 2);
    assert.equal(bracketDepth("式は $f(g(h(x)))$ です。"), 0);
    assert.equal(bracketDepth("設定は {a: {b: {c: 1}}} です。"), 0);
  });
});

describe("clauseCount: 節のつながり", () => {
  it("接続助詞と、読点で止めた動詞を数える", () => {
    assert.equal(clauseCount(tokensOf("報告した。")), 1);
    assert.equal(clauseCount(tokensOf("資料を調べて、内容をまとめ、課長に報告したが、返事がないので、もう一度送った。")), 5);
  });

  it("文の終わりの助詞（返信して。）は次の節をつないでいない", () => {
    assert.equal(clauseCount(tokensOf("内容を整理して、返信して。")), 2);
  });

  it("補助動詞へのつなぎは一つの述語", () => {
    assert.equal(clauseCount(tokensOf("資料を調べている。")), 1);
    assert.equal(clauseCount(tokensOf("課長に読んでもらった。")), 1);
  });
});

describe("topicDistance: 主題から述語まで", () => {
  it("文の最初の「名詞＋は」から終わりまでの字数", () => {
    assert.equal(topicDistance(tokensOf("会議は延期します。")), 3);
    assert.equal(topicDistance(tokensOf("報告します。")), undefined);
    assert.equal(topicDistance(tokensOf("延期ではなく中止にします。")), undefined);
  });

  it("空白は数えない", () => {
    assert.equal(topicDistance(tokensOf("会議は 明日に 延期します。")), topicDistance(tokensOf("会議は明日に延期します。")));
  });
});

describe("bracket-nesting", () => {
  it("三重の括弧を指し、二重までは指さない", () => {
    assert.deepEqual(findingsOf("bracket-nesting", "費用は本部が負担します（ただし、出張費（交通費（特急料金を除く）を含む）は各部の負担）。\n"), [
      "括弧が 3 重になっています（2 重まで）",
    ]);
    assert.deepEqual(findingsOf("bracket-nesting", "費用は本部が負担します（ただし、出張費（交通費を含む）は各部の負担）。\n"), []);
  });

  it("英語の文書でも数える", () => {
    assert.deepEqual(findingsOf("bracket-nesting", "The fee is waived (for members (including students (under 25))).\n", en), [
      "Brackets nested 3 deep (limit 2)",
    ]);
  });
});

describe("clause-chain", () => {
  it("六つの節を指し、五つまでは指さない", () => {
    assert.deepEqual(
      findingsOf(
        "clause-chain",
        "資料を調べて、内容をまとめ、課長に報告したが、返事がないので、もう一度送ってみたところ、翌日に返事が来て、修正を頼まれた。\n",
      ),
      ["一文に節が 6 つつながっています（5 つまで）"],
    );
    assert.deepEqual(findingsOf("clause-chain", "資料を調べて、内容をまとめ、課長に報告したが、返事がないので、もう一度送った。\n"), []);
  });

  it("鉤括弧で引いたものの中は数えない", () => {
    assert.deepEqual(findingsOf("clause-chain", "彼は「調べて、まとめ、報告したが、返事がないので、送り直して、待った」と書いた。\n"), []);
  });
});

describe("topic-predicate-distance", () => {
  it("主題から述語まで遠い文を指し、近い文は指さない", () => {
    const far =
      "来週の定例会議は、新しい担当者の紹介と、先月から続いている予算の見直しと、春に予定している本社の移転の準備と、秋の採用計画の確認と、年末の懇親会の段取りについて話し合う必要があるため、二時間に延長します。\n";
    assert.deepEqual(findingsOf("topic-predicate-distance", far), ["「は」で出した主題から述語まで 91 字あります（80 字まで）"]);
    assert.deepEqual(findingsOf("topic-predicate-distance", "そのため定例会議は二時間に延長します。\n"), []);
  });

  it("主題の無い文は見ない", () => {
    assert.deepEqual(
      findingsOf(
        "topic-predicate-distance",
        "新しい担当者の紹介と、先月から続いている予算の見直しと、春に予定している移転の準備について話し合う必要があるため、二時間に延長します。\n",
      ),
      [],
    );
  });
});
