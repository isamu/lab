import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { tallyVotes, type Vote } from "../packages/chaff/src/cross-votes.ts";

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
