// Seeded-mistake benchmark. Plants one mistake at a time in the self-written samples of test/fixtures/bench/<lang>/,
// runs every rule (as with --experimental) for the sample's genre, and counts which planted mistakes chaff finds.
// A mistake is planted only where its rule runs: in the rule's languages, a genre in its use_for, and not off in the genre's
// preset. The team's words (jargon, required_sections) are passed as chaff.yaml would pass them.
// The corpus measures false positives; this measures misses. The summary is compared with
// test/fixtures/bench/expected/ (scripts/bench-expected.ts), and --update rewrites it. A rule that test/fixtures/bench/plants.yaml says is
// planted, but that this run planted in no sample of one of its languages, fails the run even with --update.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { allFindings, type CorpusFinding } from "./corpus-findings.ts";
import { MUTATIONS } from "./bench-mutations.ts";
import type { Mutation } from "./bench-text.ts";
import { cleanLine, falseAlarms, formatTable, outcomeLine, outcomeOf, ruleTable, summaryChanges, type Outcome } from "./bench-score.ts";
import { BENCH, contextOf, runsOn, samplesOf, teamOf, type Sample } from "./bench-samples.ts";
import { planOf, planProblems, unplanted } from "./bench-coverage.ts";
import { joinBenchSummary, splitBenchSummary } from "./bench-expected.ts";
import { readExpectedDir, writeExpectedDir } from "./expected-dir.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { parse } from "yaml";

const EXPECTED = join(BENCH, "expected");
const PLAN = planOf(parse(readFileSync(join(BENCH, "plants.yaml"), "utf8")));
const LANGUAGES: readonly string[] = ["ja", "en"];
const verbose = process.argv.includes("--verbose");
const update = process.argv.includes("--update");

const findingsOf = async (sample: Sample, source: string): Promise<CorpusFinding[]> =>
  allFindings(sample.path, source, sample.language, sample.genre, teamOf(sample));

const plantedOutcome = async (sample: Sample, mutation: Mutation): Promise<Outcome | undefined> => {
  const plant = mutation.plant(sample.source, contextOf(sample));
  if (plant === undefined) return undefined;
  const findings = await findingsOf(sample, plant.source);
  if (verbose)
    findings.filter((finding) => finding.rule === mutation.rule).forEach((finding) => console.log(`    ${String(finding.line)}  ${finding.message}`));
  return outcomeOf(sample.name, mutation.id, { rule: mutation.rule, line: mutation.reportsOn ?? plant.line }, findings);
};

const outcomesOf = async (sample: Sample): Promise<Outcome[]> =>
  MUTATIONS.filter((mutation) => mutation.languages.includes(sample.language) && runsOn(sample, mutation.rule)).reduce<Promise<Outcome[]>>(
    async (previous, mutation) => {
      const outcomes = await previous;
      const outcome = await plantedOutcome(sample, mutation);
      if (outcome !== undefined && verbose) console.log(outcomeLine(outcome));
      return outcome === undefined ? outcomes : [...outcomes, outcome];
    },
    Promise.resolve([]),
  );

type Measured = { readonly outcomes: readonly Outcome[]; readonly clean: readonly CorpusFinding[]; readonly cleanLine: string };

const measured: ReadonlySet<string> = new Set(MUTATIONS.map((mutation) => mutation.rule));

const measure = async (sample: Sample): Promise<Measured> => {
  const clean = await findingsOf(sample, sample.source);
  return { outcomes: await outcomesOf(sample), clean, cleanLine: cleanLine(sample.name, clean, measured) };
};

const samples = LANGUAGES.flatMap(samplesOf);
const results = await samples.reduce<Promise<Measured[]>>(async (previous, sample) => [...(await previous), await measure(sample)], Promise.resolve([]));
const outcomes = results.flatMap((result) => result.outcomes);
const alarms = falseAlarms(
  results.flatMap((result) => result.clean),
  measured,
);
const table = formatTable(ruleTable(measured, outcomes, alarms));
table.forEach((line) => console.log(line));

const misses = outcomes.filter((outcome) => !outcome.found);
if (misses.length > 0) console.log("\nMissed:");
misses.forEach((outcome) => console.log(`  ${outcomeLine(outcome)}`));

const ruleIds = [...new Set(LANGUAGES.flatMap((language) => loadRules(language).map((rule) => rule.id)))];
const coverage = [...planProblems(PLAN, ruleIds, MUTATIONS), ...unplanted(PLAN, outcomes)];
if (coverage.length > 0) {
  console.log("\nPlants missing (test/fixtures/bench/plants.yaml):");
  coverage.forEach((problem) => console.log(`  ${problem}`));
  process.exitCode = 1;
}

const actual = [...table, ...results.map((result) => result.cleanLine), ...outcomes.map(outcomeLine)];
const expected = joinBenchSummary(
  readExpectedDir(EXPECTED),
  MUTATIONS.map((mutation) => mutation.id),
);
if (update) writeExpectedDir(EXPECTED, splitBenchSummary(actual, new Map(MUTATIONS.map((mutation) => [mutation.id, mutation.rule]))));
const changes = update ? [] : summaryChanges(expected, actual);
if (changes.length > 0) {
  console.log("\nChanged from test/fixtures/bench/expected.txt (yarn bench --update to accept):");
  changes.forEach((change) => console.log(change));
  process.exitCode = 1;
}
