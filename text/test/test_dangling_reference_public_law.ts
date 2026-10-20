import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { citedLawAround, lawVocabulary } from "../packages/lang-en/src/law-citation.ts";

// A US Code section's source credit and amendment notes cite a Public Law by its number and sections ("Pub. L. 98–620,
// title IV, §402(2)"), and an older law by the page of the Statutes at Large that prints it ("ch. 324, §2(a), 60 Stat.
// 237"). Those sections are the law's, not the Code section's. Lines from 5 U.S.C. 551–552 and 18 U.S.C. 1030 (public
// domain, chaff-corpus #54); the others are self-written.

const VOCABULARY = lawVocabulary(en.lexicons);
const at = (text: string, reference: string): string | undefined => {
  const start = text.indexOf(reference);
  return citedLawAround(text, start, start + reference.length, VOCABULARY);
};

describe("citedLawAround", () => {
  [
    ["[(D) Repealed. Pub. L. 98–620, title IV, §402(2), Nov. 8, 1984, 98 Stat. 3357.]", "§402(2)", "Pub. L. 98–620"],
    ["amended Pub. L. 99–474, §2, Oct. 16, 1986, 100 Stat. 1213", "§2", "Pub. L. 99–474"],
    ["Pub. L. 104–294, title II, §201, title VI, §604(b)(36), Oct. 11, 1996", "§604(b)(36)", "Pub. L. 104–294"],
    ["Pub. L. 107–56, title V, §506(a), title VIII, §814(a)–(e), Oct. 26, 2001", "§814(a)", "Pub. L. 107–56"],
    ["Pub. L. 116–92, div. A, title V, §550, Dec. 20, 2019, 133 Stat. 1379", "§550", "Pub. L. 116–92"],
    ["Pub. L. 107–296, §2207(g)(2), formerly §225(g)(2), as renumbered", "§225(g)(2)", "Pub. L. 107–296"],
    ["2007—Subsec. (a)(3)(A). Pub. L. 110–175, §2(1)(A)(i), in introductory provisions", "§2(1)", "Pub. L. 110–175"],
    ["the amendment by Public Law 89-487, section 3, applies", "section 3", "Public Law 89-487"],
    ["as renumbered by Pub. L. 107–296, §2207(g)(1), then by Pub. L. 115–278, §2(g)(2)(I)", "§2(g)", "Pub. L. 115–278"],
    ["Pub. L. 117–58, div. A, title I, subtitle A, part 2, §101, Nov. 15, 2021", "§101", "Pub. L. 117–58"],
  ].forEach(([text, reference, law]) => {
    it(`valid (named before): ${String(reference)} → ${String(law)}`, () => assert.equal(at(String(text), String(reference)), law));
  });

  [
    ["June 11, 1946, ch. 324, §2(a), 60 Stat. 237.", "§2(a)", "60 Stat. 2"],
    ["§2(a), August 26, 1946, 60 Stat. 237", "§2(a)", "60 Stat. 2"],
    ["see Ex. Ord. No. 13526, §3.6, Dec. 29, 2009, 75 F.R. 718, set out", "§3.6", "75 F.R. 7"],
  ].forEach(([text, reference, volume]) => {
    it(`valid (a volume after): ${String(reference)}`, () => assert.ok(at(String(text), String(reference))?.endsWith(String(volume))));
  });

  [
    ["a semicolon between the law and the reference", "amended Pub. L. 98–620; see §402(2)", "§402(2)"],
    ["a word of a sentence between them", "Pub. L. 98–620 applies to the matters in §402(2)", "§402(2)"],
    ["a law without its Congress", "Pub. L. 620, §402(2)", "§402(2)"],
    ["a law number longer than a law's", "Pub. L. 98–6200, §402(2)", "§402(2)"],
    ["the name inside a word", "XPub. L. 98–620, §402(2)", "§402(2)"],
    ["a law named after the reference", "§402(2) and Pub. L. 98–620", "§402(2)"],
    ["a page that is not of a volume", "section 4, 60 pages long", "section 4"],
    ["a date and no volume after it", "section 4, Dec. 29, 2009, and later", "section 4"],
    ["a law too far before the reference", `Pub. L. 98–620, ${"1, ".repeat(60)}§402(2)`, "§402(2)"],
  ].forEach(([form, text, reference]) => {
    it(`invalid: ${String(form)}`, () => assert.equal(at(String(text), String(reference)), undefined));
  });

  it("abnormal input: empty text, a reference at the start or end, an empty vocabulary", () => {
    assert.equal(citedLawAround("", 0, 0, VOCABULARY), undefined);
    assert.equal(citedLawAround("§5 applies", 0, 2, VOCABULARY), undefined);
    assert.equal(citedLawAround("Pub. L. 98–620, §5", 16, 18, VOCABULARY), "Pub. L. 98–620");
    const empty = lawVocabulary({});
    assert.deepEqual(empty, { before: undefined, after: undefined });
    assert.equal(citedLawAround("Pub. L. 98–620, §5", 16, 18, empty), undefined);
  });
});

const lines = (...rows: string[]): string => rows.join("\n");

const dangling = (...body: string[]): string[] =>
  runRules(buildDocument("s.md", lines("### §552. Public information", "", ...body), en), loadRules("en"), {}, true, "legal/statute")
    .findings.filter((finding) => finding.rule === "dangling-reference")
    .map((finding) => String(finding.values["label"]));

describe("dangling-reference and a section of a Public Law", () => {
  it("valid: a source credit and amendment notes cite the law's sections", () => {
    assert.deepEqual(
      dangling(
        "(a) Each agency shall make available to the public information as follows.",
        "",
        "(Pub. L. 89–554, Sept. 6, 1966, 80 Stat. 383; Pub. L. 98–620, title IV, §402(2), Nov. 8, 1984, 98 Stat. 3357; Pub. L. 110–175, §§3, 4(a), 5, 6(a)(1), (b)(1), 7(a), 8–10(a), 12, Dec. 31, 2007, 121 Stat. 2525–2530.)",
        "",
        "2016—Subsec. (a)(2). Pub. L. 114–185, §2(1)(A)(i), in introductory provisions, substituted text.",
        "",
        "| 5 U.S.C. 1001(a) | June 11, 1946, ch. 324, §2(a), 60 Stat. 237. |",
      ),
      [],
    );
  });

  it("invalid: a section the statute names without a law is still looked up", () => {
    assert.deepEqual(dangling("(a) The agency shall act under section 9.", "", "This applies after Pub. L. 98–620; see §402(2)."), ["section 9", "§402(2)"]);
  });
});
