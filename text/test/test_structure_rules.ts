import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import type { Finding, LanguageAdapter, StructurePatterns } from "../packages/chaff/src/plugin.ts";
import { citationVocabulary, citedDocument } from "../packages/lang-ja/src/citation.ts";
import { citedDocumentAfter } from "../packages/lang-en/src/citation.ts";
import { loadProfiles } from "../packages/chaff/src/profile/load.ts";

// 参照先が無い・番号の抜け・二重定義。誤検出しやすい正常な文書と、誤りのある文書を対にする（spec §23）。

const STRUCTURE_RULES = ["dangling-reference", "numbering-gap", "duplicate-definition"];

const lines = (...rows: string[]): string => rows.join("\n");

type Found = readonly [string, Readonly<Record<string, string | number>>];

/** 日本語の例は法令と契約書の抜き書き。CLI なら条が 3 つ以上あれば法令の種類で読むので、短い抜き書きにも同じ種類を渡す。 */
const statuteJa = loadProfiles().find((definition) => definition.id === "statute")?.languages["ja"];

const findingsOf = (adapter: LanguageAdapter, source: string, path = "c.txt"): Finding[] =>
  runRules(
    buildDocument(path, source, adapter, undefined, adapter.id === "ja" ? statuteJa : undefined),
    loadRules(adapter.id),
    {},
    true,
    "business/contract",
  ).findings.filter((finding) => STRUCTURE_RULES.includes(finding.rule));

/** offset は位置の確認用で、期待値に書くと読みにくいので外して比べる。 */
const withoutOffset = (values: Finding["values"]): Readonly<Record<string, string | number>> =>
  Object.fromEntries(Object.entries(values).filter(([key]) => key !== "offset"));

const found = (adapter: LanguageAdapter, source: string, path?: string): Found[] =>
  findingsOf(adapter, source, path).map((finding) => [finding.rule, withoutOffset(finding.values)]);

describe("日本語: 誤りの無い文書では何も言わない", () => {
  const cases: readonly (readonly [string, string])[] = [
    [
      "第1項に番号を振らない法令の書き方で、第4条第1項を指す",
      lines("第4条（支払）", "甲は支払う。", "２　乙は受け取る。", "第5条（解除）", "第4条第1項に違反したときは解除できる。"),
    ],
    ["枝番号の条は並びの外", lines("第3条（甲）", "本文", "第3条の2（乙）", "本文", "第4条（丙）", "本文")],
    ["章が変わっても条は続く", lines("第1章 総則", "第1条（目的）", "本文", "第2章 義務", "第2条（義務）", "第1条を守る。")],
    ["番号の無い文書から他の文書を指すのは誤りではない", "詳しくは民法第709条を参照する。"],
    ["一度だけの定義", lines("第1条（定義）", "「本件業務」とは、甲が委託する業務をいう。", "第2条（業務）", "乙は本件業務を行う。")],
    ["号の並び", lines("第1条（業務）", "次の業務を行う。", "一　設計", "二　開発", "三　試験")],
  ];
  cases.forEach(([name, source]) => {
    it(name, () => assert.deepEqual(found(ja, source), []));
  });
});

// 実際の法令（e-Gov、労働基準法・民法・会社法・個人情報の保護に関する法律）で誤検出したものを、短く切り出して残す。
// 法令は著作権の目的とならない（著作権法第13条）。
describe("日本語: 実際の法令の書き方で誤検出しない", () => {
  const cases: readonly (readonly [string, string])[] = [
    [
      "号の後の番号付きの第 2 項（号と項は別の並び）、第 1 項の号への参照",
      lines(
        "第十二条　この法律で平均賃金とは、次の各号の一によつて計算した金額を下つてはならない。",
        "一　賃金が、労働した日によつて算定された場合",
        "二　賃金の一部が、月によつて定められた場合",
        "２　前項の期間は、賃金締切日から起算する。",
        "第十三条　第十二条第一項第一号の金額による。",
      ),
    ],
    [
      "番号を振らない古い法令の第 2 項（全角空白で字下げした行）",
      lines(
        "第三十四条　使用者は、労働時間の途中に休憩時間を与えなければならない。",
        "\u3000前項の休憩時間は、一斉に与えなければならない。",
        "第三十五条　第三十四条第二項の規定は、適用しない。",
      ),
    ],
    [
      "範囲で削った条（「から…まで　削除」）",
      lines("第四十二条　労働安全衛生法の定めるところによる。", "第四十三条から第五十五条まで\u3000削除", "第五十六条　使用者は、児童を使用してはならない。"),
    ],
    ["二つ並べて削った条（「及び」）", lines("第五百十五条　本文", "第五百十六条及び第五百十七条\u3000削除", "第五百十八条　本文")],
    ["法律の題名に公布の番号を括弧で添えた、他の法令への参照", lines("第二条　国家行政組織法（昭和二十三年法律第百二十号）第三条第二項に規定する機関をいう。")],
    [
      "他の法令への参照に続く並び（括弧書きを挟んでも）",
      lines(
        "第百六十二条　民事訴訟法（平成八年法律第百九号）第百条第一項、第百一条、第百二条の二、第百三条の規定を準用する。",
        "第百六十三条　投資信託及び投資法人に関する法律（昭和二十六年法律第百九十八号）第二十五条第二項（同法第五十九条において準用する場合を含む。）及び第百八十六条の二第四項に規定する。",
      ),
    ],
    [
      "読み替えの「」の中の番地は、読み替える先の法令のもの",
      lines("第百七条　「審査会等」とあるのは「情報公開・個人情報保護審査会（別に法律で定める審査会。第五十条第一項第四号において同じ。）」と読み替える。"),
    ],
    [
      "読み替える前の言葉（「第九十九条」とあるのは）も、読み替える先の法令の番地",
      lines("第百八条　民事訴訟法の規定中「第九十九条」とあるのは「第百条」と読み替えて適用する。", "第百九条　本文"),
    ],
    [
      "条を持たない書類（契約書に付ける承諾書）から、契約書の条を指す（国土交通省『賃貸住宅標準契約書』の承諾書例）",
      lines(
        "（１）賃借権譲渡承諾書（例）",
        "敷金は、契約書第６条第３項ただし書に基づく精算の上、返還いたします。",
        "２　「増改築等」とは、契約書第８条第２項に規定するものをいう。",
      ),
    ],
    [
      "条ごとに範囲を限った定義（前項に規定する「X」とは）",
      lines(
        "第百十六条　反対株主は、株式の買取りを請求することができる。",
        "２　前項に規定する「反対株主」とは、次に掲げる株主をいう。",
        "第百八十二条の四　反対株主は、株式の買取りを請求することができる。",
        "２　前項に規定する「反対株主」とは、次に掲げる株主をいう。",
      ),
    ],
  ];
  cases.forEach(([name, source]) => {
    it(name, () => assert.deepEqual(found(ja, source), []));
  });
});

describe("日本語: 実際の法令の書き方を許しても、誤りは見逃さない", () => {
  it("他の法令への参照の後でも、文が変われば自分の条への参照", () => {
    assert.deepEqual(found(ja, lines("第一条　民法第百条に定めるところによる。第九条に違反した者は罰する。", "第二条　本文")), [
      ["dangling-reference", { label: "第九条", target: "9" }],
    ]);
  });

  it("古い法令の字下げの項も数えるので、無い第 3 項は無い", () => {
    assert.deepEqual(found(ja, lines("第三十四条　本文。", "\u3000前項の休憩時間は、一斉に与える。", "第三十五条　第三十四条第三項の規定による。")), [
      ["dangling-reference", { label: "第三十四条第三項", target: "34.3" }],
    ]);
  });

  it("番号付きの項（２）がある条では、字下げの行は項にならない", () => {
    assert.deepEqual(found(ja, lines("第一条　本文。", "２　第二項。", "\u3000続きの文。", "第二条　第一条第三項の規定による。")), [
      ["dangling-reference", { label: "第一条第三項", target: "1.3" }],
    ]);
  });

  it("「から」だけで「まで」の無い行は、条の範囲ではない（両端は参照のまま）", () => {
    assert.deepEqual(
      found(ja, lines("第一条　本文", "第二条から第五条\u3000削除", "第三条　本文")).map(([rule]) => rule),
      ["dangling-reference", "dangling-reference", "numbering-gap"],
    );
  });

  it("読み替えでない「」の中の参照は、この文書の参照", () => {
    assert.deepEqual(found(ja, lines("第一条　「第九条に定める業務」を本件業務という。", "第二条　本文")), [
      ["dangling-reference", { label: "第九条", target: "9" }],
    ]);
  });

  it("契約書の「第1条（目的）」の次の字下げの行は第 1 項の本文で、第 2 項を作らない", () => {
    assert.deepEqual(found(ja, lines("第1条（目的）", "\u3000本契約は、業務の委託を目的とする。", "第2条（業務）", "\u3000第1条第2項による。")), [
      ["dangling-reference", { label: "第1条第2項", target: "1.2" }],
    ]);
  });

  it("範囲を限った定義でも、同じ条の中で二度すれば重なり", () => {
    const source = lines(
      "第百十六条　反対株主は請求できる。",
      "２　前項に規定する「反対株主」とは、次に掲げる株主をいう。",
      "３　前項に規定する「反対株主」とは、議決権を行使できない株主をいう。",
    );
    assert.deepEqual(
      found(ja, source).map(([rule]) => rule),
      ["duplicate-definition"],
    );
  });

  it("範囲を限らない定義を二度すれば、重なり", () => {
    const source = lines("第一条　「本件業務」とは、設計をいう。", "第二条　「本件業務」とは、開発をいう。");
    assert.deepEqual(
      found(ja, source).map(([rule]) => rule),
      ["duplicate-definition"],
    );
  });

  it("範囲で削った条の次が飛べば、抜け", () => {
    assert.deepEqual(found(ja, lines("第四十二条　本文", "第四十三条から第五十五条まで\u3000削除", "第五十七条　本文")), [
      ["numbering-gap", { previous: "第四十三条から第五十五条まで", label: "第五十七条", expected: 56, found: 57 }],
    ]);
  });
});

describe("日本語: 誤りを見つける", () => {
  it("存在しない条への参照", () => {
    assert.deepEqual(found(ja, lines("第1条（目的）", "第12条に定める業務を行う。", "第2条（業務）", "本文")), [
      ["dangling-reference", { label: "第12条", target: "12" }],
    ]);
  });

  it("存在しない項への参照（第2項は番号付きで書かれるので、無ければ無い）", () => {
    assert.deepEqual(found(ja, lines("第1条（支払）", "甲は支払う。", "第2条（解除）", "第1条第2項に違反したとき。")), [
      ["dangling-reference", { label: "第1条第2項", target: "1.2" }],
    ]);
  });

  it("条の番号が飛ぶ", () => {
    assert.deepEqual(found(ja, lines("第1条（目的）", "本文", "第2条（定義）", "本文", "第4条（支払）", "本文")), [
      ["numbering-gap", { previous: "第2条", label: "第4条", expected: 3, found: 4 }],
    ]);
  });

  it("項の番号が重なる", () => {
    assert.deepEqual(found(ja, lines("第1条（支払）", "甲は支払う。", "２　期限は月末とする。", "２　遅延には利息を付す。")), [
      ["numbering-gap", { previous: "２", label: "２", expected: 3, found: 2 }],
    ]);
  });

  it("括弧書きの号が飛ぶ", () => {
    assert.deepEqual(found(ja, lines("第1条（禁止事項）", "（1）法令違反", "（3）迷惑行為")), [
      ["numbering-gap", { previous: "（1）", label: "（3）", expected: 2, found: 3 }],
    ]);
  });

  it("同じ語を二度定義する", () => {
    const source = lines("第1条（定義）", "「成果物」とは、納入物をいう。", "第5条（検収）", "「成果物」とは、検収に合格したものをいう。");
    assert.deepEqual(found(ja, source), [
      ["numbering-gap", { previous: "第1条", label: "第5条", expected: 2, found: 5 }],
      ["duplicate-definition", { term: "成果物", first: 2 }],
    ]);
  });
});

describe("English: nothing to say about a sound document", () => {
  const cases: readonly (readonly [string, string])[] = [
    [
      "sections numbered by chapter, 101 then 201",
      lines("CHAPTER 1 GENERAL", "Section 101 Title", "text", "Section 102 Definitions", "text", "CHAPTER 2 DUTIES", "Section 201 Care", "See Section 102."),
    ],
    ["(h), (i), (j) are letters", lines("Section 1 Terms", "(g) seven", "(h) eight", "(i) nine", "(j) ten")],
    ["(a), (i), (ii), (b)", lines("Section 1 Terms", "(a) one", "(i) sub one", "(ii) sub two", "(b) two")],
    [
      "(a), (1), (i), (ii), (2), (i), (b), as US regulations go",
      lines("Section 1 Terms", "(a) one", "(1) one", "(i) one", "(ii) two", "(2) two", "(i) one", "(b) two", "See Section 1(a)(2)(i)."),
    ],
    ["(1), (h), (i), (j), (2)", lines("Section 1 Terms", "(1) one", "(h) eight", "(i) nine", "(j) ten", "(2) two")],
    ["a reference into another agreement from a document with no numbering", "As provided in Section 5 of the Master Agreement."],
    ["a reference down to a lettered item", lines("Section 4.2 Payment", "(a) Pay within 30 days.", "Section 4.3 Late fees", "See Section 4.2(a).")],
  ];
  cases.forEach(([name, source]) => {
    it(name, () => assert.deepEqual(found(en, source), []));
  });
});

describe("English: finds the errors", () => {
  it("a reference to a section that is not there", () => {
    assert.deepEqual(found(en, lines("Section 1 Scope", "text", "Section 2 Fees", "As set out in Section 9, fees are due.")), [
      ["dangling-reference", { label: "Section 9", target: "9" }],
    ]);
  });

  it("a lettered item skipped", () => {
    assert.deepEqual(found(en, lines("Section 1 Terms", "(a) one", "(c) three")), [
      ["numbering-gap", { previous: "(a)", label: "(c)", expected: 2, found: 3 }],
    ]);
  });

  it("a roman item skipped", () => {
    assert.deepEqual(found(en, lines("Section 1 Terms", "(a) one", "(i) sub one", "(iii) sub three")), [
      ["numbering-gap", { previous: "(i)", label: "(iii)", expected: 2, found: 3 }],
    ]);
  });

  it("a term defined twice", () => {
    const source = lines('"Services" means consulting.', "Section 1 Scope", '"Services" means consulting and support.');
    assert.deepEqual(found(en, source), [["duplicate-definition", { term: "Services", first: 1 }]]);
  });
});

describe("English: how a statute is written, with no false alarm", () => {
  const act = (...rows: string[]): string => lines("Section 1 Scope", "text", "Section 2 Definitions", ...rows);
  const cases: readonly (readonly [string, string])[] = [
    ["a list of references that ends in the name of another law", act("Under Article 58(2)(c) to (g) and (j) of the UK GDPR.")],
    ["a list of section references into another law", act("See sections 5(7), 29(2) and 9 of the Data Protection Act 2018.")],
    ["a comma list of references into another law", act("Articles 6(3), 8A(3)(e) and 23(1) of the UK GDPR.")],
    ["a gloss between the reference and the law it is in", act("as mentioned in section 4(2)(a) (exception to liability) of the Damages (Scotland) Act 2011.")],
    ["“of that Act”", act("Section 123 of that Act is amended.")],
    [
      "references in a gloss after a reference into another law",
      act("In section 120(3) of the Communications Act 2003 (conditions under section 120 or an order under section 122) omit “or”."),
    ],
    [
      "an Article reference in an Act numbered by sections that cites the Articles of another law",
      act("Articles 13 to 21 of the UK GDPR apply.", "the power in Article 23(1) to restrict obligations."),
    ],
    [
      "a term defined again in another section after “In this section—”",
      lines("Section 1 Scope", "In this section—", "“review period” means 3 years;", "Section 2 Review", "In this section—", "“review period” means 5 years;"),
    ],
    [
      "a term defined again after “In this Part, …” on the same line",
      lines("Section 1 A", "In this Part, “the seller” means A.", "Section 2 B", "In this Part, “the seller” means B."),
    ],
    [
      "“This section applies where a person (“the seller”)”",
      lines(
        "Section 1 A",
        "This section applies where a person (“the seller”) sells.",
        "Section 2 B",
        "This section applies where a person (“the seller”) re-sells.",
      ),
    ],
    [
      "“has the meaning given in” points at a definition",
      lines("“data” means facts.", "Section 1 A", "“data” has the meaning given in section 3 of the Data Protection Act 2018."),
    ],
  ];
  cases.forEach(([name, source]) => {
    it(name, () => assert.deepEqual(found(en, source), []));
  });
});

describe("English: the statute allowances do not hide real errors", () => {
  it("a lowercase section reference to a section that is not there", () => {
    assert.deepEqual(found(en, lines("Section 1 Scope", "text", "Section 2 Fees", "See section 9(2).")), [
      ["dangling-reference", { label: "section 9(2)", target: "9.2" }],
    ]);
  });

  it("a reference after a gloss that closed is into this document again", () => {
    const source = lines("Section 1 Scope", "section 120 of the Communications Act 2003 (see section 5) applies, and so does section 9.");
    assert.deepEqual(found(en, source), [["dangling-reference", { label: "section 9", target: "9" }]]);
  });

  it("an Article reference in a document numbered by articles", () => {
    assert.deepEqual(found(en, lines("Article 1 Scope", "text", "Article 2 Fees", "See Article 9.")), [
      ["dangling-reference", { label: "Article 9", target: "9" }],
    ]);
  });

  it("a term defined twice in one scoped section", () => {
    const source = lines("Section 1 Scope", "In this section—", "“review period” means 3 years;", "“review period” means 5 years;");
    assert.deepEqual(found(en, source), [["duplicate-definition", { term: "review period", first: 3 }]]);
  });

  it("a term defined twice in sections that do not scope their definitions", () => {
    const source = lines("Section 1 A", "“the seller” means A.", "Section 2 B", "“the seller” means B.");
    assert.deepEqual(found(en, source), [["duplicate-definition", { term: "the seller", first: 2 }]]);
  });

  it("an Article reference in a contract numbered by sections that names no Article-numbered document", () => {
    assert.deepEqual(found(en, lines("Section 1 Scope", "text", "Section 2 Fees", "See Article 9.")), [
      ["dangling-reference", { label: "Article 9", target: "9" }],
    ]);
  });

  it("a reference in a second parenthesis, after the gloss of another law closed", () => {
    const source = lines("Section 1 Scope", "(see section 120 of the Communications Act 2003) and (see section 9).");
    assert.deepEqual(found(en, source), [["dangling-reference", { label: "section 9", target: "9" }]]);
  });

  it("a reference two parentheses deep, after the gloss of another law closed", () => {
    const source = lines("Section 1 Scope", "(see section 120 of the Communications Act 2003) and (as in (section 9)).");
    assert.deepEqual(found(en, source), [["dangling-reference", { label: "section 9", target: "9" }]]);
  });

  it("an Article reference in a document numbered by articles that also cites another law's Articles", () => {
    const source = lines("Article 1 Scope", "Article 5 of the GDPR applies.", "Article 2 Fees", "See Article 9.");
    assert.deepEqual(found(en, source), [["dangling-reference", { label: "Article 9", target: "9" }]]);
  });

  it("“This section applies” scopes only a party named in parentheses, not a “means” definition on the same line", () => {
    const source = lines(
      "Section 1 A",
      "This section applies to sales. “Services” means A.",
      "Section 2 B",
      "This section applies to resales. “Services” means B.",
    );
    assert.deepEqual(found(en, source), [["duplicate-definition", { term: "Services", first: 2 }]]);
  });

  it("“This section applies” on another line does not scope a definition", () => {
    const source = lines(
      "Section 1 A",
      "This section applies to sales.",
      "“the seller” means A.",
      "Section 2 B",
      "This section applies to resales.",
      "“the seller” means B.",
    );
    assert.deepEqual(found(en, source), [["duplicate-definition", { term: "the seller", first: 3 }]]);
  });

  it("a list with no law named after it stays in this document", () => {
    assert.deepEqual(found(en, lines("Section 1 Scope", "text", "Section 2 Fees", "See Sections 9, 1 and 2.")), [
      ["dangling-reference", { label: "Sections 9", target: "9" }],
    ]);
  });
});

describe("Markdown: headings carry the numbers", () => {
  it("a dotted section skipped in the headings", () => {
    const source = lines("# 1 Intro", "", "## 1.1 Scope", "", "## 1.3 Terms", "", "See 1.2.");
    assert.deepEqual(found(en, source, "spec.md"), [["numbering-gap", { previous: "1.1", label: "1.3", expected: 2, found: 3 }]]);
  });

  it("does not read a reference inside code", () => {
    assert.deepEqual(found(ja, lines("# 規約", "", "## 第1条（目的）", "", "例として `第99条` と書く。"), "terms.md"), []);
  });
});

describe("a language whose adapter cannot read structure", () => {
  it("skips the structure rules with a reason instead of reporting nothing", () => {
    // structure を持たない adapter。英語の adapter から structure だけを除いて作る。
    const blind: LanguageAdapter = {
      kind: en.kind,
      id: en.id,
      apiVersion: en.apiVersion,
      capabilities: en.capabilities,
      detect: en.detect,
      segment: en.segment,
      lexicons: en.lexicons,
    };
    const result = runRules(buildDocument("c.txt", "Section 1 Scope\nSee Section 9.", blind), loadRules("en"), {}, true, "business/contract");
    assert.deepEqual(
      result.findings.filter((finding) => STRUCTURE_RULES.includes(finding.rule)),
      [],
    );
    const skipped = result.skipped.filter((entry) => STRUCTURE_RULES.includes(entry.rule));
    const byName = (left: string, right: string): number => left.localeCompare(right, "en");
    assert.deepEqual(skipped.map((entry) => entry.rule).sort(byName), [...STRUCTURE_RULES].sort(byName));
    // An English document is told why in English.
    assert.ok(skipped.every((entry) => entry.why.includes("cannot read a document's structure")));
  });

  it("stays off unless experimental rules are on", () => {
    const result = runRules(buildDocument("c.txt", "Section 1 Scope\nSee Section 9.", en), loadRules("en"), {}, false, "business/contract");
    assert.deepEqual(
      result.findings.filter((finding) => STRUCTURE_RULES.includes(finding.rule)),
      [],
    );
  });
});

describe("the sample documents (test/fixtures/structure)", () => {
  const ROOT = fileURLToPath(new URL("./fixtures/structure", import.meta.url));
  const ADAPTERS: Readonly<Record<string, LanguageAdapter>> = { ja, en };
  // 見本の中で本当に誤っているのは英語の契約書の一か所だけ。Section 5.1 を指しているが、その節は無い。
  const EXPECTED: Readonly<Record<string, readonly Found[]>> = {
    "en/contract.txt": [["dangling-reference", { label: "Section 5.1", target: "5.1" }]],
  };
  Object.entries(ADAPTERS).forEach(([language, adapter]) => {
    readdirSync(join(ROOT, language))
      .filter((name) => /\.(?:md|txt)$/u.test(name))
      .forEach((name) => {
        const key = `${language}/${name}`;
        it(key, () => assert.deepEqual(found(adapter, readFileSync(join(ROOT, key), "utf8"), name), EXPECTED[key] ?? []));
      });
  });
});

describe("日本語: 他の文書の条を指す参照は、この文書では引かない", () => {
  const numbered = (sentence: string): string => lines("第1条（目的）", sentence, "第2条（定義）", "本文");
  const cases: readonly (readonly [string, readonly Found[]])[] = [
    ["民法第709条に基づき賠償する。", []],
    ["個人情報保護法第3条の規定による。", []],
    ["同法第5条を準用する。", []],
    ["就業規則第12条に従う。", []],
    ["個人情報の保護に関する法律第3条による。", []],
    ["本契約第9条に定める。", [["dangling-reference", { label: "第9条", target: "9" }]]],
    ["当規約第9条に定める。", [["dangling-reference", { label: "第9条", target: "9" }]]],
    ["契約第9条に定める。", [["dangling-reference", { label: "第9条", target: "9" }]]],
    ["甲は第9条に定める。", [["dangling-reference", { label: "第9条", target: "9" }]]],
  ];
  cases.forEach(([sentence, expected]) => {
    it(sentence, () => assert.deepEqual(found(ja, numbered(sentence)), expected));
  });

  const names: readonly (readonly [string, string | undefined])[] = [
    ["民法第709条", "民法"],
    ["会社法施行規則第3条", "会社法施行規則"],
    ["個人情報の保護に関する法律第3条", "個人情報の保護に関する法律"],
    ["この点は、法律第3条", undefined],
    ["ガイドライン第2条", undefined],
    ["社内ガイドライン第2条", "社内ガイドライン"],
    ["本法第3条", undefined],
    ["この契約第3条", undefined],
    ["第3条", undefined],
  ];
  names.forEach(([text, expected]) => {
    it(`citedDocument: ${text} → ${String(expected)}`, () =>
      assert.equal(citedDocument(text, text.lastIndexOf("第"), citationVocabulary(ja.lexicons)), expected));
  });

  it("文書の種類の語は、語彙表の並びによらず長いものから当てる。「法律」だけの名前は「法」の文書にしない", () => {
    const shortFirst = citationVocabulary({ "document-kind": [{ pattern: "法" }, { pattern: "法律" }] });
    assert.deepEqual(shortFirst.kinds, ["法律", "法"]);
    assert.equal(citedDocument("法律第3条", "法律".length, shortFirst), undefined);
  });
});

describe("English: a reference into another document is not looked up here", () => {
  const numbered = (sentence: string): string => lines("Section 1 Scope", sentence, "Section 2 Fees", "text");
  const cases: readonly (readonly [string, readonly Found[]])[] = [
    ["As provided in Section 9 of the Master Agreement.", []],
    ["Under Section 5 of the Securities Act of 1933, sales are restricted.", []],
    ["See Section 12 of the Code of Federal Regulations.", []],
    ["Disclosures follow Section 5 of the Act.", []],
    ["Taxes are withheld under Section 1441 of the Code.", []],
    ["See Section 9 of this Agreement.", [["dangling-reference", { label: "Section 9", target: "9" }]]],
    ["See Section 9 of the Agreement.", [["dangling-reference", { label: "Section 9", target: "9" }]]],
    ["See Section 9 of each party's obligations.", [["dangling-reference", { label: "Section 9", target: "9" }]]],
    // RFC 9457: a bracketed citation tag names another document, after the reference or just before it.
    ["HTTP status codes (Section 15 of [HTTP]) cannot always convey enough.", []],
    ["The language used is negotiated (see [HTTP], Section 12.1).", []],
    ["Relative references are resolved as per [URI], Section 5.", []],
    ["See Section 4.6 of [RFC8126].", []],
    ["See Section 9 [2024 edition].", [["dangling-reference", { label: "Section 9", target: "9" }]]],
    ["See [1], Section 9.", [["dangling-reference", { label: "Section 9", target: "9" }]]],
    ["See [Company], Section 9.", [["dangling-reference", { label: "Section 9", target: "9" }]]],
    ["See Section 9 of [Reserved].", [["dangling-reference", { label: "Section 9", target: "9" }]]],
    ["See [A], Section 9.", [["dangling-reference", { label: "Section 9", target: "9" }]]],
    ["See [BUYER-1], Section 9.", [["dangling-reference", { label: "Section 9", target: "9" }]]],
    ["See Section 9 of [EXHIBIT.A].", [["dangling-reference", { label: "Section 9", target: "9" }]]],
    ["The [HTTP] rules apply; see Section 9.", [["dangling-reference", { label: "Section 9", target: "9" }]]],
  ];
  cases.forEach(([sentence, expected]) => {
    it(sentence, () => assert.deepEqual(found(en, numbered(sentence)), expected));
  });

  it("citedDocumentAfter stops the title at punctuation", () => {
    const text = "Section 9 of the Master Agreement. Payment is due.";
    assert.equal(citedDocumentAfter(text, "Section 9".length), "Master Agreement");
  });
});

describe("a plain-text specification's top-level sections (RFC 9457: '5.  Security Considerations')", () => {
  // 二段の番号（3.1）は本文でも読むので、どの例も構造を読めた文書として比べる。
  const withSubsection = (...head: string[]): string => lines(...head, "", "3.1.  Details", "", "Text.", "", "See Section 1.");
  const missing = [["dangling-reference", { label: "Section 1", target: "1" }]];

  it("a number, a dot and two spaces before a short title is a section in a .txt document", () => {
    assert.deepEqual(found(en, withSubsection("1.  Introduction", "", "Text.", "", "2.  Terms")), []);
  });

  it("not when the line reads as a sentence, or has one space, or is in Markdown", () => {
    assert.deepEqual(found(en, withSubsection("1.  Install the package.", "", "2.  Run it.")), missing);
    assert.deepEqual(found(en, withSubsection("1. Introduction", "", "2. Terms")), missing);
    const longLine = `1.  ${"The service keeps every request it receives for audit ".repeat(2).trim()}`;
    assert.deepEqual(found(en, withSubsection(longLine, "", "2.  Terms")), missing);
    assert.deepEqual(found(en, withSubsection("1.  Introduction", "", "Text.", "", "2.  Terms"), "c.md"), missing);
  });
});

describe("the first paragraph without a number is a Japanese convention, not an English one", () => {
  it("English Section 4.1 is missing when only Section 4 exists", () => {
    assert.deepEqual(found(en, lines("Section 4 Payment", "text", "Section 5 Late fees", "See Section 4.1.")), [
      ["dangling-reference", { label: "Section 4.1", target: "4.1" }],
    ]);
  });
});

describe("two lists under one parent", () => {
  it("English (a)(b), a paragraph, then (a)(b) again", () => {
    assert.deepEqual(found(en, lines("Section 1 Terms", "(a) one", "(b) two", "The Buyer may also:", "(a) three", "(b) four")), []);
  });

  it("日本語の（1）（2）が二組", () => {
    assert.deepEqual(found(ja, lines("第1条（手続）", "申込みは次による。", "（1）書面", "（2）電子", "取消しは次による。", "（1）書面", "（2）電子")), []);
  });

  it("附則が第1条から振り直す", () => {
    assert.deepEqual(found(ja, lines("第1条（目的）", "本文", "第2条（施行）", "本文", "附則", "第1条（経過措置）", "本文")), []);
  });
});

describe("the tree is built only when a structure rule reads it", () => {
  const counting = (): { adapter: LanguageAdapter; calls: () => number } => {
    const base = en.structure;
    if (base === undefined) throw new Error("lang-en has no structure");
    let count = 0;
    const patterns: StructurePatterns = {
      ...base,
      numbered: (line, context) => {
        count += 1;
        return base.numbered(line, context);
      },
    };
    return { adapter: { ...en, structure: patterns }, calls: () => count };
  };

  it("does not build it when the structure rules are off", () => {
    const { adapter, calls } = counting();
    runRules(buildDocument("c.txt", "Section 1 Scope\nSee Section 9.", adapter), loadRules("en"), {}, false, "business/contract");
    assert.equal(calls(), 0);
  });

  it("builds it once when they run", () => {
    const { adapter, calls } = counting();
    runRules(buildDocument("c.txt", "Section 1 Scope\nSee Section 9.", adapter), loadRules("en"), {}, true, "business/contract");
    assert.equal(calls(), 2);
  });
});
