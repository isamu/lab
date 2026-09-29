import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { reportedAcronyms } from "./rule-run.ts";
import { citationKeySpans } from "../packages/chaff/src/detectors/citation-key.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";

// 仕様書の参考文献の見出し語（[HPACK]）は略語として数えない。例文は自作。W3C の Secure Contexts と IETF の
// Internet-Draft で、[MIX]、[SECURING-WEB]、[WEB-ORIGIN]、[SF] が説明の無い略語として報告されていた。

const keysIn = (text: string): string[] => citationKeySpans(text).map((span) => text.slice(span.start, span.end));

const reported = (source: string): string[] => reportedAcronyms(en, source, "technical/spec");

/** 説明の無い略語 SRE を毎回並べ、rule が動いていることを確かめる。 */
const withSre = (sentence: string): string => `# Notes\n\n${sentence} The SRE joins.\n`;

describe("citationKeySpans", () => {
  it("finds a bracketed reference key", () => {
    assert.deepEqual(keysIn("header compression such as [HPACK]."), ["[HPACK]"]);
    assert.deepEqual(keysIn("see [RFC9110] and [SECURING-WEB]"), ["[RFC9110]", "[SECURING-WEB]"]);
    assert.deepEqual(keysIn("as in [IndexedDB], [HTML5] and [W3C.REC-xml]"), ["[IndexedDB]", "[HTML5]", "[W3C.REC-xml]"]);
    assert.deepEqual(keysIn("[UNIX]     The Open Group"), ["[UNIX]"]);
  });

  it("leaves a Markdown link, a reference definition and an image alone", () => {
    assert.deepEqual(keysIn("ask the [DRI](/handbook/dri) first"), []);
    assert.deepEqual(keysIn("ask the [DRI][dri] first"), []);
    assert.deepEqual(keysIn("[DRI]: /handbook/dri"), []);
    assert.deepEqual(keysIn("![LOGO] here"), []);
  });

  it("leaves brackets that hold more than one word, a number or one letter", () => {
    assert.deepEqual(keysIn("he met [the FBI] agents"), []);
    assert.deepEqual(keysIn("as shown in [12] and [3-5]"), []);
    assert.deepEqual(keysIn("option [A] or [B-]"), []);
    assert.deepEqual(keysIn("a[FOO] b"), []);
  });

  it("returns nothing for empty or bracket-free text", () => {
    assert.deepEqual(keysIn(""), []);
    assert.deepEqual(keysIn("[]"), []);
    assert.deepEqual(keysIn("no brackets at all, MIX or HPACK"), []);
    assert.deepEqual(keysIn("[unclosed HPACK"), []);
  });
});

describe("undefined-acronym and reference keys", () => {
  it("does not count a reference key", () => {
    assert.deepEqual(reported(withSre("This follows the concept in [MIX] and [SECURING-WEB].")), ["SRE"]);
    assert.deepEqual(reported(withSre("It builds on [WEB-ORIGIN] and [SF].")), ["SRE"]);
  });

  it("still counts the same acronym outside the brackets", () => {
    assert.deepEqual(reported(withSre("The MIX model applies, as in [MIX].")), ["MIX", "SRE"]);
  });

  it("still counts an acronym written as a Markdown link or in a bracketed phrase", () => {
    assert.deepEqual(reported(withSre("Ask the [DRI](https://example.com/dri) first.")), ["DRI", "SRE"]);
    assert.deepEqual(reported(withSre("He met [the FBI] agents.")), ["FBI", "SRE"]);
  });
});
