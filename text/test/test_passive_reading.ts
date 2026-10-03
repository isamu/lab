import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { outsideTheReport, passiveVocabulary, readsAsPassive, type PassiveVocabulary } from "../packages/lang-ja/src/passive-reading.ts";
import type { Morpheme } from "../packages/lang-ja/src/counter-tsu.ts";
import type { Lexicon } from "../packages/chaff/src/plugin.ts";

const lexiconOf = (...patterns: string[]): Lexicon => patterns.map((pattern) => ({ pattern, weight: undefined, instead_of: undefined }));

const VOCABULARY: PassiveVocabulary = passiveVocabulary({
  "spontaneous-verb": lexiconOf("考える", "思う"),
  "stative-passive-verb": lexiconOf("含む", "適用", "定める"),
  "honorific-formula": lexiconOf("におかれましては", "におかれては、"),
  "intransitive-verb": lexiconOf("来る", "取り組む", "参加", "辞任"),
  "naming-verb": lexiconOf("呼ぶ"),
});

/**
 * "決定/名詞,サ変接続 さ/動詞,自立,する れる/動詞,接尾,れる" の形で書いた列を形態素にする。原形を省けば表層と同じ。
 * 四つ目は活用の型（"変え/動詞,自立,変える,一段"）。
 */
const morphemesOf = (source: string): Morpheme[] =>
  source.split(" ").map((entry) => {
    const [surface = "", tags = ""] = entry.split("/");
    const [pos = "", detail = "*", basic = surface, conjugation] = tags.split(",");
    return {
      surface_form: surface,
      pos,
      pos_detail_1: detail,
      pos_detail_2: "*",
      basic_form: basic,
      ...(conjugation === undefined ? {} : { conjugated_type: conjugation }),
    };
  });

const passiveIndex = (morphemes: readonly Morpheme[]): number => morphemes.findIndex((morpheme) => morpheme.pos_detail_1 === "接尾" && morpheme.pos === "動詞");

const passiveAt = (source: string, vocabulary: PassiveVocabulary = VOCABULARY): boolean => {
  const morphemes = morphemesOf(source);
  return readsAsPassive(morphemes, passiveIndex(morphemes), vocabulary);
};

const outsideAt = (source: string): boolean => {
  const morphemes = morphemesOf(source);
  return outsideTheReport(morphemes, passiveIndex(morphemes));
};

/** Whether agentless-passive reports the source, named in chaff.yaml: business documents leave it off by measurement (spec §21.1). */
const reported = (source: string): boolean =>
  runRules(buildDocument("t.md", source, ja), loadRules("ja"), { "agentless-passive": "normal" }, true, "business/report").findings.some(
    (finding) => finding.rule === "agentless-passive",
  );

describe("readsAsPassive: 受動と読める「れる/られる」", () => {
  it("ふつうの動詞に付いた「れる/られる」は受動", () => {
    assert.equal(passiveAt("方針/名詞,一般 が/助詞,格助詞 決定/名詞,サ変接続 さ/動詞,自立,する れ/動詞,接尾,れる た/助動詞"), true);
    assert.equal(passiveAt("協力/名詞,サ変接続 が/助詞,格助詞 求め/動詞,自立,求める られ/動詞,接尾,られる ます/助動詞"), true);
  });

  it("自発の動詞に付いた「れる/られる」は受動ではない", () => {
    assert.equal(passiveAt("必要/名詞,形容動詞語幹 と/助詞,格助詞 考え/動詞,自立,考える られる/動詞,接尾,られる"), false);
    assert.equal(passiveAt("よい/形容詞,自立 と/助詞,格助詞 思わ/動詞,自立,思う れる/動詞,接尾,れる"), false);
  });

  it("自発の動詞でも、述語が過去なら誰かの考えた動作の受動", () => {
    assert.equal(passiveAt("案/名詞,一般 が/助詞,格助詞 考え/動詞,自立,考える られ/動詞,接尾,られる まし/助動詞,*,ます た/助動詞,*,た"), true);
    assert.equal(passiveAt("と/助詞,格助詞 考え/動詞,自立,考える られ/動詞,接尾,られる て/助詞,接続助詞 い/動詞,非自立,いる た/助動詞,*,た"), true);
    assert.equal(passiveAt("と/助詞,格助詞 考え/動詞,自立,考える られ/動詞,接尾,られる て/助詞,接続助詞 き/動詞,非自立,くる た/助動詞,*,た"), true);
  });

  it("過去の「た」が述語の外にあれば、自発のまま", () => {
    // 「たい」は過去ではない。読点や名詞で述語は終わる。
    assert.equal(passiveAt("と/助詞,格助詞 思わ/動詞,自立,思う れ/動詞,接尾,れる たい/助動詞,*,たい"), false);
    assert.equal(passiveAt("と/助詞,格助詞 考え/動詞,自立,考える られ/動詞,接尾,られる て/助詞,接続助詞 い/動詞,非自立,いる ます/助動詞,*,ます"), false);
    assert.equal(passiveAt("と/助詞,格助詞 考え/動詞,自立,考える られる/動詞,接尾,られる 、/記号,読点 会議/名詞,一般 だっ/助動詞,*,だ た/助動詞,*,た"), false);
    assert.equal(passiveAt("と/助詞,格助詞 考え/動詞,自立,考える られる/動詞,接尾,られる が/助詞,接続助詞 済ん/動詞,自立,済む だ/助動詞,*,た"), false);
    // 「からだった」の過去は、理由を述べる文の述語のもの。
    assert.equal(passiveAt("と/助詞,格助詞 考え/動詞,自立,考える られる/動詞,接尾,られる から/助詞,接続助詞 だっ/助動詞,*,だ た/助動詞,*,た"), false);
  });

  it("関係を表す動詞は、過去でも受動ではない", () => {
    assert.equal(passiveAt("個人/名詞,一般 も/助詞,係助詞 含ま/動詞,自立,含む れ/動詞,接尾,れる て/助詞,接続助詞 い/動詞,非自立,いる た/助動詞,*,た"), false);
  });

  it("関係を表す動詞に付いた「れる/られる」は受動ではない", () => {
    assert.equal(passiveAt("個人/名詞,一般 も/助詞,係助詞 含ま/動詞,自立,含む れる/動詞,接尾,れる"), false);
  });

  it("補助動詞（動詞,非自立）に付いた「れる/られる」は受動のまま。尊敬の「務めてこられた」と受動の「連れてこられた」は形で分けられない", () => {
    assert.equal(passiveAt("連れ/動詞,自立,連れる て/助詞,接続助詞 こ/動詞,非自立,くる られ/動詞,接尾,られる た/助動詞"), true);
    assert.equal(passiveAt("持っ/動詞,自立,持つ て/助詞,接続助詞 いか/動詞,非自立,いく れ/動詞,接尾,れる た/助動詞"), true);
  });

  it("本動詞に付いて後ろに補助動詞が続く受動は受動のまま", () => {
    assert.equal(passiveAt("使わ/動詞,自立,使う れ/動詞,接尾,れる て/助詞,接続助詞 き/動詞,非自立,くる た/助動詞"), true);
  });

  it("尊敬の決まり文句の中の「れ」は受動ではない", () => {
    assert.equal(passiveAt("学校/名詞,一般 に/助詞,格助詞 おか/動詞,自立,おく れ/動詞,接尾,れる て/助詞,接続助詞 は/助詞,係助詞 、/記号,読点"), false);
    assert.equal(passiveAt("参考人/名詞,一般 に/助詞,格助詞 おか/動詞,自立,おく れ/動詞,接尾,れる まし/助動詞 て/助詞,接続助詞 は/助詞,係助詞"), false);
  });

  it("決まり文句が途中で切れていれば受動のまま", () => {
    // 漢字の「置かれた」は物を置いた受動。決まり文句は仮名の「おかれては」だけ。
    assert.equal(passiveAt("机/名詞,一般 に/助詞,格助詞 置か/動詞,自立,置く れ/動詞,接尾,れる た/助動詞"), true);
    assert.equal(passiveAt("机/名詞,一般 に/助詞,格助詞 おか/動詞,自立,おく れ/動詞,接尾,れる た/助動詞"), true);
    assert.equal(
      passiveAt("通路/名詞,一般 に/助詞,格助詞 おか/動詞,自立,おく れ/動詞,接尾,れる て/助詞,接続助詞 は/助詞,係助詞 なら/動詞,自立,なる ない/助動詞"),
      true,
    );
  });

  it("決まり文句は「れ」を覆っていなければ関係しない", () => {
    // 「決定さ」は語の区切りから始まるが、「れ」の手前で終わる。
    const vocabulary = passiveVocabulary({ "honorific-formula": lexiconOf("決定さ") });
    assert.equal(passiveAt("決定/名詞,サ変接続 さ/動詞,自立,する れ/動詞,接尾,れる た/助動詞", vocabulary), true);
  });

  it("語彙表が空なら、形の決まりだけで読む", () => {
    const empty = passiveVocabulary({});
    assert.equal(passiveAt("必要/名詞,形容動詞語幹 と/助詞,格助詞 考え/動詞,自立,考える られる/動詞,接尾,られる", empty), true);
    assert.equal(passiveAt("個人/名詞,一般 も/助詞,係助詞 含ま/動詞,自立,含む れる/動詞,接尾,れる", empty), true);
    assert.equal(passiveAt("学校/名詞,一般 に/助詞,格助詞 おか/動詞,自立,おく れ/動詞,接尾,れる て/助詞,接続助詞 は/助詞,係助詞", empty), true);
  });

  it("「れる/られる」でない語や範囲の外は受動ではない", () => {
    const morphemes = morphemesOf("方針/名詞,一般 が/助詞,格助詞 決定/名詞,サ変接続 さ/動詞,自立,する");
    assert.equal(readsAsPassive(morphemes, 0, VOCABULARY), false);
    assert.equal(readsAsPassive(morphemes, 3, VOCABULARY), false);
    assert.equal(readsAsPassive(morphemes, 99, VOCABULARY), false);
    assert.equal(readsAsPassive([], 0, VOCABULARY), false);
  });

  it("前の語が動詞でなければ、語彙表の語と同じ字でも受動のまま", () => {
    assert.equal(passiveAt("考える/名詞,一般 れる/動詞,接尾,れる"), true);
  });

  it("先頭の「れる」も読める", () => {
    assert.equal(readsAsPassive(morphemesOf("れる/動詞,接尾,れる"), 0, VOCABULARY), true);
  });

  it("「おる」に付いた「れる」は尊敬。「おる」には受動が無い", () => {
    assert.equal(
      passiveAt("参加/名詞,サ変接続 を/助詞,格助詞 し/動詞,自立,する て/助詞,接続助詞 おら/動詞,自立,おる れ/動詞,接尾,れる まし/助動詞 た/助動詞"),
      false,
    );
    assert.equal(passiveAt("務め/動詞,自立,務める て/助詞,接続助詞 おら/動詞,非自立,おる れる/動詞,接尾,れる"), false);
  });

  it("お・ご・御 を付けた「される」は受動のまま。謙譲の「ご用意する」の受動と、尊敬の「お会いされる」は形で分けられない", () => {
    assert.equal(
      passiveAt("資料/名詞,一般 が/助詞,格助詞 ご/接頭詞,名詞接続 用意/名詞,サ変接続 さ/動詞,自立,する れ/動詞,接尾,れる まし/助動詞 た/助動詞"),
      true,
    );
    assert.equal(passiveAt("お/接頭詞,動詞接続 会い/動詞,自立,会う さ/動詞,自立,する れ/動詞,接尾,れる た/助動詞"), true);
  });

  it("受動を作らない自動詞の「れる/られる」は受動ではない（尊敬か可能）", () => {
    assert.equal(passiveAt("町/名詞,一般 へ/助詞,格助詞 来ら/動詞,自立,来る れ/動詞,接尾,れる"), false);
    assert.equal(passiveAt("熱心/名詞,形容動詞語幹 に/助詞,格助詞 取り組ま/動詞,自立,取り組む れ/動詞,接尾,れる て/助詞,接続助詞"), false);
    assert.equal(passiveAt("委員/名詞,一般 を/助詞,格助詞 辞任/名詞,サ変接続 さ/動詞,自立,する れ/動詞,接尾,れる"), false);
  });

  it("受け入れた限界: 自動詞の迷惑の受身は尊敬と形で分けられず、受動に数えない", () => {
    assert.equal(passiveAt("家/名詞,一般 に/助詞,格助詞 来ら/動詞,自立,来る れ/動詞,接尾,れる て/助詞,接続助詞 困っ/動詞,自立,困る た/助動詞"), false);
  });

  it("補助動詞の「てこられた」は、自動詞の語彙表に「来る」があっても受動のまま", () => {
    assert.equal(passiveAt("連れ/動詞,自立,連れる て/助詞,接続助詞 こ/動詞,非自立,来る られ/動詞,接尾,られる た/助動詞"), true);
  });

  it("サ変名詞は「する」の直前にあるときだけ自動詞として見る", () => {
    assert.equal(passiveAt("参加/名詞,サ変接続 を/助詞,格助詞 さ/動詞,自立,する れ/動詞,接尾,れる た/助動詞"), true);
    assert.equal(passiveAt("選任/名詞,サ変接続 さ/動詞,自立,する れ/動詞,接尾,れる まし/助動詞 た/助動詞"), true);
    // 「出席求められた」の受動は「求める」のもの。サ変名詞が前にあっても「する」でなければ見ない。
    assert.equal(passiveAt("参加/名詞,サ変接続 求め/動詞,自立,求める られ/動詞,接尾,られる た/助動詞"), true);
  });

  it("「〜と呼ばれる」は名付けで、誰かの動作を隠していない", () => {
    assert.equal(passiveAt("端末/名詞,一般 と/助詞,格助詞,引用 呼ば/動詞,自立,呼ぶ れる/動詞,接尾,れる"), false);
    assert.equal(passiveAt("WAF/名詞,固有名詞 と/助詞,格助詞 も/助詞,係助詞 呼ば/動詞,自立,呼ぶ れ/動詞,接尾,れる て/助詞,接続助詞"), false);
  });

  it("「と」の付かない「呼ばれる」は、呼び出す動作の受動", () => {
    assert.equal(passiveAt("参議院/名詞,固有名詞 に/助詞,格助詞 は/助詞,係助詞 呼ば/動詞,自立,呼ぶ れる/動詞,接尾,れる"), true);
    assert.equal(passiveAt("会議/名詞,一般 に/助詞,格助詞 呼ば/動詞,自立,呼ぶ れ/動詞,接尾,れる た/助動詞"), true);
  });
});

describe("agentless-passive（日本語）: 受動でない「れる/られる」", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("valid: 自発の「考えられる」「思われる」「解される」は指摘しない", () => {
    [
      "引継ぎ義務を明記しておくことが望ましいと考えられる。",
      "問題ないと思われます。",
      "感染経路は経口感染と考えられています。",
      "学術研究目的とは解されない。",
    ].forEach((source) => assert.equal(reported(source), false, source));
  });

  it("valid: 関係を表す「含まれる」「限られる」は指摘しない", () => {
    ["報道機関には個人も含まれる。", "治療は対症療法に限られます。"].forEach((source) => assert.equal(reported(source), false, source));
  });

  it("valid: 尊敬の「におかれましては」は指摘しない", () => {
    [
      "参考人におかれましては、御出席いただきありがとうございました。",
      "各学校設置者におかれては、対策を検討すること。",
      "各事業者におかれては，適切に対応すること。",
      "各事業者におかれては,適切に対応すること。",
    ].forEach((source) => assert.equal(reported(source), false, source));
  });

  it("invalid: 誰かのした動作の受動は指摘する", () => {
    [
      "方針が決定された。",
      "予算案が承認されました。",
      "一定の協力が求められます。",
      "書類は机の上に置かれた。",
      "コンテナは軽量だといわれます。",
      "この件は重要とされている。",
      "顧客データが外部に持っていかれた。",
      "備品が通路におかれてはならない。",
      "新しい方式が考え出された。",
      "代替案は会議で考えられました。",
      "代替案は会議で考えられてはいなかった。",
      "その案も考えられてもいた。",
      "当初は安全と考えられていた。",
      "影響額は予算に見込まれていません。",
    ].forEach((source) => assert.equal(reported(source), true, source));
  });

  it("valid: 尊敬の「れる/られる」は、形に表れるものを指摘しない", () => {
    [
      "林参考人も参加をしておられました。",
      "大変忙しい中、町へ来られ、講演をいただきました。",
      "参加者は防災グッズの作成に熱心に取り組まれておりました。",
      "山田君が委員を辞任されました。",
      "当日は多くの方が参加されました。",
    ].forEach((source) => assert.equal(reported(source), false, source));
  });

  it("valid: 名付けの「〜と呼ばれる」は指摘しない", () => {
    ["この端末は「ステーション」などとも呼ばれます。", "WAF（ワフ）とも呼ばれています。", "この方式は二段階認証と呼ばれる。"].forEach((source) =>
      assert.equal(reported(source), false, source),
    );
  });

  it("invalid: 尊敬と形で分けられない受動は指摘する", () => {
    [
      "方針が決定された。",
      "担当者の判断で問題ないと判断されました。",
      "山田君が委員に選任されました。",
      "林参考人も言われました。",
      "お客様が研修を受けられた。",
      "資料がご用意されました。",
      "書類は会議に呼ばれた人に配られた。",
      "担当者は会議に呼ばれました。",
      "データが再利用されました。",
      "被告人は証人に連れてこられた。",
    ].forEach((source) => assert.equal(reported(source), true, source));
  });

  it("invalid: 尊敬の述語と同じ文にほかの受動があれば、そちらを指摘する", () => {
    assert.equal(reported("山田君が委員を辞任され、その補欠として佐藤君が選任されました。"), true);
  });

  it("invalid: 自発の文と同じ文にほかの受動があれば、そちらを指摘する", () => {
    assert.equal(reported("検討課題が相当残されていると思われます。"), true);
  });
});

describe("readsAsPassive: 状態・決まりの受動、ら抜き、可能", () => {
  it("状態や決まりを言う動詞は、サ変名詞も「する」の前で見る", () => {
    assert.equal(passiveAt("各号/名詞,一般 が/助詞,格助詞 適用/名詞,サ変接続 さ/動詞,自立,する れる/動詞,接尾,れる"), false);
    assert.equal(passiveAt("法令/名詞,一般 で/助詞,格助詞 定め/動詞,自立,定める られ/動詞,接尾,られる て/助詞,接続助詞 いる/動詞,非自立,いる"), false);
  });

  it("サ変名詞が「する」の直前になければ見ない", () => {
    assert.equal(passiveAt("適用/名詞,サ変接続 を/助詞,格助詞 さ/動詞,自立,する れ/動詞,接尾,れる まし/助動詞,*,ます"), true);
  });

  it("「た」で終わる出来事は、状態の動詞でも誰かのした動作の受動", () => {
    assert.equal(passiveAt("割引/名詞,一般 が/助詞,格助詞 適用/名詞,サ変接続 さ/動詞,自立,する れ/動詞,接尾,れる まし/助動詞,*,ます た/助動詞,*,た"), true);
    assert.equal(passiveAt("規程/名詞,一般 が/助詞,格助詞 定め/動詞,自立,定める られ/動詞,接尾,られる た/助動詞,*,た"), true);
  });

  it("「ていた」は過去の状態で、状態の動詞なら受動に数えない", () => {
    assert.equal(
      passiveAt("法令/名詞,一般 で/助詞,格助詞 定め/動詞,自立,定める られ/動詞,接尾,られる て/助詞,接続助詞 い/動詞,非自立,いる た/助動詞,*,た"),
      false,
    );
  });

  it("一段動詞に直に付いた「れる」は、ら抜きか誤字の読み違いで受動ではない", () => {
    assert.equal(passiveAt("と/助詞,格助詞 とらえ/動詞,自立,とらえる,一段 れ/動詞,接尾,れる いただけれ/動詞,自立,いただける"), false);
  });

  it("五段動詞の「れる」と一段動詞の「られる」は受動のまま", () => {
    assert.equal(passiveAt("会議/名詞,一般 で/助詞,格助詞 決め/動詞,自立,決める,一段 られ/動詞,接尾,られる た/助動詞,*,た"), true);
    assert.equal(passiveAt("注文/名詞,サ変接続 を/助詞,格助詞 断ら/動詞,自立,断る,五段・ラ行 れ/動詞,接尾,れる た/助動詞,*,た"), true);
  });

  it("一段動詞の「られる」に打ち消しが直に続けば、可能に読む", () => {
    assert.equal(passiveAt("他人/名詞,一般 は/助詞,係助詞 変え/動詞,自立,変える,一段 られ/動詞,接尾,られる ない/助動詞,*,ない"), false);
    assert.equal(passiveAt("質問/名詞,サ変接続 に/助詞,格助詞 答え/動詞,自立,答える,一段 られ/動詞,接尾,られる ず/助動詞,*,ぬ"), false);
  });

  it("「ている」を挟んだ打ち消しや、一段でない動詞の打ち消しは受動のまま", () => {
    assert.equal(
      passiveAt("設定/名詞,サ変接続 は/助詞,係助詞 変え/動詞,自立,変える,一段 られ/動詞,接尾,られる て/助詞,接続助詞 い/動詞,非自立,いる ない/助動詞,*,ない"),
      true,
    );
    assert.equal(passiveAt("評価/名詞,サ変接続 さ/動詞,自立,する,サ変・スル れ/動詞,接尾,れる ない/助動詞,*,ない"), true);
  });
});

describe("outsideTheReport: 文が報告する動作の外にある受動", () => {
  it("仮定の「ば」「と」の節は外", () => {
    assert.equal(outsideAt("立証/名詞,サ変接続 さ/動詞,自立,する れれ/動詞,接尾,れる ば/助詞,接続助詞"), true);
    assert.equal(outsideAt("整理/名詞,サ変接続 さ/動詞,自立,する れ/動詞,接尾,れる て/助詞,接続助詞 いる/動詞,非自立,いる と/助詞,接続助詞"), true);
  });

  it("逆接の「が」「けど」の節は、起きたことを言い切っているので報告の中", () => {
    assert.equal(
      outsideAt("確認/名詞,サ変接続 さ/動詞,自立,する れ/動詞,接尾,れる て/助詞,接続助詞 い/動詞,非自立,いる ない/助動詞,*,ない が/助詞,接続助詞 、/記号,読点"),
      false,
    );
    assert.equal(outsideAt("共有/名詞,サ変接続 さ/動詞,自立,する れ/動詞,接尾,れる た/助動詞,*,た けど/助詞,接続助詞"), false);
  });

  it("義務の「なければならない」の「ば」は仮定ではない", () => {
    assert.equal(
      outsideAt("見直さ/動詞,自立,見直す れ/動詞,接尾,れる なけれ/助動詞,*,ない ば/助詞,接続助詞 なり/動詞,自立,なる ませ/助動詞,*,ます ん/助動詞,*,ん"),
      false,
    );
    assert.equal(outsideAt("図ら/動詞,自立,図る れ/動詞,接尾,れる なけれ/助動詞,*,ない ば/助詞,接続助詞 いけ/動詞,自立,いける ない/助動詞,*,ない"), false);
    assert.equal(
      outsideAt(
        "統一/名詞,サ変接続 さ/動詞,自立,する れ/動詞,接尾,れる て/助詞,接続助詞 い/動詞,非自立,いる なけれ/助動詞,*,ない ば/助詞,接続助詞 、/記号,読点",
      ),
      true,
    );
  });

  it("起きやすさ・起こりうることを言う形は外", () => {
    ["やすい/形容詞,非自立", "にくい/形容詞,非自立", "づらい/形容詞,非自立", "得る/動詞,非自立", "うる/動詞,非自立", "がち/名詞,接尾"].forEach((after) =>
      assert.equal(outsideAt(`理解/名詞,サ変接続 さ/動詞,自立,する れ/動詞,接尾,れる ${after}`), true, after),
    );
  });

  it("文末、「〜され、」で続く述語、理由の「ので」は報告の中", () => {
    assert.equal(
      outsideAt("確認/名詞,サ変接続 さ/動詞,自立,する れ/動詞,接尾,れる て/助詞,接続助詞 い/動詞,非自立,いる ませ/助動詞,*,ます ん/助動詞,*,ん 。/記号,句点"),
      false,
    );
    assert.equal(outsideAt("変更/名詞,サ変接続 さ/動詞,自立,する れ/動詞,接尾,れる 、/記号,読点"), false);
    assert.equal(outsideAt("紛失/名詞,サ変接続 さ/動詞,自立,する れ/動詞,接尾,れる た/助動詞,*,た ので/助詞,接続助詞"), false);
    assert.equal(outsideAt("決定/名詞,サ変接続 さ/動詞,自立,する れる/動詞,接尾,れる"), false);
  });

  it("引用の「と」（格助詞）は接続助詞の「と」ではない", () => {
    assert.equal(outsideAt("残さ/動詞,自立,残す れ/動詞,接尾,れる て/助詞,接続助詞 いる/動詞,非自立,いる と/助詞,格助詞 思わ/動詞,自立,思う"), false);
  });

  it("空の列や、後ろに何も無い「れる」でも投げない", () => {
    assert.equal(outsideTheReport([], 0), false);
    assert.equal(outsideTheReport(morphemesOf("れる/動詞,接尾,れる"), 0), false);
  });
});

describe("agentless-passive（日本語）: 状態・決まり・文書の中身を言う受動", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("valid: 決まりや分類を言う受動は指摘しない", () => {
    [
      "本規程は、全社員に適用される。",
      "対象の機器は3つに分類されています。",
      "申請の様式は法令上定められていない。",
      "この手当は就業規則で規定されている。",
      "委員会は5名で構成されている。",
      "上位の規程が優先される。",
      "複数の書面を合わせて一つの記録とすることは妨げられない。",
      "本部の役割は中期計画の柱として位置付けられている。",
    ].forEach((source) => assert.equal(reported(source), false, source));
  });

  it("valid: 文書の中身を言う受動は指摘しない", () => {
    [
      "詳細はガイドラインに記載されています。",
      "等風速線が破線で示されています。",
      "利用者の特性が列記されている。",
      "必要な事項が網羅されている。",
      "手順の確認について触れられている。",
      "代表的な手口が挙げられます。",
    ].forEach((source) => assert.equal(reported(source), false, source));
  });

  it("valid: 名詞を修飾する受動、仮定の節、起きやすさの形は指摘しない", () => {
    [
      "定められた手続に従って申請する。",
      "要件が立証されれば、処分の対象となる。",
      "情報が整理されていると、探しやすい。",
      "図があった方が理解されやすい。",
      "受託の現場では勉強会が開催されづらい。",
      "全ての選択肢に誤りがないと解釈され得る。",
    ].forEach((source) => assert.equal(reported(source), false, source));
  });

  it("valid: 可能の「られない」と、ら抜きの読み違いは指摘しない", () => {
    ["他人は変えられないので、自分が動くしかない。", "この線が偏西風の位置ととらえれいただければと思います。"].forEach((source) =>
      assert.equal(reported(source), false, source),
    );
  });

  it("invalid: 責任の所在を隠す受動は指摘する", () => {
    [
      "二次被害は確認されていません。",
      "よくある質問のページを更新することが検討されています。",
      "同条項は早急に削除されるべきです。",
      "国連憲章も見直されなければなりません。",
      "技術の拡散も懸念されます。",
      "申請は業務負担を理由に断られた。",
      "仕様は変更され、担当者が確認した。",
      "二次被害は確認されていないが、担当部署は公表していません。",
      "不正アクセスは認められていません。",
    ].forEach((source) => assert.equal(reported(source), true, source));
  });

  it("invalid: 状態の動詞でも、「た」で終わる出来事は指摘する", () => {
    ["割引が適用されました。", "新しい規程が定められた。", "手当の対象が限定されました。"].forEach((source) => assert.equal(reported(source), true, source));
  });

  it("invalid: 一段動詞の受動と、「ている」を挟んだ打ち消しは指摘する", () => {
    ["設定が変えられた。", "設定はまだ変えられていない。"].forEach((source) => assert.equal(reported(source), true, source));
  });
});
