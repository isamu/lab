import { test } from "node:test";
import assert from "node:assert/strict";
import { chooseTypeChecker, type BinResolver } from "../packages/scoria/src/type-checker.ts";

const installed =
  (...packages: readonly string[]): BinResolver =>
  (packageName, binName) =>
    packages.includes(packageName) ? `/repo/node_modules/${packageName}/bin/${binName}` : undefined;

test("a TypeScript project is checked with tsc", () => {
  assert.deepEqual(chooseTypeChecker(["ts"], installed("typescript")), { kind: "found", tool: "typescript", bin: "/repo/node_modules/typescript/bin/tsc" });
});

/** tsc reports every .vue import as a missing module; vue-tsc reads them. */
test("a Vue project is checked with vue-tsc, even where tsc is installed too", () => {
  assert.deepEqual(chooseTypeChecker(["vue", "ts"], installed("typescript", "vue-tsc")), {
    kind: "found",
    tool: "vue-tsc",
    bin: "/repo/node_modules/vue-tsc/bin/vue-tsc",
  });
});

test("a Vue project without vue-tsc is not checked with tsc instead", () => {
  const checker = chooseTypeChecker(["vue", "ts"], installed("typescript"));
  assert.equal(checker.kind, "missing");
  assert.ok(checker.kind === "missing" && checker.reason.includes("vue-tsc"));
});

test("vue-tsc being installed does not change the checker of a project that is not Vue", () => {
  const checker = chooseTypeChecker(["ts", "react"], installed("typescript", "vue-tsc"));
  assert.equal(checker.kind === "found" ? checker.tool : checker.kind, "typescript");
});

test("nothing installed is a missing checker, whatever the stack", () => {
  assert.equal(chooseTypeChecker([], installed()).kind, "missing");
  assert.equal(chooseTypeChecker(["vue"], installed()).kind, "missing");
});
