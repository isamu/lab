import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { siblingHeadingRunsOf } from "../packages/chaff/src/structure/heading-runs.ts";

// The sibling-heading-run walk that version-order and date-order both read changelogs with.

type Heading = { readonly depth: number; readonly joins: boolean; readonly index: number };

const runsOf = (headings: readonly Heading[]): number[][] => siblingHeadingRunsOf(headings, (heading) => (heading.joins ? heading.index : undefined));

/**
 * The rule stated without the walk: two joining headings at one depth share a run exactly when no heading between them,
 * joining or not, is shallower. Runs come in the order of their first heading.
 */
const expectedRuns = (headings: readonly Heading[]): number[][] => {
  const joining = headings.filter((heading) => heading.joins);
  const sameRun = (left: Heading, right: Heading): boolean =>
    left.depth === right.depth && headings.slice(left.index + 1, right.index).every((between) => between.depth >= left.depth);
  return joining
    .filter((heading) => !joining.some((earlier) => earlier.index < heading.index && sameRun(earlier, heading)))
    .map((first) =>
      joining.filter((heading) => heading.index === first.index || (heading.index > first.index && sameRun(first, heading))).map((heading) => heading.index),
    );
};

const MAX_DEPTH = 6;
const MAX_HEADINGS = 12;
const CASES = 3000;
const DEFAULT_SEED = 20261008;

const generator = (seed: number): (() => number) => {
  const state = { value: seed };
  return () => {
    state.value = (Math.imul(state.value, 1103515245) + 12345) >>> 0;
    return state.value / 2 ** 32;
  };
};

const generatedHeadings = (random: () => number): Heading[] =>
  Array.from({ length: Math.floor(random() * MAX_HEADINGS) }, (_, index) => ({
    depth: 1 + Math.floor(random() * MAX_DEPTH),
    joins: random() < 2 / 3,
    index,
  }));

/** "2 3x 2": depths in order, x marking a heading pointOf refuses (## Install among version headings). */
const headingsOf = (shape: string): Heading[] =>
  shape.split(" ").map((token, index) => ({ depth: Number.parseInt(token, 10), joins: !token.endsWith("x"), index }));

describe("siblingHeadingRunsOf", () => {
  it("a deeper heading (### Added) stays inside the run; a shallower one closes it", () => {
    assert.deepEqual(runsOf(headingsOf("1x 2 3x 2 3x 2 1x 2")), [[1, 3, 5], [7]]);
  });

  it("a refused heading at the run's depth (## Install) neither joins nor splits it, and opens no run", () => {
    assert.deepEqual(runsOf(headingsOf("2 2x 2")), [[0, 2]]);
    assert.deepEqual(runsOf(headingsOf("2x 2x")), []);
  });

  it("a refused shallower heading still closes the deeper run", () => {
    assert.deepEqual(runsOf(headingsOf("2 1x 2")), [[0], [2]]);
  });

  it("runs come in the order of their first heading, each depth under each parent its own run", () => {
    assert.deepEqual(runsOf(headingsOf("2x 3 2 3 2")), [[1], [2, 4], [3]]);
  });

  it("no headings, no runs", () => {
    assert.deepEqual(runsOf([]), []);
  });

  it("matches the rule stated without the walk over generated heading sequences", () => {
    const seed = Number(process.env["CHAFF_TEST_SEED"] ?? DEFAULT_SEED);
    const random = generator(seed);
    Array.from({ length: CASES }, () => generatedHeadings(random)).forEach((headings) => {
      assert.deepEqual(runsOf(headings), expectedRuns(headings), `seed ${String(seed)}: ${JSON.stringify(headings)}`);
    });
  });
});
