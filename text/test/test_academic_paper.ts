import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { authorKey, citationMarks, numbersIn, type CitationMark, type CitationWords } from "../packages/chaff/src/detectors/citation-marks.ts";
import { citingFootnotes, minorityCitations } from "../packages/chaff/src/detectors/citation-style.ts";
import { citationSlips, namesEntry } from "../packages/chaff/src/detectors/citation-entry.ts";
import { labelOf } from "../packages/chaff/src/detectors/abstract-length.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { Finding, LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// The academic paper's own checks: one citation style, citations against the reference list, figures referred to in
// order, and the abstract's length. Every example is self-written.

const findingsOf = (adapter: LanguageAdapter, rule: string, source: string, genre = "academic/paper"): Finding[] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(adapter.id), {}, false, genre).findings.filter((finding) => finding.rule === rule);

const variantsOf = (adapter: LanguageAdapter, rule: string, source: string): string[] =>
  findingsOf(adapter, rule, source).map((finding) => finding.variant ?? "");

const WORDS: CitationWords = {
  pairs: ["and", "&", "・"],
  others: ["et al.", "ら", "他"],
  notAuthors: new Set(["march", "spring", "年度"]),
  referenceHeadings: ["References", "参考文献"],
};

const stylesIn = (text: string): string[] => citationMarks(text, [], WORDS).map((mark) => `${mark.style} ${mark.written}`);

const mark = (style: CitationMark["style"], start: number, numbers: number[] = []): CitationMark => ({
  start,
  end: start + 3,
  style,
  written: `#${String(start)}`,
  numbers,
  authorYears: [],
});

describe("citation marks: the shapes a paper cites in", () => {
  it("spreads number lists and ranges, and refuses a range that is no citation", () => {
    assert.deepEqual(numbersIn("1, 3-5"), [1, 3, 4, 5]);
    assert.deepEqual(numbersIn("2–4"), [2, 3, 4]);
    assert.deepEqual(numbersIn("5-3"), []);
    assert.deepEqual(numbersIn("1-90"), []);
  });

  it("reads numbers in brackets, but not a link's label or a numbered line", () => {
    assert.deepEqual(stylesIn("Sleep helps [1]. Naps help [2, 3]."), ["numeric [1]", "numeric [2, 3]"]);
    assert.deepEqual(stylesIn("See the [manual][1]. Both agree [1][2]."), ["numeric [1]", "numeric [2]"]);
    assert.deepEqual(stylesIn("[1] Smith, A. Sleep.\n- [2] Jones."), []);
    assert.deepEqual(stylesIn("[1]: https://example.com"), []);
  });

  it("reads Japanese numbered styles, and not a parenthesis opened before the number", () => {
    assert.deepEqual(stylesIn("効果がある〔1〕。"), ["kikko 〔1〕"]);
    assert.deepEqual(stylesIn("効果がある1)。報告もある2,3)。"), ["paren-number 1)", "paren-number 2,3)"]);
    assert.deepEqual(stylesIn("結果を示す（図1)。"), []);
    assert.deepEqual(stylesIn("1) まず登録する。"), []);
  });

  it("reads author and year, in parentheses and in the sentence", () => {
    assert.deepEqual(stylesIn("Naps help (Smith, 2020)."), ["author-year (Smith, 2020)"]);
    assert.deepEqual(stylesIn("Naps help (Smith and Jones 2020; Young et al., 2019a)."), ["author-year (Smith and Jones 2020; Young et al., 2019a)"]);
    assert.deepEqual(stylesIn("As Smith et al. (2020) showed."), ["author-year Smith et al. (2020)"]);
    assert.deepEqual(stylesIn("効果がある（山田ら, 2020）。山田（2019）も同じ。"), ["author-year （山田ら, 2020）", "author-year 山田（2019）"]);
  });

  it("does not read a date or a remark in parentheses as a citation", () => {
    assert.deepEqual(stylesIn("It opened (March 2020) and closed in Spring (2021)."), []);
    assert.deepEqual(stylesIn("It costs less (about 2020 yen) than before (see below)."), []);
    assert.deepEqual(stylesIn("実施した（令和元年度 2019）。"), []);
  });

  it("takes the first author's surname as the key", () => {
    assert.equal(authorKey("Smith et al.", WORDS.others), "smith");
    assert.equal(authorKey("山田ら", WORDS.others), "山田");
    assert.equal(authorKey("山田・佐藤", WORDS.others), "山田");
  });
});

describe("citation-style-mix: the minority style", () => {
  it("reports the few citations in another style, at most limit of them", () => {
    const marks = [mark("numeric", 0), mark("numeric", 10), mark("numeric", 20), mark("author-year", 30)];
    assert.deepEqual(
      minorityCitations(marks, 2).map(({ mark: found }) => found.start),
      [30],
    );
    assert.deepEqual(minorityCitations([...marks, mark("author-year", 40), mark("author-year", 50)], 2), []);
    const numbered = [0, 1, 2, 3, 4].map((index) => mark("numeric", index * 10));
    assert.deepEqual(minorityCitations([...numbered, mark("author-year", 60), mark("author-year", 70), mark("author-year", 80)], 2), []);
  });

  it("reports nothing when the styles are even, or there is one style", () => {
    assert.deepEqual(minorityCitations([mark("numeric", 0), mark("author-year", 10)], 2), []);
    assert.deepEqual(minorityCitations([mark("numeric", 0), mark("numeric", 10)], 2), []);
  });

  it("counts a footnote as a citation only when its note gives a year", () => {
    assert.deepEqual([...citingFootnotes("Text[^1][^2].\n\n[^1]: Smith, A. Sleep. 2020.\n[^2]: A remark.")], ["[^1]"]);
  });

  it("reports a Japanese paper's one author-year citation among numbers", () => {
    const source = "# 睡眠\n\n睡眠は記憶を助ける[1]。昼寝も効く[2]。夜の学習のあとに眠るとよい（山田, 2020）。\n";
    assert.deepEqual(
      findingsOf(ja, "citation-style-mix", source).map((finding) => finding.values["citation"]),
      ["（山田, 2020）"],
    );
  });

  it("runs only in the academic paper genre", () => {
    const source = "# Sleep\n\nSleep helps [1]. Naps help [2]. Evening study helps (Young, 2020).\n";
    assert.equal(findingsOf(en, "citation-style-mix", source).length, 1);
    assert.deepEqual(findingsOf(en, "citation-style-mix", source, "blog/tech"), []);
  });
});

describe("citation-reference-mismatch: citations against the list", () => {
  const list = (...entries: string[]): string => ["", "## References", "", ...entries.map((entry) => `- ${entry}`), ""].join("\n");

  it("reports a numbered citation with no entry, and an entry never cited", () => {
    const source = `# Sleep\n\nSleep helps [1]. Naps help [3].\n${list("[1] Smith, A. 2019.", "[2] Jones, B. 2021.")}`;
    assert.deepEqual(variantsOf(en, "citation-reference-mismatch", source), ["missing", "uncited"]);
  });

  it("matches author-year citations by surname and year, a Japanese surname against the full name", () => {
    const source = `# 睡眠\n\n効果がある（山田, 2020）。佐藤ら（2019）も同じ。\n${list("山田太郎. 夜の学習. 2020.", "佐藤花子. 昼寝. 2019.")}`;
    assert.deepEqual(variantsOf(ja, "citation-reference-mismatch", source), []);
    assert.ok(namesEntry("2020 山田太郎", "2020 山田"));
    assert.ok(!namesEntry("2020 smithson", "2020 smith"));
    assert.ok(!namesEntry("2020 林田太郎", "2020 林"));
    assert.ok(namesEntry("2020 林", "2020 林"));
  });

  it("reads unbulleted author-year entries one per line, and not a wrapped line", () => {
    const entries = "\n## References\n\nSmith, A. (2020). Naps.\nJones, B. (2021). Sleep\nJournal of Rest, 2019.\n";
    const source = `# Sleep\n\nNaps help (Smith, 2020). Sleep helps (Jones, 2021).\n${entries}`;
    assert.deepEqual(variantsOf(en, "citation-reference-mismatch", source), []);
    assert.deepEqual(variantsOf(en, "citation-reference-mismatch", source.replace("(Jones, 2021)", "(Jones, 2022)")), ["missing", "uncited"]);
  });

  it("reports an author-year citation whose year is not in the list", () => {
    const source = `# Sleep\n\nNaps help (Smith, 2019). Sleep helps (Jones, 2021).\n${list("Smith, A. (2020). Naps.", "Jones, B. (2021). Sleep.")}`;
    assert.deepEqual(
      findingsOf(en, "citation-reference-mismatch", source).map((finding) => [finding.variant, finding.values["key"]]),
      [
        ["missing", "smith 2019"],
        ["uncited", "smith 2020"],
      ],
    );
  });

  it("does not report uncited entries when most entries are cited in no form chaff reads", () => {
    const entries = [1, 2, 3, 4].map((number) => ({ start: number * 10, number }));
    assert.deepEqual(citationSlips(entries, [mark("numeric", 0, [1])]), []);
    assert.deepEqual(
      citationSlips(entries, [mark("numeric", 0, [1, 2, 3])]).map((slip) => slip.variant),
      ["uncited"],
    );
  });

  it("does not run without a reference list, or with one entry", () => {
    assert.deepEqual(variantsOf(en, "citation-reference-mismatch", "# Sleep\n\nNaps help [3].\n"), []);
    assert.deepEqual(variantsOf(en, "citation-reference-mismatch", `# Sleep\n\nNaps help [3].\n${list("[1] Smith, A. 2019.")}`), []);
  });
});

describe("figure-reference-order: figures referred to in order and in place", () => {
  it("reports a figure first referred to after a higher number", () => {
    const source = "# Naps\n\nFigure 2 shows recall. Figure 1 shows the design.\n\nFigure 1: Design\n\nFigure 2: Recall\n";
    assert.deepEqual(
      findingsOf(en, "figure-reference-order", source).map((finding) => [finding.variant, finding.values["label"], finding.values["after"]]),
      [["order", "Figure 1", "Figure 2"]],
    );
  });

  it("compares tables apart from figures, and sub-numbers in order", () => {
    const source = "# Naps\n\nTable 1 and Figure 2.1 come first, then Figure 2.2 and Table 2.\n\nFigure 2.1: A\n\nFigure 2.2: B\n\nTable 1: C\n\nTable 2: D\n";
    assert.deepEqual(findingsOf(en, "figure-reference-order", source), []);
  });

  it("reports a figure first referred to past a heading after its caption, and one never referred to", () => {
    const late = "# Naps\n\n## Results\n\n図1　研究の流れ\n\n本文。\n\n## 考察\n\n図1のとおりである。\n";
    assert.deepEqual(variantsOf(ja, "figure-reference-order", late), ["late"]);
    const unreferenced = "# Naps\n\nFigure 1 shows the design.\n\nFigure 1: Design\n\nFigure 2: Recall\n";
    assert.deepEqual(variantsOf(en, "figure-reference-order", unreferenced), ["unreferenced"]);
  });

  it("does not report figures the text never refers to at all", () => {
    assert.deepEqual(variantsOf(en, "figure-reference-order", "# Naps\n\nText.\n\nFigure 1: Design\n\nFigure 2: Recall\n"), []);
  });
});

describe("abstract-length: an abstract over the limit, or none", () => {
  const sentence = "本研究では、昼寝が単語の記憶を助けるかを大学生で調べた。";

  it("reads an abstract's label with its marks", () => {
    assert.equal(labelOf("【要旨】"), "要旨");
    assert.equal(labelOf("## 1. Abstract:"), "abstract");
    assert.equal(labelOf("**Abstract**"), "abstract");
  });

  it("measures a Japanese abstract in characters, under a heading, alone on a line or at a paragraph's head", () => {
    const long = sentence.repeat(40);
    assert.deepEqual(variantsOf(ja, "abstract-length", `# 昼寝\n\n## 要旨\n\n${long}\n`), ["chars"]);
    assert.deepEqual(variantsOf(ja, "abstract-length", `# 昼寝\n\n要旨\n\n${long}\n`), ["chars"]);
    assert.deepEqual(variantsOf(ja, "abstract-length", `# 昼寝\n\n【要旨】${long}\n`), ["chars"]);
    assert.deepEqual(variantsOf(ja, "abstract-length", `# 昼寝\n\n## 要旨\n\n${sentence}\n`), []);
  });

  it("measures an English abstract in words", () => {
    const long = "We tested whether a short nap helps students remember a list of words. ".repeat(40);
    assert.deepEqual(variantsOf(en, "abstract-length", `# Naps\n\nAbstract: ${long}\n`), ["words"]);
    assert.deepEqual(variantsOf(en, "abstract-length", `# Naps\n\nAbstract: ${long.slice(0, 300)}\n`), []);
  });

  it("measures the English abstract of a Japanese paper in words, against the English limit", () => {
    const english = (repeats: number): string => "We tested whether a short nap helps students remember a list of words. ".repeat(repeats);
    assert.deepEqual(variantsOf(ja, "abstract-length", `# 昼寝\n\n## 要旨\n\n${sentence}\n\n## Abstract\n\n${english(25)}\n`), []);
    assert.deepEqual(variantsOf(ja, "abstract-length", `# 昼寝\n\n## 要旨\n\n${sentence}\n\n## Abstract\n\n${english(40)}\n`), ["words"]);
  });

  it("reports a paper with sections and no abstract, and not a document without them", () => {
    assert.deepEqual(variantsOf(en, "abstract-length", "# Naps\n\n## Introduction\n\nText.\n\n## Methods\n\nText.\n"), ["missing"]);
    assert.deepEqual(variantsOf(en, "abstract-length", "# Naps\n\n## Introduction\n\nText.\n\n## Budget\n\nText.\n"), []);
    assert.deepEqual(variantsOf(ja, "abstract-length", "# 昼寝\n\n## はじめに\n\n本文。\n\n## 方法\n\n本文。\n"), ["missing"]);
  });
});
