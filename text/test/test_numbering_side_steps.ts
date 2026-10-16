import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { sideStepReader } from "../packages/chaff/src/structure/side-step.ts";
import type { StructureNode } from "../packages/chaff/src/plugin.ts";

// numbering-gap: a step-by-step list (GOV.UK's) writes "and" in place of a number for a step done alongside the one
// before it. Such a step may have taken a number, so "1, and, 3" is not a gap. Examples are self-written.

const GENRE = "docs/manual";

const gapsOf = (source: string): [unknown, unknown][] =>
  runRules(buildDocument("steps.md", source, en), loadRules(en.id), {}, true, GENRE)
    .findings.filter((finding) => finding.rule === "numbering-gap")
    .map((finding) => [finding.values["previous"], finding.values["label"]]);

const steps = (...labels: string[]): string =>
  [
    "# Ship a parcel abroad: step by step",
    "",
    ...labels.flatMap((label, index) => [`### ${label}     Step text ${String(index + 1)}`, "", "Do this.", ""]),
  ].join("\n");

const nodeWith = (heading?: string | number): StructureNode => ({
  kind: "section",
  address: "h",
  line: 1,
  attrs: heading === undefined ? {} : { heading },
  children: [],
  span: { start: 0, end: 0 },
});

describe("numbering-gap: a step labelled 'and' in place of its number", () => {
  it("does not report the number after an 'and' step that took it", () => {
    assert.deepEqual(gapsOf(steps("1", "and", "3", "and", "4", "5")), []);
    assert.deepEqual(gapsOf(steps("1", "or", "3")), []);
  });

  it("still reports a gap wider than the 'and' steps before it", () => {
    assert.deepEqual(gapsOf(steps("1", "and", "4")), [["1", "4"]]);
  });

  it("still reports a gap with no 'and' step before it", () => {
    assert.deepEqual(gapsOf(steps("1", "and", "2", "4")), [["2", "4"]]);
  });

  it("does not read an ordinary heading that starts with 'and' as a step", () => {
    const source = ["# Notes", "", "### 1     First", "", "Text.", "", "### and more details", "", "Text.", "", "### 3     Third", "", "Text."].join("\n");
    assert.deepEqual(gapsOf(source), [["1", "3"]]);
  });

  it("reads the label word as written, in a label column, followed by the step's text", () => {
    const isSideStep = sideStepReader(["and"]);
    assert.equal(isSideStep(nodeWith("and     Book a courier")), true);
    assert.equal(isSideStep(nodeWith("and\tBook a courier")), true);
    assert.equal(isSideStep(nodeWith("and Book a courier")), false);
    assert.equal(isSideStep(nodeWith("And     Book a courier")), false);
    assert.equal(isSideStep(nodeWith("and")), false);
    assert.equal(isSideStep(nodeWith("Android setup")), false);
    assert.equal(isSideStep(nodeWith("Book a courier and pack")), false);
    assert.equal(isSideStep(nodeWith()), false);
    assert.equal(isSideStep(nodeWith(3)), false);
    assert.equal(sideStepReader([])(nodeWith("and     Book a courier")), false);
  });
});
