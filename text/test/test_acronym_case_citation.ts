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
    assert.equal(covered("It supports Version 2 (RFC 8305) now.", "RFC"), false);
    assert.equal(covered("Baker v. Lee, 12 F.R.D. 30, 31 (EDNY 8305).", "EDNY"), false);
    assert.equal(covered("FTA v. Hill Farms, 312 U.S. 40.", "FTA"), true);
    assert.equal(caseCitationSpans("FTA v. Hill Farms", []).length, 0);
  });

  it("covers a party joined by & or /, and a party followed by more words of its name", () => {
    assert.equal(covered("See MCI Telecomms. Corp. v. AT&T, 512 U.S. 218, 231 n.4 (1994).", "MCI"), true);
    assert.equal(covered("See MCI Telecomms. Corp. v. AT&T, 512 U.S. 218, 231 n.4 (1994).", "AT&T"), true);
    assert.equal(covered("see Trust Co. Bank v. MGM/UA Entertainment Co., 772 F.2d 740 (11th Cir. 1985)", "MGM/UA"), true);
  });

  it("covers an agency's docket number before a pin cite and the deciding body with its year", () => {
    assert.equal(covered("In re Colo. River Indian Tribes, NOV/CFA 01-01, 5-6 (Nat'l Indian Gaming Comm'n May 30, 2001).", "NOV/CFA"), true);
    assert.equal(covered("The NOV/CFA 01-01 form is due.", "NOV/CFA"), false);
    assert.equal(covered("File NOV/CFA 01-01, 5-6 copies (two sets).", "NOV/CFA"), false);
    assert.equal(covered("The MGM/UA Entertainment Co. lot was sold.", "MGM/UA"), false);
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

  it("does not ask to expand the parties of citations from opinions, even when a party's name breaks the sentence", () => {
    // Colorado River Indian Tribes v. NIGC, 466 F.3d 134 (D.C. Cir. 2006) and Micro Star v. FormGen Inc., 154 F.3d 1107 (9th
    // Cir. 1998), US court opinions in the public domain.
    const opinion = [
      "In re Colo. River Indian Tribes, NOV/CFA 01-01, 5-6 (Nat'l Indian Gaming Comm'n May 30, 2001). The Commission denied the objection.",
      "",
      "See MCI Telecomms. Corp. v. AT&T, 512 U.S. 218, 231 n.4 (1994). A copyright owner holds the right to create sequels, see Trust Co. Bank v. MGM/UA Entertainment Co., 772 F.2d 740 (11th Cir. 1985).",
    ].join("\n");
    assert.deepEqual(reportedAcronyms(en, opinion, "legal/judgment"), []);
    assert.deepEqual(reportedAcronyms(en, `${opinion} The MCI rule binds the RRB.`, "legal/judgment"), ["MCI", "RRB"]);
  });

  it("still asks to expand an acronym the opinion uses in its own words", () => {
    const opinion = "In Baker v. FTA, 312 U.S. 40 (1950), the Court held that the FTA rule binds the RRB as well.";
    assert.deepEqual(reportedAcronyms(en, opinion, "legal/judgment"), ["FTA", "RRB"]);
  });
});
