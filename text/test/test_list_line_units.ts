import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { listItemParagraphs } from "../packages/chaff/src/list-item-paragraphs.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { listLineBreaks, startsWithListMarker } from "../packages/lang-ja/src/list-line.ts";
import type { Span } from "../packages/chaff/src/plugin.ts";

const textsOf = (source: string): string[] => ja.segment(source).sentences.map((sentence) => sentence.text);

const rulesOf = (source: string, genre: string, rules: readonly string[]): string[] =>
  runRules(buildDocument("t.md", source, ja), loadRules("ja"), {}, true, genre)
    .findings.filter((finding) => rules.includes(finding.rule))
    .map((finding) => `${finding.rule}:${String(finding.values["count"])}`);

describe("startsWithListMarker: 行頭の印", () => {
  it("箇条書きの印で始まる行", () => {
    [
      "①　誓約書",
      "　　　　②　身元保証書",
      "・関係機関との連絡調整",
      "(1)学歴：大学卒業以上",
      "（２）職歴",
      "１．採用の手続",
      "3) 期限",
      "a. 経験を有すること",
      "イ　写しを添える",
      "一　商号",
      "⑴ 目的",
      "（iv）条件",
      "（IV）条件",
    ].forEach((line) => assert.equal(startsWithListMarker(line), true, line));
  });

  it("文の中の番号や語は印ではない", () => {
    [
      "①に掲げる書類を提出する",
      "(1)の規定による",
      "イベントの案内",
      "1.5倍に増えた",
      "一 人で行う",
      "第３条　会社は",
      "本文の行",
      "○事務局",
      "※ 書類は返却しません",
      "J. Smith wrote it.",
    ].forEach((line) => assert.equal(startsWithListMarker(line), false, line));
  });
});

describe("listLineBreaks: 項目の行の前後で文が改まる", () => {
  it("項目の行の前と後ろで切る", () => {
    assert.equal(listLineBreaks("次の書類を出す。\n①　誓約書\n②　身元保証書\nただし省略できる。").length, 3);
  });

  it("読点で終わる行と、括弧を開いたまま終わる行の後ろでは切らない", () => {
    assert.deepEqual(listLineBreaks("①　会社が定める書類のうち、\n本人が用意するもの"), []);
    assert.deepEqual(listLineBreaks("①　職務経歴書（様式は任意で、\n写真を貼る。）"), []);
  });

  it("印の無い行の折り返しでは切らない", () => {
    assert.deepEqual(listLineBreaks("この規程は社員の勤務について\n必要な事項を定める。"), []);
  });
});

describe("日本語の文分割: 1 行 1 項目の箇条書き", () => {
  it("句点の無い項目の行は、それぞれ 1 文", () => {
    assert.deepEqual(textsOf("次の書類を提出しなければならない。\n①　誓約書\n②　身元保証書\n③　住民票の写し"), [
      "次の書類を提出しなければならない。",
      "①　誓約書",
      "②　身元保証書",
      "③　住民票の写し",
    ]);
  });

  it("<br> で改めた行（印で始まる行）も、それぞれ 1 文", () => {
    assert.deepEqual(textsOf("・登録審査に関する業務\n・講習の運営に関する業務\n(1)学歴：大学卒業以上の者\n(2)職歴：三年以上の者"), [
      "・登録審査に関する業務",
      "・講習の運営に関する業務",
      "(1)学歴：大学卒業以上の者",
      "(2)職歴：三年以上の者",
    ]);
  });

  it("項目の後ろの印の無い行も、項目の文に続けない", () => {
    assert.deepEqual(textsOf("ロ　通知カードの写し\nただし原本を見せれば省略できる。"), ["ロ　通知カードの写し", "ただし原本を見せれば省略できる。"]);
  });

  it("印の無い行の折り返しは 1 文のまま", () => {
    assert.deepEqual(textsOf("これは長い文で\n途中で折り返している。次の文。"), ["これは長い文で\n途中で折り返している。", "次の文。"]);
  });

  it("文の中の番号（①に掲げる）で始まる行は、前の行の続き", () => {
    assert.deepEqual(textsOf("前条第二項\n①に掲げる書類を出す。"), ["前条第二項\n①に掲げる書類を出す。"]);
  });

  it("注記の印（※）は文を改めないが、そこで始まる文は項目と同じく印を付ける", () => {
    assert.deepEqual(textsOf("ファックス番号：012-3456-7890\n※送られたら必ずご連絡ください。"), [
      "ファックス番号：012-3456-7890\n※送られたら必ずご連絡ください。",
    ]);
    const sentences = ja.segment("書類を送ってください。\n※ 書類は返却しません。").sentences;
    assert.deepEqual(
      sentences.map((sentence) => sentence.listItem === true),
      [false, true],
    );
  });

  it("項目を始める文に印を付ける", () => {
    const sentences = ja.segment("次の書類を出す。\n①　誓約書\n②　身元保証書").sentences;
    assert.deepEqual(
      sentences.map((sentence) => sentence.listItem === true),
      [false, true, true],
    );
  });
});

describe("listItemParagraphs: 項目ごとに段落を改める", () => {
  it("項目が無ければ段落 1 つのまま", () => {
    const paragraph = { start: 0, end: 20 };
    assert.deepEqual(listItemParagraphs(paragraph, [{ span: { start: 0, end: 8 } }, { span: { start: 9, end: 20 } }]), [paragraph]);
  });

  it("文の無い段落は 1 つのまま", () => {
    assert.deepEqual(listItemParagraphs({ start: 0, end: 5 }, []), [{ start: 0, end: 5 }]);
  });

  it("段落の最初の文だけが項目なら 1 つのまま", () => {
    assert.deepEqual(listItemParagraphs({ start: 0, end: 20 }, [{ span: { start: 0, end: 8 }, listItem: true }, { span: { start: 9, end: 20 } }]), [
      { start: 0, end: 20 },
    ]);
  });

  it("項目を始める文の前で割り、印の無い続きの文は項目に付ける", () => {
    const sentences: { readonly span: Span; readonly listItem?: true }[] = [
      { span: { start: 0, end: 8 } },
      { span: { start: 9, end: 14 }, listItem: true },
      { span: { start: 15, end: 22 } },
      { span: { start: 23, end: 30 }, listItem: true },
    ];
    assert.deepEqual(listItemParagraphs({ start: 0, end: 30 }, sentences), [
      { start: 0, end: 8 },
      { start: 9, end: 22 },
      { start: 23, end: 30 },
    ]);
  });
});

/** 番号を振った項と、空行を挟まない号の並びの条（自作）。 */
const ARTICLE = [
  "# 就業規則",
  "",
  "第５条（提出書類）",
  "１．社員として採用された者は、採用された日から二週間以内に、会社が定める次の書類を人事担当の部署へ提出しなければならない。ただし、会社が認めた場合には、提出の期限を延ばし、又は書類の一部を省くことがある。",
  "①　会社が定める様式による誓約書と、身元保証人が署名した身元保証書",
  "②　住民票に記載された事項を証明する書面と、扶養家族の状況を示す書面",
  "２．前項の書類に書いた事項に変更が生じたときは、社員は変わった日から一週間以内に、その内容を書面で会社へ届け出なければならない。",
  "３．会社は、第１項の規定に基づいて提出された書類を、配属の決定、給与の計算、社会保険の手続のためにだけ用いるものとする。",
  "４．会社は、前項に定める目的のために必要な範囲を超えて、提出された書類に記載された個人の情報を取り扱ってはならない。",
  "５．社員は、提出した書類の記載に誤りがあることを知ったときは、すみやかに人事担当の部署へ申し出て、正しい内容を届け出なければならない。",
  "６．会社は、社員が退職した後、法令で定められた期間を過ぎた書類を、復元できない方法で廃棄するものとする。",
  "",
].join("\n");

/** 空行で区切らない、長い文の続く段落（自作）。印の無い行の折り返しを含む。 */
const PROSE = [
  "# 報告",
  "",
  "今年度の調査では、全国の事業所を対象として、勤務の形態と通勤の手段について、これまでより詳しく尋ねる質問票を用い、回答の傾向を地域ごとに比べた。",
  "その結果、在宅での勤務を取り入れた事業所の割合は、大都市圏とそれ以外の地域とで大きく異なり、地域による差が前年度よりも広がっていることが分かった。",
  "また、通勤にかかる時間が長い地域ほど、在宅での勤務を週に二日以上認める事業所が多く、通勤の負担を減らすことが導入の主な理由として挙げられた。",
  "一方で、製造や販売の現場を抱える事業所では、在宅での勤務を取り入れる余地が小さく、交代で勤務する制度や始業の時刻をずらす制度で対応している例が目立った。",
  "さらに、規模の小さな事業所ほど、勤務の記録を管理する仕組みや情報の安全を守る設備が整っておらず、導入をためらう理由としてそれらを挙げる回答が多かった。",
  "これらの結果を踏まえ、次年度は、導入を支える仕組みの整備の状況と、働く人の満足度との関係を、同じ事業所を追って調べる計画を立てている。",
  "",
].join("\n");

/** <br> で行を改めた募集の要項（自作）。行どうしは空行を挟まない。 */
const BR_LIST = [
  "# 募集",
  "",
  "【担当する業務】",
  "・登録の審査に関する業務と、審査に伴う関係機関との連絡調整",
  "・講習の運営に関する業務と、講習の内容を見直すための調査",
  "・制度の活用を進めるための広報と、利用する人からの問い合わせへの対応",
  "・新しい学習の仕組みの検討に関する業務と、関係する部局との調整",
  "・上記の業務に伴う予算の要求と執行の管理、会議の運営",
  "",
].join("\n");

/** 印の無い行の折り返しで続く、1 つの長い文（自作）。 */
const WRAPPED_LONG_SENTENCE = [
  "# 報告",
  "",
  "今年度の調査では、全国の事業所を対象として、勤務の形態と通勤の手段について、これまでより詳しく尋ねる質問票を用い、回答の傾向を地域ごとに比べるとともに、",
  "前年度の結果と照らし合わせて変化の大きかった項目を洗い出し、その理由を事業所への聞き取りで確かめたうえで、次年度の調査の設計に生かす方針を定めた。",
  "",
].join("\n");

describe("段落と文の長さ: 1 行 1 項目の並びは、項目ごとに数える", () => {
  it("番号を振った項と号を空行無しで並べた条は、長すぎる段落と言わない", () => {
    assert.deepEqual(rulesOf(ARTICLE, "business/report", ["max-paragraph-length"]), []);
  });

  it("長い文の続く段落は、行が改まっていても長すぎる段落と言う", () => {
    assert.deepEqual(rulesOf(PROSE, "business/report", ["max-paragraph-length"]), ["max-paragraph-length:6"]);
  });

  it("<br> で改めた項目の並びは、長すぎる文と言わない", () => {
    assert.deepEqual(rulesOf(BR_LIST, "business/report", ["max-sentence-length", "topic-predicate-distance", "max-paragraph-length"]), []);
  });

  it("印の無い行で折り返した長い文は、1 文として長すぎると言う", () => {
    assert.deepEqual(
      rulesOf(WRAPPED_LONG_SENTENCE, "business/report", ["max-sentence-length"]).map((found) => found.split(":")[0]),
      ["max-sentence-length"],
    );
  });

  it("中黒を含む項目を並べても、項目ごとに中黒を数える", () => {
    const items = [
      "# 明示する事項",
      "",
      "明示すべき事項は次のとおりとする。",
      "①　就業の場所・業務",
      "②　賃金の決定・計算・支払の方法",
      "③　始業・終業の時刻・休憩・休日",
      "④　退職・解雇に関する事項",
      "",
    ].join("\n");
    assert.deepEqual(rulesOf(items, "business/report", ["no-nakaguro-parallel"]), []);
  });
});
