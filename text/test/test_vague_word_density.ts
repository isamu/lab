import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { entriesForGenre } from "../packages/chaff/src/lexicon-genres.ts";
import { vagueWordsIn } from "../packages/chaff/src/detectors/vague-density.ts";

// あいまいな語の密度（vague-word-density）。例文はすべて自作。

const RULE = "vague-word-density";

before(async () => {
  await ja.prepare?.({ pos: true });
  await en.prepare?.({ pos: true });
});

const findingsOf = (source: string, adapter = ja, genre = "business/report"): readonly string[] => namedRuleRun(RULE, source, adapter, "a.md", genre).findings;

const PLAIN_JA = "会議は毎週月曜の十時に始まり、議題は前の週の金曜までに共有します。";
const PLAIN_EN = "The meeting starts at ten every Monday, and the agenda goes out by the Friday before. ";

describe("vague-word-density: あいまいな語が文書の長さに対して多い所", () => {
  it("重なれば、語のある文ごとに一度指す", () => {
    const source = `${PLAIN_JA.repeat(15)}障害は適宜報告し、必要に応じて連絡します。記録は適切に残し、なるべく早めにまとめます。\n`;
    const findings = findingsOf(source);
    assert.equal(findings.length, 2, findings.join("\n"));
    assert.match(findings[0] ?? "", /^「適宜」など、あいまいな語が 1000 字あたり \d+ 個あります（2 個まで）$/u);
  });

  it("英語の文書は英語で言う", () => {
    const source = `${PLAIN_EN.repeat(13)}Report incidents as needed and notify the appropriate people in a timely manner. Keep adequate records where possible.\n`;
    const findings = findingsOf(source, en);
    assert.equal(findings.length, 2, findings.join("\n"));
    assert.match(findings[0] ?? "", /^"as needed" and other vague words: \d+ per 1000 words \(limit 4\)$/u);
  });

  it("長い文書の中の一つ二つは普通の言い方として指さない", () => {
    assert.deepEqual(findingsOf(`${PLAIN_JA.repeat(30)}資料は適宜更新します。\n`), []);
    assert.deepEqual(findingsOf(`${PLAIN_EN.repeat(30)}We update the slides as needed.\n`, en), []);
  });

  it("足した語も数え、言い切った書き方は数えない", () => {
    const vague = `${PLAIN_JA.repeat(15)}障害には臨機応変に対応し、概ね報告します。手順はしっかりと守り、近日中にまとめます。\n`;
    assert.equal(findingsOf(vague).length, 2, findingsOf(vague).join("\n"));
    const plain = `${PLAIN_JA.repeat(15)}障害は発生から一時間以内に報告します。手順書の三章を守り、十月五日までにまとめます。\n`;
    assert.deepEqual(findingsOf(plain), []);
    const vagueEn = `${PLAIN_EN.repeat(13)}Report incidents as soon as practicable and escalate where necessary. Publish notes in due course and ship shortly.\n`;
    assert.equal(findingsOf(vagueEn, en).length, 2, findingsOf(vagueEn, en).join("\n"));
    const plainEn = `${PLAIN_EN.repeat(13)}Report incidents within one hour and escalate to the on-call lead. Publish notes by Friday and ship on Monday.\n`;
    assert.deepEqual(findingsOf(plainEn, en), []);
  });

  it("あいまいな語が無ければ何も言わない", () => {
    assert.deepEqual(findingsOf(`${PLAIN_JA.repeat(10)}\n`), []);
  });

  it("契約の中の法律の基準と決まった言い方は数えず、ほかのジャンルでは数える", () => {
    const standards =
      "The Supplier shall use commercially reasonable efforts to deliver. The Customer shall act reasonably and use best efforts to cooperate. " +
      "The Policy may be amended from time to time. Damages cannot adequately compensate the Owner for a breach. ";
    const source = `${PLAIN_EN.repeat(13)}${standards}\n`;
    assert.deepEqual(findingsOf(source, en, "legal/contract"), []);
    const elsewhere = findingsOf(source, en, "business/report");
    assert.equal(elsewhere.length, 4, elsewhere.join("\n"));
  });

  it("契約でも、基準の無いあいまいな語は数える", () => {
    const source = `${PLAIN_EN.repeat(13)}The Supplier shall report incidents as needed. It shall notify the appropriate people where possible. It shall keep adequate records.\n`;
    const findings = findingsOf(source, en, "legal/contract");
    assert.equal(findings.length, 3, findings.join("\n"));
  });
});

const wordsIn = (text: string, genre: string): string[] => {
  const doc = buildDocument("a.md", `${text}\n`, en);
  const termsOfArt = entriesForGenre(doc.lexicons["vague-word-term-of-art"] ?? [], genre);
  return doc.sentences.flatMap((sentence) => vagueWordsIn(sentence, doc.lexicons["vague-word"] ?? [], termsOfArt));
};

describe("vague-word-density: 一つの文の中のあいまいな語", () => {
  it("長い語の中の短い語は、長い語として一度だけ数える", () => {
    assert.deepEqual(wordsIn("Notify us in a timely manner.", "business/report"), ["in a timely manner"]);
    assert.deepEqual(wordsIn("Act as appropriate.", "business/report"), ["as appropriate"]);
  });

  it("別々に書いた語は別々に数える", () => {
    assert.deepEqual(wordsIn("Send a timely reply in a timely manner.", "business/report"), ["timely", "in a timely manner"]);
    assert.deepEqual(wordsIn("Report as needed and keep adequate records.", "business/report"), ["as needed", "adequate"]);
  });

  it("法務のジャンルでは、決まった言い方の中の語を数えない", () => {
    assert.deepEqual(wordsIn("Consent is given on reasonable notice and acted on reasonably.", "legal/contract"), []);
    assert.deepEqual(wordsIn("Damages would not adequately compensate the Owner.", "legal/contract"), []);
    assert.deepEqual(wordsIn("Give reasonable notice as needed.", "legal"), ["as needed"]);
  });

  it("ほかのジャンルでは、同じ語を数える", () => {
    assert.deepEqual(wordsIn("Damages would not adequately compensate the Owner.", "business/report"), ["adequately"]);
    assert.deepEqual(wordsIn("Give reasonable notice as needed.", "blog/tech"), ["reasonable", "as needed"]);
  });

  it("語の無い文と空の文は何も返さない", () => {
    assert.deepEqual(wordsIn("The meeting starts at ten.", "legal/contract"), []);
    assert.deepEqual(wordsIn("", "legal/contract"), []);
  });
});
