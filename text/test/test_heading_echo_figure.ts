import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { statesFigure } from "../packages/chaff/src/detectors/heading-echo.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// A first sentence that states a figure the heading does not have (an amount, a number, a date) gives what the heading
// promised, however many of its words it repeats. Self-written examples.

describe("statesFigure", () => {
  it("a figure the heading does not have", () => {
    assert.ok(statesFigure("Quoted amount", "The quoted amount is $1,320,000, tax included."));
    assert.ok(statesFigure("Invoice", "Invoice number: INV-2026-0318"));
    assert.ok(statesFigure("見積金額", "見積金額は１３２万円です。"));
    assert.ok(statesFigure("Step 3", "Step 3 takes 10 minutes."));
  });

  it("no figure, or only the heading's own", () => {
    assert.ok(!statesFigure("Installation", "This section covers installation."));
    assert.ok(!statesFigure("Step 3", "This is step 3."));
    assert.ok(!statesFigure("", ""));
    assert.ok(!statesFigure("1320000 users", "1,320,000 users."));
    assert.ok(!statesFigure("Installation", "Installation[^1]."));
    assert.ok(!statesFigure("インストール", "インストールです。※1"));
  });
});

const echoes = (source: string, adapter: LanguageAdapter): number => {
  const doc = buildDocument("a.md", source, adapter);
  return runRules(doc, loadRules(adapter.id), {}, false, "technical/readme").findings.filter((finding) => finding.rule === "heading-echo").length;
};

describe("heading-echo and a first sentence that states a figure", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
    await en.prepare?.({ pos: true });
  });

  it("valid: the amount or the number the heading promised", () => {
    assert.equal(echoes("## Quoted amount\n\nThe quoted amount is $1,320,000, tax included.\n", en), 0);
    assert.equal(echoes("# Invoice\n\nInvoice number: INV-2026-0318\n", en), 0);
    assert.equal(echoes("## 見積金額\n\n見積金額は1,320,000円です。\n", ja), 0);
  });

  it("invalid: the heading restated without a figure, or with only the heading's own", () => {
    assert.equal(echoes("## Quoted amount\n\nThis section gives the quoted amount.\n", en), 1);
    assert.equal(echoes("## Changes in version 2\n\nThis section covers the changes in version 2.\n", en), 1);
  });
});
