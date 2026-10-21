import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { withoutWordBrackets } from "../packages/chaff/src/bracket-annotation.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";

// 語の一部として書いた括弧（読みの 拓（ひら）く、添え書きの 栄養教諭（仮称）、条文の項の印 § 1813(h)、引用で改めた一字 [A]）は、
// 括弧の重なりに数えない。例文は、出典を書いたもののほかは自作。

const findingsOf = (source: string): readonly string[] => namedRuleRun("bracket-nesting", source, ja, "a.md", "business/report").findings;
const enFindingsOf = (source: string, genre: string): readonly string[] => namedRuleRun("bracket-nesting", source, en, "a.md", genre).findings;

const annotations = ["仮称", "案"];

describe("bracket-nesting: 語の一部として書いた括弧", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("送り仮名や助詞が続く読みの括弧と、名前のすぐ後ろの添え書きを外す", () => {
    assert.equal(withoutWordBrackets("未来を拓（ひら）く力", annotations), "未来を拓く力");
    assert.equal(withoutWordBrackets("新しい係長（仮称）を置く", annotations), "新しい係長を置く");
    assert.equal(withoutWordBrackets("計画（案）と予算（仮称）", annotations), "計画と予算");
  });

  it("挟んだ言葉、前が空いた括弧、ひらがなの後ろの括弧、語彙表に無い添え書きは残す", () => {
    assert.equal(withoutWordBrackets("本文（氏名（ふりがな））を書く", annotations), "本文（氏名（ふりがな））を書く");
    assert.equal(withoutWordBrackets("これは （仮称） です", annotations), "これは （仮称） です");
    assert.equal(withoutWordBrackets("これは（たぶん）よい", annotations), "これは（たぶん）よい");
    assert.equal(withoutWordBrackets("報告（速報）を出す", annotations), "報告（速報）を出す");
    assert.equal(withoutWordBrackets("対象（すべて）を見る", annotations), "対象（すべて）を見る");
    assert.equal(withoutWordBrackets("これは（仮称）です", annotations), "これは（仮称）です");
    // 読みとしても添え書きとしても当たる括弧は、一度だけ外す。
    assert.equal(withoutWordBrackets("大字（かり）ね", ["かり"]), "大字ね");
  });

  it("引いた題名の中の読みと添え書きは重なりに数えず、本当に三重の括弧は指す", () => {
    assert.deepEqual(findingsOf("当会は「『未来を拓（ひら）く人を育てる』－新しい学びの形－」（答申）で提言した。\n"), []);
    assert.deepEqual(findingsOf("答申は「いわゆる『学習支援員（仮称）』の制度を設ける」と述べた。\n"), []);
    assert.equal(findingsOf("答申は「いわゆる『学習支援員（新設の職）』の制度を設ける」と述べた。\n").length, 1);
  });
});

describe("bracket-nesting: 条文の項の印と、引用で改めた一字", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
    await en.prepare?.({ pos: true });
  });

  it("英字や数字にすぐ続けた短い括弧（§ 1813(h)、5(a)(1)、item(s)）と、角括弧の一字（[A]、[a]ll）を外す", () => {
    assert.equal(withoutWordBrackets("12 U.S.C. § 1813(h) and section 5(a)(1)(iv)", []), "12 U.S.C. § 1813 and section 5");
    assert.equal(withoutWordBrackets("the item(s) listed", []), "the item listed");
    assert.equal(withoutWordBrackets("“[A] musical composition” and “[a]ll questions”", []), "“ musical composition” and “ll questions”");
  });

  it("空けて書いた括弧、長い中身、角括弧の二字以上は残す", () => {
    assert.equal(withoutWordBrackets("section 5 (a) applies", []), "section 5 (a) applies");
    assert.equal(withoutWordBrackets("rules(see note)", []), "rules(see note)");
    assert.equal(withoutWordBrackets("item(12345)", []), "item(12345)");
    assert.equal(withoutWordBrackets("[AB] and [1]", []), "[AB] and [1]");
  });

  it("判決や条文の引用の中の角括弧の一字と項の印は指さず、本当に三重の括弧は指す", () => {
    // 定義の括弧の中の「（以下「PHR」という。）」は三重のまま数える（特許庁の手引きの同じ形が、正しい指摘と判定されている）。
    assert.equal(findingsOf("医療データ等（パーソナル・ヘルス・レコード（以下「PHR」という。））を活用した。\n").length, 1);
    // Micro Star v. FormGen Inc., 154 F.3d 1107 (9th Cir. 1998), a US court opinion in the public domain.
    const citation = "See 1 William F. Patry, Copyright Law and Practice 168 (1994) (“[A] musical composition may be embodied in sheet music….”).\n";
    assert.deepEqual(enFindingsOf(citation, "legal/judgment"), []);
    assert.equal(enFindingsOf("See Patry (1994) (“(A) musical composition may be embodied in sheet music.”).\n", "legal/judgment").length, 1);
    // Federal Reserve SR letter 25-3 (US government work, public domain).
    assert.deepEqual(
      enFindingsOf("(i) an insured bank (as defined in section 3(h) of the Federal Deposit Insurance Act (12 U.S.C. § 1813(h))).\n", "business/email"),
      [],
    );
  });
});
