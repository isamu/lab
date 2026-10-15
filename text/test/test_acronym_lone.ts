import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { isBracketed, isInHeading, isNamePart } from "../packages/chaff/src/detectors/acronym-lone.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";

// 説明のない略語が上限（normal で 3）に届かない文書でも、書き手が略語を展開する文書なら、展開しなかった 1 つを指す。例文はすべて自作。

const RULES = loadRules("en");

const reportedAt = (source: string, level: "strict" | "normal" | "relaxed" = "normal"): string[] =>
  runRules(buildDocument("t.md", source, en), RULES, { "undefined-acronym": level }, true, "business/report")
    .findings.filter((finding) => finding.rule === "undefined-acronym")
    .map((finding) => String(finding.values["word"]));

const SPELLED_OUT = [
  "The Harbour Lighting Office (HLO) runs the lamps.",
  "The Quay Maintenance Board (QMB) mends the walls.",
  "The Tide Survey Unit (TSU) reads the gauges.",
].join(" ");

const notice = (rest: string): string => `# Harbour notice\n\n${SPELLED_OUT}\n\n${rest}\n`;

describe("isNamePart", () => {
  const namePart = (sentence: string, acronym: string): boolean => {
    const start = sentence.indexOf(acronym);
    return isNamePart(sentence, start, start + acronym.length);
  };

  [
    ["後ろに大文字で始まる語", "The study was run by SRI International last year.", "SRI"],
    ["前に大文字で始まる語", "We discussed the Math FMA proposal.", "FMA"],
    ["ダッシュで繋いだ名前", "It follows the Japan–DPRK Pyongyang Declaration.", "DPRK"],
    ["所有の形の名前", "It aligns with HM Treasury’s pay controls.", "HM"],
  ].forEach(([form, sentence, acronym]) => {
    it(`名前の一部: ${String(form)}`, () => assert.equal(namePart(String(sentence), String(acronym)), true));
  });

  [
    ["小文字の語に挟まれる", "Give the number of the CFR title.", "CFR"],
    ["文の頭の語の後ろ", "The RIN identifies each action.", "RIN"],
    ["文の頭", "PCE prices rose last month.", "PCE"],
    ["文の終わり", "Send it to the TSU.", "TSU"],
    ["後ろが大文字だけの語", "Read the ABC NOW notice.", "ABC"],
    ["空の文", "", "ABC"],
  ].forEach(([form, sentence, acronym]) => {
    it(`名前の一部でない: ${String(form)}`, () => assert.equal(namePart(String(sentence), String(acronym)), false));
  });
});

describe("isBracketed", () => {
  it("略語だけを括弧に入れた所を数える", () => {
    assert.equal(isBracketed("The Tide Survey Unit (TSU) reads.", "TSU"), true);
    assert.equal(isBracketed("潮位調査班（TSU）が読む。", "TSU"), true);
    assert.equal(isBracketed("the Agreement (“MNDA”) applies", "MNDA"), true);
  });

  it("略語の後ろの括弧や、列挙の括弧は数えない", () => {
    assert.equal(isBracketed("Typo in README ( #1455 ) fixed.", "README"), false);
    assert.equal(isBracketed("Agencies (EPA, FDIC, GSA) agreed.", "EPA"), false);
    assert.equal(isBracketed("The TSU reads.", "TSU"), false);
    assert.equal(isBracketed("", "TSU"), false);
  });

  it("別の略語の括弧を取り違えない", () => {
    assert.equal(isBracketed("The office (HLOX) runs.", "HLO"), false);
  });
});

describe("isInHeading", () => {
  it("見出しに語として出れば真", () => assert.equal(isInHeading(["NASA Selects a Telescope"], "NASA"), true));
  it("語の一部や、見出しが無いときは偽", () => {
    assert.equal(isInHeading(["NASAL sprays"], "NASA"), false);
    assert.equal(isInHeading([], "NASA"), false);
  });
});

describe("undefined-acronym: 上限に届かない文書の、展開しなかった 1 つ", () => {
  it("略語を展開する文書では、1 つだけの抜けも指す", () => {
    assert.deepEqual(reportedAt(notice("Give the number of the CFR title.")), ["CFR"]);
  });

  it("2 つの抜けも、どちらも指す", () => {
    assert.deepEqual(reportedAt(notice("Give the number of the CFR title. The RIN identifies each action.")), ["CFR", "RIN"]);
  });

  it("展開が上限より少ない文書では、これまでどおり指さない", () => {
    const two =
      "# Harbour notice\n\nThe Harbour Lighting Office (HLO) runs the lamps. The Quay Maintenance Board (QMB) mends the walls.\n\nGive the number of the CFR title.\n";
    assert.deepEqual(reportedAt(two), []);
  });

  it("名前の一部の略語は、展開する文書でも指さない", () => {
    assert.deepEqual(reportedAt(notice("The study was run by SRI International.")), []);
  });

  it("見出しに出る略語は、展開する文書でも指さない", () => {
    assert.deepEqual(reportedAt(`# PRX Harbour notice\n\n${SPELLED_OUT}\n\nThe PRX lamps are lit at dusk.\n`), []);
  });

  it("略語の後ろのリンクの括弧は、展開として数えない", () => {
    const links = ["ABC", "DEF", "GHI"].map((word, index) => `- Fix ${word} ([#${String(index)}](https://example.com/${String(index)}))`);
    const changes = `# Changes\n\n${[...links, "- Use JKL in the build"].join("\n")}\n`;
    assert.deepEqual(reportedAt(changes, "strict"), ["JKL"]);
    assert.deepEqual(reportedAt(changes), []);
  });

  it("relaxed では、その上限の数だけ展開した文書でだけ指す", () => {
    assert.deepEqual(reportedAt(notice("Give the number of the CFR title."), "relaxed"), []);
  });

  it("上限に届いた文書は、これまでどおりすべて指す", () => {
    assert.deepEqual(reportedAt("# Notice\n\nThe CFR, the RIN and the SRI International study are cited."), ["CFR", "RIN", "SRI"]);
  });
});
