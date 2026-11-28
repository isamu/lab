import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { reportedAcronyms } from "./rule-run.ts";
import { parentItemAcronyms } from "../packages/chaff/src/detectors/acronym-parent-item.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";

// undefined-acronym: a nested list whose parent item writes out the name the child items shorten, a quoted name joined to
// its acronym by "or" without a comma, and everyday short forms (NB, MS Excel). Self-written text only.

const PENDING = "The SRE, XYZ and QRS are pending.";

describe("undefined-acronym: the parent list item writes out the name", () => {
  it("a child item's acronym spelled by consecutive words of its parent item is explained", () => {
    const source = `# T\n\n- **No product owner:** nobody owns the\n  product.\n  - Busy PO: the PO cannot meet.\n\n${PENDING}\n`;
    assert.deepEqual(reportedAcronyms(en, source), ["SRE", "XYZ", "QRS"]);
  });

  it("an acronym the parent does not spell, or spells only with short words, is still reported", () => {
    assert.deepEqual(reportedAcronyms(en, `# T\n\n- **No team lead:** nobody.\n  - Busy PO: the PO cannot meet.\n\n${PENDING}\n`), ["PO", "SRE", "XYZ", "QRS"]);
    assert.deepEqual(reportedAcronyms(en, `# T\n\n- Point of order.\n  - The PO waits.\n\n${PENDING}\n`), ["PO", "SRE", "XYZ", "QRS"]);
  });

  it("a sibling item or a child item is no parent", () => {
    assert.deepEqual(reportedAcronyms(en, `# T\n\n- No product owner.\n- Busy PO.\n\n${PENDING}\n`), ["PO", "SRE", "XYZ", "QRS"]);
    assert.deepEqual(reportedAcronyms(en, `# T\n\n- Busy PO.\n  - No product owner.\n\n${PENDING}\n`), ["PO", "SRE", "XYZ", "QRS"]);
  });

  it("parentItemAcronyms reads only list items with children, outside code fences", () => {
    assert.deepEqual([...parentItemAcronyms("- subject matter experts\n  - Ask the SMEs.\n")], ["SME"]);
    assert.deepEqual([...parentItemAcronyms("```\n- subject matter experts\n  - Ask the SMEs.\n```\n")], []);
    assert.deepEqual([...parentItemAcronyms("")], []);
    assert.deepEqual([...parentItemAcronyms("- subject matter experts\n")], []);
  });

  it("the words of a link's address are not the parent's own words; its link text is", () => {
    assert.deepEqual([...parentItemAcronyms("- Charter [#7](https://example.org/cross-project-council/issues/7)\n  - The CPC agreed.\n")], []);
    assert.deepEqual([...parentItemAcronyms("- Charter https://example.org/cross-project-council/7\n  - The CPC agreed.\n")], []);
    assert.deepEqual([...parentItemAcronyms("- [Cross Project Council](https://example.org/7)\n  - The CPC agreed.\n")], ["CPC"]);
  });
});

describe("undefined-acronym: a quoted name, or the acronym", () => {
  it("the quote closes the name, so no comma is needed", () => {
    assert.deepEqual(reportedAcronyms(en, `# T\n\nAsk the SME.\n\nThis helps “subject matter experts” or SME most. ${PENDING}\n`), ["SRE", "XYZ", "QRS"]);
  });

  it("a quoted name whose initials differ, or an unquoted name without a comma, is no expansion", () => {
    assert.deepEqual(reportedAcronyms(en, `# T\n\nAsk the SME.\n\nThis helps “domain experts” or SME most. ${PENDING}\n`), ["SME", "SRE", "XYZ", "QRS"]);
    assert.deepEqual(reportedAcronyms(en, `# T\n\nAsk the SME.\n\nThis helps subject matter experts or SME most. ${PENDING}\n`), ["SME", "SRE", "XYZ", "QRS"]);
  });
});

describe("undefined-acronym: everyday short forms", () => {
  it("NB and MS before an office product are not reported; MS alone still is", () => {
    assert.deepEqual(reportedAcronyms(en, `# T\n\nNB: send it as an MS Excel or MS Word file. ${PENDING}\n`), ["SRE", "XYZ", "QRS"]);
    assert.deepEqual(reportedAcronyms(en, `# T\n\nSend the MS to the editor. ${PENDING}\n`), ["MS", "SRE", "XYZ", "QRS"]);
  });
});
