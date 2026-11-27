import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { reportedAcronyms } from "./rule-run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { codePrefixSpans } from "../packages/chaff/src/detectors/code-prefix.ts";

// undefined-acronym and the letters a sentence says an identifier starts with (a number that starts with XI). Examples are self-written.

const EN_PHRASES = (en.lexicons["code-prefix-phrase"] ?? []).map((entry) => entry.pattern);
const JA_PHRASES = (ja.lexicons["code-prefix-phrase"] ?? []).map((entry) => entry.pattern);

const doc = (...body: string[]): string => ["# Exports", "", ...body, "", "The SRE joins the call."].join("\n");
const jaDoc = (...body: string[]): string => ["# 輸出", "", ...body, "", "SREが対応する。"].join("\n");

const prefixes = (text: string, phrases: readonly string[]): string[] => codePrefixSpans(text, phrases).map((span) => text.slice(span.start, span.end));

describe("codePrefixSpans", () => {
  it("valid: the letters right after or before the phrase, quoted or not, at the head of a sentence too", () => {
    assert.deepEqual(prefixes("You may need one that starts with XI.", EN_PHRASES), ["XI"]);
    assert.deepEqual(prefixes("Starts with “QZ” and has 9 digits.", EN_PHRASES), ["QZ"]);
    assert.deepEqual(prefixes("Codes beginning with  KT are local.", EN_PHRASES), ["KT"]);
    assert.deepEqual(prefixes("XIで始まる番号が要ります。", JA_PHRASES), ["XI"]);
  });

  it("invalid: a lower-case word, longer capitals, letters joined to digits, no phrase, empty input", () => {
    assert.deepEqual(prefixes("It starts with the form.", EN_PHRASES), []);
    assert.deepEqual(prefixes("The day starts with ABCDE.", EN_PHRASES), []);
    assert.deepEqual(prefixes("It starts with XI9.", EN_PHRASES), []);
    assert.deepEqual(prefixes("Send it to XI.", EN_PHRASES), []);
    assert.deepEqual(prefixes("", EN_PHRASES), []);
    assert.deepEqual(prefixes("It starts with XI.", []), []);
    assert.deepEqual(prefixes("It starts with XI.", ["a phrase with no slot"]), []);
  });
});

describe("undefined-acronym: the letters an identifier starts with", () => {
  it("valid: not reported, in English and in Japanese", () => {
    assert.deepEqual(reportedAcronyms(en, doc("If you move goods to Belfast you may need one that starts with XI.")), ["SRE"]);
    assert.deepEqual(reportedAcronyms(ja, jaDoc("北アイルランドに送るときは、XIで始まる番号が要ります。")), ["SRE"]);
  });

  it("invalid: the same letters in prose are still reported", () => {
    assert.deepEqual(reportedAcronyms(en, doc("Send the form to XI by Friday.")), ["XI", "SRE"]);
    assert.deepEqual(reportedAcronyms(ja, jaDoc("XIに書類を送ります。")), ["XI", "SRE"]);
  });
});
