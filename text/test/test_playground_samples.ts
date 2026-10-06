import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { checkSource } from "../packages/chaff/src/check-source.ts";
import { EMPTY } from "../packages/chaff/src/config/load.ts";
import { GENRES } from "../packages/chaff/src/genre.ts";
import { PLAYGROUND_SAMPLES } from "../site/src/lib/playgroundSamples.ts";

// The playground opens on a sample, so a visitor sees a result with one click: each sample must still get findings
// from chaff, in its own language and genre, after a rule changes.

/** A sample shows a few findings, not one: enough to see what kinds of mistake chaff reads. */
const MIN_FINDINGS = 2;

const ruleOf = (finding: { readonly rule: string }): string => finding.rule;

describe("the playground's samples", () => {
  Object.entries(PLAYGROUND_SAMPLES).forEach(([language, samples]) => {
    it(`${language}: one per kind, each in a genre chaff knows`, () => {
      assert.deepEqual(
        samples.map((sample) => sample.id),
        ["blog", "email", "contract", "press"],
      );
      samples.forEach((sample) => assert.ok(GENRES.includes(sample.genre), sample.genre));
    });

    samples.forEach((sample) => {
      it(`${language} ${sample.id}: gets findings as ${sample.genre}`, async () => {
        const check = await checkSource("document.md", sample.text, EMPTY, { language, genre: sample.genre, experimental: false });
        const rules = check.applied.kept.map(ruleOf);
        assert.ok(rules.length >= MIN_FINDINGS, rules.join(", "));
      });
    });
  });
});

/** The contract sample shows the mistakes a contract is checked for, not only readability: one of each in both languages. */
const CONTRACT_RULES = ["total-mismatch", "party-role-name", "dangling-reference", "numbering-gap", "vague-deadline"];

describe("the playground's contract sample", () => {
  Object.entries(PLAYGROUND_SAMPLES).forEach(([language, samples]) => {
    it(`${language}: shows the contract checks`, async () => {
      const sample = samples.find((candidate) => candidate.id === "contract");
      assert.ok(sample !== undefined);
      const check = await checkSource("document.md", sample.text, EMPTY, { language, genre: sample.genre, experimental: false });
      const rules = new Set(check.applied.kept.map(ruleOf));
      assert.deepEqual(
        CONTRACT_RULES.filter((rule) => !rules.has(rule)),
        [],
      );
    });
  });
});
