import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { standingIn } from "../packages/chaff/src/rule-genres.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { loadGenres } from "../packages/chaff/src/genre-load.ts";
import { presetLevelsOf } from "../packages/chaff/src/genre-parse.ts";

const stable = { id: "r", status: "stable", use_for: ["business", "blog"] } as const;
const experimental = { ...stable, status: "experimental" } as const;

describe("standingIn — how a rule stands in one genre", () => {
  it("a stable rule suited to the genre runs at normal", () => {
    assert.deepEqual(standingIn(stable, "business/report", {}), { kind: "on", level: "normal", byPreset: false });
  });

  it("an experimental rule waits for --experimental unless the genre turns it on", () => {
    assert.deepEqual(standingIn(experimental, "business/report", {}), { kind: "experimental" });
    assert.deepEqual(standingIn(experimental, "business/report", { r: "strict" }), { kind: "on", level: "strict", byPreset: true });
  });

  it("the genre's off wins over the rule's status", () => {
    assert.deepEqual(standingIn(stable, "blog/tech", { r: "off" }), { kind: "genre-off" });
    assert.deepEqual(standingIn(experimental, "blog/tech", { r: "off" }), { kind: "genre-off" });
  });

  it("a genre outside use_for is unsuited, whatever the preset says", () => {
    assert.deepEqual(standingIn(stable, "legal/contract", { r: "strict" }), { kind: "unsuited" });
    assert.deepEqual(standingIn({ ...stable, use_for: [] }, "blog/tech", {}), { kind: "unsuited" });
  });

  it("use_for names a group of genres or one genre", () => {
    assert.deepEqual(standingIn({ ...stable, use_for: ["blog"] }, "blog/essay", {}).kind, "on");
    assert.deepEqual(standingIn({ ...stable, use_for: ["blog/essay"] }, "blog/tech", {}).kind, "unsuited");
  });
});

describe("standingIn — the shipped rules and genres", () => {
  it("reads genres.yaml and use_for as a run does", () => {
    const rules = loadRules("en");
    const data = loadGenres();
    const contract = presetLevelsOf(data, "legal/contract");
    const offInContract = rules.filter((rule) => standingIn(rule, "legal/contract", contract).kind === "genre-off").map((rule) => rule.id);
    assert.ok(offInContract.includes("ngram-repetition"));
    const rhythm = rules.find((rule) => rule.id === "sentence-rhythm");
    assert.ok(rhythm !== undefined);
    assert.deepEqual(standingIn(rhythm, "business/report", presetLevelsOf(data, "business/report")), { kind: "unsuited" });
  });
});
