import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { prepare } from "../packages/lang-ja/src/pos.ts";
import { namesAction, quoteBlockEnd, warningTextStart } from "../packages/chaff/src/warning-action.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// 危険だけを書き、読み手のすることを書いていない注意書き（warning-without-action）。例文は自作。

const RULE = "warning-without-action";

const found = (source: string, adapter: LanguageAdapter, genre = "docs/manual"): number[] =>
  runRules(buildDocument("manual.md", source, adapter), loadRules(adapter.id), {}, false, genre)
    .findings.filter((finding) => finding.rule === RULE)
    .map((finding) => finding.line);

const manual = (...lines: string[]): string => ["# Restore", "", ...lines, ""].join("\n");

before(async () => {
  await prepare();
  await en.prepare?.({ pos: true });
});

describe("warning-without-action", () => {
  it("ja: 危険だけの注意書きを指し、することのある注意書きは指さない", () => {
    assert.deepEqual(found(manual("注意：復元すると、今のデータベースは置き換わります。"), ja), [3]);
    assert.deepEqual(found(manual("注意：復元すると、今のデータベースは置き換わります。先に注文を書き出してください。"), ja), []);
    assert.deepEqual(found(manual("**警告**：作業中は電源を切らないこと。"), ja), []);
    assert.deepEqual(found(manual("> [!WARNING]", "> データが失われることがあります。"), ja), [3]);
    assert.deepEqual(found(manual("> [!WARNING]", "> 作業の前に、バックアップを取る必要があります。"), ja), []);
  });

  it("en: a warning that only names a risk, not one that gives an action", () => {
    assert.deepEqual(found(manual("Warning: the restore replaces the current database."), en), [3]);
    assert.deepEqual(found(manual("Warning: the restore replaces the current database. Export today's orders first."), en), []);
    assert.deepEqual(found(manual("**Caution:** Do not unplug the drive while it runs."), en), []);
    assert.deepEqual(found(manual("Danger: the blade keeps turning after the motor stops. Make sure it has stopped."), en), []);
    assert.deepEqual(found(manual("> [!CAUTION]", "> The file is overwritten without a prompt."), en), [3]);
  });

  it("reads a GitHub alert to the end of its block quote, past blank quoted lines", () => {
    assert.deepEqual(found(manual("> [!WARNING]", "> The file is overwritten.", ">", "> Export it first."), en), []);
    assert.deepEqual(found(manual("> [!WARNING]", ">", "> The file is overwritten."), en), [3]);
    assert.deepEqual(found(manual("> [!WARNING]", "> The file is overwritten.", "", "Export it first."), en), [3]);
    assert.deepEqual(found(manual("> [!WARNING]", "> ファイルは上書きされます。", ">", "> 先に書き出してください。"), ja), []);
  });

  it("reads an action phrase across a line break, and an ending before a closing quote", () => {
    assert.deepEqual(found(manual("Warning: the drive keeps running. Do", "not unplug it."), en), []);
    assert.deepEqual(found(manual("注意：作業の前に「先に書き出してください」。"), ja), []);
  });

  it("does not read a label in a heading, inside a sentence, or as the start of a phrase", () => {
    assert.deepEqual(found(["# Warning: the restore replaces the database", "", "Read on.", ""].join("\n"), en), []);
    assert.deepEqual(found(manual("Danger zone settings are listed below."), en), []);
    assert.deepEqual(found(manual("The installer prints Warning: disk full when it stops."), en), []);
  });

  it("does not read notes, words that only start with the label, or other genres", () => {
    assert.deepEqual(found(manual("Note: the restore replaces the current database."), en), []);
    assert.deepEqual(found(manual("Warnings are written to the log."), en), []);
    assert.deepEqual(found(manual("注意深く読むと、置き換わる範囲が分かります。"), ja), []);
    assert.deepEqual(found(manual("Warning: the restore replaces the current database."), en, "business/email"), []);
  });
});

describe("warningTextStart", () => {
  const labels = ["warning", "caution", "注意"];
  it("finds the text after a label standing alone", () => {
    assert.equal(warningTextStart("Warning: it breaks.", labels), "Warning: ".length);
    assert.equal(warningTextStart("**Caution:** it breaks.", labels), "**Caution:** ".length);
    assert.equal(warningTextStart("> [!WARNING]\n> it breaks.", labels), "> [!WARNING]".length);
    assert.equal(warningTextStart("注意：壊れます。", labels), "注意：".length);
  });
  it("finds none without a label, or with a label that is part of a word", () => {
    assert.equal(warningTextStart("", labels), undefined);
    assert.equal(warningTextStart("It breaks.", labels), undefined);
    assert.equal(warningTextStart("Warnings are logged.", labels), undefined);
    assert.equal(warningTextStart("注意深く読む。", labels), undefined);
    assert.equal(warningTextStart("Warning: x", []), undefined);
  });
});

describe("quoteBlockEnd", () => {
  it("ends a block quote at its last quoted line, and gives none for an unquoted line", () => {
    const source = "Intro.\n> [!WARNING]\n> A.\n>\n> B.\nAfter.";
    assert.equal(quoteBlockEnd(source, source.indexOf("[!")), source.indexOf("\nAfter."));
    assert.equal(quoteBlockEnd(source, 0), undefined);
    assert.equal(quoteBlockEnd("> A.", 2), "> A.".length);
  });
});

describe("namesAction", () => {
  it("matches Latin words whole and other words at the sentence's end", () => {
    assert.ok(namesAction("Do not unplug it.", ["do not"]));
    assert.ok(!namesAction("Undo nothing.", ["do not"]));
    assert.ok(!namesAction("It mustard.", ["must"]));
    assert.ok(namesAction("電源を切らないこと。", ["こと"]));
    assert.ok(!namesAction("失われることがあります。", ["こと"]));
    assert.ok(!namesAction("", ["ください"]));
  });
});
