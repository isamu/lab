import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { labelWrittenBetween } from "../packages/chaff/src/structure/unread-label.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// numbering-gap: a skip the text does not have. The number is written where the tree does not read it (run into the end
// of the line before, joined to the heading before, a plain paragraph), the numbers are quoted from a statute under a
// heading that says it is an excerpt (抜粋), or one number is a name repeated in glossary headwords (Section 508). The
// statute lines are from 工業所有権に関する手続等の特例に関する法律 (a Japanese statute, public domain), the glossary
// headwords from Section508.gov (CC0); the others are self-written.

const gapsOf = (adapter: LanguageAdapter, path: string, source: string, genre = "legal/contract"): [unknown, unknown][] =>
  runRules(buildDocument(path, source, adapter), loadRules(adapter.id), {}, true, genre)
    .findings.filter((finding) => finding.rule === "numbering-gap")
    .map((finding) => [finding.values["previous"], finding.values["label"]]);

const merger = (between: string): string =>
  [
    "Section 2.2          Exchange of Certificates.",
    "",
    "(a)          Paying Agent. Parent shall appoint a bank to act as paying agent.",
    "",
    "(b)          Payment Fund. Parent shall deposit the cash with the Paying Agent.",
    "",
    `(c)          Exchange Procedures. Parent shall cause the Paying Agent to mail a letter of transmittal.${between}`,
    "",
    "(e)          Any portion of the Payment Fund that remains undistributed for twelve months shall be delivered to Parent.",
    "",
  ].join("\n");

describe("numbering-gap: a number written where the tree does not read it", () => {
  it("does not report a skip over a label run into the end of the line before, set out after a run of spaces", () => {
    assert.deepEqual(gapsOf(en, "m.txt", merger("   (d)          The Merger Consideration shall be paid in full.")), []);
  });

  it("still reports the skip when the label is only mentioned in a sentence, or not written at all", () => {
    assert.deepEqual(gapsOf(en, "m.txt", merger(" The fee is set out in clause (d) of Section 2.3.")), [["(c)", "(e)"]]);
    assert.deepEqual(gapsOf(en, "m.txt", merger("")), [["(c)", "(e)"]]);
  });

  it("still reports a skip in headings over a list item that carries the missing number", () => {
    const baseline = [
      "# Teams baseline",
      "",
      "## 1. Meetings",
      "",
      "Set the policy.",
      "",
      "## 2. External access",
      "",
      "1.  Sign in.",
      "",
      "2.  Select Policies.",
      "",
      "3.  Select Global.",
      "",
      "## 4. Email integration",
      "",
      "Turn it off.",
      "",
    ];
    assert.deepEqual(gapsOf(en, "t.md", baseline.join("\n"), "docs/manual"), [["2", "4"]]);
  });

  it("does not report a skip over headings written in another width, which the tree reads apart", () => {
    const faq = [
      "# 相談事例",
      "",
      "## 1.  購入に関する相談",
      "",
      "回答。",
      "",
      "## 2.  解約に関する相談",
      "",
      "回答。",
      "",
      "## ３.  手数料に関する相談",
      "",
      "回答。",
      "",
      "## 4.  相続に関する相談",
      "",
      "回答。",
      "",
    ];
    assert.deepEqual(gapsOf(ja, "f.md", faq.join("\n"), "docs/faq"), []);
  });

  it("does not report a skip over items joined to the heading of the item before", () => {
    const minutes = (heading: string): string =>
      [
        "# 会議録",
        "",
        "##### (9) 緑の計画について",
        "",
        "報告があった。",
        "",
        `##### ${heading}`,
        "",
        "報告があった。",
        "",
        "##### (12) 予算について",
        "",
        "報告があった。",
        "",
      ].join("\n");
    assert.deepEqual(gapsOf(ja, "m.md", minutes("(10) 名称の変更について (11) 教育の計画について"), "business/meeting-notes"), []);
    assert.deepEqual(gapsOf(ja, "m.md", minutes("(10) 名称の変更について"), "business/meeting-notes"), [["（10）", "（12）"]]);
  });
});

const STATUTE = [
  "第7条 特定手続のうち特許出願その他の経済産業省令で定めるものを書面の提出により行った者は、特許庁長官に対し、その事項を磁気ディスクに記録すべきことを求めなければならない。",
  "",
  "第9条 特許庁長官は、その登録を受けた者に、ファイルへの記録の業務を行わせることができる。",
  "",
  "第40条 次に掲げる者は、政令で定める額の手数料を納付しなければならない。",
  "",
];

describe("numbering-gap: articles quoted under a heading that says they are an excerpt", () => {
  const manual = (heading: string): string => ["# 電子化手数料について", "", "手数料を納付してください。", "", `## ${heading}`, "", ...STATUTE].join("\n");

  it("does not report the skips under an excerpt heading", () => {
    assert.deepEqual(gapsOf(ja, "d.md", manual("参考：根拠条文の抜粋"), "docs/manual"), []);
  });

  it("still reports them under another heading", () => {
    assert.deepEqual(gapsOf(ja, "d.md", manual("参考：根拠条文"), "docs/manual"), [
      ["第7条", "第9条"],
      ["第9条", "第40条"],
    ]);
  });
});

describe("numbering-gap: one number repeated as a name", () => {
  const glossary = (...heads: string[]): string =>
    ["# Glossary", "", "## S", "", ...heads.flatMap((head) => [head, "", "A term used in federal accessibility work.", ""])].join("\n");

  it("does not report glossary headwords that all carry the same number", () => {
    assert.deepEqual(
      gapsOf(en, "g.md", glossary("Section 508 Conformant", "Section 508 Program or equivalent", "Section 508 Program Manager"), "docs/glossary"),
      [],
    );
  });

  it("still reports a repeated number among others", () => {
    assert.deepEqual(gapsOf(en, "g.md", glossary("Section 507 Scope", "Section 508 Conformant", "Section 508 Program Manager"), "docs/glossary"), [
      ["Section 508", "Section 508"],
    ]);
  });
});

describe("labelWrittenBetween", () => {
  const at = (source: string, label: string): number => source.indexOf(label);

  it("finds a missing label set out at a line start, after spaces, or in the heading before", () => {
    const plain = "6.1 eGain warrants.\n\n6.2 eGain represents.\n\n6.3 EXCEPT AS PROVIDED";
    assert.equal(labelWrittenBetween(plain, { label: "2.1", ordinal: 1, last: 1, start: 0 }, { label: "6.3", ordinal: 3, start: at(plain, "6.3") }), true);
    const fullWidth = "##### （10） 名称について （11） 計画について\n\n##### （12） 予算";
    assert.equal(
      labelWrittenBetween(fullWidth, { label: "（10）", ordinal: 10, last: 10, start: 0 }, { label: "（12）", ordinal: 12, start: at(fullWidth, "（12）") }),
      true,
    );
  });

  it("does not find a label in a sentence, a label of another number, or one it cannot write", () => {
    const sentence = "(c) Exchange under clause (d) hereof.\n\n(e) Any portion";
    assert.equal(
      labelWrittenBetween(sentence, { label: "(c)", ordinal: 3, last: 3, start: 0 }, { label: "(e)", ordinal: 5, start: at(sentence, "(e)") }),
      false,
    );
    const other = "(c) Exchange.   (f) Other.\n\n(e) Any portion";
    assert.equal(labelWrittenBetween(other, { label: "(c)", ordinal: 3, last: 3, start: 0 }, { label: "(e)", ordinal: 5, start: at(other, "(e)") }), false);
    const kanji = "第七条 記録する。\n\n第八条 行う。\n\n第九条 納付する。";
    assert.equal(
      labelWrittenBetween(kanji, { label: "第七条", ordinal: 7, last: 7, start: 0 }, { label: "第九条", ordinal: 9, start: at(kanji, "第九条") }),
      false,
    );
    assert.equal(labelWrittenBetween("", { label: "(c)", ordinal: 3, last: 3, start: 0 }, { label: "(e)", ordinal: 5, start: 0 }), false);
  });
});
