import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { cleanLine, falseAlarms, formatTable, outcomeLine, outcomeOf, ruleTable, summaryChanges, type Outcome, type Planted } from "../scripts/bench-score.ts";

// yarn bench の数え方。植えた誤りを見つけたか、rule ごとの表、前回との違い。

const planted = { rule: "date-order", line: 10 };

describe("outcomeOf", () => {
  it("植えた行か、その隣の行で狙いの rule が言えば見つけた", () => {
    [9, 10, 11].forEach((line) => assert.equal(outcomeOf("ja/a", "m", planted, [{ rule: "date-order", line }]).found, true, String(line)));
  });

  it("二行離れて言っただけ、別の rule が言っただけなら見逃し。離れて言った行は残す", () => {
    const far = outcomeOf("ja/a", "m", planted, [
      { rule: "date-order", line: 12 },
      { rule: "date-order", line: 8 },
      { rule: "total-mismatch", line: 10 },
    ]);
    assert.deepEqual(far, { sample: "ja/a", mutation: "m", rule: "date-order", found: false, elsewhere: [12, 8] });
    assert.deepEqual(outcomeOf("ja/a", "m", planted, []).elsewhere, []);
    assert.deepEqual(
      outcomeOf("ja/a", "m", planted, [
        { rule: "date-order", line: 10 },
        { rule: "date-order", line: 30 },
      ]).elsewhere,
      [],
    );
  });
});

describe("outcomeOf (document)", () => {
  it("文書全体に言う rule は、どの行で言っても見つけた。別の rule では見逃し", () => {
    const document: Planted = { rule: "required-sections", line: "document" };
    assert.equal(outcomeOf("ja/a", "m", document, [{ rule: "required-sections", line: 1 }]).found, true);
    assert.deepEqual(outcomeOf("ja/a", "m", document, [{ rule: "heading-echo", line: 1 }]).elsewhere, []);
    assert.equal(outcomeOf("ja/a", "m", document, []).found, false);
  });
});

describe("falseAlarms", () => {
  it("誤りの無い見本で、測っている rule が言った数", () => {
    const clean = [
      { rule: "date-order", line: 1 },
      { rule: "date-order", line: 5 },
      { rule: "heading-echo", line: 2 },
    ];
    assert.deepEqual([...falseAlarms(clean, new Set(["date-order", "total-mismatch"]))], [["date-order", 2]]);
    assert.deepEqual([...falseAlarms([], new Set(["date-order"]))], []);
  });
});

const outcome = (rule: string, found: boolean): Outcome => ({ sample: "en/a", mutation: "m", rule, found, elsewhere: [] });

describe("ruleTable / formatTable", () => {
  it("rule ごとに、植えた数・見つけた数・見逃した数・誤りの無い見本での指摘の数", () => {
    const rows = ruleTable(
      new Set(["total-mismatch", "date-order"]),
      [outcome("date-order", true), outcome("date-order", false), outcome("date-order", true)],
      new Map([["total-mismatch", 1]]),
    );
    assert.deepEqual(rows, [
      { rule: "date-order", planted: 3, found: 2, missed: 1, falseAlarms: 0 },
      { rule: "total-mismatch", planted: 0, found: 0, missed: 0, falseAlarms: 1 },
    ]);
    assert.deepEqual(formatTable(rows), [
      "rule            planted  found  missed  false alarms",
      "date-order            3      2       1             0",
      "total-mismatch        0      0       0             1",
    ]);
  });
});

describe("outcomeLine / cleanLine", () => {
  it("植えた誤り一つにつき一行。見逃したときは、離れて言った行を添える", () => {
    assert.equal(outcomeLine(outcome("date-order", true)), "en/a  m  found");
    assert.equal(outcomeLine({ ...outcome("date-order", false), elsewhere: [3, 9] }), "en/a  m  missed (reported at line 3, 9)");
  });

  it("見本ごとに、測っている rule の指摘を数える", () => {
    const measured = new Set(["date-order", "total-mismatch"]);
    assert.equal(cleanLine("en/a", [{ rule: "heading-echo", line: 1 }], measured), "en/a  clean sample  clean");
    assert.equal(
      cleanLine(
        "en/a",
        [
          { rule: "total-mismatch", line: 1 },
          { rule: "date-order", line: 2 },
        ],
        measured,
      ),
      "en/a  clean sample  date-order 1, total-mismatch 1",
    );
  });
});

describe("summaryChanges", () => {
  it("前回にだけある行と、今回にだけある行", () => {
    assert.deepEqual(summaryChanges(["a", "b"], ["b", "c"]), ["- a", "+ c"]);
    assert.deepEqual(summaryChanges(["a"], ["a"]), []);
  });
});
