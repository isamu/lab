import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ARTEFACT_NOTE,
  artefactKeys,
  countedFindings,
  groupPrecisions,
  isPrecisionMeasurement,
  precisionOf,
  type CorpusResult,
  type LanguagePrecision,
} from "../scripts/rules-precision-score.ts";
import {
  heldOnGroups,
  isRarelyRight,
  LOW_PRECISION_MAX,
  lowPrecisionGroups,
  PRECISION_MIN_DOCUMENTS,
  PRECISION_MIN_FINDINGS,
  standingOf,
} from "../scripts/rule-policy.ts";
import { precisionOffs, readPrecision } from "../scripts/rules-measure-files.ts";
import { parseGenres } from "../packages/chaff/src/genre-parse.ts";
import type { RuleDefinition } from "../packages/chaff/src/plugin.ts";

// 人が判定した指摘（isamu/chaff-corpus の expected）の正しさで、ルールを group ごとに止める（yarn rules:precision）。

const outcome = (kind: string, rule: string, line: number, text = `line ${String(line)}`) => ({ kind, rule, line, text });

const RESULTS: CorpusResult[] = [
  {
    id: "contract-a",
    genre: "legal/contract",
    language: "en",
    outcomes: [
      outcome("correct-kept", "r", 1),
      outcome("false-positive-present", "r", 2),
      outcome("false-positive-present", "r", 3),
      outcome("unjudged-present", "r", 4),
      outcome("new", "r", 5),
      outcome("correct-lost", "r", 6),
      outcome("false-positive-gone", "r", 7),
      outcome("unjudged-gone", "r", 8),
      outcome("missed-still", "r", 9),
      outcome("missed-found", "r", 10),
    ],
  },
  { id: "contract-b", genre: "legal/contract", language: "en", outcomes: [outcome("false-positive-present", "r", 1)] },
  { id: "keiyaku", genre: "legal/contract", language: "ja", outcomes: [outcome("unjudged-present", "r", 1)] },
  { id: "report", genre: "business/report", language: "ja", outcomes: [{ kind: "correct-kept", rule: "r", line: 3, sha256: "abc" }] },
];

const verdicts = (results: readonly CorpusResult[], artefacts: ReadonlySet<string>): string[] =>
  countedFindings(results, artefacts).map((finding) => `${finding.document} ${finding.group} ${finding.language} ${finding.verdict}`);

describe("countedFindings", () => {
  it("今も出ている指摘を判定とともに数える。消えた指摘と見逃しは数えない", () => {
    assert.deepEqual(verdicts(RESULTS, new Set()), [
      "contract-a legal en correct",
      "contract-a legal en false-positive",
      "contract-a legal en false-positive",
      "contract-a legal en unjudged",
      "contract-a legal en unjudged",
      "contract-b legal en false-positive",
      "keiyaku legal ja unjudged",
      "report business ja correct",
    ]);
    assert.deepEqual(countedFindings([], new Set()), []);
  });

  it("note が抽出や dataset のせいだと言う判定は数えない。本文でも sha256 でも照合し、他の rule・行の判定には触れない", () => {
    const notes = [
      { document: "contract-a", rule: "r", line: 1, text: "line 1", note: "dataset artefact: the text stops early" },
      { document: "contract-a", rule: "r", line: 2, text: "line 2", note: "extraction artefact: clauses run together" },
      { document: "contract-a", rule: "r", line: 3, text: "line 3", note: "the rule is wrong here" },
      { document: "contract-a", rule: "other", line: 3, text: "line 3", note: "extraction artefact: x" },
      { document: "report", rule: "r", line: 3, sha256: "abc", note: "extraction artefact: one long line" },
      { document: "contract-b", rule: "r", line: 1, text: "line 1" },
    ];
    assert.deepEqual(verdicts(RESULTS, artefactKeys(notes)), [
      "contract-a legal en false-positive",
      "contract-a legal en unjudged",
      "contract-a legal en unjudged",
      "contract-b legal en false-positive",
      "keiyaku legal ja unjudged",
    ]);
  });

  it("artefact と読むのは note の先頭に書いたときだけ", () => {
    assert.match("extraction artefact: x", ARTEFACT_NOTE);
    assert.match("dataset artefact: x", ARTEFACT_NOTE);
    assert.doesNotMatch("not an extraction artefact: x", ARTEFACT_NOTE);
    assert.doesNotMatch("extraction artefact without a colon", ARTEFACT_NOTE);
  });
});

describe("groupPrecisions", () => {
  it("rule・group・言語ごとに、正しい数・誤検出の数・判定のある文書の数・未判定の数を数える", () => {
    assert.deepEqual(groupPrecisions(countedFindings(RESULTS, new Set())), {
      r: {
        business: { ja: { correct: 1, falsePositive: 0, documents: 1, unjudged: 0 } },
        legal: { en: { correct: 1, falsePositive: 3, documents: 2, unjudged: 2 }, ja: { correct: 0, falsePositive: 0, documents: 0, unjudged: 1 } },
      },
    });
    assert.deepEqual(groupPrecisions([]), {});
  });

  it("判定が一つも無ければ precision は無い", () => {
    assert.equal(precisionOf({ correct: 1, falsePositive: 3 }), 0.25);
    assert.equal(precisionOf({ correct: 0, falsePositive: 0 }), undefined);
  });

  it("読んだ JSON の形を確かめる", () => {
    const counts = { correct: 1, falsePositive: 0, documents: 1, unjudged: 0 };
    assert.equal(isPrecisionMeasurement({ corpus: "abc", rules: { r: { legal: { en: counts } } } }), true);
    assert.equal(isPrecisionMeasurement({ corpus: "abc", rules: {} }), true);
    [
      null,
      [],
      { rules: {} },
      { corpus: "abc", rules: [] },
      { corpus: "abc", rules: { r: { legal: counts } } },
      { corpus: "abc", rules: { r: { legal: { en: { ...counts, correct: "1" } } } } },
      { corpus: "abc", rules: { r: { legal: { en: { ...counts, correct: -1 } } } } },
      { corpus: "abc", rules: { r: { legal: { en: { correct: 1, falsePositive: 0, documents: 1 } } } } },
    ].forEach((value) => assert.equal(isPrecisionMeasurement(value), false, JSON.stringify(value)));
  });

  it("commit した corpus/rules-precision.json は読める", () => {
    assert.equal(isPrecisionMeasurement(readPrecision()), true);
  });
});

/** `judged` judged findings over `documents` documents, `correct` of them right. */
const counts = (correct: number, judged = PRECISION_MIN_FINDINGS, documents = PRECISION_MIN_DOCUMENTS, unjudged = 0): LanguagePrecision => ({
  correct,
  falsePositive: judged - correct,
  documents,
  unjudged,
});

describe("isRarelyRight", () => {
  it("正しさが二割以下なら低い。ちょうど二割も低く、二割を超えれば低くない", () => {
    assert.equal(LOW_PRECISION_MAX, 0.2);
    assert.equal(isRarelyRight(counts(0)), true);
    assert.equal(isRarelyRight(counts(4, 20)), true);
    assert.equal(isRarelyRight(counts(5, 20)), false);
    assert.equal(isRarelyRight(counts(PRECISION_MIN_FINDINGS)), false);
  });

  it("判定の数が足りない、または一つ二つの文書からしか来ていなければ決めない。未判定は数に入れない", () => {
    assert.equal(PRECISION_MIN_FINDINGS, 15);
    assert.equal(PRECISION_MIN_DOCUMENTS, 3);
    assert.equal(isRarelyRight(counts(0, PRECISION_MIN_FINDINGS - 1, PRECISION_MIN_DOCUMENTS, 400)), false);
    assert.equal(isRarelyRight(counts(0, 400, PRECISION_MIN_DOCUMENTS - 1)), false);
    assert.equal(isRarelyRight(counts(0, 0, 0, 400)), false);
  });
});

describe("lowPrecisionGroups", () => {
  it("指摘を出すどの言語でも正しさが低い group だけを返す", () => {
    assert.deepEqual(lowPrecisionGroups({ legal: { en: counts(0) }, docs: { en: counts(0), ja: counts(1) }, business: { en: counts(10) } }), ["legal", "docs"]);
  });

  it("もう一つの言語で、判定が足りない・未判定しか無い・正しさが高いなら、その group は止めない", () => {
    assert.deepEqual(lowPrecisionGroups({ legal: { en: counts(0), ja: counts(0, 4, 1) } }), []);
    assert.deepEqual(lowPrecisionGroups({ legal: { en: counts(0), ja: counts(0, 0, 0, 1) } }), []);
    assert.deepEqual(lowPrecisionGroups({ legal: { en: counts(0), ja: counts(10) } }), []);
  });

  it("測っていない rule や言語の無い group には何も言わない", () => {
    assert.deepEqual(lowPrecisionGroups(undefined), []);
    assert.deepEqual(lowPrecisionGroups({}), []);
    assert.deepEqual(lowPrecisionGroups({ legal: {} }), []);
  });
});

const RULE: Pick<RuleDefinition, "id" | "layer" | "status"> = { id: "some-rule", layer: "L2", status: "stable" };
const NONE: ReadonlySet<string> = new Set();
const share = (fired: number, documents = 20) => ({ documents, fired });

describe("standingOf with judged precision", () => {
  it("正しさの低い group は止める。割合で止めた group と重ねて書かない", () => {
    assert.deepEqual(standingOf(RULE, { groups: { legal: share(1), docs: share(0) } }, NONE, ["legal"]), { kind: "normal", off: ["legal"] });
    assert.deepEqual(standingOf(RULE, { groups: { legal: share(11) } }, NONE, ["legal"]), { kind: "normal", off: ["legal"] });
    assert.deepEqual(standingOf(RULE, { groups: { legal: share(1) } }, NONE, []), { kind: "normal", off: [] });
  });

  it("正しさで止めた group は、info かどうかの判断に入れない", () => {
    const measure = { groups: { legal: share(5), docs: share(0) } };
    assert.equal(standingOf(RULE, measure, NONE).kind, "info");
    assert.equal(standingOf(RULE, measure, NONE, ["legal"]).kind, "normal");
  });

  it("文書の数で決められない rule と、意味を読む rule は、正しさでも動かさない", () => {
    assert.deepEqual(standingOf(RULE, { groups: {} }, NONE, ["legal"]), { kind: "experimental" });
    assert.deepEqual(standingOf({ ...RULE, layer: "L4" }, { groups: { legal: share(1) } }, NONE, ["legal"]), { kind: "judge" });
  });
});

const GENRES = parseGenres({
  groups: [
    { id: "legal", name: { ja: "法務", en: "Legal" } },
    { id: "docs", name: { ja: "文書", en: "Docs" } },
  ],
  genres: [
    { id: "legal/contract", name: { ja: "契約", en: "Contract" }, summary: { ja: "契", en: "C" }, rules: { "held-rule": "normal", "off-rule": "off" } },
    { id: "docs/manual", name: { ja: "手引き", en: "Manual" }, summary: { ja: "手", en: "M" } },
  ],
});

describe("heldOnGroups and precisionOffs", () => {
  it("genres.yaml が手で動かすと書いたジャンルの group は、正しさが低くても止めない", () => {
    assert.deepEqual([...heldOnGroups(GENRES, "held-rule")], ["legal"]);
    assert.deepEqual([...heldOnGroups(GENRES, "off-rule")], []);
    assert.deepEqual([...heldOnGroups(GENRES, "unknown-rule")], []);
    const low = { en: counts(0) };
    const precision = { corpus: "abc", rules: { "held-rule": { legal: low, docs: low }, "off-rule": { legal: low } } };
    assert.deepEqual(precisionOffs(GENRES, "held-rule", precision), ["docs"]);
    assert.deepEqual(precisionOffs(GENRES, "off-rule", precision), ["legal"]);
    assert.deepEqual(precisionOffs(GENRES, "unknown-rule", precision), []);
  });
});
