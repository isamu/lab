import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { isOrganisationRun, type OrganisationWords } from "../packages/chaff/src/detectors/organisation-run.ts";
import { prepare, tokenize } from "../packages/lang-ja/src/pos.ts";
import { loadLexicons } from "../packages/lang-ja/src/lexicons.ts";
import type { Token } from "../packages/chaff/src/plugin.ts";

const LEXICONS = loadLexicons();
const patternsOf = (id: string): string[] => (LEXICONS[id] ?? []).map((entry) => entry.pattern);
const WORDS: OrganisationWords = {
  forms: patternsOf("organisation-form"),
  closingForms: (LEXICONS["organisation-form"] ?? []).filter((entry) => entry.position !== "before").map((entry) => entry.pattern),
  units: patternsOf("organisation-unit"),
};

const tokensOf = (text: string): Token[] => {
  const tokens = tokenize(text);
  if (tokens === undefined) throw new Error("形態素解析が用意できていない");
  return tokens;
};

/** 文字列全体を 1 つの漢字の連なりとして判定する。 */
const isOrganisation = (run: string, words: OrganisationWords = WORDS): boolean => {
  const tokens = tokensOf(run);
  return isOrganisationRun(
    tokens,
    tokens.map((_, index) => index),
    words,
  );
};

const token = (surface: string, start: number, pos = "NOUN", features?: Record<string, string>): Token => ({
  span: { start, end: start + surface.length },
  surface,
  pos,
  ...(features === undefined ? {} : { features }),
});

describe("isOrganisationRun — 漢字の連なりが 1 つの組織の名前か", () => {
  before(async () => {
    await prepare();
  });

  it("語彙表 organisation-form と organisation-unit が読める", () => {
    assert.ok(WORDS.forms.includes("国立研究開発法人"));
    assert.ok(WORDS.units.includes("研究所"));
  });

  it("valid: 法人格で始まり、組織の語で閉じる（経済産業省の報道発表、九州先端科学技術研究所のサイト）", () => {
    assert.ok(isOrganisation("国立研究開発法人産業技術総合研究所"));
    assert.ok(isOrganisation("公益財団法人九州先端科学技術研究所"));
    assert.ok(isOrganisation("独立行政法人国立病院機構沖縄病院"));
    assert.ok(isOrganisation("国立保健医療科学院"));
  });

  it("valid: 地名や固有名詞で始まり、組織の語で閉じる（紀美野町の町長の部屋・お知らせ）", () => {
    assert.ok(isOrganisation("下神野地区自主防災組織"));
    assert.ok(isOrganisation("紀美野町青少年育成町民会議"));
    assert.ok(isOrganisation("日本作業療法士協会"));
    assert.ok(isOrganisation("東京大学社会科学研究所"));
  });

  it("valid: 組織の語で閉じる区切りが 2 つ以上続く（〜省〜局〜課）", () => {
    assert.ok(isOrganisation("経済産業省製造産業局自動車課"));
    assert.ok(isOrganisation("国土交通省鉄道局総務課"));
    assert.ok(isOrganisation("厚生労働省労働基準局労働保険徴収課"));
    assert.ok(isOrganisation("臨時行政調査会作業部会"));
    assert.ok(isOrganisation("新東京国際空港公団総務部"));
  });

  it("invalid: 組織の語で閉じない（組織の名前に普通の語や役職が続く）", () => {
    assert.ok(!isOrganisation("情報処理推進機構認定試験"));
    assert.ok(!isOrganisation("新宿区役所総務部総務課長"));
    assert.ok(!isOrganisation("大阪府市町村振興協会資料"));
    assert.ok(!isOrganisation("社会保障審議会統計分科会疾病"));
    assert.ok(!isOrganisation("日本作業療法士協会五十年史"));
  });

  it("invalid: 頭に名前の無い 1 区切りは、書き手が組み立てた語かもしれない", () => {
    assert.ok(!isOrganisation("個人情報保護法施行規則改正案検討会"));
    assert.ok(!isOrganisation("新規顧客獲得施策検討会議"));
    assert.ok(!isOrganisation("全国社会福祉協議会"));
    // 会社は普通の語。社で閉じても組織の名前とは言わない。
    assert.ok(!isOrganisation("東京自動車部品販売会社"));
  });

  it("invalid: 語の途中の 1 字や、前が 1 字の語は区切りにしない（課題・部門・外部）", () => {
    assert.ok(!isOrganisation("社会課題解決推進会議"));
    assert.ok(!isOrganisation("営業部門強化策検討会議"));
    assert.ok(!isOrganisation("外部監査制度検討委員会"));
  });

  it("invalid: 数を含む区切り、地名だけの並び", () => {
    assert.ok(!isOrganisation("東京都港区新橋二丁目課"));
    assert.ok(!isOrganisation("第三回情報処理推進機構"));
    assert.ok(!isOrganisation("京都奈良大阪神戸市"));
  });

  it("invalid: 語彙表が空なら、どれも組織の名前と言わない", () => {
    assert.ok(!isOrganisation("国土交通省鉄道局総務課", { forms: [], closingForms: [], units: [] }));
    assert.ok(!isOrganisation("国立研究開発法人産業技術総合研究所", { forms: WORDS.forms, closingForms: [], units: [] }));
    assert.ok(!isOrganisation("東日本自動車販売株式会社", { forms: WORDS.forms, closingForms: [], units: WORDS.units }));
  });

  it("valid: 名前の後ろに立つ法人格で閉じる（東日本自動車販売株式会社、青葉監査法人）", () => {
    assert.ok(WORDS.closingForms.includes("株式会社"));
    assert.ok(isOrganisation("東日本自動車販売株式会社"));
    assert.ok(isOrganisation("青葉山監査法人"));
  });

  it("invalid: 設置者の語（県立）は名前を閉じない。法人格の前に名前が 1 字しか無いか、数を含む連なりも名前と言わない", () => {
    assert.ok(!WORDS.closingForms.includes("県立"));
    assert.ok(!isOrganisation("情報処理推進機構認定県立"));
    assert.ok(!isOrganisation("新株式会社"));
    assert.ok(!isOrganisation("２０２４年度株式会社"));
    // 会社法の語。固有名詞の無い連なりは、法人格で閉じても名前ではない。
    assert.ok(!isOrganisation("株式交換完全親株式会社"));
    assert.ok(!isOrganisation("当該新設合併設立株式会社"));
  });

  it("invalid: 語が無い・範囲の外・語のあいだに隙間がある", () => {
    assert.ok(!isOrganisationRun([], [], WORDS));
    assert.ok(!isOrganisationRun([token("総務部", 0)], [3], WORDS));
    const split = [token("鉄道", 0), token("局", 2), token("総務", 4), token("課", 6)];
    assert.ok(!isOrganisationRun(split, [0, 1, 2, 3], WORDS));
    const joined = [token("鉄道", 0), token("局", 2), token("総務", 3), token("課", 5)];
    assert.ok(isOrganisationRun(joined, [0, 1, 2, 3], WORDS));
  });

  it("valid: 課の下の担当、連なりのすぐ後ろのグループで閉じる（大阪市の公開ページにある問合せ先）", () => {
    assert.ok(isOrganisation("大阪市行政委員会事務局監査部監査課特別監査担当"));
    assert.ok(isOrganisation("大阪市教育委員会事務局教務部教職員人事担当"));
    const text = "青少年局幼保施策部幼保企画課幼稚園運営企画グループ";
    const tokens = tokensOf(text);
    const kanji = tokens.flatMap((piece, index) => (/^[一-鿿]+$/u.test(piece.surface) ? [index] : []));
    assert.ok(isOrganisationRun(tokens, kanji, WORDS));
  });

  it("invalid: 担当 1 区切りだけ、グループが隙間をあけて続く、グループのほかの語が続く", () => {
    assert.ok(!isOrganisation("家庭児童相談員任用担当"));
    const spaced = [token("幼保", 0), token("企画", 2), token("課", 4), token("運営", 5), token("企画", 7), token("グループ", 10)];
    assert.ok(!isOrganisationRun(spaced, [0, 1, 2, 3, 4], WORDS));
    const other = [token("幼保", 0), token("企画", 2), token("課", 4), token("運営", 5), token("企画", 7), token("ページ", 9)];
    assert.ok(!isOrganisationRun(other, [0, 1, 2, 3, 4], WORDS));
    const joined = [token("幼保", 0), token("企画", 2), token("課", 4), token("運営", 5), token("企画", 7), token("グループ", 9)];
    assert.ok(isOrganisationRun(joined, [0, 1, 2, 3, 4], WORDS));
  });

  it("invalid: 地名の単位だけでは頭の名前にならない（固有名詞が要る）", () => {
    const unitOnly = [token("県", 0, "NOUN", { NameType: "GeoUnit" }), token("振興", 1), token("協議会", 3)];
    assert.ok(!isOrganisationRun(unitOnly, [0, 1, 2], WORDS));
    const named = [token("奈良", 0, "PROPN", { NameType: "Geo" }), token("県", 2, "NOUN", { NameType: "GeoUnit" }), token("振興", 3), token("協議会", 5)];
    assert.ok(isOrganisationRun(named, [0, 1, 2, 3], WORDS));
  });
});
