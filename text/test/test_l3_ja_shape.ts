import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { loadProfiles } from "../packages/chaff/src/profile/load.ts";
import type { DocumentProfile } from "../packages/chaff/src/plugin.ts";

const RULES = loadRules("ja");

const idsFor = (source: string, profile?: DocumentProfile): string[] =>
  runRules(buildDocument("t.md", source, ja, undefined, profile), RULES, {}, true, "business/report").findings.map((finding) => finding.rule);

const kanjiWords = (source: string): string[] =>
  runRules(buildDocument("t.md", source, ja), RULES, {}, true, "business/report")
    .findings.filter((finding) => finding.rule === "max-kanji-continuous")
    .map((finding) => String(finding.values?.["word"]));

const statute = loadProfiles().find((definition) => definition.id === "statute")?.languages["ja"];
if (statute === undefined) throw new Error("profiles/statute.yaml has no ja section");

const inStatute = (source: string): string[] => idsFor(source, statute);

describe("L3 日本語 — 文字と語彙", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  describe("max-kanji-continuous", () => {
    it("invalid: 漢字が 12 字続く", () => {
      assert.ok(idsFor("情報処理推進機構認定試験の受験者が増えました。").includes("max-kanji-continuous"));
    });

    it("valid: 助詞で割れていれば指摘しない", () => {
      assert.ok(!idsFor("情報処理推進機構の認定試験の受験者が増えました。").includes("max-kanji-continuous"));
    });

    it("valid: 実文書で普通に出る 6 字は指摘しない", () => {
      // examples/ の最長が 6 字（認知的複雑度・社会課題解決）。良い文書で出る長さは閾値の下。
      assert.ok(!idsFor("認知的複雑度を測ります。社会課題解決に取り組みます。").includes("max-kanji-continuous"));
    });

    it("valid: 住所は割れないので数えない（都道府県で始まるか、丁目で終わるもの）", () => {
      // SRE NEXT 定款の事務所の所在地。
      assert.ok(!idsFor("主たる事務所は、東京都港区新橋二丁目に置く。").includes("max-kanji-continuous"));
      assert.ok(!idsFor("本店は神奈川県横浜市中区山下町に置く。").includes("max-kanji-continuous"));
      assert.ok(!idsFor("会場は千代田区霞関三丁目です。").includes("max-kanji-continuous"));
      assert.ok(!idsFor("本社は愛知県名古屋市中村区名駅南一丁目にある。").includes("max-kanji-continuous"));
      // 辞書に無い町名は形態素解析が割る（紀美野町は 紀＋美野、倶知安町の前は 北海道＋虻田）。単位で閉じれば住所。
      assert.ok(!idsFor("所在地は和歌山県海草郡紀美野町動木です。").includes("max-kanji-continuous"));
      assert.ok(!idsFor("会場は北海道虻田郡倶知安町です。").includes("max-kanji-continuous"));
    });

    it("invalid: 都道府県や丁目が無い長い語、住所の後ろに続く長い語は数える", () => {
      assert.ok(idsFor("東京都知事選挙管理委員会事務局に問い合わせる。").includes("max-kanji-continuous"));
      assert.ok(idsFor("新宿区役所総務部総務課長に届ける。").includes("max-kanji-continuous"));
      assert.ok(idsFor("埼玉県市町村総合事務組合に問い合わせる。").includes("max-kanji-continuous"));
      assert.ok(idsFor("大阪府市町村振興協会資料を確認する。").includes("max-kanji-continuous"));
      assert.ok(idsFor("東京都港区政策経営部に届ける。").includes("max-kanji-continuous"));
      // 数と単位だけの連なりは、地名で始まらないので住所ではない。
      assert.ok(idsFor("三百二十五万四千八百人が参加した。").includes("max-kanji-continuous"));
      // 地名を並べただけのものは住所ではない（地名が単位を挟まずに続く）。
      assert.ok(idsFor("東京大阪名古屋福岡に展開します。").includes("max-kanji-continuous"));
      assert.ok(idsFor("京都奈良大阪神戸市に展開します。").includes("max-kanji-continuous"));
      // 都道府県の単位（語彙表 prefecture-unit）は住所の先頭にしか来ない。地名の後ろに付けば並び。
      assert.ok(idsFor("北海道神奈川県横浜市に展開します。").includes("max-kanji-continuous"));
      // 割られた町名の後ろに普通の語が続けば住所ではない。
      assert.ok(idsFor("和歌山県海草郡紀美野町役場総務課に届ける。").includes("max-kanji-continuous"));
      // 数の後ろが助数詞でない語なら住所ではない。
      assert.ok(idsFor("東京都港区新橋二政策に届ける。").includes("max-kanji-continuous"));
      // 住所の後ろの 1 字の語も連なりの一部で、住所だけの連なりではない。
      assert.ok(idsFor("東京都港区新橋二丁目課に届ける。").includes("max-kanji-continuous"));
    });

    it("数に付いた助数詞は、後ろの複合語の連なりに数えない", () => {
      // 最高裁平成18年9月14日判決。「2日」の日は数と読まれるので、見せる語は「日本弁護士連合会臨時総会決議」。
      assert.deepEqual(kanjiWords("弁護士倫理規定（平成2年3月2日日本弁護士連合会臨時総会決議）は、基本倫理を掲げた。"), ["日本弁護士連合会臨時総会決議"]);
      // 助数詞を外すと 8 字で、上限に届かない。
      assert.deepEqual(kanjiWords("第3回情報処理推進機構の試験です。"), []);
      assert.deepEqual(kanjiWords("第3 回情報処理推進機構の試験です。"), []);
    });

    it("住所か名前かは、助数詞を外した残りで決める", () => {
      assert.deepEqual(kanjiWords("昭和41年7月1日新東京国際空港公団が発足した。"), []);
      assert.deepEqual(kanjiWords("7月1日新東京国際空港公団総務部が発足した。"), ["新東京国際空港公団総務部"]);
    });

    it("同じ連なりが文に二度出れば、それぞれの位置で助数詞かどうかを読む", () => {
      assert.deepEqual(kanjiWords("2026年度予算編成基本方針と年度予算編成基本方針を比べる。"), ["年度予算編成基本方針"]);
      assert.deepEqual(kanjiWords("年度予算編成基本方針と2026年度予算編成基本方針を比べる。"), ["年度予算編成基本方針"]);
    });

    it("invalid: 漢数字の後ろの助数詞と、助数詞でない語は数える", () => {
      // 漢数字は連なりの一部で、数と助数詞も連なりの中にある。
      assert.deepEqual(kanjiWords("第三回情報処理推進機構の試験です。"), ["第三回情報処理推進機構"]);
      // 会計は助数詞ではない（令和6年版情報通信白書）。
      assert.deepEqual(kanjiWords("米国の「2021会計年度国防授権法」を参照する。"), ["会計年度国防授権法"]);
      assert.deepEqual(kanjiWords("第3回情報処理推進機構認定試験です。"), ["情報処理推進機構認定試験"]);
    });

    it("valid: 辞書が 1 語の固有名詞と読む名前は、書き手が変えられないので数えない", () => {
      assert.ok(!idsFor("新東京国際空港公団が発表した。").includes("max-kanji-continuous"));
      assert.ok(!idsFor("動力炉核燃料開発事業団の報告を読む。").includes("max-kanji-continuous"));
    });

    it("invalid: 名前に普通の語が続く語、名前の並び、辞書が固有名詞と読まない正式名称は数える", () => {
      assert.ok(idsFor("新東京国際空港公団総務部に届ける。").includes("max-kanji-continuous"));
      // デジタル庁のサービスデザインガイドラインにある学部名。武蔵野美術大学だけが固有名詞で、後ろは普通の語。
      assert.ok(idsFor("武蔵野美術大学造形構想学部の教員が参加した。").includes("max-kanji-continuous"));
      assert.ok(idsFor("日本経済団体連合会が提言した。").includes("max-kanji-continuous"));
      assert.ok(idsFor("田中一郎山田花子佐藤次郎が出席した。").includes("max-kanji-continuous"));
      // デジタル庁のプライバシーポリシーにある委員会名。形態素解析は 個人/情報/保護/委員/会 と普通の語に割る。
      assert.ok(idsFor("個人情報保護委員会規則に従う。").includes("max-kanji-continuous"));
    });

    it("覆った箇所の空白をまたいで繋がない", () => {
      // `情報処理` と `推進機構` は別のコード。間の記号は覆われて空白になる。
      assert.ok(!idsFor("`情報処理`と`推進機構`の話です。").includes("max-kanji-continuous"));
    });

    it("法令の種類を選ばなければ、番地も漢字の連なりに数える", () => {
      assert.ok(idsFor("第二百三十六条第一項第七号に掲げる事項についての定めがある場合").includes("max-kanji-continuous"));
    });

    it("valid: 法令の番地は漢字の連なりに数えない", () => {
      // 会社法第二百三十八条。番地を数えると「第二百三十六条第一項第七号」で 13 字になる。
      assert.ok(!inStatute("第二百三十六条第一項第七号に掲げる事項についての定めがある場合").includes("max-kanji-continuous"));
      assert.ok(!inStatute("第五十二条の二第一項の規定により発起人の負う義務").includes("max-kanji-continuous"));
    });

    it("invalid: 番地の前後の長い複合語は指摘する", () => {
      // 個人情報保護法第六十条。番地で切れたあとの「独立行政法人等情報公開法」は 12 字。
      assert.ok(inStatute("独立行政法人等情報公開法第五条に規定する不開示情報").includes("max-kanji-continuous"));
    });

    it("invalid: 番地に見えても語が続けば番地ではない", () => {
      assert.ok(inStatute("第十項目標管理制度導入を進めます。").includes("max-kanji-continuous"));
      assert.ok(inStatute("第五条中央銀行本店の決定です。").includes("max-kanji-continuous"));
      assert.ok(inStatute("第五条第五項中央銀行です。").includes("max-kanji-continuous"));
    });
  });

  describe("no-nakaguro-parallel", () => {
    it("invalid: 1 文に中黒が 6 個", () => {
      assert.ok(idsFor("企画・開発・運用・保守、営業・販売・広報・総務の体制を見直します。").includes("no-nakaguro-parallel"));
    });

    it("valid: 1 組の並列は指摘しない", () => {
      assert.ok(!idsFor("企画・開発・運用の体制を見直します。").includes("no-nakaguro-parallel"));
    });
  });

  describe("sasete-itadaku", () => {
    it("invalid: 文書内に 4 回", () => {
      const source = "検討させていただきます。調整させていただきます。確認させていただきます。報告させていただきます。";
      assert.ok(idsFor(source).includes("sasete-itadaku"));
    });

    it("valid: 1 度なら指摘しない", () => {
      assert.ok(!idsFor("検討させていただきます。来週までに結論を出します。").includes("sasete-itadaku"));
    });
  });

  describe("double-keigo", () => {
    it("invalid: 尊敬語に「られる」を重ねる", () => {
      assert.ok(idsFor("部長がおっしゃられました。").includes("double-keigo"));
    });

    it("invalid: 謙譲語に「させていただく」を重ねる", () => {
      assert.ok(idsFor("資料を拝見させていただきます。").includes("double-keigo"));
    });

    it("valid: 敬語が 1 つなら指摘しない", () => {
      assert.ok(!idsFor("部長がおっしゃいました。").includes("double-keigo"));
    });

    it("valid: 議論の分かれる形は語彙表に入れない", () => {
      // 「ご説明させていただきます」は二重敬語かで割れる。割れる形を入れると rule ごと無視される。
      assert.ok(!idsFor("ご説明させていただきます。").includes("double-keigo"));
    });
  });

  describe("hiragana-fukushi", () => {
    it("invalid: 表外漢字の副詞", () => {
      assert.ok(idsFor("殆どの項目は完了しました。").includes("hiragana-fukushi"));
    });

    it("valid: かなで書いてあれば指摘しない", () => {
      assert.ok(!idsFor("ほとんどの項目は完了しました。").includes("hiragana-fukushi"));
    });

    it("valid: 公用文で漢字が認められる副詞は見ない", () => {
      // 「既に」「全く」は漢字でよい。どちらが正しいかで割れる語を入れない。
      assert.ok(!idsFor("既に完了しました。全く問題ありません。").includes("hiragana-fukushi"));
    });
  });
});
