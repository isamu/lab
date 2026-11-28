import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { tallyVotes, votesOutOfStep, type Vote } from "../packages/chaff/src/cross-votes.ts";

// The files of one run vote with their value for an item; the files outside the value most of them write are out of step.

const votes = (...values: string[]): Vote<string>[] => values.map((value, index) => ({ path: `${String(index)}.md`, value }));
const same = (left: string, right: string): boolean => left === right;
const pathsOf = (list: readonly Vote<string>[] | undefined): string[] => (list ?? []).map((vote) => vote.path);

describe("tallyVotes", () => {
  it("the value most files write is usual, and the other files are out of step, in the run's order", () => {
    const tally = tallyVotes(votes("b", "a", "a", "c"), same);
    assert.deepEqual(pathsOf(tally?.usual), ["1.md", "2.md"]);
    assert.deepEqual(pathsOf(tally?.odd), ["0.md", "3.md"]);
    assert.equal(tally?.values, 3);
  });

  it("on a tie, the value whose first file comes first is usual", () => {
    assert.deepEqual(pathsOf(tallyVotes(votes("b", "a"), same)?.usual), ["0.md"]);
    assert.deepEqual(pathsOf(tallyVotes(votes("b", "a", "a", "b"), same)?.usual), ["0.md", "3.md"]);
  });

  it("all files agreeing leave nothing out of step", () => {
    const tally = tallyVotes(votes("a", "a"), same);
    assert.deepEqual(pathsOf(tally?.odd), []);
    assert.equal(tally?.values, 1);
  });

  it("values are grouped by the comparison given, not by identity", () => {
    const caseless = (left: string, right: string): boolean => left.toLowerCase() === right.toLowerCase();
    assert.deepEqual(pathsOf(tallyVotes(votes("A", "a", "b"), caseless)?.odd), ["2.md"]);
  });

  it("no votes, no tally", () => {
    assert.equal(tallyVotes([], same), undefined);
  });
});

const reported = (...values: string[]): string[] =>
  votesOutOfStep(votes(...values), same).map(({ vote, against }) => `${vote.path}→${against.map((other) => other.path).join(",")}`);

describe("votesOutOfStep", () => {
  it("a value most files write: the other files, each compared with all of the usual value's", () => {
    assert.deepEqual(reported("b", "a", "a", "c"), ["0.md→1.md,2.md", "3.md→1.md,2.md"]);
    assert.deepEqual(reported("a", "b", "a"), ["1.md→0.md,2.md"]);
  });

  it("an even split of two values: every file, each compared with the other value, whichever file comes first", () => {
    assert.deepEqual(reported("a", "b"), ["0.md→1.md", "1.md→0.md"]);
    assert.deepEqual(reported("b", "a"), ["0.md→1.md", "1.md→0.md"]);
    assert.deepEqual(reported("a", "b", "b", "a"), ["0.md→1.md,2.md", "3.md→1.md,2.md", "1.md→0.md,3.md", "2.md→0.md,3.md"]);
  });

  it("three values, two of them sharing the most files: every file, the third compared with the first leader", () => {
    assert.deepEqual(reported("a", "b", "c", "a", "b"), ["0.md→1.md,4.md", "3.md→1.md,4.md", "1.md→0.md,3.md", "4.md→0.md,3.md", "2.md→0.md,3.md"]);
  });

  it("three values tied one each: each leader compared with the next", () => {
    assert.deepEqual(reported("a", "b", "c"), ["0.md→1.md", "1.md→2.md", "2.md→0.md"]);
  });

  it("nothing when the files agree, when one file votes, or when none does", () => {
    assert.deepEqual(reported("a", "a"), []);
    assert.deepEqual(reported("a"), []);
    assert.deepEqual(reported(), []);
  });
});
