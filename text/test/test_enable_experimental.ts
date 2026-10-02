import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runCli } from "./cli-run.ts";
import { offOnlyAsExperimental } from "../packages/chaff/src/experimental-alone.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { presetLevels } from "../packages/chaff/src/genre-load.ts";
import { DEFAULT_GENRE } from "../packages/chaff/src/init-choice.ts";

// An experimental rule can be turned on alone by naming it in chaff.yaml. enable writes that line, and explain, the list
// of rules that did not run, and rules --json each point to it.

const DOC_EN = "# Checks\n\nThere are three checks.\n";

// Most rules run by default since they were measured (spec §21.1); a rule is experimental only until it is. So the rules
// these tests turn on are whichever are experimental today, and a test that needs one is skipped while none is.
const NOTHING_WRITTEN = { rules: {}, experimental: false };
const offAlone = (language: string, genre = DEFAULT_GENRE): string[] =>
  loadRules(language)
    .filter((rule) => rule.layer !== "L4" && offOnlyAsExperimental(rule, NOTHING_WRITTEN, genre, presetLevels(genre), language))
    .map((rule) => rule.id);
const ALONE_EN = offAlone("en");
const ALONE_JA = offAlone("ja");
const RULE = ALONE_EN[0];
const OTHER = ALONE_EN[1];
const OTHER_GENRE_ONLY = offAlone("en", "business/report").find((id) => !ALONE_EN.includes(id));
const ENGLISH_ONLY = ALONE_EN.find((id) => !ALONE_JA.includes(id));
const NONE_NOW = "no rule is experimental now (yarn rules:measure)";
const skipUnless = (...needed: readonly (string | undefined)[]): false | string => (needed.every((id) => id !== undefined) ? false : NONE_NOW);
/** The rule chaff enable writes in these tests: an experimental one when there is one, since that is what enable is for. */
const ENABLED = RULE ?? "max-sentence-length";
const ENABLED_NAME = loadRules("en").find((rule) => rule.id === ENABLED)?.name["en"] ?? "";

const count = (text: string, part: string): number => text.split(part).length - 1;

describe("chaff enable", () => {
  it("writes the rule at normal into chaff.yaml, with a comment explaining it", async () => {
    const run = await runCli({}, ["enable", ENABLED], "en_US.UTF-8");
    assert.equal(run.code, 0);
    assert.match(run.out, new RegExp(`^Set ${ENABLED} to normal \\(`, "u"));
    const written = readFileSync(join(run.dir, "chaff.yaml"), "utf8");
    assert.match(written, new RegExp(`^ {2}${ENABLED}: normal$`, "mu"));
    assert.ok(written.split("\n").includes(`  # ${ENABLED_NAME}`), written);
  });

  it("keeps a reason given with --why", async () => {
    const run = await runCli({}, ["enable", ENABLED, "--why", "our specs announce counts"], "en_US.UTF-8");
    assert.match(readFileSync(join(run.dir, "chaff.yaml"), "utf8"), new RegExp(`${ENABLED}: normal # \\S+ our specs announce counts / `, "u"));
  });

  it("turns that rule on, and no other experimental rule, without --experimental", { skip: skipUnless(RULE, OTHER) }, async () => {
    const run = await runCli({ "chaff.yaml": `rules:\n  ${RULE ?? ""}: normal\n`, "t.md": DOC_EN }, ["t.md"], "en_US.UTF-8");
    assert.match(run.out, new RegExp(`1 experimental rule turned on in the settings: ${RULE ?? ""}`, "u"));
    assert.doesNotMatch(run.out, new RegExp(`^ +${RULE ?? ""} \\(still experimental\\)$`, "mu"));
    assert.match(run.out, new RegExp(`^ +${OTHER ?? ""} \\(still experimental\\)$`, "mu"));
  });

  it("refuses a rule that does not exist", async () => {
    const run = await runCli({}, ["enable", "no-such-rule"], "en_US.UTF-8");
    assert.equal(run.code, 1);
  });

  it("is listed in the help", async () => {
    const english = await runCli({}, ["--help"], "en_US.UTF-8");
    assert.match(english.out, /chaff enable <rule>/u);
    const japanese = await runCli({}, ["--help"]);
    assert.match(japanese.out, /chaff enable <rule>.*試験中のルールを 1 つだけ動かす/u);
  });
});

describe("explain on an experimental rule", () => {
  it("shows how to turn it on alone while it is off, in English and Japanese", { skip: skipUnless(RULE) }, async () => {
    const english = await runCli({}, ["explain", RULE ?? ""], "en_US.UTF-8");
    assert.match(
      english.out,
      new RegExp(`Turn on this rule alone: {2}npx chaffjs enable ${RULE ?? ""} {2}\\(the same as rules: \\{ ${RULE ?? ""}: normal \\} in chaff\\.yaml\\)`, "u"),
    );
    const japanese = await runCli({}, ["explain", RULE ?? ""]);
    assert.match(japanese.out, new RegExp(`このルールだけを動かす: {2}npx chaffjs enable ${RULE ?? ""}`, "u"));
  });

  it("does not show it once the rule is on, nor for a rule that is not experimental", async () => {
    const on = await runCli({ "chaff.yaml": `rules:\n  ${ENABLED}: normal\n` }, ["explain", ENABLED], "en_US.UTF-8");
    assert.doesNotMatch(on.out, /npx chaffjs enable/u);
    const stable = await runCli({}, ["explain", "max-sentence-length"], "en_US.UTF-8");
    assert.doesNotMatch(stable.out, /npx chaffjs enable/u);
    const stableOff = await runCli({ "chaff.yaml": "rules:\n  max-sentence-length: off\n" }, ["explain", "max-sentence-length"], "en_US.UTF-8");
    assert.doesNotMatch(stableOff.out, /npx chaffjs enable|still experimental/u);
  });
});

describe("explain where enable would change nothing", () => {
  it("does not offer it for a rule chaff.yaml turned off with a reason", async () => {
    const run = await runCli({ "chaff.yaml": `rules:\n  ${ENABLED}: off # 2026-10-02 not for us / writer\n` }, ["explain", ENABLED], "en_US.UTF-8");
    assert.doesNotMatch(run.out, /npx chaffjs enable/u);
  });

  it("does not offer it in a genre the rule does not serve", { skip: skipUnless(OTHER_GENRE_ONLY) }, async () => {
    const rule = OTHER_GENRE_ONLY ?? "";
    const run = await runCli({}, ["explain", rule, "--genre", DEFAULT_GENRE], "en_US.UTF-8");
    assert.doesNotMatch(run.out, /npx chaffjs enable/u);
    const served = await runCli({}, ["explain", rule, "--genre", "business/report"], "en_US.UTF-8");
    assert.match(served.out, new RegExp(`npx chaffjs enable ${rule}`, "u"));
  });

  it("does not offer it in a language the rule does not read", { skip: skipUnless(ENGLISH_ONLY) }, async () => {
    const rule = ENGLISH_ONLY ?? "";
    const japanese = await runCli({ "chaff.yaml": "language: ja\n" }, ["explain", rule]);
    assert.doesNotMatch(japanese.out, /npx chaffjs enable/u);
    const english = await runCli({ "chaff.yaml": "language: en\n" }, ["explain", rule], "en_US.UTF-8");
    assert.match(english.out, new RegExp(`npx chaffjs enable ${rule}`, "u"));
  });
});

describe("the list of rules that did not run", () => {
  it("says once how to turn one experimental rule on alone", { skip: skipUnless(RULE, OTHER) }, async () => {
    const run = await runCli({ "t.md": DOC_EN }, ["t.md"], "en_US.UTF-8");
    assert.ok(count(run.out, "(still experimental)") > 1);
    assert.equal(count(run.out, "Turn on one experimental rule alone by naming it: npx chaffjs enable "), 1);
    assert.match(run.out, /--experimental turns on all of them\./u);
  });

  it("names the first rule left off for being experimental as the example", { skip: skipUnless(RULE) }, async () => {
    const run = await runCli({ "t.md": DOC_EN }, ["t.md"], "en_US.UTF-8");
    const first = /^ +(\S+) \(still experimental\)$/mu.exec(run.out)?.[1];
    assert.ok(first !== undefined);
    assert.match(run.out, new RegExp(`npx chaffjs enable ${first} \\(the same as rules: \\{ ${first}: normal \\}`, "u"));
  });

  it("says it in Japanese for a Japanese document", { skip: skipUnless(ALONE_JA[0]) }, async () => {
    const run = await runCli({ "t.md": "# 確認\n\n確認は三つあります。\n" }, ["t.md"]);
    assert.equal(count(run.out, "試験中のルールを 1 つだけ動かすには、npx chaffjs enable "), 1);
  });

  it("says nothing when no rule is off for being experimental", async () => {
    const run = await runCli({ "t.md": DOC_EN }, ["t.md", "--experimental"], "en_US.UTF-8");
    assert.doesNotMatch(run.out, /npx chaffjs enable/u);
  });
});

describe("rules --json", () => {
  it("gives the command that turns an experimental rule on alone", { skip: skipUnless(RULE) }, async () => {
    const run = await runCli({}, ["rules", "--json"], "en_US.UTF-8");
    const parsed: unknown = JSON.parse(run.out);
    assert.match(JSON.stringify(parsed), new RegExp(`"turn_on_with":"npx chaffjs enable ${RULE ?? ""}"`, "u"));
  });

  it("gives no command for a rule the language does not read", { skip: skipUnless(ENGLISH_ONLY, ALONE_JA[0]) }, async () => {
    const run = await runCli({ "chaff.yaml": "language: ja\n" }, ["rules", "--json"]);
    const text = JSON.stringify(JSON.parse(run.out));
    assert.doesNotMatch(text, new RegExp(`npx chaffjs enable ${ENGLISH_ONLY ?? ""}"`, "u"));
    assert.match(text, new RegExp(`npx chaffjs enable ${ALONE_JA[0] ?? ""}`, "u"));
  });
});

describe("offOnlyAsExperimental", () => {
  const rule: Parameters<typeof offOnlyAsExperimental>[0] = { id: "r", status: "experimental", use_for: ["blog"], languages: ["en"] };
  const written = { rules: {}, experimental: false };

  it("is true for an experimental rule left off in a genre and language it serves", () => {
    assert.equal(offOnlyAsExperimental(rule, written, "blog/tech", {}, "en"), true);
    assert.equal(offOnlyAsExperimental({ ...rule, languages: undefined }, written, "blog/tech", {}, "ja"), true);
  });

  const falses: readonly (readonly [string, Parameters<typeof offOnlyAsExperimental>])[] = [
    ["a stable rule", [{ ...rule, status: "stable" }, written, "blog/tech", {}, "en"]],
    ["--experimental already on", [rule, { rules: {}, experimental: true }, "blog/tech", {}, "en"]],
    ["a rule chaff.yaml names", [rule, { rules: { r: "off" }, experimental: false }, "blog/tech", {}, "en"]],
    ["a genre it does not serve", [rule, written, "business/report", {}, "en"]],
    ["a genre preset that decides it", [rule, written, "blog/tech", { r: "off" }, "en"]],
    ["a language it does not read", [rule, written, "blog/tech", {}, "ja"]],
  ];
  falses.forEach(([label, args]) => {
    it(`is false for ${label}`, () => {
      assert.equal(offOnlyAsExperimental(...args), false);
    });
  });
});
