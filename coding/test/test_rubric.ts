import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreDimension, scoreMetric, type MetricState, type Rubric } from "../packages/scoria/src/rubric.ts";

const ok = (entries: readonly (readonly [string, number])[]): ReadonlyMap<string, MetricState> =>
  new Map(entries.map(([id, value]) => [id, { kind: "ok", value }]));

test("maps a lower-is-better metric linearly to points", () => {
  const scale = { good: 0, bad: 20 };
  assert.equal(scoreMetric(0, scale), 100);
  assert.equal(scoreMetric(20, scale), 0);
  assert.equal(scoreMetric(10, scale), 50);
});

test("the same formula handles a higher-is-better metric", () => {
  const scale = { good: 90, bad: 40 };
  assert.equal(scoreMetric(90, scale), 100);
  assert.equal(scoreMetric(40, scale), 0);
  assert.equal(scoreMetric(65, scale), 50);
});

test("values outside the scale clamp, so overachieving earns nothing", () => {
  const scale = { good: 0, bad: 20 };
  assert.equal(scoreMetric(-50, scale), 100);
  assert.equal(scoreMetric(999, scale), 0);
});

const rubric: Rubric = {
  id: "readability",
  status: "experimental",
  metrics: [
    { metric: "a", scale: { good: 0, bad: 10 }, weight: 0.6 },
    { metric: "b", scale: { good: 0, bad: 10 }, weight: 0.4 },
  ],
  confidenceFrom: [],
};

test("a dimension score is the sum of its metric points", () => {
  const scored = scoreDimension(
    rubric,
    ok([
      ["a", 5],
      ["b", 0],
    ]),
  );
  const sum = scored.metrics.reduce((acc, m) => acc + m.points, 0);
  assert.ok(Math.abs((scored.score ?? 0) - sum) < 1e-6);
  assert.equal(scored.score, 70);
});

/** spec §18.1: a metric nobody could measure is excluded, and the rest renormalised. */
test("a skipped metric is excluded and the remaining weights renormalised", () => {
  const scored = scoreDimension(rubric, ok([["a", 0]]));
  assert.equal(scored.metrics.length, 2);
  assert.equal(scored.metrics[1]?.state, "skipped");
  assert.equal(scored.coverage, 0.6);
  assert.equal(scored.score, 100);
});

test("an absent metric scores zero and keeps its weight", () => {
  const states = new Map<string, MetricState>([
    ["a", { kind: "ok", value: 0 }],
    ["b", { kind: "absent" }],
  ]);
  const scored = scoreDimension(rubric, states);
  assert.equal(scored.coverage, 1);
  assert.equal(scored.score, 60);
});

test("a dimension with nothing measurable has no score at all", () => {
  const scored = scoreDimension(rubric, new Map());
  assert.equal(scored.score, undefined);
  assert.equal(scored.coverage, 0);
});
