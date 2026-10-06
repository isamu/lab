import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { checkSource } from "../packages/chaff/src/check-source.ts";
import { EMPTY } from "../packages/chaff/src/config/load.ts";
import { GENRES } from "../packages/chaff/src/genre.ts";
import { PLAYGROUND_SAMPLES, type PlaygroundSample } from "../site/src/lib/playgroundSamples.ts";

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

/**
 * Each sample shows the mistakes its kind of document is checked for, not only readability: one of each in both languages.
 * The tech blog its steps and its install command, the email its dates and attachments, the press release its figures.
 */
const SAMPLE_RULES: Readonly<Record<string, readonly string[]>> = {
  blog: ["version-mismatch", "numbering-gap", "step-reference-missing", "date-weekday-mismatch"],
  email: ["attachment-not-attached", "announced-count-mismatch", "date-weekday-mismatch"],
  contract: ["total-mismatch", "party-role-name", "dangling-reference", "numbering-gap", "vague-deadline"],
  press: ["date-weekday-mismatch", "elapsed-years-mismatch", "change-rate-mismatch", "percent-sum-mismatch"],
};

/** The rules of SAMPLE_RULES that do not report on the sample. */
const missingRules = async (language: string, sample: PlaygroundSample): Promise<string[]> => {
  const check = await checkSource("document.md", sample.text, EMPTY, { language, genre: sample.genre, experimental: false });
  const rules = new Set(check.applied.kept.map(ruleOf));
  return (SAMPLE_RULES[sample.id] ?? []).filter((rule) => !rules.has(rule));
};

describe("the playground's samples show their kind's checks", () => {
  Object.entries(PLAYGROUND_SAMPLES).forEach(([language, samples]) => {
    samples.forEach((sample) => {
      it(`${language} ${sample.id}: ${(SAMPLE_RULES[sample.id] ?? []).join(", ")}`, async () => {
        assert.deepEqual(await missingRules(language, sample), []);
      });
    });
  });
});
