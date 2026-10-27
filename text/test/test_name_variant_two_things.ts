import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { isInverseOrder, isListedPair, isOtherEnding, isSetInCapitals } from "../packages/chaff/src/name-variant-shapes.ts";
import { titleSlipsIn } from "../packages/chaff/src/name-title-slip.ts";

// name-variant: two forms that look like one name written two ways but are two things, and a slip in a repeated title.
// Excerpts are public domain (the Congressional Record, U.S. Supreme Court opinions, Project Gutenberg texts, 北原白秋) or
// self-written.

const variants = (source: string, adapter = en, path = "a.md"): readonly string[] => namedRuleRun("name-variant", source, adapter, path).findings;

const PREFIXES = ["Mc", "Mac", "Des"];

describe("name-variant: two things, not one name", () => {
  before(async () => {
    await en.prepare?.({ pos: true });
    await ja.prepare?.({ pos: true });
  });

  it("isSetInCapitals: every word in capitals, or in three capitals or more after a surname prefix", () => {
    assert.equal(isSetInCapitals("MICHAEL T. McCAUL", PREFIXES), true);
    assert.equal(isSetInCapitals("SCOTT DesJARLAIS", PREFIXES), true);
    assert.equal(isSetInCapitals("NASA", PREFIXES), true);
    assert.equal(isSetInCapitals("McCaul", PREFIXES), false);
    assert.equal(isSetInCapitals("MacOS", PREFIXES), false);
    assert.equal(isSetInCapitals("MySQL", PREFIXES), false);
    assert.equal(isSetInCapitals("Mrs LINDE", PREFIXES), false);
    assert.equal(isSetInCapitals("McCAUL", []), false);
    assert.equal(isSetInCapitals("", PREFIXES), false);
  });

  it("a roster that sets surnames in capitals is not a variant of the prose form", () => {
    const roster =
      "LYNN WOOLSEY, California             MICHAEL T. McCAUL, Texas\n\nThe Honorable Michael T. McCaul testified.\n\nMr. McCaul. Thank you, Mr. Chairman.\n\nMr. McCaul. Thank you.\n";
    assert.deepEqual(variants(roster), []);
  });

  it("a surname with other capitals in the prose is still a variant", () => {
    assert.deepEqual(variants("Mr. McCaul spoke first. Mr. McCaul asked a question. Mr. Mccaul yielded.\n"), [
      '"Mccaul" is written "McCaul" elsewhere in the document (case, width or punctuation)',
    ]);
  });

  it("isOtherEnding: a last letter the lexicon pairs, in one-word names of one length", () => {
    const endings = [{ ending: "n", insteadOf: "s" }];
    assert.equal(isOtherEnding("Texan", "Texas", endings), true);
    assert.equal(isOtherEnding("Texas", "Texan", endings), true);
    assert.equal(isOtherEnding("Texaz", "Texas", endings), false);
    assert.equal(isOtherEnding("Texan Ray", "Texas Ray", endings), false);
    assert.equal(isOtherEnding("Texan", "Texas", []), false);
    assert.equal(isOtherEnding("", "", endings), false);
  });

  it("a demonym or a Latin case beside the place or the plural is another word", () => {
    assert.deepEqual(variants("He served Texas well. Texas honours him. Being a Texan, I am proud of Ray.\n"), []);
    assert.deepEqual(variants("The Romans won. The Romans built roads. He wrote Romano imperio militibus.\n"), []);
  });

  it("a slip at the last letter that is not another form is still reported", () => {
    assert.deepEqual(variants("Mobimagic builds the app. Mobimagic hosts it. Mobimagix bills it.\n"), [
      '"Mobimagix" is one letter away from "Mobimagic", which the document uses more than once',
    ]);
  });

  it("two names one letter apart in one sentence are two names", () => {
    const bacon =
      "Constantinus the Great was fatal to his house; for both Constantinus and Constance, his sons, died violent deaths; and Constantius, his other son, did little better.\n";
    assert.deepEqual(variants(bacon), []);
  });

  it("a name one letter away, written in another sentence, is still reported", () => {
    assert.deepEqual(variants("Constantinus ruled the east. Constantinus built a city. Constantius signed the edict.\n"), [
      '"Constantius" is one letter away from "Constantinus", which the document uses more than once',
    ]);
  });

  it("a name the document writes twice, in two names, is a name of its own", () => {
    const spoonRiver =
      "From Bindle’s opera house in the village\n\nMade a speech in Bindle’s Opera House.\n\nAnd in the hall of Nicholas Bindle held\n\nRichard Bandle and I had trouble over a fence,\n\nAnd my wife and Mrs. Bandle quarreled.\n";
    assert.deepEqual(variants(spoonRiver, en, "a.txt"), []);
  });

  it("a word that starts a verse line and is a dictionary word is not a name", () => {
    const poem =
      "Spring and Summer, Fall and Winter and Spring,\n\nVoices of Spring.\n\nAwaken roots under cover of soil—it is Spring again.\n\nSprang from your delusion that it was wantonness\n";
    assert.deepEqual(variants(poem, en, "a.txt"), []);
  });

  it("a title quoted in capitals as published is not a variant; capitals outside quotation marks still are", () => {
    const faq =
      'The Trident Conference met in the Board Room.\n\nAt the Trident Conference, the two nations met.\n\nMaurice Matloff, "The TRIDENT Conference—New Patterns: May 1943," in Strategic Planning.\n';
    assert.deepEqual(variants(faq), []);
    assert.deepEqual(variants("Mrs Linde enters. Mrs Linde sits.\n\nMrs LINDE starts, trembles.\n"), [
      '"Mrs LINDE" is written "Mrs Linde" elsewhere in the document (case, width or punctuation)',
    ]);
  });

  it("isInverseOrder: the same two sides in the two orders around a direction word", () => {
    assert.equal(isInverseOrder("ASCII to binary", "binary to ASCII", ["to"]), true);
    assert.equal(isInverseOrder("ASCIIからバイナリ", "バイナリからASCII", ["から"]), true);
    assert.equal(isInverseOrder("Toronto Data", "Data Toronto", ["to"]), false);
    assert.equal(isInverseOrder("ASCII to binary", "ASCII to binary", ["to"]), false);
    assert.equal(isInverseOrder("Foundations of Statistics", "Statistical Foundations", ["to"]), false);
    assert.equal(isInverseOrder("", "", ["to"]), false);
  });

  it("a direction and its inverse are two names", () => {
    const glossary =
      'Window.btoa() creates an ASCII string from binary data ("btoa" should be read as "binary to ASCII").\n\nWindow.atob() decodes it ("atob" should be read as "ASCII to binary").\n';
    assert.deepEqual(variants(glossary), []);
  });

  it("isListedPair: ・ between two kanji only", () => {
    assert.equal(isListedPair("動物園・水族館", "動物園水族館"), true);
    assert.equal(isListedPair("動物園水族館", "動物園・水族館"), true);
    assert.equal(isListedPair("コンベンション・センター", "コンベンションセンター"), false);
    assert.equal(isListedPair("動物園・水族館", "動物園と水族館"), false);
    assert.equal(isListedPair("", ""), false);
  });

  it("・ listing two kinds of place is not the name written without it", () => {
    const report =
      "日本動物園水族館協会と協定を結び、動物園水族館と連携して取り組んでいます。個別の動物園・水族館ではなく協会全体として取り組んでもらいます。\n";
    assert.deepEqual(variants(report, ja), []);
  });

  it("・ inside a katakana place name is still a variant", () => {
    assert.deepEqual(
      variants("会場は札幌コンベンションセンターです。札幌コンベンションセンターで発表し、翌日も札幌コンベンション・センターで聴講します。\n", ja),
      ["「札幌コンベンション・センター」は、ほかの所では「札幌コンベンションセンター」と書いています（字の大小・幅・記号の違い）"],
    );
  });

  it("a verb stem before a classical auxiliary is not a name read the same", () => {
    assert.deepEqual(variants("おもふ、いま水に華さき、\n\nほのかに青き青蓮の白華咲けり。\n", ja), []);
  });

  it("titleSlipsIn: a title written once, one word one letter away from a repeated title", () => {
    const act =
      "the National Industrial Recovery Act. Under the National Industrial Recovery Act the codes. Title 1 of the National Industrial Recover Act; that";
    assert.deepEqual(titleSlipsIn(act, ["Act"]), [
      { offset: act.indexOf("National Industrial Recover Act"), surface: "National Industrial Recover Act", usual: "National Industrial Recovery Act" },
    ]);
    assert.deepEqual(titleSlipsIn(act, []), []);
    assert.deepEqual(titleSlipsIn("", ["Act"]), []);
  });

  it("titleSlipsIn: plurals, other heads, two-word titles, and two titles each written once are not slips", () => {
    assert.deepEqual(titleSlipsIn("Water Resources Development Act. Water Resources Development Act. Water Resource Development Act.", ["Act"]), []);
    assert.deepEqual(titleSlipsIn("National Labor Relations Board. National Labor Relations Board. National Labor Relations Act.", ["Act", "Board"]), []);
    assert.deepEqual(titleSlipsIn("Trade Act. Trade Act. Grade Act.", ["Act"]), []);
    assert.deepEqual(titleSlipsIn("National Industrial Recovery Act. National Industrial Recover Act.", ["Act"]), []);
    assert.deepEqual(titleSlipsIn("Federal Trade Commission Act. Federal Trade Commission Act. Federal Trade Commissions Act.", ["Act"]), []);
  });

  it("a slip in a repeated statute title is reported, though the tagger reads the word as a verb", () => {
    const opinion =
      "The code was promulgated under section 3 of the National Industrial Recovery Act.\n\nThe declared purpose is to effect the policies of the National Industrial Recovery Act.\n\nThe application was made under title 1 of the National Industrial Recover Act; and notice was given.\n";
    assert.deepEqual(variants(opinion), [
      '"National Industrial Recover Act" has one word a letter away from the title "National Industrial Recovery Act", which the document uses more than once',
    ]);
  });
});
