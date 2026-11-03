import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { narrowestStretch, sentencePositions } from "../packages/chaff/src/detectors/gram-spread.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// ngram-repetition: a phrase whose uses lie far apart across a long document (a long report naming the event it times, a
// paper naming the quantity it measures) is not read as said again; the same uses close together still are. Self-written text.

const USES = 6;
const EN_GAP_SENTENCES = 180;
const JA_GAP_SENTENCES = 320;
const CLOSE_GAP_SENTENCES = 3;

const enFiller = (from: number, count: number): string =>
  Array.from({ length: count }, (_, index) => `Item ${String(from + index)} holds value ${String((from + index) * 3)} today.`).join(" ");
const jaFiller = (from: number, count: number): string =>
  Array.from({ length: count }, (_, index) => `項目${String(from + index)}の値${String(from + index)}。`).join("");

const YEARS = ["1990", "1994", "1998", "2002", "2006", "2010", "2014", "2018"];
const PLACES = ["東京", "大阪", "札幌", "福岡", "仙台", "広島", "那覇", "金沢"];

/** Six uses of one phrase, each followed by gap filler sentences. */
const enSource = (gap: number): string =>
  YEARS.slice(0, USES)
    .map((year, index) => `In ${year}, Congress adopted a budget resolution before May. ${enFiller(index * gap, gap)}`)
    .join("\n\n");
const jaSource = (gap: number): string =>
  PLACES.slice(0, USES)
    .map((place, index) => `${place}では計画を見直していきます。${jaFiller(index * gap, gap)}`)
    .join("\n\n");

const worst = (adapter: LanguageAdapter, body: string): string | undefined => {
  const finding = runRules(buildDocument("t.md", `# Notes\n\n${body}\n`, adapter), loadRules(adapter.id), {}, true, "business/report").findings.find(
    (each) => each.rule === "ngram-repetition",
  );
  return finding === undefined ? undefined : String(finding.values["word"]);
};

before(async () => {
  await en.prepare?.({ pos: true });
  await ja.prepare?.({ pos: true });
});

describe("ngram-repetition: uses spread across a long document", () => {
  it("does not count an English phrase whose uses lie far apart, and counts the same uses close together", () => {
    assert.equal(worst(en, enSource(EN_GAP_SENTENCES)), undefined);
    assert.match(worst(en, `${enSource(CLOSE_GAP_SENTENCES)}\n\n${enFiller(1000, EN_GAP_SENTENCES)}`) ?? "", /adopted a/u);
  });

  it("does not count a Japanese phrase whose uses lie far apart, and counts the same uses close together", () => {
    assert.equal(worst(ja, jaSource(JA_GAP_SENTENCES)), undefined);
    assert.match(worst(ja, `${jaSource(CLOSE_GAP_SENTENCES)}\n\n${jaFiller(1000, JA_GAP_SENTENCES)}`) ?? "", /見直し/u);
  });
});

describe("narrowestStretch", () => {
  it("is the shortest distance covering count positions, in any order", () => {
    assert.equal(narrowestStretch([0, 100, 105, 110, 500], 3), 10);
    assert.equal(narrowestStretch([500, 110, 0, 105, 100], 3), 10);
    assert.equal(narrowestStretch([0, 100, 105, 110, 500], 5), 500);
  });

  it("is zero for one position or for positions in one place", () => {
    assert.equal(narrowestStretch([42], 1), 0);
    assert.equal(narrowestStretch([7, 7, 7], 3), 0);
  });

  it("is undefined when there are fewer positions than count, or count is not positive", () => {
    assert.equal(narrowestStretch([], 1), undefined);
    assert.equal(narrowestStretch([1, 2], 3), undefined);
    assert.equal(narrowestStretch([1, 2], 0), undefined);
    assert.equal(narrowestStretch([1, 2], -1), undefined);
  });
});

describe("sentencePositions", () => {
  it("places each sentence at the length of the sentences before it", () => {
    const doc = buildDocument("t.md", "One two three. Four five.\n\nSix seven eight nine.\n", en);
    const positions = doc.sentences.map((sentence) => sentencePositions(doc.sentences, "word").get(sentence));
    assert.deepEqual(positions, [0, 3, 5]);
  });

  it("is empty for no sentences", () => {
    assert.equal(sentencePositions([], "char").size, 0);
  });
});
