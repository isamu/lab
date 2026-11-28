import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { reportedAcronyms } from "./rule-run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";

// undefined-acronym and a conjunction written in capitals at the head of a line. The text is self-written.

before(async () => {
  await en.prepare?.({ pos: true });
});

const enDoc = (body: string): string => `# Notice\n\n${body}\n`;

describe("undefined-acronym: a conjunction in capitals at the head of a line", () => {
  it("leaves out OR before a comma and a capitalised word, and OR alone on its line", () => {
    assert.deepEqual(reportedAcronyms(en, enDoc("Read the whole guide below.\n\nOR, Skip to the topics of interest to you:")), []);
    assert.deepEqual(reportedAcronyms(en, enDoc("Mail the form to the office.\n\nOR\n\nFill in the form on the website.")), []);
  });

  it("still reports OR inside a sentence, before a state, or before a lower-case word", () => {
    assert.deepEqual(reportedAcronyms(en, enDoc("Bring the patient to the OR before noon.")), ["OR"]);
    assert.deepEqual(reportedAcronyms(en, enDoc("OR, WA and ID share the river.")), ["OR", "WA"]);
    assert.deepEqual(reportedAcronyms(en, enDoc("OR staff must wear masks.")), ["OR"]);
  });
});
