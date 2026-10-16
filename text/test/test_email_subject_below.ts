import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { valueBelow, type SubjectVocabulary } from "../packages/chaff/src/detectors/email-letter.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { Finding, LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// email-subject-length and a subject set on the line under its label ("SUBJECT:" over the subject). Every example is self-written.

const subjectFindings = (adapter: LanguageAdapter, source: string): Finding[] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(adapter.id), {}, true, "business/email").findings.filter(
    (finding) => finding.rule === "email-subject-length",
  );
const variantsOf = (adapter: LanguageAdapter, source: string): string[] => subjectFindings(adapter, source).map((finding) => finding.variant ?? "");

const VOCABULARY: SubjectVocabulary = { fields: ["Subject"], replyMarks: ["Re"], greetings: ["Dear", "Hi"], sentenceEnds: [".", "?", "!"] };
const below = (text: string, index = 0): string => {
  const lines: { start: number; text: string }[] = [];
  text.split("\n").forEach((line) => lines.push({ start: (lines.at(-1)?.start ?? 0) + (lines.at(-1)?.text.length ?? -1) + 1, text: line }));
  return valueBelow(lines, index, VOCABULARY);
};

describe("valueBelow: the subject on the line under its label", () => {
  it("takes the next line with text, past blank lines", () => {
    assert.equal(below("SUBJECT:\n\n  Car park repairs  \n\nThe car park closes."), "Car park repairs");
    assert.equal(below("Subject:\nCar park repairs"), "Car park repairs");
  });

  it("leaves the subject empty when the next line is the body, a field, a quote, or nothing", () => {
    assert.equal(below("Subject:\n\nDear Ann,"), "");
    assert.equal(below("Subject:\n\nThe car park closes on Monday."), "");
    assert.equal(below("Subject:\nFrom: Ann"), "");
    assert.equal(below("Subject:\n> Car park"), "");
    assert.equal(below("Subject:\n\n"), "");
    assert.equal(below("Subject:"), "");
  });
});

describe("email-subject-length with the subject under its label", () => {
  const memo = (subject: string): string =>
    ["TO THE HEAD OF EACH BRANCH OFFICE", "", "SUBJECT:", "", subject, "", "The car park closes on Monday for repairs.", ""].join("\n");

  it("measures the subject under the label: a short one passes, a long one is reported", () => {
    assert.deepEqual(variantsOf(en, memo("Car park repairs")), []);
    const long = "Repairs to the staff car park behind the town hall and the closing of the side gate on Mill Lane";
    assert.deepEqual(
      subjectFindings(en, memo(long)).map((finding) => finding.values?.["count"]),
      [[...long].length],
    );
  });

  it("still reports an empty subject followed by the greeting or the body", () => {
    assert.deepEqual(variantsOf(en, "Subject:\n\nDear Ann,\n\nThe car park closes on Monday.\n\nBest regards,\nIchiro\n"), ["empty"]);
    assert.deepEqual(variantsOf(en, "Subject:\n\nThe car park closes on Monday.\n\nBest regards,\nIchiro\n"), ["empty"]);
  });

  it("reads a Japanese subject under 件名：, and still reports an empty one", () => {
    assert.deepEqual(
      variantsOf(ja, "件名：\n駐車場の工事\n\nいつもお世話になっております。月曜日から駐車場を閉鎖します。\n\nよろしくお願いいたします。\n"),
      [],
    );
    assert.deepEqual(variantsOf(ja, "件名：\n\nいつもお世話になっております。月曜日から駐車場を閉鎖します。\n\nよろしくお願いいたします。\n"), ["empty"]);
  });
});
