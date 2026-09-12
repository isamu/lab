import { test } from "node:test";
import assert from "node:assert/strict";
import { swallowedFailures } from "../packages/scoria/src/probes/swallow.ts";
import type { ConfigFile } from "../packages/scoria/src/plugin.ts";

const workflow = (text: string, path = ".github/workflows/ci.yml"): ConfigFile => ({ path, text });

const countOf = (text: string): number => swallowedFailures([workflow(text)]).count;

const steps = (body: string): string => `name: CI\non: [push]\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n${body}`;

test("a step that ignores a failure and judges nothing is swallowing it", () => {
  assert.equal(countOf(steps("      - run: yarn lint || true\n")), 1);
});

/**
 * The other use of `|| true` is to capture output from a command that exits non-zero and then judge
 * it. This repository's own workflow does exactly that, and the previous scan called it an error.
 */
test("capturing a failure and then asserting on what it captured is not swallowing", () => {
  const script = steps(`      - shell: bash
        run: |
          yarn --silent example > report.txt 2>&1 || true
          cat report.txt
          if ! grep -q 'finished' report.txt; then
            echo "::error::the tool did not run to the end"
            exit 1
          fi
`);
  assert.equal(countOf(script), 0);
});

test("an annotation without an exit still counts as judging the outcome", () => {
  const script = steps(`      - shell: bash
        run: |
          yarn audit || true
          grep -q 'critical' out.txt && echo "::error::critical advisory"
`);
  assert.equal(countOf(script), 0);
});

test("`continue-on-error` on a step needs no `|| true` to swallow", () => {
  assert.equal(countOf(steps("      - run: yarn test\n        continue-on-error: true\n")), 1);
});

/** A job-level `continue-on-error` makes every step in it decoration. */
test("`continue-on-error` on a job counts once", () => {
  const script = `name: CI\non: [push]\njobs:\n  flaky:\n    runs-on: ubuntu-latest\n    continue-on-error: true\n    steps:\n      - run: yarn test\n`;
  assert.equal(countOf(script), 1);
});

test("several swallowing steps are counted separately", () => {
  assert.equal(countOf(steps("      - run: yarn lint || true\n      - run: yarn test || true\n")), 2);
});

test("a clean workflow swallows nothing", () => {
  assert.equal(countOf(steps("      - run: yarn lint\n      - run: yarn test\n")), 0);
});

/** A workflow GitHub cannot parse runs nothing; guessing at its text would invent a finding. */
test("unparseable YAML contributes no count", () => {
  assert.equal(countOf("jobs: [ this is not a workflow"), 0);
});

test("the file reported is the one that swallows, not merely the first", () => {
  const clean = workflow(steps("      - run: yarn test\n"), ".github/workflows/a.yml");
  const dirty = workflow(steps("      - run: yarn test || true\n"), ".github/workflows/b.yml");
  const found = swallowedFailures([clean, dirty]);
  assert.equal(found.count, 1);
  assert.equal(found.file, ".github/workflows/b.yml");
});

test("no workflows means nothing swallowed and nothing to point at", () => {
  assert.deepEqual(swallowedFailures([]), { count: 0, file: undefined });
});
