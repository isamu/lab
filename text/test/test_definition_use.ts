import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { usesBeforeDefinition, unusedDefinitions, usesOf, type DefinedTerm } from "../packages/chaff/src/structure/definition-use.ts";
import { comparableName, expansionConflicts, expansionsIn, nameBefore } from "../packages/chaff/src/acronym-expansions.ts";
import { deniesSaying } from "../packages/lang-ja/src/denied-saying.ts";

// 定義した語の使い方（unused-definition、use-before-definition）と、略語の展開の食い違い（acronym-expansion-conflict）。例文はすべて自作。

const unused = (source: string, adapter = en): readonly string[] => namedRuleRun("unused-definition", source, adapter, "a.md").findings;
const early = (source: string, adapter = en): readonly string[] => namedRuleRun("use-before-definition", source, adapter, "a.md").findings;
const conflicts = (source: string, adapter = en): readonly string[] => namedRuleRun("acronym-expansion-conflict", source, adapter, "a.md").findings;

const term = (word: string, start: number, inline = true): DefinedTerm => ({ term: word, span: { start, end: start + word.length + 2 }, line: 1, inline });

describe("unused-definition: 定義したのに使っていない語", () => {
  it("defined and never used is reported", () => {
    assert.deepEqual(unused('"Service" means the booking website we run. Users may use the website free of charge.\n'), [
      '"Service" is defined but never used',
    ]);
  });

  it("a use, a plural and a possessive all count as uses", () => {
    assert.deepEqual(unused('"Service" means the booking website we run. Users may use the Service free of charge.\n'), []);
    assert.deepEqual(unused('"Seller" means Harbour Ltd. Both Sellers agree.\n'), []);
    assert.deepEqual(unused('"Policy" means an internal rule. Policies apply to staff.\n'), []);
    assert.deepEqual(unused('"Seller" means Harbour Ltd. The Seller\'s address is below.\n'), []);
  });

  it("a word that only contains the term is not a use", () => {
    assert.deepEqual(unused('"Term" means one year. Termination needs notice.\n'), ['"Term" is defined but never used']);
  });

  it("bold inside the quotes is not part of the term", () => {
    assert.deepEqual(unused("Harbour Ltd (the “**Seller**”) ships the goods. The Seller ships within five days.\n"), []);
  });

  it("a quoted remark is not a definition", () => {
    assert.deepEqual(unused('Try asking ("What do you think about this?") instead.\n'), []);
  });

  it("bare parentheses that the document never uses quote examples, not definitions (#621)", () => {
    const examples = [
      '| Verbs | Plain verbs for what happens, not metaphors ("silently fails") |',
      '| Headings | A heading with no number ("Installation") |',
      'The passive sentences name who did it ("We rolled it out"), because the post says "we".',
    ].join("\n");
    assert.deepEqual(unused(`${examples}\n`), []);
    assert.deepEqual(unused('Harbour Ltd ("Harbour") sells boats to Hill Ltd ("Buyer"). Harbour ships within five days.\n'), [
      '"Buyer" is defined but never used',
    ]);
    assert.deepEqual(unused('Harbour Ltd (the "Seller") sells boats to Hill Ltd.\n'), ['"Seller" is defined but never used']);
    assert.deepEqual(unused('Harbour Ltd ("Seller") sells boats. Write "Seller" in the form.\n'), []);
  });

  it("「X」とは言いません は、言い方を打ち消していて定義ではない（#621）", () => {
    assert.deepEqual(unused("# 方針\n\nどのルールも、それだけで「AI が書いた」とは言いません。人も書く形です。\n", ja), []);
    assert.deepEqual(unused("# 名前\n\n「個人情報保護委員会」を「個人情報保護の委員会」とは書けません。\n", ja), []);
    assert.deepEqual(unused("「本サービス」とは当社が運営する予約のサイトをいう。利用者は、このサイトを無料で使える。\n", ja), [
      "「本サービス」を定義していますが、本文で使っていません",
    ]);
  });

  it("deniesSaying: 読点の無い短い打ち消しの述語だけ", () => {
    const after = (text: string): boolean => deniesSaying(text, 0);
    ["言いません。", "書けません。", "限りません", "言えない。", "呼ばなかった。"].forEach((text) => assert.equal(after(text), true, text));
    [
      "、当社が運営するサイトをいう。",
      "当社が運営する予約のサイトをいう。",
      "、Xではない。",
      "",
      "言いません、しかし",
      "営業日ではありません。",
      "任意ではない。",
    ].forEach((text) => assert.equal(after(text), false, text));
  });

  it("日本語の定義も見る", () => {
    assert.deepEqual(unused("「本サービス」とは、当社が運営する予約のサイトをいう。利用者は、このサイトを無料で使える。\n", ja), [
      "「本サービス」を定義していますが、本文で使っていません",
    ]);
    assert.deepEqual(unused("「本サービス」とは、当社が運営する予約のサイトをいう。利用者は、本サービスを無料で使える。\n", ja), []);
  });

  it("規約やポリシーの丁寧な形（以下「X」といいます、以下、「X」といいます）も定義", () => {
    assert.deepEqual(unused("当社の日記アプリ（以下「本サービス」といいます。）を案内します。利用は無料です。\n", ja), [
      "「本サービス」を定義していますが、本文で使っていません",
    ]);
    assert.deepEqual(unused("当社の日記アプリ（以下、「本サービス」といいます。）を案内します。利用は無料です。\n", ja), [
      "「本サービス」を定義していますが、本文で使っていません",
    ]);
    assert.deepEqual(unused("当社の日記アプリ（以下「本サービス」といいます。）を案内します。本サービスは無料です。\n", ja), []);
  });

  it("地の文の「…と言います」は定義ではない", () => {
    assert.deepEqual(unused("彼は「明日行く」と言います。私もそう言います。\n", ja), []);
    assert.deepEqual(unused("この花を「すずらん」といいます。春に咲きます。\n", ja), []);
    assert.deepEqual(unused("本文では、以下、「本サービス」という見出しを削除します。利用は無料です。\n", ja), []);
    assert.deepEqual(unused("彼は、以下「本サービス」といいかけました。利用は無料です。\n", ja), []);
  });

  it("見出しで使った語は使われている", () => {
    assert.deepEqual(unused("当社のアカウント（以下「当アカウント」といいます。）で発信します。\n\n## 当アカウントの利用\n\n出典を書きます。\n", ja), []);
    assert.deepEqual(unused("当社のアカウント（以下「当アカウント」といいます。）で発信します。\n\n## 利用\n\n出典を書きます。\n", ja), [
      "「当アカウント」を定義していますが、本文で使っていません",
    ]);
  });
});

describe("use-before-definition: 定義より前で使っている語", () => {
  it("a term used before its inline definition is reported once", () => {
    assert.deepEqual(
      early('The Seller ships within five days. The Seller pays postage. This agreement is between Harbour Ltd (the "Seller") and Hill Ltd.\n'),
      ['"Seller" is used here, before it is defined on line 1'],
    );
  });

  it("uses after the definition, and the name in the defining sentence, are fine", () => {
    assert.deepEqual(early('This agreement is between Harbour Ltd (the "Seller") and Hill Ltd. The Seller ships within five days.\n'), []);
    assert.deepEqual(early('The Professional Services team (the "Professional Services") helps.\n'), []);
  });

  it("a label on the defining line is not an earlier use", () => {
    assert.deepEqual(early("**12.2.** Taxes. Customer pays all levies (“**Taxes**”). Fees exclude Taxes.\n"), []);
  });

  it("a quotation of the term alone is a mention, not a use (#621)", () => {
    assert.deepEqual(early('Its sentences open with "The key point is", and lists follow.\n\n| Announcements ("The key point is") | Delete them |\n'), []);
    assert.deepEqual(early('The Seller ships. Harbour Ltd (the "Seller") agrees.\n'), ['"Seller" is used here, before it is defined on line 1']);
    assert.deepEqual(early('He said "the Seller ships today". Harbour Ltd (the "Seller") agrees.\n'), [
      '"Seller" is used here, before it is defined on line 1',
    ]);
    assert.deepEqual(early('The "Seller" ships. Harbour Ltd (the "Seller") agrees.\n'), ['"Seller" is used here, before it is defined on line 1']);
    assert.deepEqual(early("「買主」は、毎月末日に代金を支払う。株式会社やまと（以下「買主」という。）と契約する。\n", ja), [
      "「買主」を、1 行目の定義より前で使っています",
    ]);
  });

  it("a definitions clause may come after its uses", () => {
    assert.deepEqual(early('The Seller ships within five days.\n\n"Seller" means Harbour Ltd.\n'), []);
  });

  it("a lowercase English term and a different capitalisation are not distinctive", () => {
    assert.deepEqual(early('Most vendors agree. Companies ("vendors") sell software.\n'), []);
    assert.deepEqual(early("Beta features include early access. Users who collect data (“Access”) must stop.\n"), []);
  });

  it("日本語の以下「甲」という", () => {
    assert.deepEqual(early("株式会社やまとは、毎月末日に代金を支払う。代金の支払いは株式会社やまと（以下「買主」という。）が行う。買主は検収する。\n", ja), []);
    assert.deepEqual(early("買主は、毎月末日に代金を支払う。株式会社やまと（以下「買主」という。）と契約する。\n", ja), [
      "「買主」を、1 行目の定義より前で使っています",
    ]);
  });

  it("漢字で終わる語に漢字が続く長い語は、その語の使用ではない（監査委員会の監査委員）", () => {
    assert.deepEqual(early("監査委員会を置く。取締役のうち三人（以下「監査委員」という。）を選ぶ。\n", ja), []);
    assert.deepEqual(early("監査委員が報告する。取締役のうち三人（以下「監査委員」という。）を選ぶ。\n", ja), [
      "「監査委員」を、1 行目の定義より前で使っています",
    ]);
    assert.deepEqual(early("本サービス利用料を払う。この案内（以下「本サービス」という。）による。\n", ja), [
      "「本サービス」を、1 行目の定義より前で使っています",
    ]);
  });

  it("見出しの行の語は、使った所ではない", () => {
    assert.deepEqual(early("## 買主の義務\n\n株式会社やまと（以下「買主」という。）は、代金を支払う。\n", ja), []);
    assert.deepEqual(early('## Duties of the Seller\n\nHarbour Ltd (the "Seller") ships the goods.\n'), []);
    assert.deepEqual(early("## 義務\n\n買主は、代金を支払う。株式会社やまと（以下「買主」という。）と契約する。\n", ja), [
      "「買主」を、3 行目の定義より前で使っています",
    ]);
  });

  it("条の前の見出しの行と、章・節の行の語は、使った所ではない", () => {
    const statute = (head: string): readonly string[] =>
      namedRuleRun("use-before-definition", `${head}第一条\u3000株式会社やまと（以下「買主」という。）は、代金を支払う。\n`, ja, "a.txt", "legal/statute")
        .findings;
    assert.deepEqual(statute("第一章　買主の義務\n\n（買主の義務）\n"), []);
    assert.deepEqual(statute("買主は、検収する。\n\n（買主の義務）\n"), ["「買主」を、4 行目の定義より前で使っています"]);
  });

  it("規約やポリシーの丁寧な形（以下「X」といいます）でも、定義より前の使用を言う", () => {
    assert.deepEqual(early("株式会社ひばりラボ（以下「当社」といいます。）は、利用者の情報を守ります。当社は、本ポリシーを定めます。\n", ja), []);
    assert.deepEqual(early("当社は、利用者の情報を守ります。本サービスを使う方（以下「利用者」といいます。）が対象です。\n", ja), [
      "「利用者」を、1 行目の定義より前で使っています",
    ]);
    assert.deepEqual(early("利用者は、退会できます。本サービスを使う方（以下、「利用者」といいます。）が対象です。\n", ja), [
      "「利用者」を、1 行目の定義より前で使っています",
    ]);
  });

  it("定義の括弧の前の長い名前を、定義より前でそのまま書いた所は使用ではない", () => {
    assert.deepEqual(early("「熱中症対策の手引き」を添えます。環境省は「熱中症対策の手引き（以下、「手引き」という。）」を作りました。\n", ja), []);
    assert.deepEqual(early("手引きを添えます。環境省は「熱中症対策の手引き（以下、「手引き」という。）」を作りました。\n", ja), [
      "「手引き」を、1 行目の定義より前で使っています",
    ]);
    assert.deepEqual(early("学校の手引きを添えます。環境省は「熱中症対策の手引き（以下、「手引き」という。）」を作りました。\n", ja), [
      "「手引き」を、1 行目の定義より前で使っています",
    ]);
  });

  it("一字の漢字の語は前の使用を探さない（令和の令、方法の法）", () => {
    assert.deepEqual(early("令和8年に改める。施行令（以下「令」という。）による。\n", ja), []);
  });
});

describe("the reading behind both rules", () => {
  const texts = [
    { start: 0, text: "The Seller ships." },
    { start: 18, text: "Harbour Ltd (the Seller) agrees." },
  ];

  it("usesOf skips the definition's own span", () => {
    assert.deepEqual(usesOf("Seller", texts, [{ start: 35, end: 41 }]), [4]);
    assert.deepEqual(usesOf("Seller", texts, []), [4, 35]);
  });

  it("only the first definition of a term is reported unused", () => {
    const twice = [term("Buyer", 0, false), term("Buyer", 20, false)];
    assert.equal(unusedDefinitions(twice, []).length, 1);
  });

  it("usesBeforeDefinition looks only at inline definitions", () => {
    assert.equal(usesBeforeDefinition([term("Seller", 30)], texts).length, 1);
    assert.equal(usesBeforeDefinition([term("Seller", 30, false)], texts).length, 0);
    assert.equal(usesBeforeDefinition([term("Seller", 2)], texts).length, 0);
  });
});

describe("acronym-expansion-conflict: 同じ略語の二通りの展開", () => {
  it("two names for one abbreviation are reported at the second", () => {
    assert.deepEqual(
      conflicts("We review the Service Level Agreement (SLA) every month. After an outage, refunds follow the Support Level Agreement (SLA).\n"),
      ['"SLA" is expanded as "Support Level Agreement" here and as "Service Level Agreement" on line 1'],
    );
  });

  it("the same name, written with other case, hyphens, & or a plural, is not a conflict", () => {
    assert.deepEqual(conflicts("The Service Level Agreement (SLA) holds. The service-level agreements (SLA) hold.\n"), []);
    assert.deepEqual(conflicts("The Office of Information and Technology (OIT) runs it. The Office of Information & Technology (OIT) pays.\n"), []);
  });

  it("the abbreviation first, the name in brackets", () => {
    assert.deepEqual(conflicts("CI (Continuous Integration) runs. Later, CI (Code Inspection) runs.\n"), [
      '"CI" is expanded as "Code Inspection" here and as "Continuous Integration" on line 1',
    ]);
  });

  it("日本語の展開も比べる", () => {
    assert.deepEqual(conflicts("SLA（サービス品質保証）を毎月見直します。障害が続いた月は、SLA（サービスレベル契約）に従って返金します。\n", ja), [
      "「SLA」をここでは「サービスレベル契約」と、1 行目では「サービス品質保証」と展開しています",
    ]);
    assert.equal(conflicts("SLA（サービス品質保証）を守ります。返金はSLA（サービスレベル契約）に従います。\n", ja).length, 1);
  });

  it("brackets that are not a name are not an expansion", () => {
    assert.deepEqual(expansionsIn({ start: 0, text: "Read the SLA (see Table 2) first." }), []);
    assert.deepEqual(expansionsIn({ start: 0, text: "人事部（以下「HR」という。）と HR（以下、人事）は同じ。" }), []);
  });

  it("nameBefore takes the shortest run of words whose initials spell it", () => {
    assert.equal(nameBefore("Minutes of the Federal Open Market Committee ", "FOMC"), "Federal Open Market Committee");
    assert.equal(nameBefore("the Department of Defense ", "DD"), "Department of Defense");
    assert.equal(nameBefore("as shown in the table ", "SLA"), undefined);
  });

  it("each different name is reported once", () => {
    const at = (name: string, offset: number) => ({ acronym: "SLA", name, offset });
    const found = expansionConflicts([at("Service Level Agreement", 0), at("Support Level Agreement", 10), at("Support Level Agreement", 20)]);
    assert.deepEqual(
      found.map((conflict) => conflict.expansion.offset),
      [10],
    );
    assert.equal(comparableName("Service-Level Agreements"), comparableName("service level agreement"));
  });
});
