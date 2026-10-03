import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { isStativeParticiple, stativeVocabulary, type StativeVocabulary } from "../packages/lang-en/src/stative-participle.ts";
import type { Lexicon, Token } from "../packages/chaff/src/plugin.ts";

const lexiconOf = (...patterns: string[]): Lexicon => patterns.map((pattern) => ({ pattern, weight: undefined, instead_of: undefined }));

const VOCABULARY: StativeVocabulary = stativeVocabulary({
  "stative-participle": lexiconOf("delighted", "based", "logged in to"),
  "degree-adverb": lexiconOf("very"),
});

/** "We/PRP are/VBP delighted/VBN" の形で書いた列を、解析器の出力と同じ形にする。 */
const taggedOf = (source: string): { value: string; pos: string }[] =>
  source.split(" ").map((pair) => {
    const [value = "", pos = ""] = pair.split("/");
    return { value, pos };
  });

const participleAt = (source: string): number => taggedOf(source).findIndex((entry) => entry.pos === "VBN");

const stative = (source: string, vocabulary: StativeVocabulary = VOCABULARY): boolean =>
  isStativeParticiple(taggedOf(source), participleAt(source), vocabulary);

describe("isStativeParticiple: 状態を表す過去分詞", () => {
  it("語彙表の 1 語に一致すれば状態", () => {
    assert.equal(stative("We/PRP are/VBP delighted/VBN to/TO help/VB"), true);
    assert.equal(stative("The/DT report/NN was/VBD based/VBN on/IN data/NNS"), true);
  });

  it("大文字でも同じ語", () => {
    assert.equal(stative("WE/PRP ARE/VBP DELIGHTED/VBN"), true);
  });

  it("句は全部の語が続いたときだけ一致する", () => {
    assert.equal(stative("you/PRP are/VBP logged/VBN in/IN to/TO the/DT site/NN"), true);
    assert.equal(stative("Errors/NNS are/VBP logged/VBN in/IN the/DT console/NN"), false);
    assert.equal(stative("Errors/NNS are/VBP logged/VBN"), false);
  });

  it("句が文の終わりを越えるなら一致しない", () => {
    assert.equal(stative("you/PRP are/VBP logged/VBN in/IN"), false);
  });

  it("直前が程度の副詞なら状態。very approved とは言わない", () => {
    assert.equal(stative("I/PRP was/VBD very/RB pleased/VBN"), true);
  });

  it("程度の副詞でない副詞の後は受動のまま", () => {
    assert.equal(stative("The/DT release/NN was/VBD quickly/RB approved/VBN"), false);
    assert.equal(stative("No/DT issue/NN was/VBD more/RBR discussed/VBN"), false);
  });

  it("程度の副詞が離れていれば見ない", () => {
    assert.equal(stative("It/PRP was/VBD very/RB quickly/RB approved/VBN"), false);
  });

  it("語彙表に無い語は受動のまま", () => {
    assert.equal(stative("The/DT report/NN was/VBD approved/VBN"), false);
    assert.equal(stative("Receipts/NNS are/VBP required/VBN"), false);
  });

  it("語彙表が空なら何も状態と見なさない", () => {
    const empty = stativeVocabulary({});
    assert.equal(stative("We/PRP are/VBP delighted/VBN", empty), false);
    assert.equal(stative("I/PRP was/VBD very/RB pleased/VBN", empty), false);
  });

  it("範囲の外や空の列では false", () => {
    assert.equal(isStativeParticiple([], 0, VOCABULARY), false);
    assert.equal(isStativeParticiple(taggedOf("We/PRP are/VBP delighted/VBN"), 9, VOCABULARY), false);
    assert.equal(isStativeParticiple(taggedOf("very/RB delighted/VBN"), -1, VOCABULARY), false);
  });

  it("空白だけの項目は句にしない", () => {
    const blank = stativeVocabulary({ "stative-participle": lexiconOf("", "   "), "degree-adverb": lexiconOf("") });
    assert.deepEqual(blank.phrases, []);
    assert.equal(blank.degreeAdverbs.size, 0);
  });
});

describe("agentless-passive（英語）: 状態を表す過去分詞", () => {
  before(async () => {
    await en.prepare?.({ pos: true });
  });

  const tokensOf = (source: string): readonly Token[] => buildDocument("t.md", source, en).sentences.flatMap((sentence) => sentence.tokens ?? []);

  const passivesIn = (source: string): string[] => tokensOf(source).flatMap((token) => (token.features?.["Voice"] === "Pass" ? [token.surface] : []));

  const reported = (source: string): boolean =>
    runRules(buildDocument("t.md", source, en), loadRules("en"), { "agentless-passive": "normal" }, true, "business/report").findings.some(
      (finding) => finding.rule === "agentless-passive",
    );

  [
    "We are delighted to offer you the position.",
    "The team is excited about the launch.",
    "I was very surprised.",
    "The staff were very pleased with the result.",
    "Some customers are dissatisfied.",
    "The report was based on a survey.",
    "Our office is located in a quiet street.",
    "You are entitled to a refund.",
    "While you are logged in to your account, we keep a session.",
    "This question is related to the budget.",
    "Several teams may be involved.",
    "The owner will be gone for a week.",
  ].forEach((source) => {
    it(`valid: ${source}`, () => {
      assert.deepEqual(passivesIn(source), []);
      assert.equal(reported(source), false);
    });
  });

  const realPassives: readonly (readonly [string, readonly string[]])[] = [
    ["The report was approved.", ["approved"]],
    ["The decision was made.", ["made"]],
    ["No additional approvals are required.", ["required"]],
    ["Receipts are required for every hotel stay.", ["required"]],
    ["Staff are required to use the travel card.", ["required"]],
    ["Errors are logged in the console.", ["logged"]],
    ["The changes were committed to the repository.", ["committed"]],
    ["The source files are linked throughout this page.", ["linked"]],
    ["The missing file was located.", ["located"]],
    ["No issue was more discussed this year.", ["discussed"]],
    ["The model was overly simplified.", ["simplified"]],
  ];

  realPassives.forEach(([source, expected]) => {
    it(`invalid: ${source}`, () => {
      assert.deepEqual(passivesIn(source), expected);
      assert.equal(reported(source), true);
    });
  });

  it("状態の過去分詞にも VerbForm=Part は付く。分詞の導入句の判断は変わらない", () => {
    const forms = tokensOf("The plan is based on the review.").flatMap((token) =>
      token.features?.["VerbForm"] === undefined ? [] : [`${token.surface}:${token.features["VerbForm"]}:${token.features["Voice"] ?? ""}`],
    );
    assert.deepEqual(forms, ["based:Part:"]);
  });
});
