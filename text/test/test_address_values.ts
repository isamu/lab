import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { emailSpans, versionSpans } from "../packages/chaff/src/facts/address-values.ts";
import { definitionKey } from "../packages/chaff/src/structure/cross-definitions.ts";

// The scanners cross-doc-fact-conflict and cross-doc-duplicate-definition read with, in place of backtracking patterns.

const found = (source: string, spansOf: (text: string) => { start: number; end: number }[]): string[] =>
  spansOf(source).map((span) => source.slice(span.start, span.end));

describe("emailSpans", () => {
  it("an address, without the sentence's full stop", () => {
    assert.deepEqual(found("Write to help@example.com.", emailSpans), ["help@example.com"]);
    assert.deepEqual(found("窓口：support@tsumiki.example", emailSpans), ["support@tsumiki.example"]);
  });

  it("the domain up to its first empty label, and nothing without two labels or a local part", () => {
    assert.deepEqual(found("a@b.c..d", emailSpans), ["a@b.c"]);
    assert.deepEqual(found("a@localhost @b.c", emailSpans), []);
  });

  it("an @ inside the address before it starts none", () => {
    assert.deepEqual(found("a@b.c@d.e", emailSpans), ["a@b.c"]);
  });
});

describe("versionSpans", () => {
  it("three or four parts, or v and any number", () => {
    assert.deepEqual(found("Version 2.4.1, then 3.10.0.1000 and v3 and v2.1.", versionSpans), ["2.4.1", "3.10.0.1000", "v3", "v2.1"]);
  });

  it("not two parts, five parts, a run a word continues, or one inside a word", () => {
    assert.deepEqual(found("2.4 and 1.2.3.4.5 and 2.4.1a and dev3 and 3.10.0.1000x", versionSpans), []);
  });
});

describe("definitionKey", () => {
  it("evens out width, spaces and the marks at either end, spaces among them", () => {
    assert.equal(definitionKey("、 ＡＢＣ  の 場所。 "), "ABC の 場所");
    assert.equal(definitionKey("　、　:\n． ,"), ". ,");
    assert.equal(definitionKey(" 、 。"), "");
  });
});

/** The property the old patterns held, over generated text: every span is well formed, and spans never overlap. */
describe("generated text", () => {
  let seed = 7;
  const random = (): number => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  const ALPHABET = ["a", "b", "1", "2", "@", ".", "-", "_", " ", "v", "é", "\n"];
  const texts = Array.from({ length: 2000 }, () =>
    Array.from({ length: Math.floor(random() * 24) }, () => ALPHABET[Math.floor(random() * ALPHABET.length)] ?? "").join(""),
  );

  /** Whether one address is well formed and starts at or after the end of the one before. */
  const wellFormed = (text: string, span: { start: number; end: number }, previousEnd: number): boolean => {
    const [local = "", domain = ""] = text.slice(span.start, span.end).split("@");
    const labels = domain.split(".");
    return span.start >= previousEnd && local !== "" && labels.length >= 2 && !labels.includes("");
  };

  it("addresses have a local part and two labels, and do not overlap", () => {
    const bad = texts.filter((text) => emailSpans(text).some((span, index, spans) => !wellFormed(text, span, spans[index - 1]?.end ?? 0)));
    assert.deepEqual(bad, []);
  });

  const isVersion = (version: string): boolean => {
    const parts = version.replace(/^v/u, "").split(".");
    return parts.every((part) => /^\d+$/u.test(part)) && (version.startsWith("v") || parts.length === 3 || parts.length === 4);
  };

  it("versions are digits and dots, with v or with three or four parts", () => {
    assert.deepEqual(
      texts.flatMap((text) => found(text, versionSpans)).filter((version) => !isVersion(version)),
      [],
    );
  });
});
