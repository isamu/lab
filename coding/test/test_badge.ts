import { test } from "node:test";
import assert from "node:assert/strict";
import { badgeEndpoint } from "../packages/scoria/src/badge.ts";
import type { Report } from "../packages/scoria/src/report.ts";
import type { ReportDiff } from "../packages/scoria/src/diff.ts";

const reportOf = (score: number, scoredDimensions: number): Report => ({
  schemaVersion: 1,
  root: "/home/someone/projects/ownplate",
  profile: "app",
  stacks: ["ts"],
  complete: true,
  size: { files: 1, sloc: 1, testSloc: 0 },
  dimensions: [],
  findings: [],
  probes: [],
  toolVersions: {},
  overall: { score, scoredDimensions, comparable: false },
});

const diffOf = (deltas: readonly (number | undefined)[]): ReportDiff => ({
  dimensions: deltas.map((delta, index) => ({ dimension: `d${index}`, from: 0, to: 0, delta })),
  movers: [],
  notComparable: [],
});

test("the badge names the directory measured, so two workspaces are distinguishable", () => {
  assert.equal(badgeEndpoint(reportOf(97, 7)).label, "scoria · ownplate");
});

/** A badge travels without the README that would have explained it (spec §3.3). */
test("the caveat rides on the badge itself", () => {
  assert.equal(badgeEndpoint(reportOf(97, 7)).message, "97 · this repo only");
});

test("no baseline is its own colour — there is no trend to report yet", () => {
  assert.equal(badgeEndpoint(reportOf(97, 7)).color, "blue");
});

test("colour follows the direction of travel, not the score", () => {
  const low = badgeEndpoint(reportOf(31, 7), diffOf([0, 0.4]));
  const high = badgeEndpoint(reportOf(99, 7), diffOf([0, -8]));
  assert.equal(low.color, "brightgreen");
  assert.equal(high.color, "orange");
});

/** Rounding is not a regression; an orange badge every other run is one nobody reads. */
test("a dimension that moved by less than a point is not a regression", () => {
  assert.equal(badgeEndpoint(reportOf(97, 7), diffOf([-0.4])).color, "brightgreen");
});

test("a dimension with no delta cannot make the badge orange", () => {
  assert.equal(badgeEndpoint(reportOf(97, 7), diffOf([undefined])).color, "brightgreen");
});

/** `mean([])` is 0, which on a badge reads as a terrible score rather than as no measurement. */
test("a repository nothing could be measured in says so instead of showing zero", () => {
  const badge = badgeEndpoint(reportOf(0, 0));
  assert.equal(badge.message, "not measured");
  assert.equal(badge.color, "lightgrey");
});
