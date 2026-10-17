import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { startsDate } from "../packages/chaff/src/structure/universal.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";

// numbering-gap: a timeline's date subheadings (### 8 December 2022, ### 18 December 2022) open with the day, not a
// section number. Every example is self-written.

const gapsOf = (source: string): string[] =>
  runRules(buildDocument("r.md", source, en), loadRules("en"), {}, true, "business/report")
    .findings.filter((finding) => finding.rule === "numbering-gap")
    .map((finding) => `${String(finding.values["previous"])} → ${String(finding.values["label"])}`);

const timeline = (...headings: string[]): string =>
  ["## Timeline", "", ...headings.flatMap((heading) => [`### ${heading}`, "", "- 10:00 The service was restarted.", ""])].join("\n");

before(async () => {
  await en.prepare?.({ pos: true });
});

describe("startsDate", () => {
  it("is true when a date the language reads starts at the number", () => {
    assert.equal(startsDate("8 December 2022", en.structure?.dates), true);
    assert.equal(startsDate("  18 December 2022", en.structure?.dates), true);
  });

  it("is false for a numbered title, a day and month without a year, a date later in the line, and no date reader", () => {
    assert.equal(startsDate("2 May", en.structure?.dates), false);
    assert.equal(startsDate("3 Results", en.structure?.dates), false);
    assert.equal(startsDate("3 Results of 8 December", en.structure?.dates), false);
    assert.equal(startsDate("8 December 2022", undefined), false);
  });
});

describe("numbering-gap: date subheadings in a timeline", () => {
  it("does not read 8 then 18 December as a skipped number", () => {
    assert.deepEqual(gapsOf(timeline("8 December 2022", "18 December 2022", "19 December 2022")), []);
  });

  it("still reports a gap in numbered headings", () => {
    assert.deepEqual(gapsOf(timeline("1 Detection", "2 Response", "4 Recovery")), ["2 → 4"]);
  });
});
