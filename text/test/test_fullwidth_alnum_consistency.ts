import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";

// 英数字の全角と半角の混在（fullwidth-alnum-consistency）。例文はすべて自作。

const RULE = "fullwidth-alnum-consistency";

const findingsOf = (source: string): readonly string[] => namedRuleRun(RULE, source, ja).findings;

// 数字の並びを半角で書いた段落。
const PLAIN = "申込は2024年10月15日までです。説明会は2024年11月20日に開きます。会場は12階です。定員は5人で、3回に分け、2部屋と4部屋を使います。\n\n";

describe("fullwidth-alnum-consistency: 英数字の全角と半角が混ざっている", () => {
  it("半角の文書の中の全角の数字の並び", () => {
    assert.deepEqual(findingsOf(`${PLAIN}締切は２０２４年です。\n`), [
      "全角の「２０２４」と書いています（この文書はふつう半角の「2024」。8 箇所のうち 1 箇所が違う）",
    ]);
  });

  it("全角の文書の中の半角（少ないほうを指摘する。どちらが正しいかは決めない）", () => {
    assert.deepEqual(findingsOf("会場は１２階です。受付は１５時です。控室は１３号室です。予備は14号室です。\n"), [
      "半角の「14」と書いています（この文書はふつう全角の「１４」。4 箇所のうち 1 箇所が違う）",
    ]);
  });

  it("英字の語も比べる", () => {
    assert.deepEqual(findingsOf("URL を開き、ID を入れ、PDF を保存します。ＵＲＬは変わります。\n"), [
      "全角の「ＵＲＬ」と書いています（この文書はふつう半角の「URL」。4 箇所のうち 1 箇所が違う）",
    ]);
  });

  it("略語を全角で書く文書の、半角の英語の語（for Science）は指摘しない", () => {
    assert.deepEqual(findingsOf("ＡＩの活用とＩＣＴの整備、ＤＸの推進に取り組む。ＡＩ for Scienceを進める。\n"), []);
  });

  it("全角で書いた英語の語は今までどおり指摘する", () => {
    assert.deepEqual(findingsOf("Python と Ruby と Go を使い、ｊａｖａも使う。\n"), [
      "全角の「ｊａｖａ」と書いています（この文書はふつう半角の「java」。4 箇所のうち 1 箇所が違う）",
    ]);
  });

  it("半角の英語の語は票には入り、並んだ半角の略語は今までどおり指摘する", () => {
    assert.deepEqual(findingsOf("ＡＩとＩＣＴとＤＸとＧＩＧＡとＮＥＸＴとＥＢＰＭに取り組む。PDCA for Scienceを回す。\n"), [
      "半角の「PDCA」と書いています（この文書はふつう全角の「ＰＤＣＡ」。9 箇所のうち 3 箇所が違う）",
    ]);
  });

  it("英字と数字は別に比べる（英字は半角、数字は全角でそろえた文書）", () => {
    assert.deepEqual(findingsOf("URL と ID を使います。会場は１２階、受付は１５時、控室は１３号室、予備は１４号室、倉庫は１６号室です。\n"), []);
  });

  it("全角と半角が混ざった並び（Ｈ30）は数えない", () => {
    assert.deepEqual(findingsOf("ＵＲＬとＩＤとＰＤＦとＨ30を使います。\n"), []);
  });

  it("一字と二字以上は別に比べる（１桁は全角、２桁以上は半角の決まり）", () => {
    assert.deepEqual(findingsOf("第１条から第12条まで、第３条と第15条を読みます。\n"), []);
  });

  it("少ないほうが三分の一を超えれば、使い分けと見て言わない", () => {
    assert.deepEqual(findingsOf("会場は１２階です。受付は15時です。\n"), []);
  });

  it("項目と注の番号、箇条書きの頭の番号は数えない", () => {
    assert.deepEqual(findingsOf(`${PLAIN}（１）を見ます。※３も見ます。\n\n１．はじめに\n\n- ４「勧告」の考え方\n`), []);
  });

  it("メールアドレスとドメイン名は数えない", () => {
    assert.deepEqual(
      findingsOf("ＩＤを入れ、ＰＤＦを保存し、ＡＰＩを使い、ＣＳＶとＸＭＬとＨＴＭＬとＪＳＯＮとＳＱＬを送ります。連絡先はsupport@example.comです。\n"),
      [],
    );
  });

  // 東京アプリの利用規約: 第１条と全角で書く文書の「TLS1.2」。
  it("版の番号の続き（TLS1.2 の 2）は、数字の書き方として数えない", () => {
    const fullwidth = "会場は１２階です。受付は１５時です。控室は１３号室です。予備は１４号室です。部屋は２つ、窓は３つ、机は４つです。";
    assert.deepEqual(findingsOf(`${fullwidth}ブラウザが TLS1.2 に対応していること。Python3.12 で動きます。Python3.12.4 も動きます。\n`), []);
  });

  it("版の番号でも、名前の数字と幅が違う続き（TLS1.２）は数える", () => {
    assert.deepEqual(findingsOf(`${PLAIN}対応は TLS1.２ です。\n`), ["全角の「２」と書いています（この文書はふつう半角の「2」。5 箇所のうち 1 箇所が違う）"]);
  });

  it("名前（EC2）の後ろでも、点でつながっていない数は数える", () => {
    const fullwidth = "部屋は２つ、窓は３つ、机は４つ、椅子は６つ、棚は７つです。";
    assert.deepEqual(findingsOf(`${fullwidth}サーバーは EC2 8台です。\n`), [
      "半角の「8」と書いています（この文書はふつう全角の「８」。6 箇所のうち 1 箇所が違う）",
    ]);
  });

  it("英字の無い数（1.5 倍）は小数として数える", () => {
    const fullwidth = "会場は１２階、受付は１５時、控室は１３号室、予備は１４号室です。";
    assert.deepEqual(findingsOf(`${fullwidth}広さは1.5倍です。\n`), [
      "半角の「1.5」と書いています（この文書はふつう全角の「１．５」。5 箇所のうち 1 箇所が違う）",
    ]);
  });

  it("１桁は全角、小数・分数は半角の決まり（公用文）では、小数や分数の数字を一桁と数えない", () => {
    const singles = "部屋は２つ、窓は３つ、机は４つ、椅子は６つ、棚は７つ、扉は２つ、鍵は３本、箱は４個、袋は５枚、皿は６枚です。";
    assert.deepEqual(findingsOf(`${singles}期間の1/4未満のとき。気温は0.5度下がる。\n`), []);
    assert.deepEqual(findingsOf(`${singles}高さは1.25mです。\n`), []);
  });

  it("その決まりの文書でも、半角の一桁の数は今までどおり指摘する", () => {
    const singles = "部屋は２つ、窓は３つ、机は４つ、椅子は６つ、棚は７つです。";
    assert.deepEqual(findingsOf(`${singles}期間の1/4未満のとき。予備は8つです。\n`), [
      "半角の「8」と書いています（この文書はふつう全角の「８」。6 箇所のうち 1 箇所が違う）",
    ]);
  });

  it("半角の文書の中の全角の分数は、数の並びとして指摘する", () => {
    assert.deepEqual(findingsOf(`${PLAIN}期間の１／４です。\n`), [
      "全角の「１／４」と書いています（この文書はふつう半角の「1/4」。8 箇所のうち 1 箇所が違う）",
    ]);
  });

  it("鉤括弧で引いたものの中は数えない", () => {
    assert.deepEqual(findingsOf(`${PLAIN}画面には「２０２４年度」と出ます。\n`), []);
  });

  // 厚生労働省の募集案内の形: 製品の名前は半角、連絡先の行は全角。
  it("番号の札（ＴＥＬ：０３…）は番号の幅に従い、英字の票にしない", () => {
    const notice =
      "- パソコン（Excel、Word等）の操作ができること。\n\n担当：山田\nＴＥＬ：０３－１２３４－５６７８\n\nPDFを見るには、Adobe Readerが要ります。Adobe Readerは無料です。\n";
    assert.deepEqual(findingsOf(notice), []);
    assert.deepEqual(findingsOf(`${PLAIN}FAX:03-1234-5678 です。\n`), []);
  });

  it("番号の続かない全角の英字は今までどおり指摘する", () => {
    const notice =
      "- パソコン（Excel、Word等）の操作ができること。\n\n担当：山田\nＴＥＬは内線です。\n\nPDFを見るには、Adobe Readerが要ります。Adobe Readerは無料です。\n";
    assert.deepEqual(findingsOf(notice), ["全角の「ＴＥＬ」と書いています（この文書はふつう半角の「TEL」。8 箇所のうち 1 箇所が違う）"]);
    assert.equal(findingsOf(notice.replace("ＴＥＬは内線です。", "ＴＥＬ：２３６１")).length, 1);
  });

  it("番号の札でない英字と数字（Ａ：１、AB:12）は今までどおり数える", () => {
    assert.equal(findingsOf("ＵＲＬとＩＤとＰＤＦとＣＳＶを使います。型番はAB:12です。\n").length, 1);
  });

  it("アポストロフィの横でも、英字でない並び（3'rd の 3）は数える", () => {
    assert.equal(findingsOf("会場は１２階です。受付は１５時です。控室は１３号室です。予備は１４号室です。順位は33'rd です。\n").length, 1);
  });

  it("アポストロフィでつないだ英字の語のかけら（Van't Hoff の t）を、全角の一字と比べない", () => {
    assert.deepEqual(findingsOf("Ａの雲とＢの丘とＣの林とＤの谷、そして Van't Hoff の雲と l'estudiantina を聞く。\n"), []);
  });

  it("一字の英字は今までどおり比べる", () => {
    assert.deepEqual(findingsOf("Ａの雲とＢの丘とＣの林とＤの谷、そして E の谷。\n"), [
      "半角の「E」と書いています（この文書はふつう全角の「Ｅ」。5 箇所のうち 1 箇所が違う）",
    ]);
  });

  // 首相官邸の演説の形: 頁の頭の日付は半角、演説は全角。
  const speech = "卒業生の諸君、おめでとう。１２月に着任し、２７名が配属されます。９時に集まり、７時に解散します。\n";

  it("文書の頭の日付の行（更新日：令和7年9月27日）を、本文の数と比べない", () => {
    assert.deepEqual(findingsOf(`# 祝辞\n\n更新日：令和7年9月27日 総理の演説・記者会見など\n\n${speech}`), []);
    assert.deepEqual(findingsOf(`# 式辞\n\n令和8年8月15日\n\n${speech}`), []);
  });

  it("本文の中の日付、文になった頭の段落の日付は今までどおり比べる", () => {
    assert.equal(findingsOf(`# 祝辞\n\n${speech}\n式は令和7年9月27日に開きました。\n`).length, 1);
    assert.equal(findingsOf(`# 祝辞\n\n令和7年9月27日に式を開きました。\n\n${speech}`).length, 1);
    assert.equal(findingsOf(`# 祝辞\n\n令和7年9月27日\n式を開きました\n\n${speech}`).length, 1);
  });

  // 公用文の書き分け（一桁は全角、二桁以上は半角）の文書。
  const official = "第１回の会合を開き、２名と３名と４名と５名と６名が出席した。会場は12階で、20日に開く。";

  it("三桁ごとに区切った数（5,500）は一つの数で、一桁の数として比べない", () => {
    assert.deepEqual(findingsOf(`${official}標高5,500mと3,000mの気温、1,474人が回答した。\n`), []);
  });

  it("区切った数も、二桁以上の数の書き方からはずれていれば今までどおり指摘する", () => {
    assert.deepEqual(findingsOf("会場は１２階、受付は１５時、控室は１３号室、予備は１４号室で、5,000人が来る。\n"), [
      "半角の「5,000」と書いています（この文書はふつう全角の「５，０００」。5 箇所のうち 1 箇所が違う）",
    ]);
  });

  it("有価証券報告書の項目の番号（４【経営者による分析】）は数えない", () => {
    assert.deepEqual(findingsOf(`${PLAIN}４【経営者による分析】当期の売上は伸びた。\n`), []);
  });

  it("本文で【】の前に置いた数は今までどおり比べる", () => {
    assert.equal(findingsOf(`${PLAIN}今年は第４【予定】の会を開く。\n`).length, 1);
  });

  it("全角の語が一つしかない文書の、別の英語の語（ＢＡＲ と DELICATE）は比べない", () => {
    assert.deepEqual(findingsOf("ＢＡＲの生活が始まった。ＢＡＲの卓で詩を書いた。たとへやうもなく DELICATE の哀傷が過ぎた。\n"), []);
  });

  it("同じ語を二つの幅で書いていれば、多いほうが一語でも指摘する", () => {
    assert.deepEqual(findingsOf("ＢＡＲの生活が始まった。ＢＡＲの卓で詩を書いた。BAR を出た。\n"), [
      "半角の「BAR」と書いています（この文書はふつう全角の「ＢＡＲ」。3 箇所のうち 1 箇所が違う）",
    ]);
  });

  it("そろっていれば何も言わない", () => {
    assert.deepEqual(findingsOf(PLAIN), []);
  });

  it("英語の文書では動かず、理由を言う", () => {
    assert.deepEqual(namedRuleRun(RULE, "A plain sentence.\n", en).skipped, ["not a rule for en"]);
  });
});
