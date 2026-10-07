import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { prepare } from "../packages/lang-ja/src/pos.ts";
import { latePrerequisites, opensWithPrerequisite } from "../packages/chaff/src/prerequisite-order.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// 番号付きの手順の後に書いた前提（prerequisite-after-step）。例文は自作。

const RULE = "prerequisite-after-step";

const found = (source: string, adapter: LanguageAdapter, genre = "docs/manual"): number[] =>
  runRules(buildDocument("manual.md", source, adapter), loadRules(adapter.id), {}, false, genre)
    .findings.filter((finding) => finding.rule === RULE)
    .map((finding) => finding.line);

const doc = (...lines: string[]): string => [...lines, ""].join("\n");
const STEPS_EN = ["1. Open the console.", "2. Select the backup.", "3. Click Start Restore."];
const STEPS_JA = ["1. コンソールを開きます。", "2. バックアップを選びます。", "3. ［復元を開始］を押します。"];

before(async () => prepare());

describe("prerequisite-after-step", () => {
  it("ja: 節の手順の後の「作業を始める前に」を指し、手順の前なら指さない", () => {
    assert.deepEqual(found(doc("# 復元", "", ...STEPS_JA, "", "作業を始める前に、注文サービスを止めておきます。"), ja), [7]);
    assert.deepEqual(found(doc("# 復元", "", "作業を始める前に、注文サービスを止めておきます。", "", ...STEPS_JA), ja), []);
  });

  it("en: a 'Before you begin' after the steps of its section, not before them", () => {
    assert.deepEqual(found(doc("# Restore", "", ...STEPS_EN, "", "Before you begin, stop the order service."), en), [7]);
    assert.deepEqual(found(doc("# Restore", "", "Before you begin, stop the order service.", "", ...STEPS_EN), en), []);
  });

  it("does not report a prerequisite of a later section, a named step, a short list, or another genre", () => {
    const twoTasks = doc("# Tasks", "", "## Restore", "", ...STEPS_EN, "", "## Export", "", "Before you begin, stop the order service.", "", ...STEPS_EN);
    assert.deepEqual(found(twoTasks, en), []);
    assert.deepEqual(found(doc("# Restore", "", ...STEPS_EN, "", "Before step 3, stop the order service."), en), []);
    assert.deepEqual(found(doc("# Restore", "", ...STEPS_EN, "", "Before you begin step 3, stop the order service."), en), []);
    assert.deepEqual(found(doc("# Restore", "", "1. Open the console.", "2. Select the backup.", "", "Before you begin, stop the service."), en), []);
    assert.deepEqual(found(doc("# Restore", "", "- Open the console.", "- Select the backup.", "- Restore.", "", "Before you begin, stop it."), en), []);
    assert.deepEqual(found(doc("# Restore", "", ...STEPS_EN, "", "Before you begin, stop the order service."), en, "business/email"), []);
  });
});

describe("prerequisite-after-step: the shapes around a procedure", () => {
  it("reads a sentence after the steps in the intro, and a list item after the steps", () => {
    assert.deepEqual(found(doc(...STEPS_EN, "", "Before you begin, stop it.", "", "# Next", "", "Text."), en), [5]);
    assert.deepEqual(found(doc("# Restore", "", ...STEPS_EN, "", "- Before you begin, stop it."), en), [7]);
  });

  it("does not count a quoted or fenced procedure, a parent's steps for a subsection, or a run-on Japanese phrase", () => {
    assert.deepEqual(found(doc("# Restore", "", ...STEPS_EN.map((step) => `> ${step}`), "", "Before you begin, stop it."), en), []);
    assert.deepEqual(found(doc("# Restore", "", "```", ...STEPS_EN, "```", "", "Before you begin, stop it."), en), []);
    assert.deepEqual(found(doc("# Guide", "", ...STEPS_EN, "", "## Export", "", "Before you begin, stop it.", "", ...STEPS_EN), en), []);
    assert.deepEqual(found(doc("# 復元", "", ...STEPS_JA, "", "始める前に戻すには、バックアップを選び直します。"), ja), []);
  });
});

describe("latePrerequisites", () => {
  const openers = ["before you begin"];
  const sentence = (start: number, text: string): { start: number; end: number; text: string } => ({ start, end: start + text.length, text });
  it("needs a procedure ending before the sentence in the sentence's own section", () => {
    const late = sentence(50, "Before you begin, stop it.");
    assert.deepEqual(latePrerequisites([{ start: 0, end: 100 }], [{ start: 10, end: 40 }], [late], openers), [late]);
    assert.deepEqual(
      latePrerequisites(
        [
          { start: 0, end: 45 },
          { start: 45, end: 100 },
        ],
        [{ start: 10, end: 40 }],
        [late],
        openers,
      ),
      [],
    );
    assert.deepEqual(latePrerequisites([{ start: 0, end: 100 }], [{ start: 60, end: 90 }], [late], openers), []);
    assert.deepEqual(latePrerequisites([], [{ start: 10, end: 40 }], [late], openers), []);
    assert.deepEqual(latePrerequisites([{ start: 0, end: 100 }], [{ start: 10, end: 40 }], [late], []), []);
  });
  it("reads an opener standing as a phrase, in any case", () => {
    assert.ok(opensWithPrerequisite("  BEFORE YOU BEGIN, stop it.", openers));
    assert.ok(opensWithPrerequisite("Before you begin", openers));
    assert.ok(!opensWithPrerequisite("Before you beginning", openers));
    assert.ok(!opensWithPrerequisite("", openers));
  });
});
