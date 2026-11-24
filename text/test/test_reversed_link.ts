import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";

// A Markdown link written "(text)[URL]". Self-written examples.

const reversed = (source: string, adapter = en, path = "a.md"): readonly string[] => namedRuleRun("reversed-link", `${source}\n`, adapter, path).findings;

describe("reversed-link", () => {
  it("reports round brackets before square ones that hold an address", () => {
    assert.deepEqual(reversed("See the (guide)[https://example.com/guide] first."), [
      '"(guide)[https://example.com/guide]" has its brackets the wrong way round and is not a link',
    ]);
    assert.deepEqual(reversed("詳しくは(案内)[https://example.com/guide]を見てください。", ja), [
      "「(案内)[https://example.com/guide]」は括弧が逆で、リンクになりません",
    ]);
  });

  it("reports paths, anchors, pages, mail addresses and images", () => {
    assert.deepEqual(reversed("Read (setup)[./setup.md], (install)[#install], (faq)[faq.html] and (mail us)[mailto:a@example.com].").length, 4);
    assert.deepEqual(reversed("A chart: !(sales)[/img/sales.png]"), ['"(sales)[/img/sales.png]" has its brackets the wrong way round and is not a link']);
  });

  it("does not report citations, numbers, notes or escaped brackets", () => {
    assert.deepEqual(reversed("As shown (Smith 2020)[3], and in (Figure 1)[2]."), []);
    assert.deepEqual(reversed("A claim (see below)[^1].\n\n[^1]: The note."), []);
    assert.deepEqual(reversed("Written \\(guide)[https://example.com] on purpose."), []);
    assert.deepEqual(reversed("An array (a)[i] and a value (x)[key]."), []);
  });

  it("does not report a correct link, code, a quotation or a plain-text file", () => {
    assert.deepEqual(reversed("See the [guide](https://example.com/guide)."), []);
    assert.deepEqual(reversed("Type `(guide)[https://example.com]` here."), []);
    assert.deepEqual(reversed("> See the (guide)[https://example.com/guide]."), []);
    assert.deepEqual(reversed("See the (guide)[https://example.com/guide].", en, "a.txt"), []);
  });
});
