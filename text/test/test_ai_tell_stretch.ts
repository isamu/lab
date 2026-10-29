import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { densestStretch } from "../packages/chaff/src/detectors/densest-stretch.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// ai-tell scores the densest stretch of a document, not the whole of a long one: a listing of many authors' abstracts
// holds one phrase in this abstract and one in that, far apart. Self-written samples.

before(async () => {
  await en.prepare?.({ pos: true });
  await ja.prepare?.({ pos: true });
});

const weightOf = (key: string): number => ({ a: 1, b: 2, c: 4 })[key] ?? 0;

describe("densestStretch", () => {
  it("takes every hit, from the first, when they fit in one window", () => {
    const stretch = densestStretch([[], ["a"], [], ["b", "a"], ["c"]], 10, weightOf);
    assert.deepEqual(
      [...(stretch?.keys ?? [])].toSorted((left, right) => left.localeCompare(right)),
      ["a", "b", "c"],
    );
    assert.equal(stretch?.first, 1);
  });

  it("takes the heaviest window when the hits are far apart", () => {
    const stretch = densestStretch([["a"], ["b"], [], [], ["c"], ["a"]], 2, weightOf);
    assert.deepEqual(
      [...(stretch?.keys ?? [])].toSorted((left, right) => left.localeCompare(right)),
      ["a", "c"],
    );
    assert.equal(stretch?.first, 4);
  });

  it("keeps the earliest of windows that weigh the same, and counts a key once", () => {
    const stretch = densestStretch([["b"], ["b"], [], ["a", "a"], ["a"]], 2, weightOf);
    assert.deepEqual([...(stretch?.keys ?? [])], ["b"]);
    assert.equal(stretch?.first, 0);
  });

  it("gives nothing without a hit", () => {
    assert.equal(densestStretch([], 5, weightOf), undefined);
    assert.equal(densestStretch([[], []], 5, weightOf), undefined);
  });
});

const aiTell = (source: string, adapter: LanguageAdapter, genre: string) =>
  runRules(buildDocument("t.md", source, adapter), loadRules(adapter.id), {}, true, genre).findings.filter((finding) => finding.rule === "ai-tell");

/** Plain report sentences that hold no phrase of the lexicon. */
const filler = (count: number, start: number): string[] =>
  Array.from({ length: count }, (_, index) => `Field ${String(start + index)} was observed on night ${String(start + index)}.`);

const PHRASES = [
  "Mid-infrared data provide valuable insights into the disc.",
  "The magnetic field plays a crucial role in the outflow.",
  "This chapter delves into neutron star glitches.",
  "The pivotal step is the calibration of the detector.",
];

const report = (paragraphs: readonly string[]): string => `# Abstracts\n\n${paragraphs.join("\n\n")}\n`;

describe("ai-tell: the densest stretch of a long document", () => {
  it("still reports the phrases piled up in one stretch, however long the document around them", () => {
    assert.equal(aiTell(report([PHRASES.join(" ")]), en, "business/report").length, 1);
    assert.equal(aiTell(report([filler(150, 0).join(" "), PHRASES.join(" "), filler(150, 200).join(" ")]), en, "business/report").length, 1);
  });

  it("does not add up phrases scattered one per entry over a long listing", () => {
    const entries = PHRASES.map((phrase, index) => [phrase, ...filler(120, index * 200)].join(" "));
    assert.deepEqual(aiTell(report(entries), en, "business/report"), []);
  });
});
