import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";

// ngram-repetition: a process manual names the role for each step (the manager should …). The window holds only who acts and
// the modal; what they do follows outside it and differs each time. Checked both ways: a pronoun subject (you should) and the
// same words with the duty repeated are still counted. Self-written text.

const worst = (source: string): string | undefined => {
  const finding = runRules(buildDocument("t.md", source, en), loadRules(en.id), {}, true, "docs/manual").findings.find(
    (each) => each.rule === "ngram-repetition",
  );
  return finding === undefined ? undefined : String(finding.values["word"]);
};

const EN_FILLER = Array.from({ length: 40 }, (_, index) => `Item ${String(index)} holds value ${String(index * 3)} today.`).join(" ");

const STEPS = [
  { heading: "Opening a request", lead: "Before anything else", duty: "open a ticket for the payroll team" },
  { heading: "Agreeing the date", lead: "Once the offer is signed", duty: "agree the start date with the new team" },
  { heading: "Updating the title", lead: "On the first day", duty: "update the job title in the staff records" },
  { heading: "Telling the team", lead: "A week ahead", duty: "tell the current team about the change" },
  { heading: "Moving the access", lead: "If systems differ", duty: "ask the help desk to move system access" },
  { heading: "Closing the case", lead: "At the end", duty: "close the case once the move is complete" },
  { heading: "Reviewing the bonus", lead: "Where the role was interim", duty: "review whether an interim bonus is due" },
];

const manual = (sentence: (lead: string, duty: string) => string): string =>
  [`# Transfers\n\n${EN_FILLER}`, ...STEPS.map((step) => `## ${step.heading}\n\n${sentence(step.lead, step.duty)}`)].join("\n\n");

before(async () => {
  await en.prepare?.({ pos: true });
});

describe("ngram-repetition: a role named before a modal", () => {
  it("does not count the role and its modal when the duty differs", () => {
    assert.equal(worst(manual((lead, duty) => `${lead}, the manager should ${duty}.`)), undefined);
  });

  it("still counts a pronoun subject with its modal", () => {
    assert.notEqual(worst(manual((lead, duty) => `${lead}, you yourself should ${duty}.`)), undefined);
  });

  it("still counts the role when the duty after the modal repeats", () => {
    assert.notEqual(worst(manual((lead, duty) => `${lead}, the manager should check with the team and ${duty}.`)), undefined);
  });
});
