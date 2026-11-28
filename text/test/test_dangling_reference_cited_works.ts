import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";

// dangling-reference and the places where a reference names another work's unit, not this document's: an opinion's
// paragraph that opens with the statute section it discusses, a paper's reference list, a statute's "§401 et seq." of
// a code's title, and an Act copied under a heading that adds its short name. Excerpts from US Supreme Court opinions
// (Wickard v. Filburn, Panama Refining v. Ryan, Humphrey's Executor v. United States, West Virginia v. Barnette) and
// from 5 U.S.C. 552's notes, all public domain (chaff-corpus); the Japanese lines and the rest are self-written.

const lines = (...rows: string[]): string => rows.join("\n");
/** The full-width space a Japanese paragraph opens with. */
const INDENT = "\u3000";

const labels = (path: string, source: string, genre: string, language: "en" | "ja" = "en"): string[] =>
  runRules(buildDocument(path, source, language === "en" ? en : ja), loadRules(language), {}, true, genre)
    .findings.filter((finding) => finding.rule === "dangling-reference")
    .map((finding) => String(finding.values["label"]));

const opinion = (...body: string[]): string[] => labels("opinion.md", lines(...body), "legal/judgment");

describe("an opinion's paragraph that opens with a statute's section", () => {
  it("valid: a footnote or paragraph citing a section is not a heading, so the opinion has no articles to look in", () =>
    assert.deepEqual(
      opinion(
        "It is urged that under the Commerce Clause of the Constitution, Article I, § 8, clause 3, Congress does not possess the power.",
        "",
        "Section 9(c) is brief and unambiguous. It does not attempt to control the production of petroleum.",
        "",
        "Section 6 (15 USCA § 46), among other things, gives the commission wide powers of investigation.",
        "",
        "## Notes",
        "",
        "§ 331, 7 U.S.C. § 1331, 7 U.S.C.A. § 1331.",
        "",
        "§ 5(a) of the Selective Training and Service Act of 1940, 50 U.S.C. (App.) § 305(g).",
        "",
        "§ 302(b) had provided for a loan to non-cooperators of 60% of the basic loan rate. See § 10(c) of the amendment.",
      ),
      [],
    ));

  it("invalid: a statute's section headings still count, and a reference to a missing one is reported", () =>
    assert.deepEqual(
      opinion(
        "§ 1. Short title.",
        "",
        "This Act may be cited as the Example Act.",
        "",
        "§ 2 (Reserved).",
        "",
        "§ 3(a) Definitions",
        "",
        "In this Act, terms have the meanings in § 1 and § 7.",
      ),
      ["§ 7"],
    ));
});

describe("a reference list", () => {
  const paper = (entry: string): string[] =>
    labels(
      "paper.md",
      lines("# A paper", "", "## Article 1 Scope", "", "Our scope follows Article 1 and Article 4.", "", "## References", "", `- ${entry}`),
      "academic/paper",
    );

  it("valid: an article number in a journal entry is the journal's", () =>
    assert.deepEqual(paper("A. Mathur et al. (2019) Dark patterns at scale. Proc. ACM Hum.-Comput. Interact. 3 (CSCW), pp. Article 81."), ["Article 4"]));
  it("invalid: a reference in the text outside the list is still reported", () => assert.deepEqual(paper("B. Lee (2020) A book."), ["Article 4"]));
});

describe("a code's sections from a number on (et seq.)", () => {
  const statute = (note: string): string[] =>
    labels("s.md", lines("### §552. Public information", "", "(a) Each agency shall make information available.", "", note), "legal/statute");

  it("valid: '(§401 et seq.) of Title 50' is the code's", () =>
    assert.deepEqual(statute("The Act was formerly classified principally to chapter 15 (§401 et seq.) of Title 50, War and National Defense."), []));
  it("invalid: a bare '§401 et seq.' is still looked up", () => assert.deepEqual(statute("The Act was classified to §401 et seq."), ["§401"]));
});

describe("他の文書の名前に略称を添えた見出しの下に引き写した条", () => {
  const excerpt = (heading: string): string[] =>
    labels(
      "manual.md",
      lines(
        "# 手数料について",
        "",
        "## 手数料とは",
        "",
        "例示手続特例法第9条に定める手数料です。",
        "",
        "## 参考：根拠条文の抜粋",
        "",
        `### ${heading}`,
        "",
        "第9条 長官は、第6条第3項の規定による記録を行わせることができる。",
      ),
      "docs/manual",
      "ja",
    );

  it("valid: 見出しの略称（例示法）を除けば文書が引く名前なら、引き写した条の参照は報告しない", () =>
    assert.deepEqual(excerpt("例示手続特例法（例示法）"), []));
  it("valid: ＜抜粋＞の注記も名前ではない", () => assert.deepEqual(excerpt("例示手続特例法（例示法）＜抜粋＞"), []));
  it("invalid: 名前が違えば、見出しの下の参照も報告する", () => assert.deepEqual(excerpt("別の法律（別法）"), ["第6条第3項"]));
});

describe("選択肢ごとに項を見出しにしたひな形（第1条1項（オプション1））", () => {
  const model = (reference: string): string[] =>
    labels(
      "nda.md",
      lines(
        "秘密保持契約書",
        "",
        "第1条1項（オプション1：範囲）  ",
        "　本契約において「秘密情報」とは、一切の情報をいう。",
        "",
        "第1条2項（例外）  ",
        "　前項にかかわらず、公知の情報は除く。",
        "",
        "第2条（秘密保持）  ",
        `${INDENT}受領者は、${reference}の秘密情報を保持する。`,
      ),
      "legal/contract",
      "ja",
    );

  it("valid: 「第1条1項（…）」は第1条の見出しなので、第1条への参照は行き先がある", () => assert.deepEqual(model("第1条"), []));
  it("invalid: 無い条への参照は報告する", () => assert.deepEqual(model("第5条"), ["第5条"]));
});
