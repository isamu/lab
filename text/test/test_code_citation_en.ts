import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { citedCodeBefore, codeVocabulary } from "../packages/lang-en/src/code-citation.ts";
import { listedTagAround } from "../packages/lang-en/src/citation.ts";

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

// "RFC 1122, Section 3.3.4.2": a numbered document series is written before its own number (position: before in the
// lexicon). RFC 9293 reported such sections as missing. The sentences here are self-written.
describe("citedCodeBefore: a numbered document named before its number", () => {
  const at = (text: string): string | undefined => citedCodeBefore(text, text.length, VOCABULARY);
  [
    ["see RFC 1122, ", "RFC 1122"],
    ["this is discussed in RFC 7657 (", "RFC 7657"],
    ["as defined in RFC 9110 ", "RFC 9110"],
    ["the key words of BCP 14, ", "BCP 14"],
    ["the standard STD 7 § ", "STD 7"],
    ["see RFC 1122,", "RFC 1122"],
  ].forEach(([text, code]) => {
    it(`valid: "${String(text)}" → ${String(code)}`, () => assert.equal(at(String(text)), code));
  });

  [
    ["no number after the name", "see RFC, "],
    ["the name inside a longer word", "see XRFC 1122, "],
    ["a plural", "see RFCs 1122, "],
    ["a semicolon between the document and the reference", "see RFC 1122; "],
    ["a full stop between the document and the reference", "see RFC 1122. "],
    ["a word between the number and the reference", "see RFC 1122 and "],
    ["a number too long to be the document's", "see RFC 123456, "],
    ["a title number before a numbered name does not make it a code", "see 35 RFC "],
  ].forEach(([form, text]) => {
    it(`invalid: ${String(form)}`, () => assert.equal(at(String(text)), undefined));
  });

  it("a lexicon without numbered names reads only the codes; one with only numbered names reads only those", () => {
    const codesOnly = codeVocabulary({ "document-kind": [{ pattern: "CFR" }] });
    assert.equal(codesOnly.numberedBefore, undefined);
    assert.equal(citedCodeBefore("see RFC 1122, ", "see RFC 1122, ".length, codesOnly), undefined);
    const numberedOnly = codeVocabulary({ "document-kind": [{ pattern: "RFC", position: "before" }] });
    assert.equal(numberedOnly.before, undefined);
    assert.equal(citedCodeBefore("see 35 CFR § ", "see 35 CFR § ".length, numberedOnly), undefined);
    assert.equal(citedCodeBefore("see RFC 1122, ", "see RFC 1122, ".length, numberedOnly), "RFC 1122");
  });

  it("only the reach before the reference is read", () => {
    const far = `see RFC 1122, ${"x".repeat(40)} `;
    assert.equal(citedCodeBefore(far, far.length, VOCABULARY), undefined);
  });
});

describe("citedCodeBefore and listedTagAround over generated text around a reference", () => {
  const SEED = Date.now() % 100_000;
  const CASES = 5_000;
  const PIECES = [
    "RFC",
    "BCP",
    "CFR",
    "35",
    "1122",
    "123456",
    "[19]",
    "[2024]",
    "[WEB-CACHE]",
    "[1]",
    ",",
    ";",
    ".",
    "(",
    "§",
    " ",
    "see",
    "of",
    "RFCs",
    "XRFC",
    "RFC 1122, ",
    "BCP 14 (",
  ];

  it(`finds only a listed-tag candidate or a numbered name that is written there (seed ${String(SEED)})`, () => {
    let seed = SEED;
    const pick = (): string => {
      seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
      return PIECES[Math.floor(seed / 65_536) % PIECES.length] ?? "";
    };
    const piece = (): string => Array.from({ length: 1 + (Math.floor(seed / 65_536) % 7) }, pick).join(Math.floor(seed / 65_536) % 2 === 0 ? " " : "");
    Array.from({ length: CASES }).forEach(() => {
      const [before, after] = [piece(), piece()];
      const text = `${before}Section 9${after}`;
      const code = citedCodeBefore(text, before.length, VOCABULARY);
      const tag = listedTagAround(text, before.length, before.length + "Section 9".length);
      assert.ok(code === undefined || (before.includes(code) && /^(?:\d{1,3}\s+)?(?:CFR|RFC \d{1,5}|BCP \d{1,5})$/u.test(code)), `${text} → ${String(code)}`);
      assert.ok(tag === undefined || (text.includes(`[${tag}]`) && /^(?:\d{1,3}|[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+)$/u.test(tag)), `${text} → ${String(tag)}`);
    });
  });
});

describe("dangling-reference and a section of a numbered document", () => {
  [
    "Hosts choose the address as in RFC 1122, Section 3.3.4.2.",
    "The field is discussed in RFC 7657 (Sections 5.1, 5.3, and 6).",
    "The key words are those of BCP 14, Section 2.",
    "The format follows RFC 9110 Section 8.",
  ].forEach((sentence) => {
    it(`valid: ${sentence}`, () => assert.deepEqual(dangling(sentence), []));
  });

  [
    ["See RFC, Section 9.", ["Section 9"]],
    ["The RFC 1122 rules apply; see Section 9.", ["Section 9"]],
    ["Version 3, Section 9 applies.", ["Section 9"]],
  ].forEach(([sentence, labels]) => {
    it(`invalid: ${String(sentence)}`, () => assert.deepEqual(dangling(String(sentence)), labels));
  });
});
