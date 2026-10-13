import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { announcerWords, makesClaim } from "../packages/chaff/src/detectors/heading-claim.ts";
import { holdsLink, namesLocation } from "../packages/chaff/src/detectors/location-pointer.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter, Token } from "../packages/chaff/src/plugin.ts";

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

// A first sentence that says something about the heading's subject with a predicate of its own (All charges include sales
// tax.) is not an echo; one whose only predicate announces or points (covers, below, 説明, 以下) is. Self-written examples.
describe("heading-echo and a sentence that states something about the heading", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
    await en.prepare?.({ pos: true });
  });

  it("valid (en): a verb, a copula's complement or a denial of its own", () => {
    assert.equal(echoes("## Charges\n\nAll charges include sales tax.\n", en), 0);
    assert.equal(echoes("## Delivery charges\n\nDelivery charges are non-refundable.\n", en), 0);
    assert.equal(echoes("## Delivery charges\n\nThe delivery charges change often.\n", en), 0);
    assert.equal(echoes("## Open issues\n\nThere are no open issues.\n", en), 0);
    assert.equal(echoes("## Italic text\n\nDo not use italic text.\n", en), 0);
  });

  it("invalid (en): the only predicate announces, points or is the heading's own", () => {
    assert.equal(echoes("## Delivery charges\n\nDelivery charges are described below.\n", en), 1);
    assert.equal(echoes("## Delivery charges\n\nThe following describes the delivery charges.\n", en), 1);
    assert.equal(echoes("## Delivery charges\n\nHere are the delivery charges.\n", en), 1);
    assert.equal(echoes("## Delivery charges\n\nSee the delivery charges page.\n", en), 1);
    assert.equal(echoes("## Delivery charges\n\nThis section tells you about delivery charges.\n", en), 1);
    assert.equal(echoes("## restoreCache\n\nThe restoreCache step restores the cache.\n", en), 1);
    assert.equal(echoes("## Server object\n\nAn object representing a server.\n", en), 1);
    assert.equal(echoes("## The draft is not the plan\n\nWriting the draft is not the plan.\n", en), 1);
  });

  it("valid (ja): a verb or a complement of its own", () => {
    assert.equal(echoes("## 消費税の扱い\n\n消費税の扱いは変わりません。\n", ja), 0);
    assert.equal(echoes("## 消費税の扱い\n\n消費税の扱いは税込です。\n", ja), 0);
    assert.equal(echoes("## 会員登録の手順\n\n会員登録の手順を変更しました。\n", ja), 0);
  });

  it("invalid (ja): the only predicate announces, points or is the heading's own", () => {
    assert.equal(echoes("## 消費税の扱い\n\n消費税の扱いについて説明します。\n", ja), 1);
    assert.equal(echoes("## 消費税の扱い\n\n消費税の扱いは以下です。\n", ja), 1);
    assert.equal(echoes("## 消費税の扱い\n\n消費税の扱いを見ていきましょう。\n", ja), 1);
    assert.equal(echoes("## 会員登録の手順\n\n会員登録の手順です。\n", ja), 1);
  });
});

describe("makesClaim", () => {
  const token = (surface: string, pos: string, lemma = surface, features?: Record<string, string>): Token => ({
    span: { start: 0, end: 0 },
    surface,
    pos,
    lemma,
    ...(features === undefined ? {} : { features }),
  });
  const words = announcerWords([{ pattern: "be", group: "copula", position: "after" }, { pattern: "not", group: "negation" }, { pattern: "cover" }]);
  const heading = [token("Charges", "NOUN", "charge")];

  it("a verb of its own, a complement, a denial", () => {
    assert.equal(makesClaim(heading, [token("charges", "NOUN", "charge"), token("include", "VERB"), token("tax", "NOUN")], words), true);
    assert.equal(makesClaim(heading, [token("charges", "NOUN", "charge"), token("are", "VERB", "be"), token("final", "ADJ")], words), true);
    assert.equal(makesClaim(heading, [token("are", "VERB", "be"), token("not", "PART"), token("charges", "NOUN", "charge")], words), true);
  });

  it("an announcing verb, the heading's own words, a copula alone, a non-finite verb", () => {
    assert.equal(makesClaim(heading, [token("covers", "VERB", "cover"), token("charges", "NOUN", "charge")], words), false);
    assert.equal(makesClaim(heading, [token("are", "VERB", "be"), token("the", "DET"), token("charges", "NOUN", "charge")], words), false);
    assert.equal(makesClaim(heading, [token("charges", "NOUN", "charge"), token("are", "VERB", "be")], words), false);
    assert.equal(makesClaim(heading, [token("listing", "VERB", "list", { VerbForm: "Ger" }), token("charges", "NOUN", "charge")], words), false);
    assert.equal(makesClaim(heading, [token("charge", "VERB")], words), false);
  });

  it("the words of a code name in the heading are the heading's own", () => {
    const codeName = [token("restoreFixtures", "PROPN", "restorefixtures")];
    assert.equal(makesClaim(codeName, [token("restores", "VERB", "restore"), token("fixtures", "NOUN", "fixture")], words), false);
    assert.equal(makesClaim([token("cache_key", "X")], [token("keys", "VERB", "key")], words), false);
    assert.equal(makesClaim(codeName, [token("runs", "VERB", "run")], words), true);
  });

  it("a denial the heading already makes is not the sentence's own", () => {
    const denied = [token("not", "PART"), token("final", "ADJ")];
    assert.equal(makesClaim(denied, [token("is", "VERB", "be"), token("not", "PART"), token("final", "ADJ")], words), false);
  });

  it("a long run of words between a copula and its complement", () => {
    const bridge = Array.from({ length: 20000 }, () => token("very", "ADV"));
    assert.equal(makesClaim(heading, [token("are", "VERB", "be"), ...bridge, token("final", "ADJ")], words), true);
    assert.equal(makesClaim(heading, [token("are", "VERB", "be"), ...bridge], words), false);
  });

  it("no tokens, no lexicon", () => {
    assert.equal(makesClaim(heading, [], words), false);
    assert.equal(makesClaim([], [], announcerWords([])), false);
    assert.equal(makesClaim(heading, [token("include", "VERB")], announcerWords([])), true);
  });
});
