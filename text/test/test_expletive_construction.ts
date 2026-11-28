import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { firedRules, namedRuleRun } from "./rule-run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { speakerTurns } from "../packages/chaff/src/detectors/speaker-turns.ts";

// expletive-construction in minutes of who said what. All text is self-written.

const RULE = "expletive-construction";

const fires = (source: string): boolean => firedRules(en, source, "business/meeting-notes").includes(RULE);

const EXPLETIVES = ["There is a plan for the budget.", "There are risks in the schedule.", "It is clear that we must act.", "There is no answer yet."];

/** Minutes in which each named person speaks in turn, and every turn holds one of the expletives. */
const minutes = (names: readonly string[]): string =>
  names.map((name, index) => `${name}: We met on Monday. ${EXPLETIVES[index % EXPLETIVES.length] ?? ""}`).join("\n\n");

const THREE_SPEAKERS = ["Ana", "Ben", "oli", "Ana", "Ben", "oli", "Ana", "Ben", "oli"];

before(async () => {
  await en.prepare?.({ pos: true });
});

describe("speakerTurns", () => {
  it("finds the paragraphs that open with a name when three names each speak three times", () => {
    const source = minutes(THREE_SPEAKERS);
    assert.equal(speakerTurns(source).length, THREE_SPEAKERS.length);
    const first = speakerTurns(source)[0];
    assert.ok(first);
    assert.equal(source.slice(first.start, first.end).startsWith("Ana: "), true);
  });

  it("reads none when only two labels repeat, as fields do (Status:, Comments:)", () => {
    assert.deepEqual(speakerTurns(minutes(["Status", "Comments", "Status", "Comments", "Status", "Comments"])), []);
  });

  it("reads none when the labelled paragraphs are a small share of the document", () => {
    const prose = Array.from({ length: 40 }, () => "The committee reviewed the report and agreed on the next steps.").join("\n\n");
    assert.deepEqual(speakerTurns(`${prose}\n\n${minutes(THREE_SPEAKERS)}`), []);
  });

  it("reads none for empty text, a label with nothing after it, an indented label or a URL", () => {
    assert.deepEqual(speakerTurns(""), []);
    assert.deepEqual(speakerTurns(THREE_SPEAKERS.map((name) => `${name}:`).join("\n\n")), []);
    assert.deepEqual(speakerTurns(THREE_SPEAKERS.map((name) => `   ${name}: We agreed.`).join("\n\n")), []);
    assert.deepEqual(speakerTurns(THREE_SPEAKERS.map(() => "https: //example.com").join("\n\n")), []);
  });
});

describe("expletive-construction in minutes", () => {
  it("does not count a speaker's own phrasing in near-verbatim minutes", () => {
    assert.equal(fires(minutes(THREE_SPEAKERS)), false);
  });

  it("counts the note-taker's own sentences, and the same sentences in labelled fields", () => {
    assert.equal(fires(EXPLETIVES.join(" ")), true);
    assert.equal(fires(minutes(["Status", "Comments", "Status", "Comments"])), true);
  });
});

describe("expletive-construction: what a finding names", () => {
  it("names the form its own sentence opens with, under a label that covers both forms counted", () => {
    const source = "It was agreed that the rota starts in April. There were three items. There is a gap in the budget. There are two new members.\n";
    const label = 'is one of 4 sentences that open with "There is" or "It is ... that" (limit 3)';
    assert.deepEqual(namedRuleRun(RULE, source, en, "a.md", "business/meeting-notes").findings, [
      `"It was ..." ${label}`,
      `"There were ..." ${label}`,
      `"There is ..." ${label}`,
      `"There are ..." ${label}`,
    ]);
  });

  it("names a perfect or modal opening through its be", () => {
    const source = "There have been six complaints. There will be signs at the gate. There is a gap in the budget. There are two new members.\n";
    const label = 'is one of 4 sentences that open with "There is" or "It is ... that" (limit 3)';
    assert.deepEqual(namedRuleRun(RULE, source, en, "a.md", "business/meeting-notes").findings.slice(0, 2), [
      `"There have been ..." ${label}`,
      `"There will be ..." ${label}`,
    ]);
  });
});

describe("expletive-construction: the forms of be", () => {
  const PLAIN = "The committee met on Tuesday. There were three items. There is a gap in the budget.";
  const counted = (sentence: string): boolean => fires(`${PLAIN} There are two new members. ${sentence}\n`);

  it("counts a perfect and a modal be, with or without a negation", () => {
    assert.equal(counted("There have been six complaints about the car park."), true);
    assert.equal(counted("There will be signs at the gate by May."), true);
    assert.equal(counted("There has never been a meeting this short."), true);
    assert.equal(counted("There won't be a vote today."), true);
    assert.equal(counted("It has been agreed that the rota starts in April."), true);
    assert.equal(counted("It could be argued that the fee is too high."), true);
  });

  it("does not count a modal or have that is not followed by be", () => {
    assert.equal(counted("There must have seemed little point."), false);
    assert.equal(counted("It will rain, so we know that the fete moves indoors."), false);
    assert.equal(counted("There, we have a garden."), false);
  });
});

describe("expletive-construction: an it that names a thing", () => {
  const PLAIN = "The committee met on Tuesday. There were three items. There is a gap in the budget.";
  const counted = (sentence: string): boolean => fires(`${PLAIN} There are two new members. ${sentence}\n`);

  it("does not count a passive about a thing, whose that belongs to a later clause", () => {
    assert.equal(counted("It is designed to show members the plan, and that view helps them vote."), false);
  });

  it("still counts an adjective's empty it, a that-clause after a participle and a cleft", () => {
    assert.equal(counted("It is important for members to read the plan, and that reading takes an hour."), true);
    assert.equal(counted("It's tempting to start projects that grow too big."), true);
    assert.equal(counted("It is essential that applicants submit the form."), true);
    assert.equal(counted("It was agreed that the rota starts in April."), true);
    assert.equal(counted("It is the finance team that will lead it."), true);
  });
});
