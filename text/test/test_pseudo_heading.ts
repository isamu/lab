import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { firedRules } from "./rule-run.ts";
import { pseudoHeadingText } from "../packages/chaff/src/detectors/pseudo-heading.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// pseudo-heading: a bold line on its own standing where a heading would, in a document that uses headings. Every example is self-written.

const RULE = "pseudo-heading";

const count = (source: string, adapter: LanguageAdapter, genre = "blog/tech"): number =>
  firedRules(adapter, source, genre).filter((rule) => rule === RULE).length;

before(async () => {
  await ja.prepare?.({ pos: true });
  await en.prepare?.({ pos: true });
});

describe("pseudoHeadingText: a paragraph that is one bold line naming a section", () => {
  const read: readonly (readonly [string, string])[] = [
    ["**Next steps**", "Next steps"],
    ["__Next steps__", "Next steps"],
    ["**次の手順**", "次の手順"],
    ["**A. Third party liability**", "A. Third party liability"],
    ["**macOS / Linux の場合**", "macOS / Linux の場合"],
    ["  **Budget**  ", "Budget"],
  ];
  read.forEach(([paragraph, text]) => {
    it(`reads ${JSON.stringify(paragraph)}`, () => assert.equal(pseudoHeadingText(paragraph), text));
  });

  const notRead = [
    "**Note:**",
    "**参考：**",
    "**Pros**:",
    "**Read this first.**",
    "**本当に消しますか？**",
    "**Thank you!**",
    "**Rating: 4 out of 5**",
    "**評価：5 点中 4 点**",
    "**Usage grew**: every week.",
    "**Next steps** come later.",
    "**a** and **b**",
    "**[Download the app](https://example.com)**",
    "**`--force`**",
    "** spaced **",
    "**Keep every receipt for travel, meals and lodging, and send them to the finance team within thirty days of return**",
    "**Budget**\nThe plan costs less.",
    "plain text",
    "",
  ];
  notRead.forEach((paragraph) => {
    it(`does not read ${JSON.stringify(paragraph)}`, () => assert.equal(pseudoHeadingText(paragraph), undefined));
  });
});

describe("pseudo-heading: reports a bold line in place of a heading", () => {
  it("reports a Japanese bold line under a section heading", () => {
    const source = "# 引っ越し\n\n## 一か月前\n\n転出届を出します。\n\n**一週間前**\n\n荷物を箱に詰めます。\n";
    assert.equal(count(source, ja), 1);
  });

  it("reports an English bold line under a section heading", () => {
    const source = "# Moving house\n\n## A month before\n\nTell the council.\n\n**A week before**\n\nPack your boxes.\n";
    assert.equal(count(source, en), 1);
  });

  it("reports each bold line, a list or a code block under it counting as its body", () => {
    const source =
      "# Setup\n\n## Install\n\nRun the installer.\n\n**On macOS**\n\n```sh\nbrew install tool\n```\n\n**On Windows**\n\n- Open the installer.\n- Click next.\n";
    assert.equal(count(source, en), 2);
  });

  it("reports a document without a title whose first heading opens a section", () => {
    const source = "## Overview\n\nThe plan.\n\n**Costs**\n\nThe plan costs less.\n";
    assert.equal(count(source, en), 1);
  });
});

describe("pseudo-heading: does not report", () => {
  it("a document with no headings, where bold lines are the writer's only way to divide it", () => {
    const source = "Hello all,\n\n**Office closures**\n\nThe office is closed on Friday.\n\n**Before you go**\n\nSend your reports.\n";
    assert.equal(count(source, en, "business/email"), 0);
  });

  it("a document whose only heading is its title", () => {
    const source = "# Launch\n\nThe app is out today.\n\n**About us**\n\nWe build garden tools.\n";
    assert.equal(count(source, en), 0);
  });

  it("a bold line under the title, before the first section heading", () => {
    const source = "# 新製品のお知らせ\n\n**報道関係者各位**\n\n本日、新製品を発売します。\n\n## 概要\n\n軽くなりました。\n";
    assert.equal(count(source, ja), 0);
  });

  it("a bold line right over a heading, or at the end of the document", () => {
    const source = "# Policy\n\n## Scope\n\nAll staff.\n\n**Effective March 2026**\n\n## Rules\n\nKeep receipts.\n\n**Finance team**\n";
    assert.equal(count(source, en), 0);
  });

  it("a bold label with text after it on the same line (bold-label-list's area)", () => {
    const source = "# Report\n\n## Results\n\n**Usage grew**: every week, by a little.\n\nMore text.\n";
    assert.equal(count(source, en), 0);
  });

  it("a bold line in a list, a quotation or a table", () => {
    const source = "# 手引き\n\n## 準備\n\n- **道具**\n- 手袋\n\n> **他の人の言葉**\n\n| 項目 |\n| --- |\n| **太字** |\n\n本文です。\n";
    assert.equal(count(source, ja), 0);
  });

  it("a bold line closed by punctuation or a colon", () => {
    const source = "# Guide\n\n## Steps\n\nDo this.\n\n**Pros:**\n\n- Fast\n\n**Read this first.**\n\nThen go on.\n";
    assert.equal(count(source, en), 0);
  });
});
