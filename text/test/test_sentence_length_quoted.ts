import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { quotedSentenceParts } from "../packages/chaff/src/detectors/quoted-sentences.ts";

// max-sentence-length and a 「」 quotation that holds sentences of its own: an incident report quoted whole, each sentence
// closed by 。, then the child's age. Every example here is self-written.

before(async () => {
  await ja.prepare?.({ pos: true });
});

const findingsOf = (source: string): readonly string[] => namedRuleRun("max-sentence-length", `${source}\n`, ja, "a.md", "business/email").findings;

const REPORT =
  "「台所で保護者が湯を沸かしている間に、こどもが椅子によじ登って調理台の上の鍋に手を伸ばした。鍋が傾いて湯がかかり、腕にやけどを負って通院した。」(2歳3か月)";

describe("quotedSentenceParts", () => {
  it("cuts a quotation of two sentences or more into its sentences, and keeps the words outside apart", () => {
    assert.deepEqual(quotedSentenceParts("「転んだ。泣いた。」(1歳)"), ["「」(1歳)", "転んだ。", "泣いた。"]);
    assert.deepEqual(quotedSentenceParts("報告には「転んだ。泣いた。」とある。"), ["報告には「」とある。", "転んだ。", "泣いた。"]);
  });

  it("keeps a stop inside an inner bracket within its sentence", () => {
    assert.deepEqual(quotedSentenceParts("「母は『もう寝なさい。』と言った。こどもは寝た。」"), ["「」", "母は『もう寝なさい。』と言った。", "こどもは寝た。"]);
  });

  it("leaves a quotation of one sentence, of a clause, or ending without a stop as a whole", () => {
    assert.deepEqual(quotedSentenceParts("「転んだ。」と書いてある。"), ["「転んだ。」と書いてある。"]);
    assert.deepEqual(quotedSentenceParts("「転んだ」と書いてある。"), ["「転んだ」と書いてある。"]);
    assert.deepEqual(quotedSentenceParts("「転んだ。泣いた」と書いてある。"), ["「転んだ。泣いた」と書いてある。"]);
    assert.deepEqual(quotedSentenceParts("「転んだ。泣いた。と書いてある。"), ["「転んだ。泣いた。と書いてある。"]);
    assert.deepEqual(quotedSentenceParts(""), [""]);
  });
});

describe("max-sentence-length on a quoted report of several sentences", () => {
  it("measures each quoted sentence on its own", () => {
    assert.deepEqual(findingsOf(`- ${REPORT}`), []);
  });

  it("still counts a quoted sentence that is long on its own", () => {
    const long =
      "「台所で保護者が湯を沸かしている間に、こどもが椅子によじ登って調理台の上の鍋に手を伸ばし、鍋が傾いて湯がかかり、腕にやけどを負って通院し、その後も数週間にわたって通院を続けた。転んだ。」(2歳3か月)";
    assert.deepEqual(findingsOf(`- ${long}`), ["この文は 87 文字あります（70 文字まで）"]);
  });

  it("still counts the same words as one long sentence without the quotation's own sentences", () => {
    assert.deepEqual(findingsOf(`- ${REPORT.replace("手を伸ばした。", "手を伸ばし、")}`), ["この文は 78 文字あります（70 文字まで）"]);
  });

  it("still counts the words around the quotation when they are long", () => {
    const around = `事故の報告には「転んだ。泣いた。」とあり、保護者が目を離した時間は短かったものの、椅子の位置と床の材質と照明の明るさがどれも事故の一因となったと考えられ、今後の注意点として施設に周知した。`;
    assert.equal(findingsOf(around).length, 1);
  });
});
