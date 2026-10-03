// The self-written samples of test/fixtures/bench/<lang>/, and what a mistake planted in one of them is run with:
// the rules' limits for the sample's genre and the team's words chaff.yaml would pass.
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { documentLengthOf, registerCountsOf, type TeamWords } from "./corpus-findings.ts";
import type { PlantContext } from "./bench-text.ts";
import { TEAM_JARGON, requiredSectionsOf } from "./bench-mutations-layout.ts";
import { TEAM_PREFER } from "./bench-mutations-phrasing.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import type { RuleDefinition } from "../packages/chaff/src/plugin.ts";
import { resolve } from "../packages/chaff/src/levels.ts";
import { GENRES } from "../packages/chaff/src/genre.ts";
import { presetLevels } from "../packages/chaff/src/genre-load.ts";
import { measuredOffOn } from "./rules-measure-files.ts";
import type { PresetLevels } from "../packages/chaff/src/genre-parse.ts";
import { BENCH_GENRES, benchGenreOf, benchLevelOf, runsInBench } from "./bench-genres.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";

export const BENCH = join(dirname(fileURLToPath(import.meta.url)), "..", "test", "fixtures", "bench");

const LENGTH_UNITS: Readonly<Record<string, "char" | "word">> = { ja: ja.capabilities.lengthUnit, en: en.capabilities.lengthUnit };

const RULES: ReadonlyMap<string, readonly RuleDefinition[]> = new Map(["ja", "en"].map((language) => [language, loadRules(language)]));

/** The genre's levels with the rules measured off back at normal: the bench reads whether a detector finds a mistake, not whether it runs by default. */
const benchPreset = (genre: string): PresetLevels => ({ ...presetLevels(genre), ...measuredOffOn(genre) });

const rulesOf = (language: string): readonly RuleDefinition[] => RULES.get(language) ?? loadRules(language);

export type Sample = { readonly name: string; readonly language: string; readonly genre: string; readonly path: string; readonly source: string };

export const samplesOf = (language: string): Sample[] =>
  readdirSync(join(BENCH, language))
    .filter((file) => file.endsWith(".md"))
    .toSorted((left, right) => left.localeCompare(right, "en"))
    .map((file) => {
      const kind = file.replace(/\.md$/u, "");
      return {
        name: `${language}/${kind}`,
        language,
        genre: benchGenreOf(kind, BENCH_GENRES, GENRES),
        path: `bench/${language}/${file}`,
        source: readFileSync(join(BENCH, language, file), "utf8"),
      };
    });

export const contextOf = (sample: Sample): PlantContext => ({
  limits: Object.fromEntries(
    rulesOf(sample.language).map((rule) => [rule.id, resolve(rule, benchLevelOf(rule.id, benchPreset(sample.genre)), sample.genre).limit]),
  ),
  lengthUnit: LENGTH_UNITS[sample.language],
  fullSentences: Object.fromEntries(rulesOf(sample.language).flatMap((rule) => (rule.full_sentence === undefined ? [] : [[rule.id, rule.full_sentence]]))),
  documentLength: (source) => documentLengthOf(sample.path, source, sample.language, sample.genre, teamOf(sample)),
  registers: (source, line) => registerCountsOf(sample.path, source, sample.language, sample.genre, teamOf(sample), line),
});

/** Whether chaff runs the rule on this sample at all: its languages, a genre in its use_for, and not off in the genre's preset. */
export const runsOn = (sample: Pick<Sample, "language" | "genre">, id: string): boolean =>
  rulesOf(sample.language).some((rule) => rule.id === id && runsInBench(rule, sample.genre, benchPreset(sample.genre)));

export const teamOf = (sample: Sample): TeamWords => ({ jargon: TEAM_JARGON, requiredSections: requiredSectionsOf(sample.source), prefer: TEAM_PREFER });
