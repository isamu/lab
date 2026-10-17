import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isMemo, isMemoLabel } from "../packages/chaff/src/detectors/email-letter.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// email-greeting-closing and a memo's header (TO: / FROM: / SUBJECT:). Every example is self-written.

const variantsOf = (adapter: LanguageAdapter, source: string): string[] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(adapter.id), {}, true, "business/email")
    .findings.filter((finding) => finding.rule === "email-greeting-closing")
    .map((finding) => finding.variant ?? "");

const EN_LABELS = ["MEMORANDUM", "TO", "FROM", "SUBJECT"];
const EN_ENDS = [".", "?", "!"];

describe("isMemoLabel: a memo's header label", () => {
  it("takes a label in capitals followed by a colon or the line's end, past emphasis and heading marks", () => {
    assert.equal(isMemoLabel("TO: All branch staff", EN_LABELS), true);
    assert.equal(isMemoLabel("**SUBJECT:**", EN_LABELS), true);
    assert.equal(isMemoLabel("## MEMORANDUM", EN_LABELS), true);
    assert.equal(isMemoLabel("発信者：総務部", ["発信者"]), true);
  });

  it("does not take a mail program's field, a longer word or a label run into words", () => {
    assert.equal(isMemoLabel("To: All branch staff", EN_LABELS), false);
    assert.equal(isMemoLabel("Subject: Parking", EN_LABELS), false);
    assert.equal(isMemoLabel("TOTAL: 3 rooms", EN_LABELS), false);
    assert.equal(isMemoLabel("TO BE DONE BY FRIDAY", EN_LABELS), false);
    assert.equal(isMemoLabel("", EN_LABELS), false);
    assert.equal(isMemoLabel("TO:", []), false);
  });
});

describe("isMemo: a label in the header, before the first sentence", () => {
  it("finds a label above the first sentence", () => {
    assert.equal(isMemo("TO: All staff\nFROM: Facilities\n\nThe car park closes on Monday.\n", EN_LABELS, EN_ENDS), true);
  });

  it("does not take a label after the first sentence, in a quoted reply, or a document without one", () => {
    const later = ["Hi team,", "", "The car park closes on Monday.", "The plan follows.", "", "SUBJECT: car park", ""].join("\n");
    assert.equal(isMemo(later, EN_LABELS, EN_ENDS), false);
    assert.equal(isMemo("", EN_LABELS, EN_ENDS), false);
    assert.equal(isMemo("> TO: All staff\n\nNoted, thanks.\n", EN_LABELS, EN_ENDS), false);
  });
});

describe("email-greeting-closing on a memo", () => {
  it("does not ask a memo for a greeting or a closing", () => {
    const memo = ["TO: All branch staff", "FROM: Facilities", "SUBJECT: Car park", "", "The car park closes on Monday for repairs.", ""].join("\n");
    assert.deepEqual(variantsOf(en, memo), []);
  });

  it("reads a memo whose label stands on a line of its own under a letterhead", () => {
    const memo = [
      "TOWN OF RIVERDALE",
      "OFFICE OF THE CLERK",
      "",
      "TO THE HEAD OF EACH BRANCH OFFICE",
      "",
      "SUBJECT:",
      "",
      "Car park repairs",
      "",
      "The car park closes on Monday for repairs. Staff may park on Mill Lane.",
      "",
      "signed by",
      "Ann Lee",
      "Town Clerk",
      "",
    ].join("\n");
    assert.deepEqual(variantsOf(en, memo), []);
  });

  it("still reports an email whose header is a mail program's, and a memo label found only in the body", () => {
    const mail = ["To: facilities", "Subject: Car park", "", "The car park closes on Monday.", "", "Best regards,", "Ichiro", ""].join("\n");
    assert.deepEqual(variantsOf(en, mail), ["greeting"]);
    const later = ["The car park closes on Monday.", "", "Ask the office for a permit.", "", "SUBJECT: permits", "", "Ichiro", ""].join("\n");
    assert.deepEqual(variantsOf(en, later), ["greeting", "closing"]);
  });

  it("reads a Japanese memo by its 発信者 line, and still reports a Japanese email", () => {
    const memo = ["発信者：総務部", "件名：駐車場の工事", "", "月曜日から駐車場を工事のため閉鎖します。", ""].join("\n");
    assert.deepEqual(variantsOf(ja, memo), []);
    const mail = ["件名：駐車場の工事", "", "月曜日から駐車場を工事のため閉鎖します。", "", "佐藤", ""].join("\n");
    assert.deepEqual(variantsOf(ja, mail), ["greeting", "closing"]);
  });
});
