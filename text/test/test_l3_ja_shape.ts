import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { loadProfiles } from "../packages/chaff/src/profile/load.ts";
import type { DocumentProfile, Finding } from "../packages/chaff/src/plugin.ts";
import { measuredOffOn } from "../scripts/rules-measure-files.ts";

const RULES = loadRules("ja");

/** max-kanji-continuous at the rule's own normal: business raises it by genre, and these read the detector, not the genre. */
const KANJI_AT_NORMAL = { "max-kanji-continuous": RULES.find((rule) => rule.id === "max-kanji-continuous")?.levels.normal ?? 0 };

const idsFor = (source: string, profile?: DocumentProfile): string[] =>
  runRules(
    buildDocument("t.md", source, ja, undefined, profile),
    RULES,
    measuredOffOn("business/report"),
    true,
    "business/report",
    KANJI_AT_NORMAL,
  ).findings.map((finding) => finding.rule);

const kanjiWords = (source: string): string[] =>
  runRules(buildDocument("t.md", source, ja), RULES, measuredOffOn("business/report"), true, "business/report", KANJI_AT_NORMAL)
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
      // 組織の名前の後ろに役職や普通の語が続けば、書き手が組み立てた語。
      assert.ok(idsFor("新宿区役所総務部総務課長に届ける。").includes("max-kanji-continuous"));
      assert.ok(idsFor("大阪府市町村振興協会資料を確認する。").includes("max-kanji-continuous"));
      // 数と単位だけの連なりは、地名で始まらないので住所ではない。
      assert.ok(idsFor("三百二十五万四千八百人が参加した。").includes("max-kanji-continuous"));
      // 地名を並べただけのものは住所ではない（地名が単位を挟まずに続く）。
      assert.ok(idsFor("東京大阪名古屋福岡に展開します。").includes("max-kanji-continuous"));
      assert.ok(idsFor("京都奈良大阪神戸市に展開します。").includes("max-kanji-continuous"));
      // 都道府県の単位（語彙表 prefecture-unit）は住所の先頭にしか来ない。地名の後ろに付けば並び。
      assert.ok(idsFor("北海道神奈川県横浜市に展開します。").includes("max-kanji-continuous"));
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

    it("行の途中で折り返した連なりでも、数に付いた助数詞の位置を読む", () => {
      assert.deepEqual(kanjiWords("弁護士倫理規定（平成2年3月2日日本弁護士連\n合会臨時総会決議）は、基本倫理を掲げた。"), ["日本弁護士連合会臨時総会決議"]);
      assert.deepEqual(kanjiWords("総会決議と弁護\n士倫理と2026年度予算編成基本方針と年度予算編\n成基本方針を比べる。"), ["年度予算編成基本方針"]);
    });

    it("語と語のあいだで折り返した改行は、連なりを切ったまま", () => {
      assert.deepEqual(kanjiWords("情報処理推進\n機構認定試験の受験者が増えました。"), []);
    });

    it("住所か名前かは、助数詞を外した残りで決める", () => {
      assert.deepEqual(kanjiWords("2026年度東京都港区新橋二丁目に置く。"), []);
      // 助数詞が折り返しをまたいでも（年\n度）、残りは助数詞の語の後ろから。
      assert.deepEqual(kanjiWords("2026年\n度東京都港区新橋二丁目に置く。"), []);
      assert.deepEqual(kanjiWords("2026年\n度東京都港区新橋二丁目課に置く。"), ["東京都港区新橋二丁目課"]);
      assert.deepEqual(kanjiWords("昭和41年7月1日新東京国際空港公団が発足した。"), []);
      assert.deepEqual(kanjiWords("7月1日新東京国際空港公団総務部長が着任した。"), ["新東京国際空港公団総務部長"]);
    });

    it("同じ連なりが文に二度出れば、それぞれの位置で助数詞かどうかを読む", () => {
      assert.deepEqual(kanjiWords("2026年度予算編成基本方針と年度予算編成基本方針を比べる。"), ["年度予算編成基本方針"]);
      assert.deepEqual(kanjiWords("年度予算編成基本方針と2026年度予算編成基本方針を比べる。"), ["年度予算編成基本方針"]);
    });

    it("invalid: 漢数字の後ろの助数詞と、助数詞でない語は数える", () => {
      // 漢数字は連なりの一部で、数と助数詞も連なりの中にある。
      assert.deepEqual(kanjiWords("第三回情報処理推進機構の試験です。"), ["第三回情報処理推進機構"]);
      // 会計は助数詞ではない（令和6年版情報通信白書）。
      // 括弧で閉じた題の名前（「2021会計年度国防授権法」）は title-ending で数えないので、文の中に置く。
      assert.deepEqual(kanjiWords("米国の2021会計年度国防授権法を参照する。"), ["会計年度国防授権法"]);
      assert.deepEqual(kanjiWords("第3回情報処理推進機構認定試験です。"), ["情報処理推進機構認定試験"]);
    });

    it("valid: 辞書が 1 語の固有名詞と読む名前は、書き手が変えられないので数えない", () => {
      assert.ok(!idsFor("新東京国際空港公団が発表した。").includes("max-kanji-continuous"));
      assert.ok(!idsFor("動力炉核燃料開発事業団の報告を読む。").includes("max-kanji-continuous"));
    });

    it("valid: 組織の名前は、書き手が変えられないので数えない（語彙表 organisation-form・organisation-unit）", () => {
      // 法人格で始まり組織の語で閉じる。経済産業省の報道発表にある研究所の名前。
      assert.ok(!idsFor("国立研究開発法人産業技術総合研究所が参加します。").includes("max-kanji-continuous"));
      // 地名で始まり組織の語で閉じる。紀美野町のお知らせにある会議と組織の名前。
      assert.ok(!idsFor("紀美野町青少年育成町民会議が主催します。").includes("max-kanji-continuous"));
      assert.ok(!idsFor("下神野地区自主防災組織が訓練をしました。").includes("max-kanji-continuous"));
      assert.ok(!idsFor("日本経済団体連合会が提言した。").includes("max-kanji-continuous"));
      // 組織の語で閉じる区切りが続く（〜省〜局〜課、住所の後ろの役場・部・課）。
      assert.ok(!idsFor("経済産業省製造産業局自動車課に問い合わせる。").includes("max-kanji-continuous"));
      assert.ok(!idsFor("新東京国際空港公団総務部に届ける。").includes("max-kanji-continuous"));
      // デジタル庁のサービスデザインガイドラインにある学部名。
      assert.ok(!idsFor("武蔵野美術大学造形構想学部の教員が参加した。").includes("max-kanji-continuous"));
      assert.ok(!idsFor("東京都知事選挙管理委員会事務局に問い合わせる。").includes("max-kanji-continuous"));
      assert.ok(!idsFor("埼玉県市町村総合事務組合に問い合わせる。").includes("max-kanji-continuous"));
      assert.ok(!idsFor("東京都港区政策経営部に届ける。").includes("max-kanji-continuous"));
      assert.ok(!idsFor("和歌山県海草郡紀美野町役場総務課に届ける。").includes("max-kanji-continuous"));
      // 名前の後ろに立つ法人格で閉じる会社の名前（有価証券報告書の契約先の形）。
      assert.ok(!idsFor("当社は東日本青葉自動車販売株式会社と契約した。").includes("max-kanji-continuous"));
    });

    it("invalid: 法人格で閉じない長い連なりは数える（法人格の後ろに語が続く）", () => {
      assert.ok(idsFor("当社は東日本青葉自動車販売株式会社営業推進課題を検討した。").includes("max-kanji-continuous"));
    });

    it("invalid: 名前に普通の語が続く語、名前の並び、辞書が固有名詞と読まない正式名称は数える", () => {
      // 頭に法人格も地名も無い 1 区切りは、書き手が組み立てた語と見分けられない。
      assert.ok(idsFor("個人情報保護法施行規則改正案検討会が開かれた。").includes("max-kanji-continuous"));
      assert.ok(idsFor("社会課題解決推進会議を開きます。").includes("max-kanji-continuous"));
      assert.ok(idsFor("田中一郎山田花子佐藤次郎が出席した。").includes("max-kanji-continuous"));
      // デジタル庁のプライバシーポリシーにある委員会名。形態素解析は 個人/情報/保護/委員/会 と普通の語に割る。
      assert.ok(idsFor("個人情報保護委員会規則に従う。").includes("max-kanji-continuous"));
    });

    it("valid: 題の名前（語彙表 title-ending で閉じ、題の置き方をしたもの）は数えない", () => {
      // 一行だけの要綱の題と、補いの括弧が付いたリンクの文字（大阪市の公募型比較見積のページ）。
      assert.deepEqual(kanjiWords("大阪市鶴見区役所公募型比較見積実施要綱\n"), []);
      assert.deepEqual(kanjiWords("- 大阪市鶴見区公募型比較見積実施要綱(PDF形式, 327.89KB)\n"), []);
      // 補いの括弧が付いた試験の名前と、括弧を閉じる事業の名前。
      assert.deepEqual(kanjiWords("国家公務員中途採用者選考試験（就職氷河期世代）を活用します。"), []);
      assert.deepEqual(kanjiWords("「令和8年度高度統計人材育成強化拠点形成事業」について、公募を開始します。"), []);
      // 略称を定めた名前は、文書のほかの所で文の中に置いても名前。
      const defined = "認定職業訓練実施奨励金（以下「奨励金」という。）を支給する。\n\n認定職業訓練実施奨励金の支給額を示す。\n";
      assert.deepEqual(kanjiWords(defined), []);
      // 見出しにある名前は、文の中でも名前。
      assert.deepEqual(kanjiWords("## 業務委託公募型比較見積案件\n\n本庁舎の業務委託公募型比較見積案件について。\n"), []);
      // 隅付き括弧の中身がまるごとの名前。
      assert.deepEqual(kanjiWords("【浪速区役所公募型比較見積】消火器の買入\n"), []);
      // 数に付く接頭の語（第172条の第）は連なりに数えない。
      assert.deepEqual(kanjiWords("様式は地方自治法施行令第172条のとおりです。"), []);
      // 数が折り返しの次の行に送られても。
      assert.deepEqual(kanjiWords("様式は地方自治法施行令第\n１７２条のとおりです。"), []);
    });

    it("invalid: 題を閉じる語で終わっても、題の置き方をしていなければ数える", () => {
      assert.deepEqual(kanjiWords("情報処理推進機構認定試験の受験者が増えました。"), ["情報処理推進機構認定試験"]);
      assert.deepEqual(kanjiWords("来年度は新規顧客獲得施策検討計画を立てる。"), ["新規顧客獲得施策検討計画"]);
      // 一行だけでも、題を閉じる語で終わらなければ数える。
      assert.deepEqual(kanjiWords("新規顧客獲得施策検討会議\n"), ["新規顧客獲得施策検討会議"]);
      // 括弧の途中で終わる連なり。
      assert.deepEqual(kanjiWords("「情報処理推進機構認定試験の案内」を読む。"), ["情報処理推進機構認定試験"]);
      // 見出しにあっても、題を閉じる語で終わらない連なりは数える。
      assert.deepEqual(kanjiWords("## 新規顧客獲得施策検討会議\n\n新規顧客獲得施策検討会議を開く。\n"), ["新規顧客獲得施策検討会議"]);
      // 接頭の語の後ろが数でなければ（第一条）、連なりの一部。
      assert.deepEqual(kanjiWords("地方自治法施行令第一条第二項を読む。"), ["地方自治法施行令第一条第二項"]);
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

    // message は「（3 回まで）」と言う。3 回は許した数なので、指摘は 4 回目から。
    const humble = (times: number): string =>
      ["検討", "調整", "確認", "報告", "共有"]
        .slice(0, times)
        .map((verb) => `${verb}させていただきます。`)
        .join("");
    const counted = (source: string, level: "strict" | "normal"): Finding | undefined =>
      runRules(buildDocument("t.md", source, ja), RULES, { "sasete-itadaku": level }, true, "business/report").findings.find(
        (finding) => finding.rule === "sasete-itadaku",
      );

    it("valid: 上限（normal は 3 回）ちょうどは指摘しない", () => {
      assert.equal(counted(humble(3), "normal"), undefined);
    });

    it("invalid: 上限を 1 回超えたら指摘し、回数は上限より多い", () => {
      assert.deepEqual([counted(humble(4), "normal")?.values["count"], counted(humble(4), "normal")?.values["limit"]], [4, 3]);
    });

    it("strict は 1 回を通し、2 回目から言う（why の「1 度なら丁寧」）", () => {
      assert.equal(counted(humble(1), "strict"), undefined);
      assert.equal(counted(humble(2), "strict")?.values["count"], 2);
    });

    it("数えるのは文ではなく出現。一文に二度あれば二回", () => {
      assert.equal(counted("資料を配布させていただき、内容を説明させていただきます。", "strict")?.values["count"], 2);
    });

    it("可能と打ち消しの形（させていただける・させていただけない）も数える", () => {
      assert.equal(counted("ご案内させていただけますか。今回は参加させていただけないそうです。", "strict")?.values["count"], 2);
      assert.equal(counted("ご案内させて頂けますか。今回は参加させて戴けないそうです。", "strict")?.values["count"], 2);
    });

    it("指摘は書いた形の語を言う（させていただける を せていただける と言わない）", () => {
      const matched = (source: string): unknown[] =>
        runRules(buildDocument("t.md", source, ja), RULES, { "sasete-itadaku": "strict" }, true, "business/report")
          .findings.filter((finding) => finding.rule === "sasete-itadaku")
          .map((finding) => finding.values["matched"]);
      assert.deepEqual(matched("ご案内させていただけますか。参加させて頂けますか。参加させて戴けますか。"), [
        "させていただける",
        "させて頂ける",
        "させて戴ける",
      ]);
      assert.deepEqual(matched("読ませていただきました。休ませていただきます。"), ["せていただく", "せていただく"]);
      assert.deepEqual(matched("読ませていただき、確認させていただきます。"), ["せていただく"]);
    });

    it("五段動詞の形（読ませていただく）も数え、「させていただく」と重なっても一回", () => {
      assert.equal(counted("資料を読ませていただきました。明日は休ませていただきます。", "strict")?.values["count"], 2);
      assert.equal(counted("確認させていただきます。", "strict"), undefined);
    });

    it("使役のない「いただく」「いただける」は数えない", () => {
      assert.equal(counted("ご確認いただけますか。お知らせいただきました。日程を知らせていただきました。", "strict"), undefined);
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
