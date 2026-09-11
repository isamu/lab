import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreDimension, scoreMetric, type Rubric } from "../packages/scoria/src/rubric.ts";

test("低いほど良い metric を線形に点へ落とす", () => {
  const scale = { good: 0, bad: 20 };
  assert.equal(scoreMetric(0, scale), 100);
  assert.equal(scoreMetric(20, scale), 0);
  assert.equal(scoreMetric(10, scale), 50);
});

test("高いほど良い metric も同じ式で扱える", () => {
  const scale = { good: 90, bad: 40 };
  assert.equal(scoreMetric(90, scale), 100);
  assert.equal(scoreMetric(40, scale), 0);
  assert.equal(scoreMetric(65, scale), 50);
});

test("範囲外は clamp する。過剰達成で点を稼げない", () => {
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

test("次元の点は metric の点の和である", () => {
  const scored = scoreDimension(
    rubric,
    new Map([
      ["a", 5],
      ["b", 0],
    ]),
  );
  const sum = scored.metrics.reduce((acc, m) => acc + m.points, 0);
  assert.ok(Math.abs(scored.score - sum) < 1e-6);
  assert.equal(scored.score, 70);
});

test("値の無い metric は 0 として扱う。黙って metric を落とさない", () => {
  const scored = scoreDimension(rubric, new Map([["a", 0]]));
  assert.equal(scored.metrics.length, 2);
  assert.equal(scored.metrics[1]?.value, 0);
});
