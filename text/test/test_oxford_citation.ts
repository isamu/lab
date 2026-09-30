import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { firedRules } from "./rule-run.ts";
import { inCitedTitle } from "../packages/chaff/src/detectors/cited-title.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";

// 引用の中の題名（誌名・論文名・書名）の読点は、題名を付けた人のもの。書き手の並べかたではないので、Oxford comma の票に数えない。
// 例文は自作と、米連邦準備制度理事会の講演の注（パブリックドメイン）。

const RULE = "oxford-comma-consistency";
const WITH_COMMA = "We shipped the parser, the renderer, and the exporter.\nThe team reviewed the plan, the budget, and the schedule.";
const WITHOUT_COMMA = "We shipped the parser, the renderer and the exporter.\nThe team reviewed the plan, the budget and the schedule.";

/** base の 2 文と流儀の違う文として、candidate が指摘されるか。 */
const judgedAgainst = (base: string, candidate: string): boolean => firedRules(en, `${base}\n\n${candidate}\n`).includes(RULE);

/** [何の形か, 比べる相手, 文]。 */
type Case = readonly [string, string, string];

const NOT_JUDGED: readonly Case[] = [
  [
    "引用した論文名のあとの誌名（Fed の注）",
    WITH_COMMA,
    'See David Reifschneider and John C. Williams (2000), "Three Lessons for Monetary Policy in a Low-Inflation Era," Journal of Money, Credit and Banking, vol. 32 (November), pp. 936–66.',
  ],
  [
    "曲がった引用符の論文名のあとの誌名",
    WITH_COMMA,
    "See Reifschneider and Williams (2000), “Three Lessons for Monetary Policy,” Journal of Money, Credit and Banking, vol. 32.",
  ],
  [
    "論文名と誌名の境の and（Fed の注）",
    WITH_COMMA,
    'On average inflation targeting, see Thomas M. Mertens and John C. Williams (2019), "Monetary Policy Frameworks and the Effective Lower Bound on Interest Rates," AEA Papers and Proceedings, vol. 109 (May), pp. 427–32.',
  ],
  [
    "引用符の中の Title Case の論文名",
    WITHOUT_COMMA,
    "See Bundick and Cairó (2025), “Labor Market Dynamics, Monetary Policy Tradeoffs, and a Shortfalls Approach to Pursuing Maximum Employment,” a working paper.",
  ],
  ["まっすぐな引用符の中の Title Case の題名", WITHOUT_COMMA, 'We read "Labor Market Dynamics, Monetary Policy Tradeoffs, and Maximum Employment" last week.'],
  ["* で強調した誌名", WITH_COMMA, "See *Journal of Money, Credit and Banking* for the full paper."],
  ["_ で強調した誌名", WITH_COMMA, "See _Journal of Money, Credit and Banking_ for the full paper."],
];

const JUDGED: readonly Case[] = [
  ["本文の固有名詞の並び（GSA）", WITH_COMMA, "GSA hired talent for its programs, including Login.gov, TTS Engineering and USAi."],
  [
    "引用の中でも、著者の並びは書き手の並べかた",
    WITH_COMMA,
    'François Gourio, Benjamin Johannsen and David López-Salido (2025) wrote "The Origins of the Review," a working paper.',
  ],
  [
    "引用符の中の小文字の語の並び（GOV.UK）",
    WITHOUT_COMMA,
    "For example, use ‘organise’ not ‘organize’, ‘modelling’ not ‘modeling’, and ‘fill in a form’, not ‘fill out a form’.",
  ],
  ["引用符の中の sentence case の題名", WITH_COMMA, "See the paper “Money, credit and banking in the long run” for details."],
  ["箇条書きの印の * は強調ではない", WITH_COMMA, "* Paris, Rome and Madrid were visited."],
  ["強調が並びの一部だけを囲む", WITH_COMMA, "We visited *Paris*, Rome and Madrid."],
  ["ピリオドのあとの閉じる引用符に続く固有名詞の並びは誌名と読まない", WITH_COMMA, "He said “we are done.” Paris, Rome and Madrid agreed."],
];

describe("oxford-comma-consistency：引用の中の題名", () => {
  before(async () => {
    await en.prepare?.({ pos: true });
  });

  NOT_JUDGED.forEach(([form, base, candidate]) => {
    it(`valid: ${form}`, () => assert.equal(judgedAgainst(base, candidate), false, candidate));
  });

  JUDGED.forEach(([form, base, candidate]) => {
    it(`invalid: ${form}`, () => assert.equal(judgedAgainst(base, candidate), true, candidate));
  });
});

describe("inCitedTitle", () => {
  before(async () => {
    await en.prepare?.({ pos: true });
  });

  /** text の最初の and が、引用した題名の中にあるか。 */
  const firstAndInTitle = (text: string): boolean => {
    const tokens = en.segment(text).sentences.flatMap((sentence) => sentence.tokens ?? []);
    return inCitedTitle(
      tokens,
      tokens.findIndex((token) => token.surface === "and"),
      text,
    );
  };

  it("文書の頭の引用符も開きの印", () => {
    assert.equal(firstAndInTitle("“Journal of Money, Credit and Banking” is a journal."), true);
    assert.equal(firstAndInTitle('"Journal of Money, Credit and Banking" is a journal.'), true);
  });

  it("印が無ければ、文書の頭の Title Case の並びも題名と読まない", () => {
    assert.equal(firstAndInTitle("Journal of Money, Credit and Banking is a journal."), false);
  });

  it("and の右が小文字の語で始まれば題名ではない", () => {
    assert.equal(firstAndInTitle("“Money, Credit and banking” is a phrase."), false);
  });

  it("and の左が小文字の語で終われば題名ではない", () => {
    assert.equal(firstAndInTitle("“Money, credit and Banking” is a phrase."), false);
  });

  it("引用符が題名の途中で閉じれば、囲まれていない", () => {
    assert.equal(firstAndInTitle("“Money, Credit” and Banking are words."), false);
  });
});
