import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { firedRules } from "./rule-run.ts";
import { isQuotedMention } from "../packages/chaff/src/detectors/bold-quoted.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { isFieldLabel } from "../packages/chaff/src/detectors/bold-field-label.ts";

// bold-density does not count a bold run that only quotes words, nor a field label opening a line. Every example is self-written.

const RULE = "bold-density";

/** The span of the whole source, as a bold run. */
const quoted = (bold: string): boolean => isQuotedMention(bold, { start: 0, end: bold.length });

before(async () => {
  await ja.prepare?.({ pos: true });
});

describe("isQuotedMention: a bold run that is only a quotation", () => {
  it("is a mention when the bold holds a quoted phrase or a code span", () => {
    ['**"であったが"**', "**「です」**", "**『である』**", "**“quoted”**", "**‘single’**", "**'single'**", "**`strict`**", '__"under"__'].forEach((bold) =>
      assert.equal(quoted(bold), true, bold),
    );
  });

  it("is not a mention when the bold emphasises or quotes only part of itself", () => {
    ["**大事**", '**"です" と "である"**', '**"開いた**', '**です"**', '**""**', "****", "**``**", 'plain "text"', ""].forEach((bold) =>
      assert.equal(quoted(bold), false, bold),
    );
  });

  it("reads the span inside a longer source", () => {
    const source = '前の文 **"です"** 後の文';
    const start = source.indexOf("**");
    assert.equal(isQuotedMention(source, { start, end: source.indexOf("後") - 1 }), true);
    assert.equal(isQuotedMention(source, { start: 0, end: 3 }), false);
  });
});

/** A section of about 500 characters with `count` bold runs made by `bold`. */
const section = (count: number, bold: (index: number) => string): string =>
  [
    "# 説明",
    "",
    "## 設定",
    "",
    ...Array.from({ length: count }, (_unused, index) => `この例では ${bold(index)} という語を見て、文の終わりの形を判定します。`),
    "設定を変えると、判定の仕方も変わります。".repeat(4),
    "",
  ].join("\n");

describe("bold-density: quoted words in bold are mentions", () => {
  it("does not report a section whose bold runs quote the words an example talks about", () => {
    assert.equal(
      firedRules(
        ja,
        section(12, (index) => `**"であった${index}"**`),
        "technical/readme",
      ).includes(RULE),
      false,
    );
  });

  it("still reports the same section when the bold runs emphasise", () => {
    assert.equal(
      firedRules(
        ja,
        section(12, (index) => `**大事な語${index}**`),
        "technical/readme",
      ).includes(RULE),
      true,
    );
  });
});

describe("bold-density: a field label opening a line is a name, not emphasis", () => {
  it("isFieldLabel: a short bold label with a colon at the start of a line", () => {
    const at = (source: string): boolean => isFieldLabel(source, { start: source.indexOf("**"), end: source.indexOf("**", source.indexOf("**") + 2) + 2 });
    assert.equal(at("**Date:** Tuesday"), true);
    assert.equal(at("x\n**Also present**: Carla"), true);
    assert.equal(at("**日時：** 11月10日"), true);
    assert.equal(at("- **Date:** Tuesday"), false);
    assert.equal(at("Send it by **Friday**: no later."), false);
    assert.equal(at("**Carried unanimously.**"), false);
    assert.equal(at("**Use headphones with a microphone and test them first:** it helps"), false);
  });

  it("does not report a minutes header of field labels, and still reports a list of bold labels", () => {
    const header = [
      "# Minutes",
      "",
      "**Riverside Food Bank**",
      "**Date:** Tuesday, November 10, 2026",
      "**Time:** 6:30 p.m.",
      "**Location:** Community Center, Room B",
      "",
      "**Present:** Margaret Ellis (Chair), David Kim (Treasurer), Susan Patel (Secretary), Robert Hughes",
      "**Absent:** Linda Fowler (excused)",
      "**Also present:** Carla Nguyen, Executive Director",
      "",
      "## 1. Call to Order",
      "",
      "The Chair called the meeting to order at 6:32 p.m. A quorum was present.",
      "",
    ].join("\n");
    assert.equal(firedRules(en, header, "business/meeting-notes").includes(RULE), false);
    const list = header
      .replaceAll("**Date:**", "- **Date:**")
      .replaceAll("**Time:**", "- **Time:**")
      .replaceAll("**Location:**", "- **Location:**")
      .replaceAll("**Present:**", "- **Present:**")
      .replaceAll("**Absent:**", "- **Absent:**")
      .replaceAll("**Also present:**", "- **Also present:**");
    assert.equal(firedRules(en, list, "business/meeting-notes").includes(RULE), true);
  });
});
