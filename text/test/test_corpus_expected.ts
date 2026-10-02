import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { summaryLine } from "../scripts/corpus-docs.ts";
import { DOCUMENTS_FILE, joinSummary, splitSummary } from "../scripts/corpus-expected.ts";

// corpus/expected/ は rule ごとのファイルに分けて持つ。rule を足す PR・直す PR が、ほかの rule の行と衝突しないため。

const EXPECTED_DIR = join(import.meta.dirname, "..", "corpus", "expected");
const RULES = ["agentless-passive", "max-sentence-length", "max-sentence", "no-em-dash", "undefined-acronym", "a-b", "a"];
const CASES = 300;
const SEED = 20261002;

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

/** Summary lines as corpus-run writes them: each document's findings by summaryLine, documents in any order. */
const summaryOf = (random: () => number): string[] =>
  Array.from({ length: pick(random, 8) }, (_, index) => {
    const findings = Array.from({ length: pick(random, 6) }, () => RULES[pick(random, RULES.length)] ?? "a");
    return summaryLine(`doc-${String(pick(random, 1000))}-${String(index)}.txt`, findings);
  });

const linesOfFile = (file: string): string[] =>
  readFileSync(join(EXPECTED_DIR, file), "utf8")
    .split("\n")
    .filter((line) => line !== "");

describe("splitSummary / joinSummary", () => {
  it(`分けてから戻すと、元の行に戻る（生成した ${String(CASES)} 通り、seed ${String(SEED)}）`, () => {
    const random = generator(SEED);
    Array.from({ length: CASES }, () => summaryOf(random)).forEach((lines) => assert.deepEqual(joinSummary(splitSummary(lines)), lines));
  });

  it("ある rule の数だけが変わると、変わるファイルはその rule のファイルだけ", () => {
    const random = generator(SEED + 1);
    Array.from({ length: CASES }, () => summaryOf(random)).forEach((lines) => {
      const before = splitSummary(lines);
      const after = splitSummary(lines.map((line) => (line.endsWith("clean") ? line.replace("clean", "zz-new-rule 1") : `${line}, zz-new-rule 2`)));
      const changed = [...after.keys()].filter((file) => JSON.stringify(after.get(file)) !== JSON.stringify(before.get(file)));
      assert.deepEqual(changed, lines.length === 0 ? [] : ["zz-new-rule.txt"]);
    });
  });

  it("指摘の無い文書は、文書の一覧にだけ載り、clean に戻る", () => {
    const files = splitSummary(["a.txt  clean", "b  no-em-dash 2"]);
    assert.deepEqual(
      [...files.entries()],
      [
        [DOCUMENTS_FILE, ["a.txt", "b"]],
        ["no-em-dash.txt", ["b  2"]],
      ],
    );
    assert.deepEqual(joinSummary(files), ["a.txt  clean", "b  no-em-dash 2"]);
  });

  it("空の一覧からは何も作らず、何も無いファイルからは何も戻らない", () => {
    assert.deepEqual([...splitSummary([]).entries()], []);
    assert.deepEqual(joinSummary(new Map()), []);
  });

  it("文書の一覧に無い文書の数があれば止まる。黙って落とさない", () => {
    assert.throws(
      () =>
        joinSummary(
          new Map([
            [DOCUMENTS_FILE, ["a"]],
            ["no-em-dash.txt", ["b  2"]],
          ]),
        ),
      /b not in _documents\.txt/u,
    );
  });
});

describe("corpus/expected/", () => {
  it("今のファイルは、戻して分け直すと同じファイルになる（手で書き崩していない）", () => {
    const files = new Map(readdirSync(EXPECTED_DIR).map((file) => [file, linesOfFile(file)]));
    assert.deepEqual(splitSummary(joinSummary(files)), files);
  });
});
