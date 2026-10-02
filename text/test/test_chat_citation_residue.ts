import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { firedRules } from "./rule-run.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { markersIn, showsInProse } from "../packages/chaff/src/detectors/chat-citation.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter, Lexicon } from "../packages/chaff/src/plugin.ts";

// chat-citation-residue: the marks a pasted chat answer leaves (utm_source=chatgpt.com, oaicite). Every example is self-written.

const idsFor = (source: string, adapter: LanguageAdapter, genre = "blog/tech"): string[] => firedRules(adapter, source, genre);

const entries = (...patterns: string[]): Lexicon => patterns.map((pattern) => ({ pattern }));

before(async () => {
  await ja.prepare?.({ pos: true });
  await en.prepare?.({ pos: true });
});

describe("markersIn: every place a marker is written", () => {
  it("finds each occurrence, in order, case and all", () => {
    const found = markersIn("a utm_source=chatgpt.com b oaicite c utm_source=chatgpt.com", entries("oaicite", "utm_source=chatgpt.com"));
    assert.deepEqual(
      found.map((marker) => [marker.matched, marker.span.start]),
      [
        ["utm_source=chatgpt.com", 2],
        ["oaicite", 27],
        ["utm_source=chatgpt.com", 37],
      ],
    );
  });

  it("matches as written: a different case is a different string", () => {
    assert.deepEqual(markersIn("UTM_SOURCE=CHATGPT.COM", entries("utm_source=chatgpt.com")), []);
  });

  it("takes a pattern's regex characters literally", () => {
    assert.equal(markersIn("utm_sourceXchatgptYcom", entries("utm_source.chatgpt.com")).length, 0);
    assert.equal(markersIn("contentReference[oaicite:0]", entries("contentReference[")).length, 1);
  });

  it("ignores an empty pattern and an empty text", () => {
    assert.deepEqual(markersIn("text", entries("")), []);
    assert.deepEqual(markersIn("", entries("oaicite")), []);
  });
});

describe("showsInProse: a span with prose left in it", () => {
  it("reads a span with text", () => assert.ok(showsInProse("ab cd", { start: 1, end: 4 })));
  it("does not read a blanked span", () => assert.ok(!showsInProse("a    d", { start: 1, end: 5 })));
  it("does not read an empty span", () => assert.ok(!showsInProse("abc", { start: 1, end: 1 })));
});

describe("chat-citation-residue", () => {
  it("invalid: a link that came from a chat answer (ja)", () => {
    assert.ok(idsFor("# 記事\n\n手順は[公式の説明](https://example.com/setup?utm_source=chatgpt.com)のとおりです。\n", ja).includes("chat-citation-residue"));
  });

  it("invalid: a bare URL with the chat parameter (en)", () => {
    assert.ok(idsFor("# Post\n\nSee https://example.com/setup?utm_source=chatgpt.com for the steps.\n", en).includes("chat-citation-residue"));
  });

  it("invalid: a citation mark left in the text", () => {
    assert.ok(idsFor("# Post\n\nThe plan costs $5 a month. :contentReference[oaicite:0]{index=0}\n", en).includes("chat-citation-residue"));
  });

  it("invalid: a reference definition with the chat parameter", () => {
    assert.ok(idsFor("# Post\n\nSee [the guide][g].\n\n[g]: https://example.com/?utm_source=chatgpt.com\n", en).includes("chat-citation-residue"));
  });

  it("invalid: every marker in each language's word list fires on its own", () => {
    const languages: readonly (readonly [LanguageAdapter, string])[] = [
      [ja, "本文です。"],
      [en, "Body text."],
    ];
    languages.forEach(([adapter, body]) => {
      (adapter.lexicons["chat-citation-marker"] ?? []).forEach((entry) => {
        assert.ok(idsFor(`# Doc\n\n${body} ${entry.pattern}\n`, adapter).includes("chat-citation-residue"), `${adapter.id}: ${entry.pattern}`);
      });
    });
  });

  it("the word lists hold the same markers in both languages", () => {
    const patternsOf = (adapter: LanguageAdapter): string[] =>
      (adapter.lexicons["chat-citation-marker"] ?? []).map((entry) => entry.pattern).toSorted((left, right) => left.localeCompare(right));
    assert.deepEqual(patternsOf(ja), patternsOf(en));
    assert.ok(patternsOf(ja).includes("oaicite"));
  });

  it("invalid: an image whose address came from a chat answer", () => {
    assert.ok(idsFor("# Post\n\n![diagram](https://example.com/a.png?utm_source=chatgpt.com)\n", en).includes("chat-citation-residue"));
  });

  it("invalid: a citation mark that Markdown splits into a text and a reference", () => {
    const source = "# Post\n\nThe plan costs $5. :contentReference[oaicite:0]{index=0}\n\n[oaicite:0]: https://example.com/source\n";
    const matched = runRules(buildDocument("t.md", source, en), loadRules("en"), {}, true, "blog/tech")
      .findings.filter((finding) => finding.rule === "chat-citation-residue")
      .map((finding) => finding.values["matched"]);
    assert.ok(matched.includes("contentReference["), JSON.stringify(matched));
  });

  it("valid: a marker in a quote is someone else's words", () => {
    assert.ok(!idsFor("# Post\n\n> See https://example.com/?utm_source=chatgpt.com\n", en).includes("chat-citation-residue"));
  });

  it("valid: another utm_source value", () => {
    assert.ok(!idsFor("# 記事\n\n[記事](https://example.com/?utm_source=qiita)を読みました。\n", ja).includes("chat-citation-residue"));
  });

  it("valid: the parameter explained in inline code", () => {
    assert.ok(!idsFor("# 記事\n\nリンクの末尾の `?utm_source=chatgpt.com` は消してください。\n", ja).includes("chat-citation-residue"));
  });

  it("valid: the parameter in a code block", () => {
    assert.ok(!idsFor("# Post\n\n```\ncurl https://example.com/?utm_source=chatgpt.com\n```\n", en).includes("chat-citation-residue"));
  });
});
