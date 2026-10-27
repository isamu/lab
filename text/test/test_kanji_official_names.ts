import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { titleBody } from "../packages/chaff/src/detectors/titled-run.ts";
import { trailingConjunction, leadingDate } from "../packages/chaff/src/detectors/kanji-name-edge.ts";
import { measuredOffOn } from "../scripts/rules-measure-files.ts";
import type { Token } from "../packages/chaff/src/plugin.ts";

// max-kanji-continuous: 文書が名前と示した連なり、法令の名前とその名の元の語、職名と組の人の名前。
// 例文は、白書・特許庁・気象庁・首相官邸・e-Gov の文（政府標準利用規約 2.0、PDL-1.0 互換）から書き起こしたものと、自作の文。

const RULES = loadRules("ja");
const KANJI_AT_NORMAL = { "max-kanji-continuous": RULES.find((rule) => rule.id === "max-kanji-continuous")?.levels.normal ?? 0 };

const kanjiWords = (source: string, genre = "docs/manual"): string[] =>
  runRules(buildDocument("t.md", source, ja), RULES, measuredOffOn(genre), true, genre, KANJI_AT_NORMAL)
    .findings.filter((finding) => finding.rule === "max-kanji-continuous")
    .map((finding) => String(finding.values?.["word"]));

const token = (surface: string, start: number, pos = "NOUN"): Token => ({ surface, pos, span: { start, end: start + surface.length } });

describe("titleBody", () => {
  const fixedName = { endings: ["法", "制度"] };
  it("閉じる語の前の字", () => {
    assert.equal(titleBody([token("愛玩", 0), token("動物", 2), token("看護", 4), token("師", 6), token("法", 7)], fixedName), "愛玩動物看護師");
  });
  it("閉じる語で終わらないか、前が 1 字なら undefined", () => {
    assert.equal(titleBody([token("解決", 0), token("方法", 2)], fixedName), undefined);
    assert.equal(titleBody([token("新", 0), token("制度", 1)], fixedName), undefined);
    assert.equal(titleBody([], fixedName), undefined);
  });
});

describe("trailingConjunction", () => {
  const tokens = [token("方針", 0), token("及び", 2, "CCONJ"), token("基本", 4)];
  it("連なりの尻から仮名へ続く接続の語の漢字", () => {
    assert.deepEqual(trailingConjunction(tokens, 0, 3, "方針及"), { surface: "及", start: 2 });
  });
  it("接続の語でない、連なりの外で始まる、連なりの中で閉じる語は外さない", () => {
    assert.equal(trailingConjunction([token("方針", 0), token("及び", 2)], 0, 3, "方針及"), undefined);
    assert.equal(trailingConjunction(tokens, 2, 3, "及"), undefined);
    assert.equal(trailingConjunction(tokens, 0, 4, "方針及び"), undefined);
    assert.equal(trailingConjunction([], 0, 3, "方針及"), undefined);
  });
});

describe("leadingDate", () => {
  const tokens = [token("令", 0), token("和", 1), token("元年", 2), token("東日本", 4), token("台風", 7)];
  it("元号の付いた年だけでも日付", () => {
    assert.deepEqual(leadingDate(tokens, 0, "令和元年東日本台風"), { surface: "令和元年", span: { start: 0, end: 4 } });
  });
  it("〇で割れた年の後半は、すぐ前が〇のときだけ", () => {
    const year = [token("二", 0), token("七", 1), token("年", 2), token("国際", 3)];
    assert.deepEqual(leadingDate(year, 0, "二七年国際", "二〇"), { surface: "二七年", span: { start: 0, end: 3 } });
    assert.equal(leadingDate(year, 0, "二七年国際"), undefined);
  });
  it("度が続く年、元号の無い年だけは日付と読まない", () => {
    assert.equal(leadingDate([token("令和", 0), token("七", 2), token("年度", 3)], 0, "令和七年度予算"), undefined);
    assert.equal(leadingDate([token("十", 0), token("年間", 1)], 0, "十年間平均"), undefined);
    assert.equal(leadingDate([token("二", 0), token("年度", 1)], 0, "二年度", "二〇"), undefined);
  });
});

describe("max-kanji-continuous: 文書が名前として示した連なり", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("valid: 角括弧でくくった欄の名前と、文書が括弧でくくった名前の、文の中での使い", () => {
    assert.deepEqual(kanjiWords("［当事者系審判請求人］［異議申立人］\n\n当事者系審判請求人等の氏名に旧氏を併記できます。\n"), []);
    const screen = "［内容を確認］をクリックすると、「署名用電子証明書確認画面」が表示されます。\n\n署名用電子証明書確認画面で［OK］をクリックします。\n";
    assert.deepEqual(kanjiWords(screen), []);
  });

  it("invalid: 括弧でくくっていない名前、括弧の中で文が続く名前は数える", () => {
    assert.deepEqual(kanjiWords("署名用電子証明書確認画面で［OK］をクリックします。\n"), ["署名用電子証明書確認画面"]);
    assert.deepEqual(kanjiWords("「署名用電子証明書確認画面の表示」を読む。\n\n署名用電子証明書確認画面で選ぶ。\n"), [
      "署名用電子証明書確認画面",
      "署名用電子証明書確認画面",
    ]);
  });

  it("valid: 法令の題を囲む括弧の中の連なり", () => {
    const statute = "こども性暴力防止法（学校設置者等及び民間教育保育等事業者による児童対象性暴力等の防止等のための措置に関する法律）が成立しました。";
    assert.deepEqual(kanjiWords(statute), []);
  });

  it("invalid: 法令の題でない括弧の中の連なりは数える", () => {
    assert.deepEqual(kanjiWords("報告（民間教育保育等事業者による届出の件数）を見る。"), ["民間教育保育等事業者"]);
  });
});

describe("max-kanji-continuous: 法令の名前と、法令が名に取った語", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("valid: 文書が単独で使う法令の名前に、語が続く", () => {
    const amended = "改正された政治資金規正法を遵守します。\n\n政治資金規正法改正に取り組みました。\n";
    assert.deepEqual(kanjiWords(amended, "speech/address"), []);
  });

  it("valid: 法令の名前の元の語（愛玩動物看護師法の「愛玩動物看護師」）で始まる連なり", () => {
    assert.deepEqual(kanjiWords("愛玩動物看護師法に基づき、第4回愛玩動物看護師国家試験を実施しました。"), []);
  });

  it("invalid: 文書に法令の名前が無ければ数える", () => {
    assert.deepEqual(kanjiWords("第4回愛玩動物看護師国家試験を実施しました。"), ["愛玩動物看護師国家試験"]);
    assert.deepEqual(kanjiWords("政治資金規正法改正を進める。"), ["政治資金規正法改正"]);
  });
});

describe("max-kanji-continuous: 連なりの頭と尻で外す語", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("valid: 元号の付いた年、〇で割れた年、仮名へ続く接続の語の漢字", () => {
    assert.deepEqual(kanjiWords("台風19号（令和元年東日本台風）では、堤防が決壊しました。"), []);
    assert.deepEqual(kanjiWords("二〇二七年国際園芸博覧会は、絶好の機会です。", "speech/address"), []);
    assert.deepEqual(kanjiWords("市町村教育委員会及び市町村の文化行政担当部局に周知してください。"), []);
  });

  it("invalid: 年の後ろの語の積み重ねと、接続の語の前の長い連なりは数える", () => {
    assert.deepEqual(kanjiWords("令和元年新規顧客獲得施策検討会議を開く。"), ["新規顧客獲得施策検討会議"]);
    assert.deepEqual(kanjiWords("新規顧客獲得施策検討会議及び分科会を開く。"), ["新規顧客獲得施策検討会議"]);
    assert.deepEqual(kanjiWords("令和七年度新規顧客獲得施策を進める。"), ["令和七年度新規顧客獲得施策"]);
  });
});

describe("max-kanji-continuous: 職名と組の人の名前、組織と書類の名前", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("valid: 職名のすぐ前か後ろの人の姓と名", () => {
    assert.deepEqual(kanjiWords("当時の小泉純一郎内閣総理大臣臨席の下、式が行われました。", "speech/address"), []);
    assert.deepEqual(kanjiWords("令和七年六月二十三日 内閣総理大臣石破茂\n", "speech/address"), []);
  });

  it("invalid: 職名の無い人の名前に語が続く連なりは数える", () => {
    assert.deepEqual(kanjiWords("小泉純一郎元首相記念講演会を開きました。", "speech/address"), ["小泉純一郎元首相記念講演会"]);
  });

  it("valid: 拠点・部隊・基地で閉じる組織の名前、ファイルへのリンクの一覧の題、職名の感謝状", () => {
    assert.deepEqual(kanjiWords("東京大学人文情報学拠点が会員となりました。"), []);
    assert.deepEqual(kanjiWords("航空自衛隊輸送機部隊の編成完結式が行われました。", "speech/address"), []);
    assert.deepEqual(kanjiWords("愛知県の航空自衛隊小牧基地で式が行われました。", "speech/address"), []);
    assert.deepEqual(kanjiWords("電子化手数料対象書類一覧（PDF：397KB）を御参照ください。"), []);
    assert.deepEqual(kanjiWords("本日、内閣総理大臣感謝状を授与いたしました。", "speech/address"), []);
  });

  it("invalid: 文の中で一度だけ使った一覧、頭に名前の無い部隊は数える", () => {
    assert.deepEqual(kanjiWords("電子化手数料対象書類一覧を御参照ください。"), ["電子化手数料対象書類一覧"]);
    assert.deepEqual(kanjiWords("新規顧客獲得施策部隊を作る。"), ["新規顧客獲得施策部隊"]);
  });
});
