import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { startsWithListMarker } from "../packages/lang-en/src/list-line.ts";
import { listItemHeads } from "../packages/lang-ja/src/english-list-line.ts";

// An appendix's numbered parts ("A.1.", "B.2.3") as a plain-text specification lists them in its contents. The contents
// continue a page, so their first lines are indented code to CommonMark and the rest one paragraph. Example text is self-written.

const startsWithEnglishMarkerInJa = (line: string): boolean => listItemHeads(line).length > 0;

const paragraphFindings = (source: string): string[] =>
  runRules(buildDocument("spec.txt", source, en), loadRules("en"), {}, true, "technical/spec")
    .findings.filter((finding) => finding.rule === "max-paragraph-length")
    .map((finding) => `${finding.rule}:${String(finding.line)}`);

const leader = (title: string, page: number): string => `${title}  ${". ".repeat(Math.max(2, 24 - Math.floor(title.length / 2)))} ${String(page)}`;

const CONTENTS = [
  "Table of Contents",
  "",
  `     ${leader("1.1.  Terms", 2)}`,
  `     ${leader("1.2.  Notation", 2)}`,
  `   ${leader("2.  Message Format", 3)}`,
  `     ${leader("2.1.  Header Fields", 3)}`,
  `   ${leader("Appendix A.  Worked Examples of Every Header", 9)}`,
  `     ${leader("A.1.  A Single Request from One Client", 9)}`,
  `     ${leader("A.2.  Repeated Requests within One Window", 10)}`,
  `       ${leader("A.2.1.  Back-off after the Limit Is Reached", 10)}`,
  `       ${leader("A.2.2.  Retrying with a Fresh Window Later", 10)}`,
  `   ${leader("Appendix B.  Design Notes and Earlier Proposals", 11)}`,
  `     ${leader("B.1.  Why the Limit Is Sent in a Header", 11)}`,
  `     ${leader("B.2.  Why the Limit Is Not Sent in the Body", 12)}`,
  `     ${leader("B.3.  Questions Left Open for a Later Version", 12)}`,
  `     ${leader("B.4.  Ideas Rejected during the Working Group Review", 13)}`,
  `   ${leader("Authors' Addresses", 14)}`,
].join("\n");

describe("list-line (en): an appendix's numbered part starts a list item", () => {
  it("reads A.1., B.2.3 and C.10. as markers, in the English adapter and in the ja adapter's copy", () => {
    ["A.1.  Interoperability", "  B.2.3  Limits", "C.10. Notes"].forEach((line) => {
      assert.equal(startsWithListMarker(line), true, line);
      assert.equal(startsWithEnglishMarkerInJa(line), true, line);
    });
  });

  it("still does not read an initial, a capital alone or an abbreviation as a marker", () => {
    ["A. Jones", "U.S. law applies.", "A.M. trading", "Appendix A.  Examples", "AB.1 build"].forEach((line) => {
      assert.equal(startsWithListMarker(line), false, line);
      assert.equal(startsWithEnglishMarkerInJa(line), false, line);
    });
  });

  it("does not report the contents of a document whose appendices are numbered A.1., B.1. as one long paragraph", () => {
    assert.deepEqual(paragraphFindings(CONTENTS), []);
  });

  it("still reports a long paragraph of prose", () => {
    const prose = Array.from(
      { length: 10 },
      (_, index) => `The server sends reply number ${String(index + 1)} to the client only after it has read the whole request and checked its limits.`,
    ).join(" ");
    assert.deepEqual(paragraphFindings(prose), ["max-paragraph-length:1"]);
  });
});
