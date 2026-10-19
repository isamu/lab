import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { voiceAt, voiceStarts } from "../packages/chaff/src/voice-parts.ts";

// orthographic-variant: 読みが同じでも別の語を、一つの語の書き方のゆれと見ない。例文は自作と、著作権の切れた夏目漱石「私の個人主義」、
// 最高裁判所の判決の書き方を写した自作の文。

const findingsOf = (source: string, genre = "business/report"): readonly string[] => namedRuleRun("orthographic-variant", source, ja, "a.md", genre).findings;

before(async () => {
  await ja.prepare?.({ pos: true });
});

describe("orthographic-variant: 数と語", () => {
  it("漢数字（三十の「三」）を、名前の後の「さん」と比べない", () => {
    assert.deepEqual(findingsOf("# 記録\n\n岡田さんが来た。山田さんが来た。木村さんが来た。学校を出て三十以上まで通り越せなかった。\n"), []);
  });

  it("かなと漢字の同じ語は今までどおり比べる", () => {
    assert.equal(findingsOf("# 記録\n\n窓口で申請できます。郵送でもできます。代理の人も申請出来ます。\n").length, 1);
  });
});

describe("orthographic-variant: 前の語に続けて書いたかなの動詞", () => {
  it("代名詞に続けた「みた」（私みたような）を、動詞の「見る」と比べない", () => {
    assert.deepEqual(findingsOf("# 講演\n\n私みたようなものを呼ぶ。資料を見る。画面を見る。図を見た。\n"), []);
  });

  it("切られた送りがな（誂らえる、引き易える）を、動詞の「得る」と比べない", () => {
    assert.deepEqual(findingsOf("# 講演\n\n洋服を誂らえてしまった。許可を得る。賛同を得る。理解を得た。\n"), []);
    assert.deepEqual(findingsOf("# 講演\n\n弟の引き易えて。許可を得る。賛同を得る。理解を得た。\n"), []);
  });

  it("助詞の後のかなの動詞は今までどおり比べる", () => {
    assert.equal(findingsOf("# 講演\n\n許可をえる。賛同を得る。理解を得た。同意を得た。\n").length, 1);
    assert.equal(findingsOf("# 講演\n\n資料をみる。資料を見る。画面を見る。図を見た。\n").length, 1);
  });

  it("名詞に続けた二字以上のかなの動詞（ご案内いたします）は今までどおり比べる", () => {
    assert.equal(findingsOf("# 案内\n\nご案内致します。ご連絡致します。ご説明致します。ご報告いたします。\n").length, 1);
  });
});

describe("orthographic-variant: 複合動詞の頭", () => {
  it("複合動詞の頭（出来上る）を、それだけの「できる」と比べない", () => {
    assert.deepEqual(findingsOf("# 講演\n\nやがて出来上ってみると驚いた。窓口でできる。郵送でもできる。代理でもできる。\n"), []);
  });

  it("複合動詞の頭どうしは比べる", () => {
    assert.equal(findingsOf("# 講演\n\n家が出来上る。橋が出来上る。塔が出来上った。庭ができ上る。\n").length, 1);
  });
});

describe("orthographic-variant: 文の頭の接続詞", () => {
  it("文の頭の「さらに、」を、文の中の「更に」と比べない", () => {
    assert.deepEqual(findingsOf("# 演説\n\n改革を進めます。さらに、少子化を分析します。協力を更に深めます。検討を更に加速します。環境を更に整えます。\n"), []);
  });

  it("文の頭の「もっとも」（ただし）を、文の中の「最も」と比べない", () => {
    assert.deepEqual(findingsOf("# 講演\n\n――もっとも進んだってどうにもならない。もっともある場合には違う。あなたがたが最も接近しやすいものである。\n"), []);
  });

  it("読点の後の「さらに」は、文の中の副詞として今までどおり比べる", () => {
    assert.equal(findingsOf("# 演説\n\n価格の転嫁、さらには賃上げを進めます。協力を更に深めます。検討を更に加速します。環境を更に整えます。\n").length, 1);
  });

  it("読点の続かない文の頭の「さらに」（さらに高い）は、副詞として今までどおり比べる", () => {
    assert.equal(findingsOf("# 演説\n\nさらに高い成果を目指します。協力を更に深めます。検討を更に加速します。環境を更に整えます。\n").length, 1);
  });

  it("文の頭の接続詞どうしは比べる", () => {
    assert.equal(findingsOf("# 演説\n\nさらに、進めます。さらに、続けます。さらに、広げます。更に、深めます。\n").length, 1);
  });
});

describe("orthographic-variant: 別の語として挙げた書き方", () => {
  it("「要る」と「いる」、「折る」と「おる」を比べない", () => {
    assert.deepEqual(findingsOf("# 講演\n\nここにいる。そこにいる。あそこにいる。お金は要らない。\n"), []);
    assert.deepEqual(findingsOf("# 講演\n\n枝を折る。紙を折る。指を折った。先生がおられる。\n"), []);
  });

  it("「憂目にあう」の「あう」を、「合う」と比べない", () => {
    assert.deepEqual(findingsOf("# 講演\n\n性の合う事。気の合う人。話の合う人。滅亡の憂目にあう。\n"), []);
  });

  it("慣用句どうしのゆれは比べる", () => {
    assert.equal(findingsOf("# 講演\n\nひどい目にあう。つらい目にあう。痛い目にあう。ひどい目に遭う。\n").length, 1);
  });

  it("「ことさらに」を、形式名詞の「事」と比べない", () => {
    assert.deepEqual(findingsOf("# 講演\n\nことさらによそから連れて来た。行く事にした。見る事にした。読む事にした。\n"), []);
  });

  it("品物の「モノ」を、形式名詞の「もの」と比べない", () => {
    assert.deepEqual(findingsOf("# 演説\n\nモノとサービスを売る。もの作りを進める。ものの価値を上げる。ものを大切にする。ものを作る。\n"), []);
  });

  it("種類の名前のカタカナ（ネギ）とかなは今までどおり比べる", () => {
    assert.equal(findingsOf("# レシピ\n\nねぎを切る。ねぎを炒める。ねぎを盛る。ネギを添える。\n").length, 1);
  });
});

const judgment = [
  "# 判決",
  "",
  "棄却する、又は差し戻す。棄却する、又は破棄する。棄却する、又は変更する。棄却する、又は取り消す。",
  "",
  "裁判官甲の反対意見は次のとおりである。",
  "",
  "破棄する、または差し戻す。破棄する、または変更する。",
  "",
].join("\n");

describe("orthographic-variant: 判決の裁判官ごとの意見", () => {
  it("裁判官の意見は、その意見の中だけで比べる", () => {
    assert.deepEqual(findingsOf(judgment, "legal/judgment"), []);
  });

  it("意見の中のゆれは比べる", () => {
    const mixed = judgment.replace("破棄する、または変更する。", "破棄する、または変更する。破棄する、または取り消す。破棄する、又は差し戻す。");
    assert.equal(findingsOf(mixed, "legal/judgment").length, 1);
  });

  it("意見を始める文が無ければ、文書全体で比べる", () => {
    assert.equal(findingsOf(judgment.replace("裁判官甲の反対意見は次のとおりである。", "以上のとおりである。"), "legal/judgment").length, 2);
  });

  it("法務のジャンルでなければ、文書全体で比べる", () => {
    assert.equal(findingsOf(judgment, "business/report").length, 2);
  });

  it("部分の始まり", () => {
    const sentences = [
      { span: { start: 0, end: 5 }, text: "本文である。" },
      { span: { start: 10, end: 30 }, text: "裁判官甲の補足意見は、次のとおりである。" },
      { span: { start: 40, end: 50 }, text: "意見である。" },
      { span: { start: 60, end: 80 }, text: "裁判官乙丙の反対意見は次のごとくである。" },
    ];
    const openings = (ja.lexicons["orthographic-variant-voice"] ?? []).map((entry) => new RegExp(entry.pattern, "u"));
    const starts = voiceStarts(sentences, openings);
    assert.deepEqual(starts, [10, 60]);
    assert.deepEqual(
      [0, 9, 10, 45, 60, 99].map((offset) => voiceAt(starts, offset)),
      [0, 0, 1, 1, 2, 2],
    );
    assert.deepEqual(voiceStarts(sentences, []), []);
    assert.deepEqual(voiceStarts([], openings), []);
    assert.deepEqual(voiceStarts([{ span: { start: 0, end: 9 }, text: "多数意見は次のとおりである。" }], openings), []);
    assert.deepEqual(voiceStarts([{ span: { start: 0, end: 9 }, text: "上告理由三についての裁判官甲の補足意見は次のごとくである。" }], openings), [0]);
    assert.deepEqual(voiceStarts([{ span: { start: 0, end: 9 }, text: "裁判官甲の反対意見は次のとおりであるが、採らない。" }], openings), []);
  });
});
