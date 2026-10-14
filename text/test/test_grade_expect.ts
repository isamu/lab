import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Atom } from "../packages/chaff/src/compare/atom.ts";
import { expectFailures, expectOf, factOfEntry } from "../packages/chaff/src/grade/expect.ts";
import { parseItems, type ItemVocabulary } from "../packages/chaff/src/grade/item.ts";
import type { GradeResult } from "../packages/chaff/src/grade/result.ts";
import { runCli } from "./cli-run.ts";
import { jsonl, resultsIn } from "./grade-run.ts";

// chaff grade's per-item `expect`: facts the output must state and facts it must not, matched as compare matches facts.

const VOCABULARY: ItemVocabulary = { isLanguage: (language) => ["ja", "en"].includes(language), genres: [] };

const atom = (kind: Atom["kind"], text: string): Atom => ({ kind, key: text, text, line: 1 });

describe("the expect field's shape", () => {
  it("reads facts and absent, and takes a missing list or an empty object as nothing to check", () => {
    assert.deepEqual(expectOf(undefined), { expect: undefined });
    assert.deepEqual(expectOf({}), { expect: { facts: [], absent: [] } });
    assert.deepEqual(expectOf({ facts: ["12,000円"] }), { expect: { facts: ["12,000円"], absent: [] } });
    assert.deepEqual(expectOf({ facts: [], absent: ["$15"] }), { expect: { facts: [], absent: ["$15"] } });
  });

  it("names the first wrong part: not an object, a misspelt list, a list that is not of non-empty strings", () => {
    const cases: readonly (readonly [unknown, string])[] = [
      ["12,000円", "expect"],
      [["12,000円"], "expect"],
      [null, "expect"],
      [{ fact: ["12,000円"] }, "expect.fact"],
      [{ facts: "12,000円" }, "expect.facts"],
      [{ facts: [12000] }, "expect.facts"],
      [{ facts: [""] }, "expect.facts"],
      [{ facts: ["  "] }, "expect.facts"],
      [{ absent: null }, "expect.absent"],
      [{ facts: ["a"], absent: [["b"]] }, "expect.absent"],
    ];
    cases.forEach(([raw, wrong]) => assert.deepEqual(expectOf(raw), { wrong }, JSON.stringify(raw)));
  });

  it("puts a wrong expect on the item's line, and keeps expect off items that have none", () => {
    const parsed = parseItems(jsonl({ id: "a", output: "x" }, { id: "b", output: "y", expect: { facts: "z" } }), VOCABULARY);
    assert.ok("problems" in parsed);
    assert.deepEqual(parsed.problems, [{ kind: "not-expect", line: 2, detail: "expect.facts" }]);
    const read = parseItems(jsonl({ id: "a", output: "x" }, { id: "b", output: "y", expect: { facts: ["1"] } }), VOCABULARY);
    assert.ok("items" in read);
    assert.deepEqual(
      read.items.map((item) => item.expect),
      [undefined, { facts: ["1"], absent: [] }],
    );
    assert.equal("expect" in (read.items[0] ?? {}), false);
  });
});

describe("the one fact an entry states", () => {
  it("takes a lone fact, or of several the one that is the whole entry", () => {
    assert.deepEqual(factOfEntry("12,000円", [atom("number", "12,000円")]), { fact: atom("number", "12,000円") });
    const quoted = [atom("number", "12,000円"), atom("quote", "「12,000円」")];
    assert.deepEqual(factOfEntry("「12,000円」", quoted), { fact: atom("quote", "「12,000円」") });
  });

  it("refuses an entry with no fact or with several that none of them is", () => {
    assert.deepEqual(factOfEntry("hello", []), { unread: "no-fact" });
    assert.deepEqual(factOfEntry("12,000円と13,000円", [atom("number", "12,000円"), atom("number", "13,000円")]), { unread: "several-facts" });
  });

  it("writes a reason per missing and per present entry, and none without expect", () => {
    assert.deepEqual(expectFailures({ checked: 3, missing: ["12,000円"], present: ["$15"] }), ["expect.missing 12,000円", "expect.present $15"]);
    assert.deepEqual(expectFailures({ checked: 0, missing: [], present: [] }), []);
    assert.deepEqual(expectFailures(undefined), []);
  });
});

const graded = async (items: string, lang: string): Promise<{ code: number; out: string; err: string; results: GradeResult[] }> => {
  const run = await runCli({ "items.jsonl": items }, ["grade", "items.jsonl", "--out", "out.jsonl"], lang);
  return { ...run, results: run.code === 2 ? [] : resultsIn(run.dir) };
};

const expectReasons = (result: GradeResult | undefined): string[] => (result?.failedBecause ?? []).filter((reason) => reason.startsWith("expect."));

describe("chaff grade with expect, in Japanese", () => {
  const JA = "ja_JP.UTF-8";

  it("finds a fact written in another form, as compare does", async () => {
    const run = await graded(
      jsonl({ id: "q1", output: "代金は12000円で、期日は2026年3月31日です。", expect: { facts: ["12,000円", "2026-03-31"], absent: ["15,000円"] } }),
      JA,
    );
    const [result] = run.results;
    assert.deepEqual(result?.expect, { checked: 3, missing: [], present: [] });
    assert.deepEqual(expectReasons(result), []);
  });

  it("fails a missing fact and a present absent one, in the result and in the summary of failed outputs", async () => {
    const run = await graded(jsonl({ id: "q1", output: "代金は15,000円です。", expect: { facts: ["12,000円"], absent: ["15,000円"] } }), JA);
    const [result] = run.results;
    assert.equal(run.code, 1);
    assert.deepEqual(result?.expect, { checked: 2, missing: ["12,000円"], present: ["15,000円"] });
    assert.deepEqual(expectReasons(result), ["expect.missing 12,000円", "expect.present 15,000円"]);
    assert.match(run.out, /✗ q1: .*expect\.missing 12,000円, expect\.present 15,000円/u);
  });

  it("counts a figure with another unit as another fact, as compare does", async () => {
    const run = await graded(jsonl({ id: "q1", output: "代金は¥12,000です。", expect: { facts: ["12,000円"] } }), JA);
    assert.deepEqual(run.results[0]?.expect?.missing, ["12,000円"]);
  });

  it("counts a fact stated only inside a quotation: compare reads the figure in a quotation too", async () => {
    const run = await graded(
      jsonl({ id: "q1", output: "契約書には「代金は12,000円とする」とある。", expect: { facts: ["12,000円"], absent: ["12,000円"] } }),
      JA,
    );
    assert.deepEqual(run.results[0]?.expect, { checked: 2, missing: [], present: ["12,000円"] });
  });

  it("stops with 2 for an entry that is several facts or none, naming the line and the entry", async () => {
    const run = await graded(
      jsonl({ id: "ok", output: "12,000円" }, { id: "q2", output: "代金は12,000円です。", expect: { facts: ["1万2000円"], absent: ["こんにちは"] } }),
      JA,
    );
    assert.equal(run.code, 2);
    assert.match(run.err, /2 行目: expect\.facts\[0\] 1万2000円 は事実を 2 つ以上含みます/u);
    assert.match(run.err, /2 行目: expect\.absent\[0\] こんにちは から事実を読めません/u);
  });

  it("stops with 2 for a wrong expect", async () => {
    const run = await graded(jsonl({ id: "q1", output: "x", expect: { fact: ["1"] } }), JA);
    assert.equal(run.code, 2);
    assert.match(run.err, /1 行目: expect\.fact は/u);
  });
});

describe("chaff grade with expect, in English", () => {
  const EN = "en_US.UTF-8";

  it("finds a date and a figure written in another form", async () => {
    const run = await graded(jsonl({ id: "q1", output: "The fee is $12000, due 2026-03-31.", expect: { facts: ["$12,000", "March 31, 2026"] } }), EN);
    assert.deepEqual(run.results[0]?.expect, { checked: 2, missing: [], present: [] });
  });

  it("fails a missing and a present fact, and checks nothing for empty lists", async () => {
    const run = await graded(
      jsonl(
        { id: "q1", output: "The fee is $15,000.", expect: { facts: ["$12,000"], absent: ["$15,000"] } },
        { id: "q2", output: "The fee is $15,000.", expect: { facts: [], absent: [] } },
      ),
      EN,
    );
    assert.deepEqual(expectReasons(run.results[0]), ["expect.missing $12,000", "expect.present $15,000"]);
    assert.deepEqual(run.results[1]?.expect, { checked: 0, missing: [], present: [] });
    assert.deepEqual(expectReasons(run.results[1]), []);
  });

  it("takes a quotation entry as the quotation", async () => {
    const run = await graded(jsonl({ id: "q1", output: 'He wrote "pay 12,000 yen" today.', expect: { facts: ['"pay 12,000 yen"'] } }), EN);
    assert.deepEqual(run.results[0]?.expect?.missing, []);
  });

  it("stops with 2 for an entry it cannot read as one fact, and for a list of numbers", async () => {
    const unread = await graded(jsonl({ id: "q1", output: "The fee is $12,000.", expect: { facts: ["hello"] } }), EN);
    assert.equal(unread.code, 2);
    assert.match(unread.err, /line 1: expect\.facts\[0\] hello states no fact chaff can read/u);
    const wrong = await graded(jsonl({ id: "q1", output: "x", expect: { facts: [12000] } }), EN);
    assert.equal(wrong.code, 2);
    assert.match(wrong.err, /line 1: expect\.facts must be/u);
  });

  it("leaves a result without expect as it was", async () => {
    const run = await graded(jsonl({ id: "q1", output: "The fee is $12,000." }), EN);
    assert.equal(run.results[0] !== undefined && "expect" in run.results[0], false);
  });
});
