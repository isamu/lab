import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { reportedAcronyms } from "./rule-run.ts";
import { grammarRuleNames, grammarSpans } from "../packages/chaff/src/detectors/abnf-grammar.ts";
import { gradeLadderWords } from "../packages/chaff/src/detectors/grade-ladder.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";

// undefined-acronym and capitals that are not acronyms to spell out: the rule names and values of a grammar written in the
// text, the rungs of a grade ladder (A and AA), a reporter or register cited by number (80 FR 66128, 2022 WL 4447293), the
// kind written before a dated identifier (WD WD-ABC1-20200101), a file format (WAV), and an expansion with a trademark mark
// (Example Product Template (EPT®)). A real undefined acronym beside them is still reported.
// Every example is self-written.

const GRAMMAR = [
  "The file follows this grammar.",
  "",
  "  record   =  name SEP value CRLF",
  "  name     =  1*ALPHA",
  '  value    =  %x21-7E / "-"',
  "              ; any VCHAR but NUL",
  "  SEP      =  %x3A",
  "  CRLF     =  %x0D %x0A",
  "",
].join("\n");

const textOf = (source: string, spans: readonly { start: number; end: number }[]): string[] => spans.map((span) => source.slice(span.start, span.end));

describe("abnf-grammar", () => {
  it("the rule names a grammar defines", () => {
    assert.deepEqual(grammarRuleNames(GRAMMAR), ["record", "name", "value", "SEP", "CRLF"]);
  });

  it("the spans of its rules, their continuation and comment lines, and of every value", () => {
    const spans = textOf(GRAMMAR, grammarSpans(GRAMMAR));
    assert.ok(spans.includes("              ; any VCHAR but NUL"));
    assert.ok(spans.includes("  SEP      =  %x3A"));
    assert.ok(spans.includes("%x21-7E"));
    assert.ok(!spans.includes("The file follows this grammar."));
  });

  it("no grammar in prose that reads x = y, with fewer than two rules that hold a value or a string", () => {
    const prose = "Total = Price / Count\nRate = Total / Hours\nKey = %x41\n";
    assert.deepEqual(grammarRuleNames(prose), []);
    assert.deepEqual(grammarRuleNames(""), []);
  });

  it("lines that end with a carriage return", () => {
    assert.deepEqual(grammarRuleNames(GRAMMAR.replaceAll("\n", "\r\n")), ["record", "name", "value", "SEP", "CRLF"]);
  });

  it("not a comment line away from the rules", () => {
    const source = `${GRAMMAR}\nSome prose.\n\n; the PDQ note\n\nMore prose.\n`;
    assert.ok(!textOf(source, grammarSpans(source)).includes("; the PDQ note"));
  });

  it("a prose line after a rule ends the rule", () => {
    const source = `${GRAMMAR}  PDQ handles the rest of the file.\n`;
    assert.ok(!textOf(source, grammarSpans(source)).includes("  PDQ handles the rest of the file."));
  });
});

describe("gradeLadderWords", () => {
  it("the repeated-letter rungs when two rungs stand side by side", () => {
    assert.deepEqual(gradeLadderWords("Meet level A and AA, and AAA where you can."), ["AA", "AAA"]);
    assert.deepEqual(gradeLadderWords("Bonds rated BB/BBB."), ["BB", "BBB"]);
  });

  it("none for one rung alone, two rungs of the same length, or two letters", () => {
    assert.deepEqual(gradeLadderWords("Call AA for help."), []);
    assert.deepEqual(gradeLadderWords("AA and AA."), []);
    assert.deepEqual(gradeLadderWords("A and BB."), []);
    assert.deepEqual(gradeLadderWords(""), []);
  });
});

describe("undefined-acronym: capitals that are not acronyms to spell out", () => {
  it("a grammar's rule names, in the grammar and in the prose that names them, and its values", () => {
    const prose = "Each record ends with CRLF. A value is a byte in the %x21-FFFF range. The PDQ reads it.\n\n";
    assert.deepEqual(reportedAcronyms(en, `${prose}${GRAMMAR}`), ["PDQ"]);
  });

  it("the rungs of a grade ladder; one rung alone is still an acronym", () => {
    assert.deepEqual(reportedAcronyms(en, "Pages meet level A and AA. Aim for AAA. The PDQ checks it.\n"), ["PDQ"]);
    assert.deepEqual(reportedAcronyms(en, "Ask AA for the key. The PDQ checks it.\n"), ["AA", "PDQ"]);
  });

  it("a reporter or register cited by number; the same capitals with no number are still acronyms", () => {
    assert.deepEqual(reportedAcronyms(en, "See 80 FR 66128 and 2022 WL 4447293. The PDQ checks it.\n"), ["PDQ"]);
    assert.deepEqual(reportedAcronyms(en, "Ask FR about it. The PDQ checks it.\n"), ["FR", "PDQ"]);
  });

  it("the kind written before a dated identifier; the kind alone is still an acronym", () => {
    assert.deepEqual(reportedAcronyms(en, "See Example Group WD WD-abc1-20200101 and NOTE-tidy-rules-20190202. The PDQ checks it.\n"), ["PDQ"]);
    assert.deepEqual(reportedAcronyms(en, "Ask the WD team. The PDQ checks it.\n"), ["WD", "PDQ"]);
  });

  it("an expansion with a trademark mark after the acronym", () => {
    assert.deepEqual(reportedAcronyms(en, "Fill in the Example Product Template (EPT®). Then the EPT is sent. The PDQ checks it.\n"), ["PDQ"]);
  });

  it("a file format named among others", () => {
    assert.deepEqual(reportedAcronyms(en, "It opens a file extension (e.g., PDF, WAV, MOV). The PDQ checks it.\n"), ["PDQ"]);
  });
});
