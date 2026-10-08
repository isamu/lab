import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { holdsLink, namesLocation } from "../packages/chaff/src/detectors/location-pointer.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// A first sentence that says where the content lives (a file, a link, a page) hands the reader on; it is not an echo of
// its heading. The location is code or a link target, outside the measured prose, so what is left looked like the heading
// alone. Self-written examples.

describe("namesLocation", () => {
  const locations: readonly string[] = [
    "The full reference is in `docs/api.md`.",
    "See `README.md`.",
    "Settings live in `./config`.",
    "It is in `src\\index`.",
    "The full reference is at https://example.com/api.",
    "詳しくは `docs/api.md` にあります。",
    "手順は https://example.jp/install をご覧ください。",
    "See ``docs/a`b.md``.",
  ];
  locations.forEach((sentence) => {
    it(`a location: ${sentence}`, () => assert.equal(namesLocation(sentence), true));
  });

  const none: readonly string[] = [
    "The full reference is in the manual.",
    "Call `wrap` to wrap text.",
    "Use `console.log` and `main.go`.",
    "Pass `width: 72` to change it.",
    "A path like `/` or `1/2` names no file.",
    "An unclosed `docs/api.md quote.",
    "A broken run ```docs/api.md`` of backticks.",
    "インストール手順について説明します。",
    "",
  ];
  none.forEach((sentence) => {
    it(`no location: ${JSON.stringify(sentence)}`, () => assert.equal(namesLocation(sentence), false));
  });
});

describe("holdsLink", () => {
  const source = "0123456789[a](b.md) [c](#c) xx";
  const sentence = { start: 10, end: 31 };
  const offPage = { start: 10, end: 19 };
  const inPage = { start: 20, end: 27 };
  it("a link off the page, inside or across the sentence", () => {
    assert.equal(holdsLink(source, sentence, [offPage]), true);
    assert.equal(holdsLink(source, { start: 12, end: 31 }, [offPage]), true);
    assert.equal(holdsLink(source, { start: 0, end: 11 }, [offPage]), true);
  });
  it("no link, one before or after it, or one to a place on the same page", () => {
    assert.equal(holdsLink(source, sentence, []), false);
    assert.equal(holdsLink(source, { start: 0, end: 10 }, [offPage]), false);
    assert.equal(holdsLink(source, { start: 19, end: 20 }, [offPage]), false);
    assert.equal(holdsLink(source, sentence, [inPage]), false);
  });
});

const echoes = (source: string, adapter: LanguageAdapter): number => {
  const doc = buildDocument("a.md", source, adapter);
  return runRules(doc, loadRules(adapter.id), {}, false, "technical/readme").findings.filter((finding) => finding.rule === "heading-echo").length;
};

describe("heading-echo and a sentence that points to where the content lives", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
    await en.prepare?.({ pos: true });
  });

  it("valid (en): a file, a page file, a web address", () => {
    assert.equal(echoes("## API reference\n\nThe full reference is in `docs/api.md`.\n", en), 0);
    assert.equal(echoes("## API reference\n\nThe full reference is in `README.md`.\n", en), 0);
    assert.equal(echoes("## API reference\n\nThe full reference is at https://example.com/api.\n", en), 0);
  });

  it("valid (ja): a file, a link, a web address", () => {
    assert.equal(echoes("## インストール手順\n\nインストール手順は `INSTALL.md` にあります。\n", ja), 0);
    assert.equal(echoes("## インストール手順\n\nインストール手順は [INSTALL.md](INSTALL.md) にあります。\n", ja), 0);
    assert.equal(echoes("## インストール手順\n\nインストール手順は https://example.jp/install にあります。\n", ja), 0);
  });

  it("invalid (en): a sentence that only restates the heading", () => {
    assert.equal(echoes("## Installation\n\nThis section covers installation.\n", en), 1);
    assert.equal(echoes("## API reference\n\nThe full reference is in the manual.\n", en), 1);
    assert.equal(echoes("## Installation\n\nThis section covers installation with `npm`.\n", en), 1);
    assert.equal(echoes("## Installation\n\nThis section covers [installation](#installation).\n", en), 1);
  });

  it("invalid (ja): a sentence that only restates the heading", () => {
    assert.equal(echoes("## インストール手順\n\nインストール手順について説明します。\n", ja), 1);
    assert.equal(echoes("## インストール手順\n\nインストール手順は `npm` で説明します。\n", ja), 1);
  });
});
