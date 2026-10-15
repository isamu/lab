import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { citationVocabulary, citedDocument } from "../packages/lang-ja/src/citation.ts";
import { articleParagraph, isListedParagraph, listedNumbers } from "../packages/chaff/src/structure/listed-paragraph.ts";

// 参照先が無い（日本語）: 規程の書き方で、木が番地を読まないが文書には書いてあるもの、他の文書を指しているもの。
// 例文はすべて自作。

const lines = (...rows: string[]): string => rows.join("\n");

const danglingTargets = (source: string): string[] =>
  runRules(buildDocument("rules.md", source, ja), loadRules("ja"), {}, true, "legal/statute")
    .findings.filter((finding) => finding.rule === "dangling-reference")
    .map((finding) => String(finding.values["target"]));

describe("名前と番地のあいだに空白を置いた他の文書の条（就業規則 第25条）", () => {
  const vocabulary = citationVocabulary(ja.lexicons);
  const cases: readonly (readonly [string, string | undefined])[] = [
    ["就業規則 第25条", "就業規則"],
    ["就業規則　第25条", "就業規則"],
    ["賃金規程  第4条", "賃金規程"],
    ["就業規則第25条", "就業規則"],
    // 空白を挟んだら、種類の語で終わる名前だけ。種類の語だけ・この文書・名前で終わらない語は他の文書にしない。
    ["規則 第25条", undefined],
    ["本規則 第25条", undefined],
    ["この規程 第25条", undefined],
    ["甲は 第25条", undefined],
    ["附則 第2条", undefined],
    ["就業規則\n第25条", undefined],
  ];
  cases.forEach(([text, expected]) => {
    it(`${JSON.stringify(text)} → ${String(expected)}`, () => assert.equal(citedDocument(text, text.lastIndexOf("第"), vocabulary), expected));
  });

  const rules = (sentence: string): string =>
    lines("# 在宅勤務規程", "", "### 第1条　目的", "", "1. 目的を定める。", "", "### 第2条　給与", "", `1. ${sentence}`);
  it("空白を挟んで他の規程の条を引いても報告しない", () => assert.deepEqual(danglingTargets(rules("就業規則 第44条の定めるところによる。")), []));
  it("この文書の名前で引いた無い条は報告する", () => assert.deepEqual(danglingTargets(rules("本規程 第44条の定めるところによる。")), ["44"]));
  it("名前の無い無い条は報告する", () => assert.deepEqual(danglingTargets(rules("第44条の定めるところによる。")), ["44"]));
});

describe("箇条書きで書いた項（### 第3条 の下の 1. 2. 3.）", () => {
  it("articleParagraph は条と項に分け、項の先や数でない項は読まない", () => {
    assert.deepEqual(articleParagraph("3.3"), { article: "3", paragraph: 3 });
    assert.deepEqual(articleParagraph("3-2.1"), { article: "3-2", paragraph: 1 });
    assert.equal(articleParagraph("3"), undefined);
    assert.equal(articleParagraph("3.3.1"), undefined);
    assert.equal(articleParagraph("3.a"), undefined);
    assert.equal(articleParagraph(""), undefined);
  });

  it("listedNumbers は行頭の半角・全角の番号を読み、行の中の番号や点の無い番号は読まない", () => {
    assert.deepEqual([...listedNumbers("1. 甲\n2. 乙")], [1, 2]);
    assert.deepEqual([...listedNumbers("\u3000\u3000１．甲\n２．乙")], [1, 2]);
    assert.deepEqual([...listedNumbers("  3．丙")], [3]);
    assert.deepEqual([...listedNumbers("甲は 3. と書く")], []);
    assert.deepEqual([...listedNumbers("3 丙")], []);
    assert.deepEqual([...listedNumbers("")], []);
  });

  it("isListedParagraph は条の箇条書きに項の番号があるときだけ真", () => {
    const listed = new Map([["3", new Set([1, 2])]]);
    assert.equal(isListedParagraph("3.2", listed), true);
    assert.equal(isListedParagraph("3.3", listed), false);
    assert.equal(isListedParagraph("4.1", listed), false);
    assert.equal(isListedParagraph("3", listed), false);
    assert.equal(isListedParagraph("3.2.1", listed), false);
    assert.equal(isListedParagraph("", new Map()), false);
  });

  const article3 = (...items: string[]): string[] => ["### 第3条　休日", ...items];
  const document = (article: readonly string[], reference: string): string =>
    lines("# 休日規程", "", ...article, "", "### 第4条　手続", `1. 会社は、${reference}の規定により通知する。`);

  it("見出しのすぐ下の箇条書きの項を引けば報告しない", () =>
    assert.deepEqual(danglingTargets(document(article3("1. 甲とする。", "2. 乙とする。", "3. 丙とする。"), "第3条第3項")), []));
  it("空行を挟んだ箇条書きの項も同じ", () =>
    assert.deepEqual(danglingTargets(document(article3("", "1. 甲とする。", "2. 乙とする。", "3. 丙とする。"), "第3条第3項")), []));
  it("全角の番号を行頭に置いた項も同じ", () =>
    assert.deepEqual(danglingTargets(document(article3("　　１．甲とする。", "　　①　丙", "２．乙とする。"), "第3条第2項")), []));
  it("箇条書きに無い番号の項は報告する", () => assert.deepEqual(danglingTargets(document(article3("1. 甲とする。", "2. 乙とする。"), "第3条第3項")), ["3.3"]));
  it("無い条の項は報告する", () => assert.deepEqual(danglingTargets(document(article3("1. 甲とする。", "2. 乙とする。"), "第9条第2項")), ["9.2"]));
  it("項の先（号）までは箇条書きで引かない", () =>
    assert.deepEqual(danglingTargets(document(article3("1. 甲とする。", "2. 乙とする。"), "第3条第2項第1号")), ["3.2.1"]));
});

describe("他の文書の名前を見出しにして引き写した条", () => {
  const quoted = (citation: string): string =>
    lines(
      "# 募集要項",
      "",
      "## 応募資格",
      "",
      `${citation}に定める欠格事項に該当しない方。`,
      "",
      "### 地方自治例法",
      "",
      "第十条　次の各号のいずれかに該当する者は、職員となることができない。",
      "",
      "一　第五十条に規定する罪を犯した者",
    );

  it("文書がその名前で他の文書として引いていれば、引き写した条の参照は報告しない", () =>
    assert.deepEqual(danglingTargets(quoted("「地方自治例法第10条」")), []));
  it("名前を引いていなければ、見出しの下の参照も報告する", () => assert.deepEqual(danglingTargets(quoted("下記")), ["50"]));
  it("その名前の見出しの下でも、引き写した条の外の地の文の参照は報告する", () =>
    assert.deepEqual(
      danglingTargets(
        lines("# 募集要項", "", "## 参照", "", "就業規則 第1条による。", "", "### 第1条", "", "1. 目的。", "", "## 就業規則", "", "第999条による。"),
      ),
      ["999"],
    ));

  it("文書の題が規程の名前でも、題の下の参照は報告する", () =>
    assert.deepEqual(
      danglingTargets(lines("# 休日規程", "", "### 第1条　目的", "", "1. 休日規程第2条を改める。", "", "### 第2条　手続", "", "1. 第9条に定める。")),
      ["9"],
    ));
});
