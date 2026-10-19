import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { isScopeCue } from "../packages/chaff/src/detectors/open-end-scope.ts";

// requirement-smell: an open list inside the clause that describes the requirement's topic (SNSなどを通じて…行う個人間融資は)
// says what the requirement is about, not what it asks. Self-written sentences only.

const RULE = "requirement-smell";

const found = (body: string): string[] =>
  runRules(buildDocument("t.md", `# T\n\n${body}\n`, ja), loadRules(ja.id), { [RULE]: "normal" }, false, "docs/faq")
    .findings.filter((finding) => finding.rule === RULE)
    .map((finding) => `${finding.variant ?? ""}:${String(finding.values["matched"])}`);

before(async () => {
  await ja.prepare?.({ pos: true });
});

describe("requirement-smell: a list in the clause that describes the topic (ja)", () => {
  it("a list in a clause describing the topic noun is not reported", () => {
    assert.deepEqual(found("掲示板などを通じて知り合った人と行う取引は、事前に届け出る必要があります。"), []);
    assert.deepEqual(found("写真等を載せるページは、運営者の承認を受ける必要があります。"), []);
  });

  it("a list that is the topic itself, or the object of the duty, is still reported", () => {
    assert.deepEqual(found("写真等は、運営者の承認を受ける必要があります。"), ["open-end:等"]);
    assert.deepEqual(found("利用者は、写真等を運営者に届け出る必要があります。"), ["open-end:等"]);
    assert.deepEqual(found("受託者は、写真等を提出することは、必ず行う必要があります。"), ["open-end:等"]);
    assert.deepEqual(found("写真等を載せるページは運営者の承認を受ける必要があります。"), ["open-end:等"]);
  });

  it("は in the scope-topic group is a cue, not an open-end word", () => {
    assert.equal(isScopeCue({ pattern: "は", group: "scope-topic" }), true);
  });
});
