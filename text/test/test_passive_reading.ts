import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { passiveVocabulary, readsAsPassive, type PassiveVocabulary } from "../packages/lang-ja/src/passive-reading.ts";
import type { Morpheme } from "../packages/lang-ja/src/counter-tsu.ts";
import type { Lexicon } from "../packages/chaff/src/plugin.ts";

const lexiconOf = (...patterns: string[]): Lexicon => patterns.map((pattern) => ({ pattern, weight: undefined, instead_of: undefined }));

const VOCABULARY: PassiveVocabulary = passiveVocabulary({
  "spontaneous-verb": lexiconOf("考える", "思う"),
  "stative-passive-verb": lexiconOf("含む"),
  "honorific-formula": lexiconOf("におかれましては", "におかれては、"),
});

/** "決定/名詞,サ変接続 さ/動詞,自立,する れる/動詞,接尾,れる" の形で書いた列を形態素にする。原形を省けば表層と同じ。 */
const morphemesOf = (source: string): Morpheme[] =>
  source.split(" ").map((entry) => {
    const [surface = "", tags = ""] = entry.split("/");
    const [pos = "", detail = "*", basic = surface] = tags.split(",");
    return { surface_form: surface, pos, pos_detail_1: detail, pos_detail_2: "*", basic_form: basic };
  });

const passiveAt = (source: string, vocabulary: PassiveVocabulary = VOCABULARY): boolean => {
  const morphemes = morphemesOf(source);
  return readsAsPassive(
    morphemes,
    morphemes.findIndex((morpheme) => morpheme.pos_detail_1 === "接尾" && morpheme.pos === "動詞"),
    vocabulary,
  );
};

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
});

describe("agentless-passive（日本語）: 受動でない「れる/られる」", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  const reported = (source: string): boolean =>
    runRules(buildDocument("t.md", source, ja), loadRules("ja"), {}, true, "business/report").findings.some((finding) => finding.rule === "agentless-passive");

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

  it("invalid: 自発の文と同じ文にほかの受動があれば、そちらを指摘する", () => {
    assert.equal(reported("検討課題が相当残されていると思われます。"), true);
  });
});
