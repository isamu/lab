import type { Level, RuleDefinition } from "../packages/chaff/src/plugin.ts";
import type { PresetLevels } from "../packages/chaff/src/genre-parse.ts";

/** The genre each kind of sample is checked as. */
export const BENCH_GENRES: Readonly<Record<string, string>> = {
  itinerary: "business/report",
  quote: "business/report",
  minutes: "business/meeting-notes",
  design: "technical/spec",
  requirements: "technical/spec",
  // A 規程 (internal rules in 第N条 articles) is what legal/statute covers: statutes, regulations and internal rules.
  policy: "legal/statute",
  // A notice to staff from General Affairs about the move: an お知らせ, not a report or a letter.
  note: "business/press-release",
  press: "business/press-release",
  email: "business/email",
  proposal: "business/proposal",
  figures: "business/report",
  readme: "technical/readme",
  blog: "blog/tech",
};

/** A sample kind's genre. Throws when the kind has none or chaff has no such genre: the run would use no genre's settings and say nothing. */
export const benchGenreOf = (kind: string, genres: Readonly<Record<string, string>>, known: readonly string[]): string => {
  const genre = Object.hasOwn(genres, kind) ? genres[kind] : undefined;
  if (genre === undefined) throw new Error(`bench: sample kind "${kind}" has no genre; add it to BENCH_GENRES in scripts/bench-genres.ts`);
  if (!known.includes(genre))
    throw new Error(`bench: sample kind "${kind}" is checked as genre "${genre}", which is not in packages/chaff/genres.yaml (${known.join(", ")})`);
  return genre;
};

/** The level a rule runs at in the bench, which has no chaff.yaml and turns experimental rules on: the genre's preset, else normal. */
export const benchLevelOf = (id: string, preset: PresetLevels): Level => preset[id] ?? "normal";

/** Whether chaff runs the rule on a sample of this genre: a genre in its use_for, and not turned off by the genre's preset. */
export const runsInBench = (rule: Pick<RuleDefinition, "id" | "use_for">, genre: string, preset: PresetLevels): boolean =>
  rule.use_for.some((target) => genre.startsWith(target)) && benchLevelOf(rule.id, preset) !== "off";
