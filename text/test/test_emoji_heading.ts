import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { firedRules } from "./rule-run.ts";
import { hasEmoji } from "../packages/chaff/src/detectors/emoji-heading.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// emoji-heading: headings with an emoji in them ("## 🚀 はじめに"), heading after heading. Every example is self-written.

const idsFor = (source: string, adapter: LanguageAdapter, genre = "blog/tech"): string[] => firedRules(adapter, source, genre);

const withHeadings = (headings: readonly string[]): string =>
  ["# 記事", "", ...headings.flatMap((heading) => [`## ${heading}`, "", "本文です。", ""])].join("\n");

before(async () => {
  await ja.prepare?.({ pos: true });
  await en.prepare?.({ pos: true });
});

describe("hasEmoji: a character drawn as an emoji", () => {
  const drawn = [
    "🚀 はじめに",
    "まとめ ✅",
    "📝 Notes",
    "⚠️ 注意",
    "✔️ Done",
    "👍🏽 Thanks",
    "👨‍💻 Developers",
    "🇯🇵 日本",
    "1️⃣ 準備",
    "#️⃣ Tag",
    "*️⃣ Note",
    "2\u20E3 次",
  ];
  drawn.forEach((text) => {
    it(`reads ${JSON.stringify(text)}`, () => assert.ok(hasEmoji(text)));
  });

  const plain = ["はじめに", "Product™", "© 2026", "→ 次へ", "✔ Done", "⚠ 注意", "1. 手順", "#1", "", "★ 重要", "■ 概要", "♥"];
  plain.forEach((text) => {
    it(`does not read ${JSON.stringify(text)}`, () => assert.ok(!hasEmoji(text)));
  });
});

describe("emoji-heading", () => {
  it("invalid: three headings carry an emoji", () => {
    assert.ok(idsFor(withHeadings(["🚀 はじめに", "🛠️ 手順", "✅ まとめ"]), ja).includes("emoji-heading"));
  });

  it("invalid: in English too", () => {
    const source = ["# Post", "", "## 🚀 Start", "", "Text.", "", "## 🛠️ Steps", "", "Text.", "", "## ✅ Summary", "", "Text."].join("\n");
    assert.ok(idsFor(source, en).includes("emoji-heading"));
  });

  it("valid: two headings stay under the normal level", () => {
    assert.ok(!idsFor(withHeadings(["🚀 はじめに", "手順", "✅ まとめ"]), ja).includes("emoji-heading"));
  });

  it("valid: emoji in the body, not the headings, are not counted", () => {
    assert.ok(!idsFor(withHeadings(["はじめに", "手順", "まとめ"]).replaceAll("本文です。", "本文です🚀"), ja).includes("emoji-heading"));
  });

  it("valid: text symbols in headings are not emoji", () => {
    assert.ok(!idsFor(withHeadings(["→ 準備", "★ 手順", "■ まとめ"]), ja).includes("emoji-heading"));
  });

  it("valid: a heading inside a code block is not a heading", () => {
    assert.ok(!idsFor(`# 記事\n\n\`\`\`md\n## 🚀 a\n## 🛠️ b\n## ✅ c\n\`\`\`\n`, ja).includes("emoji-heading"));
  });

  it("valid: quoted headings are someone else's words", () => {
    assert.ok(!idsFor("# 記事\n\n> ## 🚀 a\n>\n> ## 🛠️ b\n>\n> ## ✅ c\n", ja).includes("emoji-heading"));
  });

  it("valid: documentation is not checked", () => {
    assert.ok(!idsFor(withHeadings(["🚀 はじめに", "🛠️ 手順", "✅ まとめ"]), ja, "docs/manual").includes("emoji-heading"));
  });
});
