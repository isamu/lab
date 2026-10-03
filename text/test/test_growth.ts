import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertLinearGrowth } from "./growth.ts";

// The timing check the linear-time tests rest on: it must pass a linear run and fail a quadratic one, on any machine.

const sink = { total: 0 };

const linearWork = (size: number): void => {
  sink.total = Array.from({ length: size }, (_, index) => index).reduce((sum, value) => sum + (value % 7), 0);
};

const quadraticWork = (size: number): void => {
  sink.total = Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (__, column) => (row ^ column) % 7).reduce((sum, value) => sum + value, 0),
  ).reduce((sum, value) => sum + value, 0);
};

describe("assertLinearGrowth", () => {
  it("passes a run whose time grows with its input", () => {
    assertLinearGrowth(linearWork, 20_000);
  });

  it("fails a run whose time grows with the square of its input", () => {
    assert.throws(() => assertLinearGrowth(quadraticWork, 200), /x the input took/u);
  });

  it("passes a run too fast for the clock to see, instead of dividing by zero", () => {
    assertLinearGrowth(() => undefined, 1);
  });
});
