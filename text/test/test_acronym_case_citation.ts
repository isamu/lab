import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { reportedAcronyms } from "./rule-run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { caseCitationSpans } from "../packages/chaff/src/detectors/case-citation.ts";

// undefined-acronym and the capitals of a case citation: a party's name (ICC v. Jersey City, Ashwander v. TVA, 297 U.S.
// 288), a court and year after a pin cite ((SDNY 1952)), and a capitalised honorific (MR. JUSTICE). The citations here are
// self-written in the shape court opinions use.

before(async () => {
  await en.prepare?.({ pos: true });
});

const JOINERS = ["v.", "vs."];

const covered = (text: string, word: string): boolean => {
  const at = text.indexOf(word);
  return caseCitationSpans(text, JOINERS).some((span) => span.start <= at && at + word.length <= span.end);
};

describe("caseCitationSpans", () => {
  it("covers a party in capitals, before or after the joiner, and a court with its year", () => {
    assert.equal(covered("See also FTA v. Hill Farms, 312 U.S. 40 (1950).", "FTA"), true);
    assert.equal(covered("In Baker v. FTA, 312 U.S. 40 (1950), the Court held", "FTA"), true);
    assert.equal(covered("Ohio ex rel. Baker v. FTA, 312 U.S. at 44.", "FTA"), true);
    assert.equal(covered("Baker v. Lee, 12 F.R.D. 30, 31 (EDNY 1951), so held.", "EDNY"), true);
    assert.equal(covered("Baker v. Lee, 3 F.Cas. 9 (No. 1,20a) (CC Pa. 1810).", "CC"), true);
  });

  it("does not cover capitals outside a citation, or without the reporter or the page before the court", () => {
    assert.equal(covered("The FTA reviewed the filing in 1950.", "FTA"), false);
    assert.equal(covered("Baker v. FTA was argued twice.", "FTA"), false);
    assert.equal(covered("The FTA v. the states debate went on.", "FTA"), false);
    assert.equal(covered("The FTA v. Hill Farms dispute went on.", "FTA"), false);
    assert.equal(covered("Growth slowed (OECD 2020) in most places.", "OECD"), false);
    assert.equal(covered("FTA v. Hill Farms, 312 U.S. 40.", "FTA"), true);
    assert.equal(caseCitationSpans("FTA v. Hill Farms", []).length, 0);
  });
});

describe("undefined-acronym in a court opinion", () => {
  it("does not ask to expand the parties, the courts or a capitalised honorific", () => {
    const opinion = [
      "MR. CHIEF JUSTICE BAKER delivered the opinion of the Court.",
      "",
      "In Baker v. FTA, 312 U.S. 40 (1950), the Court looked past the label. See also KLM v. Hill Farms, 315 U.S. 9 (1951); Lee v. Ross, 12 F.R.D. 30, 31 (EDNY 1951).",
      "",
      "MR. JUSTICE LEE took no part in the decision of this case.",
    ].join("\n");
    assert.deepEqual(reportedAcronyms(en, opinion, "legal/judgment"), []);
  });

  it("still asks to expand an acronym the opinion uses in its own words", () => {
    const opinion = "In Baker v. FTA, 312 U.S. 40 (1950), the Court held that the FTA rule binds the RRB as well.";
    assert.deepEqual(reportedAcronyms(en, opinion, "legal/judgment"), ["FTA", "RRB"]);
  });
});
