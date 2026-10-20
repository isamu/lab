import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { singleQuotedSpans } from "../packages/chaff/src/single-quoted-span.ts";

// A court opinion quotes a statute, a report or an earlier case in single quotation marks. The quoted words keep their
// source's spelling and wording, so they do not vote on the opinion's own. The quoted passages are from Schechter Poultry
// Corp. v. United States, 295 U.S. 495 (1935) and Humphrey's Executor v. United States, 295 U.S. 602 (1935), U.S. Supreme
// Court opinions in the public domain; the rest is self-written.

const insides = (text: string): string[] => singleQuotedSpans(text).map((span) => text.slice(span.start, span.end));

describe("singleQuotedSpans", () => {
  it("reads straight and curly single quotations, over sentences", () => {
    assert.deepEqual(insides("It said 'the code. It binds.' Then it stopped."), ["the code. It binds."]);
    assert.deepEqual(insides("It said ‘the code’ and ‘the act,’ both."), ["the code", "the act,"]);
    assert.deepEqual(insides("(‘quoted’)"), ["quoted"]);
  });

  it("an apostrophe inside a word or after a plural does not open or close a quotation", () => {
    assert.deepEqual(insides("It isn't the courts' power."), []);
    assert.deepEqual(insides("The courts' power is 'limited by statute.'"), ["limited by statute."]);
    assert.deepEqual(insides("In the '90s it grew."), []);
  });

  it("a mark that does not close within its paragraph quotes nothing ('tis, 'em)", () => {
    assert.deepEqual(insides("'Tis the season, and they took 'em home.\n\nThe court said 'the act binds.'"), ["the act binds."]);
    assert.deepEqual(insides("It reads 'the act"), []);
    assert.deepEqual(insides(""), []);
  });

  it("a quotation closes before Japanese punctuation, and rock 'n' roll quotes one letter only", () => {
    assert.deepEqual(insides("He wrote 'the act'。Then he left."), ["the act"]);
    assert.deepEqual(insides("They played rock 'n' roll all night."), ["n"]);
  });
});

describe("a single-quoted quotation does not vote", () => {
  before(async () => {
    await en.prepare?.({ pos: true });
  });

  const spelling = (source: string): readonly string[] => namedRuleRun("orthographic-variant", source, en, "a.md", "legal/judgment").findings;
  const relative = (source: string): readonly string[] => namedRuleRun("which-that-consistency", source, en, "a.md", "legal/judgment").findings;

  it("orthographic-variant: the statute's spelling inside quotations does not outvote the opinion's", () => {
    const opinion = [
      "The crisis demanded a broad and intensive co-operative effort by those engaged in trade and industry.",
      "Section 1 declares the policy 'to provide for the general welfare by promoting the organization of industry for the purpose of cooperative action among trade groups.'",
      "The code was approved as tending 'to promote cooperative action among trade groups.'",
      "The finding was that 'such code will promote cooperative action.'",
    ].join(" ");
    assert.deepEqual(spelling(`${opinion}\n`), []);
    const unquoted = opinion.replaceAll("'", "");
    assert.deepEqual(spelling(`${unquoted}\n`), ['"co-operative" here, where the document usually writes "cooperative" (1 of 4)']);
  });

  it("which-that-consistency: a quoted report's that does not vote", () => {
    const own = "The power which rests in the commission is limited. The duty which falls on it is plain. The rule which governs the term is old.";
    const report = "The report said 'the terms shall be long enough to acquire the expertness that comes from experience.'";
    assert.deepEqual(relative(`${own} ${report}\n`), []);
    assert.deepEqual(relative(`${own} ${report.replaceAll("'", "")}\n`), ['This restrictive clause opens with "that"; the document mostly uses "which"']);
  });
});
