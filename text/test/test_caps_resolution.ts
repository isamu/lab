import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { isConventionalPhrase } from "../packages/chaff/src/detectors/caps-phrase.ts";

// all-caps-shouting and the formal wording of a resolution (WHEREAS, NOW, THEREFORE, BE IT RESOLVED), set in capitals by
// convention. Every example is self-written.

before(async () => {
  await en.prepare?.({ pos: true });
});

const findingsOf = (source: string): readonly string[] => namedRuleRun("all-caps-shouting", source, en, "a.md", "business/meeting-notes").findings;

const PHRASES = ["MUST", "NOW, THEREFORE", "BE IT RESOLVED", "BE IT FURTHER RESOLVED"];

describe("isConventionalPhrase", () => {
  it("a run made only of listed phrases, commas or not", () => {
    assert.equal(isConventionalPhrase("NOW, THEREFORE, BE IT RESOLVED", PHRASES), true);
    assert.equal(isConventionalPhrase("NOW THEREFORE BE IT FURTHER RESOLVED", PHRASES), true);
    assert.equal(isConventionalPhrase("BE IT RESOLVED", PHRASES), true);
  });

  it("not a run with a word of its own, a part of a phrase, or one-word entries", () => {
    assert.equal(isConventionalPhrase("BE IT RESOLVED AT ONCE", PHRASES), false);
    assert.equal(isConventionalPhrase("DO IT NOW", PHRASES), false);
    assert.equal(isConventionalPhrase("BE IT", PHRASES), false);
    assert.equal(isConventionalPhrase("MUST MUST MUST", PHRASES), false);
    assert.equal(isConventionalPhrase("NOW, THEREFORE, BE IT RESOLVED", []), false);
    assert.equal(isConventionalPhrase("", PHRASES), false);
  });
});

const RESOLUTION = [
  "The board was asked to approve the change, and the board voted on it.",
  "",
  "WHEREAS, the committee has recommended that the office be created; and",
  "",
  "NOW, THEREFORE, BE IT RESOLVED, that the office of treasurer is hereby created; and",
  "",
  "BE IT FURTHER RESOLVED, that the treasurer is appointed to the office now and resolved to serve; and",
  "",
  "NOW, THEREFORE, BE IT FURTHER RESOLVED, that it be further recorded.",
  "",
].join("\n");

describe("all-caps-shouting and the wording of a resolution", () => {
  it("valid: WHEREAS, NOW, THEREFORE, BE IT RESOLVED and BE IT FURTHER RESOLVED", () => {
    assert.deepEqual(findingsOf(RESOLUTION), []);
  });

  it("invalid: shouting beside the wording, or shouting of its own, is still reported", () => {
    assert.equal(findingsOf(`${RESOLUTION}\nBE IT RESOLVED NOW AND FOREVER, that the office is closed.\n`).length, 1);
    assert.equal(findingsOf(`${RESOLUTION}\nThe treasurer said: DO IT NOW, before the board is closed.\n`).length, 1);
  });
});
