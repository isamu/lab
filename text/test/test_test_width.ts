import assert from "node:assert/strict";
import { test } from "node:test";
import { testWidth } from "../scripts/test-width.ts";

const CORES = 8;

test("CHAFF_TEST_JOBS sets the width when it is a positive whole number", () => {
  assert.equal(testWidth({ CHAFF_TEST_JOBS: "2" }, CORES), 2);
  assert.equal(testWidth({ CHAFF_TEST_JOBS: "16" }, CORES), 16);
});

test("without a usable CHAFF_TEST_JOBS the width is the number of cores", () => {
  [undefined, "", "0", "-3", "1.5", "two", " "].forEach((value) => {
    assert.equal(testWidth(value === undefined ? {} : { CHAFF_TEST_JOBS: value }, CORES), CORES, String(value));
  });
});
