import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { referenceFlag } from "../packages/chaff/src/detectors/reference-flag.ts";
import { referenceUnit } from "../packages/chaff/src/detectors/reference-unit.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { DetectorOptions, LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// lab-result-column is the one heading lexicon reference-flag-mismatch and reference-unit-mismatch both read: a word in it
// names its column for both rules.

/** Neither detector reads its options. */
const NO_OPTIONS: DetectorOptions = { limit: 0 };
const ADAPTERS: readonly LanguageAdapter[] = [ja, en];
const GROUPS = ["result", "range", "flag", "unit"] as const;
type Group = (typeof GROUPS)[number];

const sharedWords = (adapter: LanguageAdapter, group: Group): string[] =>
  (adapter.lexicons["lab-result-column"] ?? []).filter((entry) => entry.group === group).map((entry) => entry.pattern);

/** What each rule reports, without where (a longer heading moves every offset). */
const readingOf = (adapter: LanguageAdapter, source: string): { flag: string[]; unit: string[] } => {
  const doc = buildDocument("t.md", source, adapter);
  const values = (findings: readonly { values: Record<string, unknown> }[]): string[] =>
    findings.map((finding) => JSON.stringify({ ...finding.values, offset: undefined }));
  return { flag: values(referenceFlag(doc, NO_OPTIONS)), unit: values(referenceUnit(doc, NO_OPTIONS)) };
};

const tableOf = (headings: readonly string[], rows: readonly (readonly string[])[]): string =>
  [headings, headings.map(() => "---"), ...rows].map((cells) => `| ${cells.join(" | ")} |`).join("\n") + "\n";

// Row one: a flag that contradicts its range (only reference-flag-mismatch). Row two: a result whose unit is in the Unit column
// and differs from the range's (only reference-unit-mismatch).
const ROWS: Readonly<Record<string, readonly (readonly string[])[]>> = {
  ja: [
    ["中性脂肪", "88 mg/dL", "30〜149 mg/dL", "高", "mg/dL"],
    ["HDL", "64", "40〜96 mg/dL", "低", "mmol/L"],
  ],
  en: [
    ["Triglycerides", "88 mg/dL", "30–149 mg/dL", "H", "mg/dL"],
    ["HDL", "64", "40–96 mg/dL", "L", "mmol/L"],
  ],
};

const headingsWith = (adapter: LanguageAdapter, group: Group, word: string): string[] => [
  "Item",
  ...GROUPS.map((each) => (each === group ? word : (sharedWords(adapter, each)[0] ?? ""))),
];

const assertBothRulesRead = (adapter: LanguageAdapter, group: Group, word: string): void => {
  const reading = readingOf(adapter, tableOf(headingsWith(adapter, group, word), ROWS[adapter.id] ?? []));
  assert.equal(reading.flag.length, 1, `reference-flag-mismatch with ${word}: ${reading.flag.join(", ")}`);
  assert.equal(reading.unit.length, 1, `reference-unit-mismatch with ${word}: ${reading.unit.join(", ")}`);
};

const assertEveryWordRead = (adapter: LanguageAdapter, group: Group): void =>
  sharedWords(adapter, group).forEach((word) => assertBothRulesRead(adapter, group, word));

describe("lab-result-column: every word names its column for both rules", () => {
  ADAPTERS.forEach((adapter) => {
    it(`${adapter.id}: the lexicon has a word for each column`, () => {
      GROUPS.forEach((group) => assert.ok(sharedWords(adapter, group).length > 0, `${adapter.id} has no ${group} word`));
    });

    GROUPS.forEach((group) => {
      it(`${adapter.id}: each ${group} word, as the heading, lets both rules read the table`, () => {
        assertEveryWordRead(adapter, group);
      });
    });

    it(`${adapter.id}: a heading no word names leaves the column unread by both rules`, () => {
      const reading = readingOf(adapter, tableOf(["Item", "Zzz", "Zzz2", "Zzz3", "Zzz4"], ROWS[adapter.id] ?? []));
      assert.deepEqual(reading, { flag: [], unit: [] });
    });
  });
});

// Generated tables: any word of a group read as the first word of that group, by both rules, in both languages.
const nextOf = (seed: number): (() => number) => {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
};

const RESULTS = ["88 mg/dL", "64 mmol/L", "5.2 %", "18 ng/mL", "<0.5", "陰性", "", "149", "1,200 U/L", "5.5 mmol/L（99 mg/dL）"];
const RANGES = ["30〜149 mg/dL", "4.0–5.6 %", "79 U/L 以下", "≤79", "40〜96 mg/dL", "", "30-100 ng/mL", "149〜30", "3.5-5.0 mmol/L"];
const FLAGS = ["H", "L", "高", "低", "基準内", "Normal", "*", "", "A", "要再検査"];
const UNITS = ["mg/dL", "mmol/L", "%", "", "U/L"];
const CELLS: Readonly<Record<Group | "other", readonly string[]>> = { result: RESULTS, range: RANGES, flag: FLAGS, unit: UNITS, other: ["メモ", "", "note"] };
/** Decorations both rules leave out of a heading the same way. */
const DECORATIONS: readonly ((word: string) => string)[] = [(word) => word, (word) => `${word} (mg/dL)`, (word) => `${word}（mg/dL）`, (word) => `**${word}**`];
const COLUMN_KINDS: readonly (Group | "other")[] = ["result", "range", "flag", "unit", "other", "result", "range", "flag"];
const RESULT_TABLE: readonly Group[] = ["result", "range", "flag"];
const CELL_UNITS = ["mg/dL", "%", "U/L", "ng/mL"];

type Generated = { readonly table: string; readonly canonical: string };
type Pick = <T>(items: readonly T[], fallback: T) => T;

/** Half the tables have exactly one result, range and flag column (in any order), the shape reference-flag-mismatch reads. */
const kindsOf = (random: () => number, pick: Pick): (Group | "other")[] => {
  if (random() < 0.5) return Array.from({ length: 1 + Math.floor(random() * 5) }, () => pick(COLUMN_KINDS, "other"));
  const extra = random() < 0.3 ? [pick(COLUMN_KINDS, "other")] : [];
  return [...RESULT_TABLE, ...extra].sort(() => random() - 0.5);
};

/** A cell of each kind; half the rows have a result and a range in one unit, so a flag can be checked against them. */
const rowOf = (kinds: readonly (Group | "other")[], random: () => number, pick: Pick): string[] => {
  const unit = pick(CELL_UNITS, "%");
  const low = 10 + Math.floor(random() * 50);
  const high = low + 10 + Math.floor(random() * 100);
  const matched: Readonly<Record<string, string>> = { result: `${Math.floor(random() * (high + 40))} ${unit}`, range: `${low}–${high} ${unit}`, unit };
  return ["Item", ...kinds.map((kind) => (random() < 0.5 ? (matched[kind] ?? pick(CELLS[kind], "")) : pick(CELLS[kind], "")))];
};

const generatedTable = (adapter: LanguageAdapter, random: () => number): Generated => {
  const pick: Pick = (items, fallback) => items[Math.floor(random() * items.length)] ?? fallback;
  const kinds = kindsOf(random, pick);
  const headingPairs = kinds.map((kind) => {
    const decorate = pick(DECORATIONS, (word: string) => word);
    if (kind === "other") return [decorate("Note"), decorate("Note")];
    const words = sharedWords(adapter, kind);
    return [decorate(pick(words, "")), decorate(words[0] ?? "")];
  });
  const rows = Array.from({ length: Math.floor(random() * 4) }, () => rowOf(kinds, random, pick));
  return {
    table: tableOf(["Item", ...headingPairs.map((pair) => pair[0] ?? "")], rows),
    canonical: tableOf(["Item", ...headingPairs.map((pair) => pair[1] ?? "")], rows),
  };
};

const assertSameReading = (adapter: LanguageAdapter, seed: number, { table, canonical }: Generated): void => {
  assert.deepEqual(readingOf(adapter, table), readingOf(adapter, canonical), `seed ${seed}\n${table}`);
};

const TABLES_PER_SEED = 300;

const assertSeedReadsAlike = (adapter: LanguageAdapter, seed: number): void => {
  const random = nextOf(seed);
  Array.from({ length: TABLES_PER_SEED }, () => generatedTable(adapter, random)).forEach((generated) => assertSameReading(adapter, seed, generated));
};

describe("lab-result-column: any word of a column reads as any other (generated tables)", () => {
  const SEEDS = [7, 4242, 90001];
  ADAPTERS.forEach((adapter) => {
    SEEDS.forEach((seed) => {
      it(`${adapter.id}, seed ${seed}: both rules report the same with the first word of each column`, () => {
        assertSeedReadsAlike(adapter, seed);
      });
    });
  });
});
