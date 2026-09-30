import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";

// undefined-acronym and a figure drawn in plain text (an RFC's message-sequence figure). A figure is not prose: an
// acronym in it is neither a use to report nor an explanation. Every document here is self-written.

before(async () => {
  await en.prepare?.({ pos: true });
});

const RULES = loadRules("en");

const reportedIn = (path: string, source: string): string[] =>
  runRules(buildDocument(path, source, en), RULES, { "undefined-acronym": "strict" }, true, "technical/spec")
    .findings.filter((finding) => finding.rule === "undefined-acronym")
    .map((finding) => String(finding.values["word"]));

/** In prose, "WAIT (??)" reads as WAIT with its expansion in brackets. In the figure, "(??)" is only a cell. */
const FIGURE = [
  "   The exchange below shows both sides.",
  "",
  "       Node A                                 Node B",
  "",
  "   1.  IDLE                                   IDLE",
  "",
  "   2.  WAIT (??)  --> <ID=7><KIND=HELLO>      ...",
  "",
  "   3.  OPEN       <-- <ID=9><KIND=REPLY>      <-- WAIT",
  "",
  "   Figure 1: A greeting between two nodes",
].join("\n");

const documentWith = (prose: string): string => ["Link setup", "", FIGURE, "", prose, ""].join("\n");

describe("undefined-acronym: an acronym in a figure", () => {
  ["setup.txt", "setup.md"].forEach((path) => {
    it(`${path}: an acronym used only in a figure is not reported`, () => {
      assert.deepEqual(reportedIn(path, documentWith("   After the greeting, both nodes are ready.")), []);
    });

    it(`${path}: an acronym shown in a figure, then used in prose without an expansion, is reported`, () => {
      assert.deepEqual(reportedIn(path, documentWith("   A node in WAIT resends its greeting after one second.")), ["WAIT"]);
    });

    it(`${path}: expanded in prose, it is explained`, () => {
      const prose = "   A node in Waiting After Initial Transmit (WAIT) resends its greeting after one second.";
      assert.deepEqual(reportedIn(path, documentWith(prose)), []);
    });
  });
});
