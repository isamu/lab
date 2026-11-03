import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { colonLeadIns } from "../packages/chaff/src/detectors/list-lead-in.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// colon-lead-in: a field label that carries its entry's name, and a lead-in that states a duty. Every example here is self-written.

before(async () => {
  await en.prepare?.({ pos: true });
  await ja.prepare?.({ pos: true });
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

// Self-written runbook sections: each lead-in states what someone has to do, or what something has to hold.
const duty = (leadIn: string): string => `## Step\n\nThe call has ended.\n\n${leadIn}\n\n- Post the summary\n- Close the ticket\n`;

const leadInsWithDuties = (source: string, adapter: LanguageAdapter): string[] => {
  const doc = buildDocument("t.md", source, adapter);
  const duties = doc.lexicons["lead-in-duty"] ?? [];
  return colonLeadIns(doc.sentences, doc.lists, doc.listSpans, doc.source, true, duties).map((sentence) => sentence.text.trim());
};

describe("colonLeadIns: a lead-in that states a duty", () => {
  it("does not count a lead-in with should, must or shall: it hands over steps or parts", () => {
    const runbook = ["To close out the call, the lead should:", "The final report must include:", "Each entry shall contain:"].map(duty).join("\n");
    assert.deepEqual(leadInsWithDuties(`# Runbook\n\n${runbook}`, en), []);
  });

  it("still counts a lead-in that only presents its list", () => {
    const post = ["Popular options include:", "Key features of the app include:", "This setup has several drawbacks:"].map(duty).join("\n");
    assert.equal(leadInsWithDuties(`# Post\n\n${post}`, en).length, 3);
  });

  it("still counts a duty word inside a clause that names the list", () => {
    const named = ["Questions you should be asking from day one:", "Here's what you must know:"].map(duty).join("\n");
    assert.equal(leadInsWithDuties(`# Post\n\n${named}`, en).length, 2);
  });

  it("reads the Japanese duty only at the end of the lead-in", () => {
    assert.deepEqual(leadInsWithDuties(`# 手順\n\n${duty("終了時、担当者は次のことを行わなければならない：")}`, ja), []);
    assert.deepEqual(leadInsWithDuties(`# 案内\n\n${duty("主な特徴は次のとおりです：")}`, ja), ["主な特徴は次のとおりです："]);
    assert.deepEqual(leadInsWithDuties(`# 案内\n\n${duty("注意しなければならない点は次のとおりです：")}`, ja), ["注意しなければならない点は次のとおりです："]);
  });
});
