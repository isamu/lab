import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { openerRuns, separatesItems } from "../packages/chaff/src/detectors/sentence-counts.ts";

// 一文の中の数と、文頭の連続を数える rule（max-ten, teki-overuse, adversative-ga-repeat, demonstrative-opener-run）。例文はすべて自作。

before(async () => {
  await ja.prepare?.({ pos: true });
});

const findingsOf = (rule: string, source: string, level: "strict" | "normal" = "normal"): readonly string[] =>
  namedRuleRun(rule, source, ja, "a.md", "business/report", level).findings;

describe("max-ten: 一文の読点", () => {
  const RULE = "max-ten";

  it("七つで指し、六つまでは指さない", () => {
    assert.deepEqual(findingsOf(RULE, "担当者が、会議室で、新人に、資料を、配布し、内容を、丁寧に、説明しました。\n"), [
      "一文に読点が 7 個あります（6 個まで）",
    ]);
    assert.deepEqual(findingsOf(RULE, "担当者が、会議室で、新人に、資料を、配布し、内容を、説明しました。\n"), []);
  });

  it("全角のカンマも数え、鉤括弧の中は数えない", () => {
    assert.deepEqual(findingsOf(RULE, "担当者が，会議室で，新人に，資料を，配布し，内容を，丁寧に，説明しました。\n"), [
      "一文に読点が 7 個あります（6 個まで）",
    ]);
    assert.deepEqual(findingsOf(RULE, "担当者は「会議室で、新人に、資料を、配布し、内容を、丁寧に、説明し、帰ります」と言った。\n"), []);
  });

  it("名詞を並べただけの読点は数えない", () => {
    const listed = "入力できる項目は、名前、会社名、訪問先、人数、到着の時刻、帰りの予定、連絡先です。\n";
    assert.deepEqual(findingsOf(RULE, listed, "strict"), []);
    const noted = "入力項目は、名前（必須）、会社名（任意）、訪問先（任意）、人数（予定）、時刻（予定）、部署（任意）、連絡先（必須）です。\n";
    assert.deepEqual(findingsOf(RULE, noted, "strict"), []);
  });

  it("和文の中の英文の読点は、英語の語（名詞と読む）のあいだなので数えない", () => {
    assert.deepEqual(findingsOf(RULE, "次の項目を確認します。Alpha， beta， gamma， delta， epsilon， zeta， eta， theta.\n", "strict"), []);
  });

  it("文ごとに数え直す", () => {
    assert.deepEqual(findingsOf(RULE, "本日、会議室で、担当者が説明しました。続けて、資料を、配布しました。\n"), []);
  });
});

describe("separatesItems: 名詞と名詞のあいだの読点", () => {
  const commaKinds = (text: string): boolean[] => {
    const tokens = buildDocument("a.md", text, ja).sentences[0]?.tokens ?? [];
    return tokens.flatMap((token, at) => (token.surface === "、" ? [separatesItems(at, tokens)] : []));
  };

  it("並べた名詞のあいだなら項目の区切り、助詞や動詞の後なら節の区切り", () => {
    assert.deepEqual(commaKinds("名前、会社名、連絡先を書く。"), [true, true]);
    assert.deepEqual(commaKinds("担当者が、資料を配布し、説明した。"), [false, false]);
    assert.deepEqual(commaKinds("名前（必須）、会社名を書く。"), [true]);
    assert.deepEqual(commaKinds("名前 、会社名を書く。"), [true]);
    assert.deepEqual(commaKinds("担当者が（本日）、説明した。"), [false]);
  });
});

describe("teki-overuse: 一文の「〜的」", () => {
  const RULE = "teki-overuse";

  it("三つで指し、二つまでは指さない", () => {
    assert.deepEqual(findingsOf(RULE, "効果的かつ効率的な施策を、積極的に展開します。\n"), ["一文に「〜的」が 3 個あります（2 個まで）"]);
    assert.deepEqual(findingsOf(RULE, "効果的かつ効率的な施策を展開します。\n"), []);
  });

  it("一語になった「目的」「的確」は数えない", () => {
    assert.deepEqual(findingsOf(RULE, "目的を的確に伝え、具体的な標的を決めます。\n", "strict"), []);
  });
});

describe("adversative-ga-repeat: 一文の逆接の「が」", () => {
  const RULE = "adversative-ga-repeat";

  it("二度で指す", () => {
    assert.deepEqual(findingsOf(RULE, "予算は足りるが、人手が足りないが、納期は守ります。\n"), ["一文に逆接の「が」が 2 個あります（1 個まで）"]);
  });

  it("格助詞の「が」は数えない", () => {
    assert.deepEqual(findingsOf(RULE, "私が、会社が、担当者が決めたが、結果は同じだった。\n"), []);
  });

  it("文が分かれていれば数えない", () => {
    assert.deepEqual(findingsOf(RULE, "予算は足りるが、人手は足りない。人手は足りないが、納期は守る。\n"), []);
  });
});

describe("openerRuns: 同じ段落で、語彙の語で始まる文の連続", () => {
  const lengths = (source: string): number[] => {
    const doc = buildDocument("a.md", source, ja);
    const lexicon = doc.lexicons["demonstrative-opener"] ?? [];
    return doc.paragraphs.flatMap((paragraph) => openerRuns(paragraph.sentences, lexicon).map((run) => run.length));
  };

  it("続いた長さを返し、指示語でない文で切れる", () => {
    assert.deepEqual(lengths("これは一つ目です。それは二つ目です。今日は晴れ。その店は閉まった。\n"), [2, 1]);
  });

  it("段落が変われば切れる", () => {
    assert.deepEqual(lengths("これは一つ目です。それは二つ目です。\n\nその店は閉まった。\n"), [2, 1]);
  });

  it("指示語で始まる文が無ければ空", () => {
    assert.deepEqual(lengths("今日は晴れ。明日は雨。\n"), []);
  });
});

describe("demonstrative-opener-run", () => {
  const RULE = "demonstrative-opener-run";

  it("三文続けば指し、二文までは指さない", () => {
    const three = "新しい手順を導入しました。これは作業を減らすためです。その結果、残業が減りました。この効果は来月も続く見込みです。\n";
    assert.deepEqual(findingsOf(RULE, three), ["「これ」など、指示語で始まる文が 3 文続いています（2 文まで）"]);
    assert.deepEqual(findingsOf(RULE, "新しい手順を導入しました。これは作業を減らすためです。その結果、残業が減りました。\n"), []);
  });

  it("「それぞれ」と接続詞の「そして」は数えない", () => {
    assert.deepEqual(findingsOf(RULE, "それぞれの班が集まった。そして話し合った。それぞれが意見を出した。\n", "strict"), []);
  });
});
