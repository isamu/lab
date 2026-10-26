import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { reportedAcronyms } from "./rule-run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { numberedSeries } from "../packages/chaff/src/detectors/acronym-series.ts";
import { spelledInSentence } from "../packages/chaff/src/detectors/acronym-gloss.ts";
import { referenceEntrySpans } from "../packages/chaff/src/detectors/reference-entry.ts";

// undefined-acronym and capitals the reader does not need spelled out: a series cited by several numbers, a name written out
// earlier in the same sentence, an entry of a bracket-keyed reference list, a judge's surname after his title, a company's
// name with its legal form, a trademark, a citation of a code. The excerpts are from US federal documents (public domain:
// Federal Reserve notes, an RFC's reference list, a FEMA citation, a Supreme Court opinion) or self-written.

const doc = (...body: string[]): string => ["# Notes", "", ...body, "", "The SRE joins the call."].join("\n");

describe("numberedSeries", () => {
  it("valid: capitals before two different numbers", () => {
    assert.deepEqual([...numberedSeries("This document is subject to BCP 78. The key words are in BCP 14.")], ["BCP"]);
    assert.deepEqual([...numberedSeries("Puerto Rico Hurricane Maria (DR 4339) and U.S. Virgin Islands Hurricane Maria (DR 4340)")], ["DR"]);
    assert.deepEqual([...numberedSeries("It obsoletes RFC 5785 and updates RFC 7230.")], ["RFC"]);
  });

  it("invalid: one number, the same number twice, years, decimals, ranges and longer identifiers", () => {
    assert.deepEqual([...numberedSeries("Generic Syntax, STD 66, January 2005.")], []);
    assert.deepEqual([...numberedSeries("See BCP 78. Again, BCP 78.")], []);
    assert.deepEqual([...numberedSeries("SKO 2024 and SKO 2025 were in Austin.")], []);
    assert.deepEqual([...numberedSeries("PM 2.5 and PM 10.5 levels")], []);
    assert.deepEqual([...numberedSeries("the SLO 100-200 band and the SLO 300-400 band")], []);
    assert.deepEqual([...numberedSeries("the ABC 12x and ABC 13x parts")], []);
  });

  it("abnormal input: empty text, lone capitals", () => {
    assert.deepEqual([...numberedSeries("")], []);
    assert.deepEqual([...numberedSeries("RFC BCP STD")], []);
  });
});

describe("spelledInSentence", () => {
  it("valid: the name earlier in the sentence than the acronym's first use", () => {
    const sba = "7. U.S. Small Business Administration, Office of Advocacy, 2025 Small Business Profile: Rural Areas (Washington: SBA, August).";
    assert.deepEqual([...spelledInSentence([sba])], ["SBA"]);
    const nigc = "In re Colo. River Indian Tribes, NOV/CFA 01-01, 5-6 (Nat'l Indian Gaming Comm'n May 30, 2002) (NIGC Final Order).";
    assert.deepEqual([...spelledInSentence([nigc])], ["NIGC"]);
    const jchs = "See Joint Center for Housing Studies of Harvard University (2026), America's Rental Housing 2026 (Cambridge, Mass.: JCHS).";
    assert.deepEqual([...spelledInSentence([jchs])], ["JCHS"]);
  });

  it("invalid: the name after the first use, in another sentence, with other words between, or not word for word", () => {
    const after = ["Use the OIT signature logo.", "Enter Office of Information and Technology for the OIT logo."];
    assert.deepEqual([...spelledInSentence(after)], []);
    assert.deepEqual([...spelledInSentence(["The National Park Service runs it.", "Ask the NPS desk."])], []);
    assert.deepEqual([...spelledInSentence(["Our Customer Relations team uses the CRM daily."])], []);
    assert.deepEqual([...spelledInSentence(["Small business, Administration and the SBA."])], []);
    assert.deepEqual([...spelledInSentence(["The SBA is the Small Business Administration."])], []);
    // A bracket right after the name is the bracketed expansion, which the expansion reader decides.
    assert.deepEqual([...spelledInSentence(["The Department of Health and Human Services (HHS and the Department) met."])], []);
    assert.deepEqual([...spelledInSentence(["The Advanced Research Projects Agency for Health (ARPA-H program) funds it."])], []);
  });

  it("abnormal input: no sentences, empty sentences, two letters only", () => {
    assert.deepEqual([...spelledInSentence([])], []);
    assert.deepEqual([...spelledInSentence(["", " "])], []);
    assert.deepEqual([...spelledInSentence(["Data Protection by the DP team."])], []);
  });
});

describe("referenceEntrySpans", () => {
  const list = [
    "8.2.  Informative References",
    "",
    '   [FETCH]    WHATWG, "Fetch - Living Standard",',
    "              <https://fetch.spec.whatwg.org/>.",
    "",
    '   [RFC3986]  Berners-Lee, T., Fielding, R., and L. Masinter, "Uniform',
    '              Resource Identifier (URI): Generic Syntax", STD 66,',
    "              RFC 3986, DOI 10.17487/RFC3986, January 2005.",
    "",
    "   The IANA registry is updated.",
  ].join("\n");
  const covered = (word: string): boolean => referenceEntrySpans(list).some((span) => span.start <= list.indexOf(word) && list.indexOf(word) < span.end);

  it("valid: the label's line and the lines indented under it", () => {
    assert.equal(covered("WHATWG"), true);
    assert.equal(covered("STD 66"), true);
  });

  it("invalid: the prose after the list, a heading, a link definition, a label without a wide gap", () => {
    assert.equal(covered("IANA"), false);
    assert.equal(covered("Informative"), false);
    assert.deepEqual(referenceEntrySpans("[FETCH]: https://fetch.spec.whatwg.org/"), []);
    assert.deepEqual(referenceEntrySpans("[FETCH] WHATWG says so."), []);
  });

  it("abnormal input: empty text, a label alone", () => {
    assert.deepEqual(referenceEntrySpans(""), []);
    assert.deepEqual(referenceEntrySpans("[FETCH]"), []);
  });
});

describe("undefined-acronym: series, spelled names, reference entries, judges, companies, trademarks and code citations", () => {
  it("valid: a series cited by number, a name before the acronym, a reference entry", () => {
    assert.deepEqual(reportedAcronyms(en, doc("See FEMA's disaster declarations: Hurricane Maria (DR 4339) and Hurricane Irma (DR 4340).")), ["FEMA", "SRE"]);
    assert.deepEqual(reportedAcronyms(en, doc("1. U.S. Small Business Administration, 2025 Small Business Profile (Washington: SBA, August).")), ["SRE"]);
    const references = [
      "# Notes",
      "",
      "The SRE joins the call; see [FETCH].",
      "",
      '   [FETCH]    WHATWG, "Fetch - Living Standard",',
      "              STD 66, January 2005.",
    ];
    assert.deepEqual(reportedAcronyms(en, references.join("\n")), ["SRE"]);
  });

  it("invalid: a lone DR, a name in another sentence, capitals in prose", () => {
    assert.deepEqual(reportedAcronyms(en, doc("The DR plan is tested yearly.")), ["DR", "SRE"]);
    assert.deepEqual(reportedAcronyms(en, doc("The Small Business Administration helps.", "Ask the SBA.")), ["SBA", "SRE"]);
    assert.deepEqual(reportedAcronyms(en, doc("WHATWG publishes the Fetch standard.")), ["WHATWG", "SRE"]);
  });

  it("valid: a judge's surname after his title, a company's name with its form, a trademark, a code cited by section", () => {
    const opinion = "Mr. Justice BULLER, in the case of the King v. Pasmore, agreed, and Lord KENYON says so, as did Lord HOLT.";
    assert.deepEqual(reportedAcronyms(en, doc(opinion)), ["SRE"]);
    assert.deepEqual(reportedAcronyms(en, doc("FormGen Inc. and GT Interactive Software Corp. own the rights.")), ["SRE"]);
    assert.deepEqual(reportedAcronyms(en, doc("Use Adobe® Acrobat DC® to add structure.")), ["SRE"]);
    assert.deepEqual(reportedAcronyms(en, doc("See 44 USC. 3502 (20).")), ["SRE"]);
    assert.deepEqual(reportedAcronyms(en, doc("The President, by Executive Order No. 6199 (15 USCA § 709 note), and (15 USCA Appendix § 12), acted.")), [
      "SRE",
    ]);
  });

  it("invalid: the same capitals without the title, the form or the mark", () => {
    assert.deepEqual(reportedAcronyms(en, doc("The HOLT team reviews it.")), ["HOLT", "SRE"]);
    assert.deepEqual(reportedAcronyms(en, doc("The GT team owns the rights.")), ["GT", "SRE"]);
    assert.deepEqual(reportedAcronyms(en, doc("Use DC power here.")), ["DC", "SRE"]);
    assert.deepEqual(reportedAcronyms(en, doc("The USCA team met.")), ["USCA", "SRE"]);
  });

  it("日本語: 漢字を挟んで会社の形が続く英字は会社の名前。続かなければ略語", () => {
    assert.deepEqual(reportedAcronyms(ja, "# 連絡\n\nサイエンスアゴラ2025運営事務局（TSP太陽（株）内）。SREが対応する。\n"), ["SRE"]);
    assert.deepEqual(reportedAcronyms(ja, "# 連絡\n\nTSP太陽の運用。SREが対応する。\n"), ["TSP", "SRE"]);
  });
});
