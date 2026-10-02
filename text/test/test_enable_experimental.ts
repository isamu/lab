import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runCli } from "./cli-run.ts";

// An experimental rule can be turned on alone by naming it in chaff.yaml. enable writes that line, and explain, the list
// of rules that did not run, and rules --json each point to it.

const DOC_EN = "# Checks\n\nThere are three checks.\n";
const RULE = "announced-count-mismatch";

const count = (text: string, part: string): number => text.split(part).length - 1;

describe("chaff enable", () => {
  it("writes the rule at normal into chaff.yaml, with a comment explaining it", async () => {
    const run = await runCli({}, ["enable", RULE], "en_US.UTF-8");
    assert.equal(run.code, 0);
    assert.match(run.out, new RegExp(`^Set ${RULE} to normal \\(`, "u"));
    const written = readFileSync(join(run.dir, "chaff.yaml"), "utf8");
    assert.match(written, new RegExp(`^ {2}${RULE}: normal$`, "mu"));
    assert.match(written, /^ {2}# A list that does not have the number of items announced$/mu);
  });

  it("keeps a reason given with --why", async () => {
    const run = await runCli({}, ["enable", RULE, "--why", "our specs announce counts"], "en_US.UTF-8");
    assert.match(readFileSync(join(run.dir, "chaff.yaml"), "utf8"), new RegExp(`${RULE}: normal # \\S+ our specs announce counts / `, "u"));
  });

  it("turns that rule on, and no other experimental rule, without --experimental", async () => {
    const run = await runCli({ "chaff.yaml": `rules:\n  ${RULE}: normal\n`, "t.md": DOC_EN }, ["t.md"], "en_US.UTF-8");
    assert.match(run.out, new RegExp(`1 experimental rule turned on in the settings: ${RULE}`, "u"));
    assert.doesNotMatch(run.out, new RegExp(`^ +${RULE} \\(still experimental\\)$`, "mu"));
    assert.match(run.out, /^ +doubled-word \(still experimental\)$/mu);
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
  it("shows how to turn it on alone while it is off, in English and Japanese", async () => {
    const english = await runCli({}, ["explain", RULE], "en_US.UTF-8");
    assert.match(
      english.out,
      new RegExp(`Turn on this rule alone: {2}npx chaffjs enable ${RULE} {2}\\(the same as rules: \\{ ${RULE}: normal \\} in chaff\\.yaml\\)`, "u"),
    );
    const japanese = await runCli({}, ["explain", RULE]);
    assert.match(japanese.out, new RegExp(`このルールだけを動かす: {2}npx chaffjs enable ${RULE}`, "u"));
  });

  it("does not show it once the rule is on, nor for a rule that is not experimental", async () => {
    const on = await runCli({ "chaff.yaml": `rules:\n  ${RULE}: normal\n` }, ["explain", RULE], "en_US.UTF-8");
    assert.doesNotMatch(on.out, /npx chaffjs enable/u);
    const stable = await runCli({}, ["explain", "max-sentence-length"], "en_US.UTF-8");
    assert.doesNotMatch(stable.out, /npx chaffjs enable/u);
    const stableOff = await runCli({ "chaff.yaml": "rules:\n  max-sentence-length: off\n" }, ["explain", "max-sentence-length"], "en_US.UTF-8");
    assert.doesNotMatch(stableOff.out, /npx chaffjs enable|still experimental/u);
  });
});

describe("the list of rules that did not run", () => {
  it("says once how to turn one experimental rule on alone", async () => {
    const run = await runCli({ "t.md": DOC_EN }, ["t.md"], "en_US.UTF-8");
    assert.ok(count(run.out, "(still experimental)") > 1);
    assert.equal(count(run.out, "Turn on one experimental rule alone by naming it: npx chaffjs enable "), 1);
    assert.match(run.out, /--experimental turns on all of them\./u);
  });

  it("names the first rule left off for being experimental as the example", async () => {
    const run = await runCli({ "t.md": DOC_EN }, ["t.md"], "en_US.UTF-8");
    const first = /^ +(\S+) \(still experimental\)$/mu.exec(run.out)?.[1];
    assert.ok(first !== undefined);
    assert.match(run.out, new RegExp(`npx chaffjs enable ${first} \\(the same as rules: \\{ ${first}: normal \\}`, "u"));
  });

  it("says it in Japanese for a Japanese document", async () => {
    const run = await runCli({ "t.md": "# 確認\n\n確認は三つあります。\n" }, ["t.md"]);
    assert.equal(count(run.out, "試験中のルールを 1 つだけ動かすには、npx chaffjs enable "), 1);
  });

  it("says nothing when no rule is off for being experimental", async () => {
    const run = await runCli({ "t.md": DOC_EN }, ["t.md", "--experimental"], "en_US.UTF-8");
    assert.doesNotMatch(run.out, /npx chaffjs enable/u);
  });
});

describe("rules --json", () => {
  it("gives the command that turns an experimental rule on alone", async () => {
    const run = await runCli({}, ["rules", "--json"], "en_US.UTF-8");
    const parsed: unknown = JSON.parse(run.out);
    assert.match(JSON.stringify(parsed), new RegExp(`"turn_on_with":"npx chaffjs enable ${RULE}"`, "u"));
  });
});
