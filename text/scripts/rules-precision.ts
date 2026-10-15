// `yarn rules:precision --corpus <dir>`: of each rule's findings that people judged in a checkout of isamu/chaff-corpus
// (expected/<id>.yaml), how many were right, per genre group, with this checkout's chaff (`yarn build` first). The corpus's
// own runner runs the documents and matches findings to verdicts; a verdict whose note says `extraction artefact:` or
// `dataset artefact:` is left out (scripts/rules-precision-score.ts). scripts/rule-policy.ts turns a rule off for a group
// its judged findings are rarely right in.
//   --corpus <dir>  the chaff-corpus checkout (its `yarn install` done)
//   --from <json>   read a run the corpus runner wrote with --json before, instead of running it again
//   --jobs <n>      how many documents the runner runs at once
//   --write         write corpus/rules-precision.json, which test/test_rule_policy.ts holds the rules to
//   --apply         --write, and place the rules from it and corpus/rules-measure.json (as yarn rules:measure --apply)
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parse } from "yaml";
import { applyMeasurement, genreDataOf, PRECISION_FILE, precisionOffs, readGenresText, readMeasurement } from "./rules-measure-files.ts";
import { isRarelyRight, lowPrecisionGroups, PRECISION_MIN_FINDINGS } from "./rule-policy.ts";
import type { GenreData } from "../packages/chaff/src/genre-parse.ts";
import {
  artefactKeys,
  groupPrecisions,
  countedFindings,
  precisionOf,
  type CorpusResult,
  type GroupPrecision,
  type LanguagePrecision,
  type ExpectedNote,
  type PrecisionMeasurement,
} from "./rules-precision-score.ts";

const ROOT = join(import.meta.dirname, "..");

const argValue = (name: string): string | undefined => {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const optionalString = (record: Record<string, unknown>, key: string): { [key: string]: string } =>
  typeof record[key] === "string" ? { [key]: record[key] } : {};

const noteOf = (document: string, entry: unknown): ExpectedNote[] => {
  if (!isRecord(entry) || typeof entry["rule"] !== "string" || typeof entry["line"] !== "number") return [];
  return [
    {
      document,
      rule: entry["rule"],
      line: entry["line"],
      ...optionalString(entry, "text"),
      ...optionalString(entry, "sha256"),
      ...optionalString(entry, "note"),
    },
  ];
};

/** Every entry of the corpus's expected/<id>.yaml files, with its note. */
const expectedNotes = (corpus: string): ExpectedNote[] => {
  const dir = join(corpus, "expected");
  return readdirSync(dir)
    .filter((file) => file.endsWith(".yaml"))
    .flatMap((file) => {
      const parsed: unknown = parse(readFileSync(join(dir, file), "utf8"));
      if (!isRecord(parsed) || typeof parsed["id"] !== "string" || !Array.isArray(parsed["findings"])) return [];
      const document = parsed["id"];
      return parsed["findings"].flatMap((entry: unknown) => noteOf(document, entry));
    });
};

const isOutcome = (value: unknown): boolean =>
  isRecord(value) && typeof value["kind"] === "string" && typeof value["rule"] === "string" && typeof value["line"] === "number";

const isCorpusResult = (value: unknown): value is CorpusResult =>
  isRecord(value) &&
  typeof value["id"] === "string" &&
  typeof value["genre"] === "string" &&
  typeof value["language"] === "string" &&
  Array.isArray(value["outcomes"]) &&
  value["outcomes"].every(isOutcome);

const resultsOf = (path: string): CorpusResult[] => {
  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
  const results = isRecord(parsed) ? parsed["results"] : undefined;
  if (!Array.isArray(results) || !results.every(isCorpusResult)) throw new Error(`${path}: not a corpus run (scripts/run.ts --json)`);
  return results;
};

/** The commit the checkout is at, read from its .git (a loose ref or packed-refs), so the verdicts can be found again. */
const headCommit = (corpus: string): string => {
  const git = join(corpus, ".git");
  const head = readFileSync(join(git, "HEAD"), "utf8").trim();
  const ref = /^ref: (.+)$/u.exec(head)?.[1];
  if (ref === undefined) return head;
  if (existsSync(join(git, ref))) return readFileSync(join(git, ref), "utf8").trim();
  const packed = readFileSync(join(git, "packed-refs"), "utf8")
    .split("\n")
    .find((line) => line.endsWith(` ${ref}`));
  if (packed === undefined) throw new Error(`${corpus}: cannot read the commit of ${ref}`);
  return packed.split(" ")[0] ?? "";
};

/** Runs the corpus with this checkout's chaff and returns its results. */
const runCorpus = (corpus: string): CorpusResult[] => {
  const dir = mkdtempSync(join(tmpdir(), "chaff-precision-"));
  const json = join(dir, "run.json");
  const jobs = argValue("--jobs");
  try {
    const args = [join(corpus, "scripts", "run.ts"), "--chaff", ROOT, "--json", json, ...(jobs === undefined ? [] : ["--jobs", jobs])];
    execFileSync(process.execPath, args, { cwd: corpus, stdio: ["ignore", "ignore", "inherit"] });
    return resultsOf(json);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

const measure = (corpus: string): PrecisionMeasurement => {
  const from = argValue("--from");
  const results = from === undefined ? runCorpus(corpus) : resultsOf(from);
  return { corpus: headCommit(corpus), rules: groupPrecisions(countedFindings(results, artefactKeys(expectedNotes(corpus)))) };
};

const percent = (value: number | undefined): string => (value === undefined ? "-" : `${String(Math.round(value * 100))}%`);

/** Why a group where this language is rarely right is not off: another language keeps it, or genres.yaml does. */
const markOf = (counts: LanguagePrecision, group: string, low: readonly string[], off: readonly string[]): string => {
  if (off.includes(group)) return "off";
  if (!isRarelyRight(counts)) return "";
  return low.includes(group) ? "on: a genre in genres.yaml turns it on by hand" : "on: another language it reports in does not show it";
};

type Row = { readonly rule: string; readonly group: string; readonly language: string; readonly counts: LanguagePrecision; readonly mark: string };

const rowsOf = (rule: string, groups: Readonly<Record<string, GroupPrecision>>, data: GenreData, measurement: PrecisionMeasurement): Row[] => {
  const low = lowPrecisionGroups(groups);
  const off = precisionOffs(data, rule, measurement);
  return Object.entries(groups).flatMap(([group, languages]) =>
    Object.entries(languages)
      .filter(([, counts]) => counts.correct + counts.falsePositive >= PRECISION_MIN_FINDINGS)
      .map(([language, counts]) => ({ rule, group, language, counts, mark: markOf(counts, group, low, off) })),
  );
};

/** The rules, groups and languages with enough judged findings to decide, lowest precision first, the decision marked. */
const tableOf = (measurement: PrecisionMeasurement): string[] => {
  const data = genreDataOf(readGenresText());
  const rows = Object.entries(measurement.rules).flatMap(([rule, groups]) => rowsOf(rule, groups, data, measurement));
  const precision = (row: Row): number => precisionOf(row.counts) ?? 1;
  return [
    "rule  group  language  precision  correct  false-positive  documents  unjudged",
    ...rows
      .toSorted((left, right) => precision(left) - precision(right))
      .map((row) =>
        [
          row.rule,
          row.group,
          row.language,
          percent(precision(row)),
          row.counts.correct,
          row.counts.falsePositive,
          row.counts.documents,
          row.counts.unjudged,
          row.mark,
        ]
          .join("  ")
          .trimEnd(),
      ),
  ];
};

const corpusArg = argValue("--corpus");
if (corpusArg === undefined) throw new Error("rules:precision: name the chaff-corpus checkout with --corpus <dir>");
const measurement = measure(resolve(corpusArg));
const apply = process.argv.includes("--apply");
if (apply || process.argv.includes("--write")) writeFileSync(PRECISION_FILE, `${JSON.stringify(measurement, null, 2)}\n`);
console.log(tableOf(measurement).join("\n"));
if (apply) applyMeasurement(readMeasurement(), measurement).forEach((line) => console.log(line));
