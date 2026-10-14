import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { reportedAcronyms } from "./rule-run.ts";
import { outlineLabelSpans } from "../packages/chaff/src/detectors/outline-label.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";

// 議事録の、Z. の次に AA.、AB. … と振る見出しの番号は略語ではない。例文はすべて自作。

const DIVISIONS = ["Attachment", "Exhibit"];

const labelsIn = (source: string, divisions: readonly string[] = DIVISIONS): string[] =>
  outlineLabelSpans(source, divisions).map((span) => source.slice(span.start, span.end));

const acronymsIn = (body: string): string[] => reportedAcronyms(en, `# Minutes\n\n${body}\n`).toSorted((left, right) => left.localeCompare(right, "en"));

describe("outlineLabelSpans", () => {
  [
    ["Z の次の AA", "  Y. Orchard report\n  Z. Garden report\n  AA. Library report\n", ["Y", "Z", "AA"]],
    ["AZ の次の BA", "AZ. Pottery club\nBA. Rowing club\n", ["AZ", "BA"]],
    ["括弧で閉じる番号", "AB) Kitchen\nAC) Pantry\n", ["AB", "AC"]],
    ["間に本文を挟む", "AD. Choir report\nThe choir met twice.\n\nAE. Band report\n", ["AD", "AE"]],
    ["一つ飛んでも隣があれば番号", "AF. Tennis\nAG. Squash\nAI. Hockey\nAJ. Rugby\n", ["AF", "AG", "AI", "AJ"]],
    ["ZZ の次の AAA", "ZZ. Last\nAAA. First\n", ["ZZ", "AAA"]],
    ["番号だけの行", "AA.\nAB.\n", ["AA", "AB"]],
    ["区切りの名前の後ろで番号を指す", "AA. Library\nAB. Kitchen\n\nSee Attachment AA and Exhibit AB.\n", ["AA", "AB", "AA", "AB"]],
  ].forEach(([form, source, labels]) => {
    it(`番号: ${String(form)}`, () => assert.deepEqual(labelsIn(String(source)), labels));
  });

  [
    ["隣の番号が無い", "AI. Tools we use\nThe team met.\n"],
    ["離れた番号だけ", "AA. Library\nAC. Kitchen\n"],
    ["行の頭でない", "See the minutes, AA. Library and AB. Kitchen.\n"],
    ["後ろに空白が無い", "AA.Library\nAB.Kitchen\n"],
    ["3 文字の大文字", "NASA. Report\nNASB. Report\n"],
    ["小文字", "aa. Library\nab. Kitchen\n"],
    ["空の文書", ""],
    ["番号の無い文書で区切りの名前の後ろ", "See Attachment AA and Exhibit AB.\n"],
  ].forEach(([form, source]) => {
    it(`番号でない: ${String(form)}`, () => assert.deepEqual(labelsIn(String(source)), []));
  });
});

describe("undefined-acronym: 文字で振った見出しの番号", () => {
  it("隣と並んだ番号は数えず、本文の略語は数える", () => {
    assert.deepEqual(acronymsIn("Z. Garden report\n\nAA. Library report. The SRE joins.\n\nAB. Kitchen report\n"), ["SRE"]);
  });

  it("番号を Attachment の後ろで指す所も数えない", () => {
    assert.deepEqual(acronymsIn("See Attachment AA. The SRE joins.\n\nAA. Library report\n\nAB. Kitchen report\n"), ["SRE"]);
  });

  it("隣の番号が無い行頭の大文字は数える", () => {
    assert.deepEqual(acronymsIn("ZQ. Tools we use\n\nThe team met."), ["ZQ"]);
  });

  it("番号でない字は、区切りの名前の後ろでも数える", () => {
    assert.deepEqual(labelsIn("AA. Library\nAB. Kitchen\n\nSee Attachment ZQ.\n"), ["AA", "AB"]);
    assert.deepEqual(labelsIn("AA. Library\nAB. Kitchen\n\nSee Attachment AA.\n", []), ["AA", "AB"]);
  });

  it("番号と同じ字の略語も、本文に現れれば数える", () => {
    assert.deepEqual(acronymsIn("AA. Library report\n\nAB. Kitchen report\n\nThe AB team met."), ["AB"]);
  });
});
