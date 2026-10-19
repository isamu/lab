import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { measuredOffOn } from "../scripts/rules-measure-files.ts";

// wordy-phrase: "at all times" states the scope of a rule, and "always" is not the same sentence. Examples are self-written.

const RULES = loadRules("en");

const wordy = (source: string): string[] =>
  runRules(buildDocument("t.md", source, en), RULES, measuredOffOn("docs/faq"), true, "docs/faq")
    .findings.filter((finding) => finding.rule === "wordy-phrase")
    .map((finding) => String(finding.values?.["matched"]));

describe("wordy-phrase: the scope of a rule", () => {
  before(async () => {
    await en.prepare?.({ pos: true });
  });

  it("valid: at all times in a rule", () => {
    assert.deepEqual(wordy("Pets must be kept on a leash at all times. Store all food in a locked vehicle at all times when it is not in use.\n"), []);
  });

  it("invalid: the other wordy phrases in the same text", () => {
    assert.deepEqual(wordy("Pets must be kept on a leash at all times. The trail is open with the exception of winter. Call ahead in order to book.\n"), [
      "with the exception of",
      "in order to",
    ]);
  });
});
