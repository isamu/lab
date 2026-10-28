import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { colonLeadIns } from "../packages/chaff/src/detectors/list-lead-in.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";

// colon-lead-in: a field label that carries its entry's name. Every example here is self-written.

before(async () => {
  await en.prepare?.({ pos: true });
});

const leadInsOf = (source: string): string[] => {
  const doc = buildDocument("t.md", source, en);
  return colonLeadIns(doc.sentences, doc.lists, doc.listSpans, doc.source).map((sentence) => sentence.text.trim());
};

/** One section per entry, each with the same label around the entry's name before its list (an incident guide's severities). */
const entries = (label: (name: string) => string, names: readonly string[] = ["High", "Medium", "Low"]): string =>
  "# Guide\n\n" + names.map((name) => `## ${name}\n\nThese cases come up now and then.\n\n${label(name)}\n\n- Call the lead\n- Write it down\n`).join("\n");

describe("colonLeadIns: a template label with the entry's name in it", () => {
  it("does not count the same noun label repeated with only the entry's name changing", () => {
    assert.deepEqual(leadInsOf(entries((name) => `Guidelines for addressing ${name}-risk issues:`)), []);
    assert.deepEqual(leadInsOf(entries((name) => `Changes in release ${name} today:`, ["2.1", "2.2", "2.3"])), []);
  });

  it("still counts a sentence repeated with only a name changing", () => {
    assert.equal(leadInsOf(entries((name) => `Here is what the ${name} team needs:`)).length, 3);
    assert.equal(leadInsOf(entries((name) => `The ${name} team should do these things:`)).length, 3);
  });

  it("still counts labels that share too few words, or differ in more than one", () => {
    assert.equal(leadInsOf(entries((name) => `Key ${name} points:`)).length, 3);
    const twoSlots = entries((name) => `Guidelines for addressing ${name}-risk ${name.toLowerCase()} issues:`);
    assert.equal(leadInsOf(twoSlots).length, 3);
  });

  it("still counts a noun label with the entry's name used once", () => {
    assert.equal(leadInsOf(entries((name) => `Guidelines for addressing ${name}-risk issues:`, ["High"])).length, 1);
  });
});
