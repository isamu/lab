import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { cleanLine, formatTable, outcomeLine, type RuleRow } from "../scripts/bench-score.ts";
import { joinBenchSummary, OTHER_FILE, SAMPLES_FILE, splitBenchSummary } from "../scripts/bench-expected.ts";
import { readExpectedDir } from "../scripts/expected-dir.ts";
import { MUTATIONS } from "../scripts/bench-mutations.ts";
import { BENCH } from "../scripts/bench-samples.ts";
import { join } from "node:path";

// test/fixtures/bench/expected/ は rule ごとのファイルに分けて持つ。rule を足す PR が、ほかの rule の行と衝突しないため。

const CASES = 300;
const SEED = 20261002;
const RULES = ["doubled-word", "a", "a-b", "sentence-initial-conjunction-run", "no-em-dash", "date-order"];
const SAMPLES = ["ja/blog", "ja/design", "en/blog", "en/quote"];

/** A small deterministic generator (mulberry32), so a failing case can be re-run from the seed. */
const generator = (seed: number): (() => number) => {
  const state = { value: seed };
  return () => {
    state.value = (state.value + 0x6d2b79f5) | 0;
    const mixed = Math.imul(state.value ^ (state.value >>> 15), 1 | state.value);
    const spread = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((spread ^ (spread >>> 14)) >>> 0) / 4294967296;
  };
};

const pick = (random: () => number, count: number): number => Math.floor(random() * count);

type Generated = { readonly lines: string[]; readonly ruleOf: Map<string, string>; readonly mutationIds: string[] };

/** A summary as scripts/bench.ts writes it: the table, a clean line per sample, then each sample's outcomes in mutation order. */
const summaryOf = (random: () => number): Generated => {
  const rules = RULES.filter(() => random() < 0.7).toSorted((left, right) => left.localeCompare(right, "en"));
  const mutationIds = rules.flatMap((rule) => Array.from({ length: 1 + pick(random, 2) }, (_, index) => `${rule}-m${String(index)}`));
  const ruleOf = new Map(mutationIds.map((id) => [id, id.replace(/-m\d$/u, "")]));
  const rows: RuleRow[] = rules.map((rule) => ({
    rule,
    planted: pick(random, 30),
    found: pick(random, 30),
    missed: pick(random, 3),
    falseAlarms: pick(random, 3),
  }));
  const clean = SAMPLES.map((sample) => cleanLine(sample, random() < 0.2 ? [{ rule: rules[0] ?? "a", line: 1 }] : [], new Set(rules)));
  const outcomes = SAMPLES.flatMap((sample) =>
    mutationIds
      .filter(() => random() < 0.6)
      .map((mutation) => outcomeLine({ sample, mutation, rule: ruleOf.get(mutation) ?? "", found: random() < 0.8, elsewhere: random() < 0.1 ? [3, 7] : [] })),
  );
  return { lines: [...(rows.length === 0 ? [] : formatTable(rows)), ...clean, ...outcomes], ruleOf, mutationIds };
};

describe("splitBenchSummary / joinBenchSummary", () => {
  it(`分けてから戻すと、元の行に戻る（生成した ${String(CASES)} 通り、seed ${String(SEED)}）`, () => {
    const random = generator(SEED);
    Array.from({ length: CASES }, () => summaryOf(random)).forEach(({ lines, ruleOf, mutationIds }) =>
      assert.deepEqual(joinBenchSummary(splitBenchSummary(lines, ruleOf), mutationIds), lines),
    );
  });

  it("どの rule より長い名前の rule が増えても、ほかの rule のファイルは変わらない（表は戻すときに揃える）", () => {
    const rows: RuleRow[] = [{ rule: "a", planted: 2, found: 2, missed: 0, falseAlarms: 0 }];
    const longer: RuleRow = { rule: "a-much-longer-rule-id-than-any-other", planted: 1, found: 1, missed: 0, falseAlarms: 0 };
    const before = splitBenchSummary(formatTable(rows), new Map());
    const after = splitBenchSummary(formatTable([...rows, longer]), new Map());
    assert.deepEqual(after.get("a.txt"), before.get("a.txt"));
    assert.deepEqual(after.get(`${longer.rule}.txt`), ["table  1  1  0  0"]);
  });

  it("見本の行は _samples.txt に、どの mutation のものでもない結果は _other.txt に置き、戻せば元の位置に返る", () => {
    const lines = ["ja/blog  clean sample  clean", "ja/blog  gone-mutation  found", "ja/blog  kept  missed"];
    const files = splitBenchSummary(lines, new Map([["kept", "doubled-word"]]));
    assert.deepEqual(files.get(SAMPLES_FILE), ["ja/blog  clean sample  clean"]);
    assert.deepEqual(files.get(OTHER_FILE), ["ja/blog  gone-mutation  found"]);
    assert.deepEqual(files.get("doubled-word.txt"), ["ja/blog  kept  missed"]);
    assert.deepEqual(joinBenchSummary(files, ["kept"]), lines);
  });

  it("空の一覧からは何も作らず、何も無いファイルからは何も戻らない", () => {
    assert.deepEqual([...splitBenchSummary([], new Map()).entries()], []);
    assert.deepEqual(joinBenchSummary(new Map(), []), []);
  });
});

describe("test/fixtures/bench/expected/", () => {
  it("今のファイルは、戻して分け直すと同じファイルになる（手で書き崩していない）", () => {
    const files = readExpectedDir(join(BENCH, "expected"));
    const ruleOf = new Map(MUTATIONS.map((mutation) => [mutation.id, mutation.rule]));
    assert.deepEqual(
      splitBenchSummary(
        joinBenchSummary(
          files,
          MUTATIONS.map((mutation) => mutation.id),
        ),
        ruleOf,
      ),
      files,
    );
  });
});
