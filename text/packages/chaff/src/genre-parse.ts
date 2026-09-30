import { isLevel } from "./levels.ts";
import type { Level, Localized } from "./plugin.ts";

/** A preset's rules: the level each named rule runs at, under whatever chaff.yaml's rules say. */
export type PresetLevels = Readonly<Record<string, Level>>;

/** A group of genres (legal, literature): its name, and the levels every genre in it shares. */
export type GenreGroup = { readonly id: string; readonly name: Localized; readonly rules: PresetLevels };

/** One genre of genres.yaml: what it is for, the levels it sets on top of its group's, and the profile it reads with. */
export type GenreDefinition = {
  readonly id: string;
  readonly name: Localized;
  readonly summary: Localized;
  readonly rules: PresetLevels;
  readonly profile: string | undefined;
  readonly suggest: GenreSuggest;
};

/** A line shape that marks the genre, and how many lines must have it. */
type LineCue = { readonly line: RegExp; readonly minLines: number };

/**
 * What makes a document look like this genre when no genre is set: its path, or per language, the shape of the body's first
 * line (a letter's salutation) or enough lines of the genre's own shape.
 */
export type GenreSuggest = {
  readonly paths: readonly RegExp[];
  readonly lines: Readonly<Record<string, LineCue>>;
  readonly openings: Readonly<Record<string, RegExp>>;
};

type LanguageCue = { readonly line: LineCue | undefined; readonly opening: RegExp | undefined };

export type GenreData = { readonly groups: readonly GenreGroup[]; readonly genres: readonly GenreDefinition[] };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const isLocalized = (value: unknown): value is Localized =>
  isRecord(value) && typeof value["ja"] === "string" && typeof value["en"] === "string" && value["ja"] !== "" && value["en"] !== "";

const levelsOf = (value: unknown, where: string): PresetLevels => {
  if (value === undefined) return {};
  if (!isRecord(value)) throw new Error(`${where}: rules must be a map of rule ids to levels`);
  const wrong = Object.entries(value).find(([, level]) => !isLevel(level));
  if (wrong !== undefined) throw new Error(`${where}: ${wrong[0]} has the level ${String(wrong[1])}; use strict, normal, relaxed or off`);
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, Level] => isLevel(entry[1])));
};

const localizedOf = (value: unknown, field: string, where: string): Localized => {
  if (!isLocalized(value)) throw new Error(`${where}: ${field} needs a ja and an en text`);
  return value;
};

const idOf = (value: unknown, index: number): string => {
  const id = isRecord(value) ? value["id"] : undefined;
  if (typeof id !== "string" || id === "") throw new Error(`entry ${String(index + 1)} has no id`);
  return id;
};

const groupOf = (value: unknown, index: number): GenreGroup => {
  const id = idOf(value, index);
  const raw = isRecord(value) ? value : {};
  return { id, name: localizedOf(raw["name"], "name", id), rules: levelsOf(raw["rules"], id) };
};

const patternOf = (value: unknown, flags: string, where: string): RegExp => {
  if (typeof value !== "string" || value === "") throw new Error(`${where}: a pattern must be a non-empty string`);
  try {
    return new RegExp(value, flags);
  } catch (error) {
    throw new Error(`${where}: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
  }
};

const lineCueOf = (value: unknown, where: string): LineCue => {
  if (!isRecord(value)) throw new Error(`${where}: needs line and min_lines`);
  const minLines = value["min_lines"];
  if (typeof minLines !== "number" || !Number.isInteger(minLines) || minLines < 1) throw new Error(`${where}: min_lines must be a whole number of 1 or more`);
  return { line: patternOf(value["line"], "u", where), minLines };
};

const hasLineCue = (value: Readonly<Record<string, unknown>>): boolean => value["line"] !== undefined || value["min_lines"] !== undefined;

const languageCueOf = (value: unknown, where: string): LanguageCue => {
  if (!isRecord(value) || (!hasLineCue(value) && value["opening"] === undefined)) throw new Error(`${where}: needs line and min_lines, or opening`);
  return {
    line: hasLineCue(value) ? lineCueOf(value, where) : undefined,
    opening: value["opening"] === undefined ? undefined : patternOf(value["opening"], "u", where),
  };
};

const presentOf = <T>(cues: readonly (readonly [string, T | undefined])[]): Record<string, T> =>
  Object.fromEntries(cues.filter((entry): entry is readonly [string, T] => entry[1] !== undefined));

const suggestOf = (value: unknown, where: string): GenreSuggest => {
  if (value === undefined) return { paths: [], lines: {}, openings: {} };
  if (!isRecord(value)) throw new Error(`${where}: suggest must be a map`);
  const paths = value["paths"] ?? [];
  if (!Array.isArray(paths)) throw new Error(`${where}: suggest.paths must be a list`);
  const cues = Object.entries(value)
    .filter(([key]) => key !== "paths")
    .map(([language, cue]) => [language, languageCueOf(cue, `${where} suggest.${language}`)] as const);
  return {
    paths: paths.map((path) => patternOf(path, "iu", `${where} suggest.paths`)),
    lines: presentOf(cues.map(([language, cue]) => [language, cue.line] as const)),
    openings: presentOf(cues.map(([language, cue]) => [language, cue.opening] as const)),
  };
};

const genreOf = (value: unknown, index: number): GenreDefinition => {
  const id = idOf(value, index);
  const raw = isRecord(value) ? value : {};
  const profile = raw["profile"];
  if (profile !== undefined && (typeof profile !== "string" || profile === "")) throw new Error(`${id}: profile must be a profile's id`);
  return {
    id,
    name: localizedOf(raw["name"], "name", id),
    summary: localizedOf(raw["summary"], "summary", id),
    rules: levelsOf(raw["rules"], id),
    profile,
    suggest: suggestOf(raw["suggest"], id),
  };
};

const listOf = (raw: Record<string, unknown>, key: string): unknown[] => {
  const value = raw[key];
  if (!Array.isArray(value)) throw new Error(`genres.yaml needs a list under ${key}`);
  return value;
};

/** genres.yaml as read by the yaml package. Throws on anything it cannot read: the file ships with chaff, so a wrong entry is chaff's bug. */
export const parseGenres = (raw: unknown): GenreData => {
  if (!isRecord(raw)) throw new Error("genres.yaml must be a map with groups and genres");
  const groups = listOf(raw, "groups").map(groupOf);
  const genres = listOf(raw, "genres").map(genreOf);
  const orphan = genres.find((genre) => !groups.some((group) => genre.id.startsWith(`${group.id}/`)));
  if (orphan !== undefined) throw new Error(`${orphan.id}: no group matches the part before its /`);
  return { groups, genres };
};

/** The levels a genre's preset sets: its group's, then its own on top. Empty for a genre chaff does not know. */
export const presetLevelsOf = (data: GenreData, genre: string): PresetLevels => {
  const own = data.genres.find((entry) => entry.id === genre);
  if (own === undefined) return {};
  const group = data.groups.find((entry) => genre.startsWith(`${entry.id}/`));
  return { ...group?.rules, ...own.rules };
};

/** The profile a genre reads its documents with, when it names one. */
export const presetProfileOf = (data: GenreData, genre: string): string | undefined => data.genres.find((entry) => entry.id === genre)?.profile;
