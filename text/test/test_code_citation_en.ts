import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { citedCodeBefore, codeVocabulary } from "../packages/lang-en/src/code-citation.ts";

// "35 CFR §122", "42 U.S.C. § 1983": a section sign right after the name of a code points into that code, not into this
// document. US 4,683,202 (public domain) reported "§122" and "§1.14" as missing. Other sentences are self-written.

const VOCABULARY = codeVocabulary(en.lexicons);
const before = (text: string): string | undefined =>
  citedCodeBefore(text, text.lastIndexOf("§") === -1 ? text.lastIndexOf("Section") : text.lastIndexOf("§"), VOCABULARY);

describe("citedCodeBefore", () => {
  [
    ["the rules according to 35 CFR §122", "35 CFR"],
    ["available under 37 CFR §1.14", "37 CFR"],
    ["claims under 42 U.S.C. § 1983", "42 U.S.C."],
    ["per 48 C.F.R. §19.705", "48 C.F.R."],
    ["see 26 USC § 501", "26 USC"],
    ["see 42 U.S.C. §§ 1981", "42 U.S.C."],
    ["see 42 U.S.C. Section 1983", "42 U.S.C."],
    ["see the U.S.C. § 5", "U.S.C."],
    ["see CFR§5", "CFR"],
  ].forEach(([text, code]) => {
    it(`valid: ${String(text)} → ${String(code)}`, () => assert.equal(before(String(text)), code));
  });

  [
    ["no code before the sign", "see § 9 for fees"],
    ["the code named earlier in the sentence", "The CFR applies; see § 9"],
    ["the code inside a longer word", "under the XCFR § 9 rules"],
    ["a plural that is not the code's name", "see the CFRs § 9"],
    ["a word between the code and the sign", "the CFR text § 9"],
  ].forEach(([form, text]) => {
    it(`invalid: ${String(form)}`, () => assert.equal(before(String(text)), undefined));
  });

  it("abnormal input: empty text, a reference at the start, an empty vocabulary", () => {
    assert.equal(citedCodeBefore("", 0, VOCABULARY), undefined);
    assert.equal(citedCodeBefore("§ 5 applies", 0, VOCABULARY), undefined);
    assert.equal(citedCodeBefore("see 35 CFR § 5", "see 35 CFR ".length, codeVocabulary({})), undefined);
  });

  it("the names are matched as written: a regex sign in a name is a character (U.S.C. is not USxCx)", () => {
    assert.equal(citedCodeBefore("see USxCx § 5", "see USxCx ".length, VOCABULARY), undefined);
  });
});

const lines = (...rows: string[]): string => rows.join("\n");

const dangling = (sentence: string): string[] =>
  runRules(buildDocument("c.txt", lines("Section 1 Scope", sentence, "Section 2 Fees", "text"), en), loadRules("en"), {}, true, "business/contract")
    .findings.filter((finding) => finding.rule === "dangling-reference")
    .map((finding) => String(finding.values["label"]));

describe("dangling-reference and a section of another code", () => {
  [
    "Filing is governed by 35 CFR §122 and the Commissioner's rules.",
    "Copies are available under 37 CFR §1.14.",
    "Claims arise under 42 U.S.C. § 1983.",
    "Claims arise under 42 U.S.C. 1983.",
    "See 48 C.F.R. §19.705 for the plan.",
    "See 26 USC § 501(c)(3).",
    "See 42 U.S.C. Section 1983.",
    "See 42 U.S.C. §§ 1981 and 1983.",
  ].forEach((sentence) => {
    it(`valid: ${sentence}`, () => assert.deepEqual(dangling(sentence), []));
  });

  [
    ["See § 9 for fees.", ["§ 9"]],
    ["The CFR applies; see § 9.", ["§ 9"]],
    ["Under the XCFR § 9 rules.", ["§ 9"]],
    ["See Section 9 of this Agreement.", ["Section 9"]],
  ].forEach(([sentence, labels]) => {
    it(`invalid: ${String(sentence)}`, () => assert.deepEqual(dangling(String(sentence)), labels));
  });
});
