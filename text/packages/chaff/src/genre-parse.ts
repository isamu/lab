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
};

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

const genreOf = (value: unknown, index: number): GenreDefinition => {
  const id = idOf(value, index);
  const raw = isRecord(value) ? value : {};
  const profile = raw["profile"];
  if (profile !== undefined && (typeof profile !== "string" || profile === "")) throw new Error(`${id}: profile must be a profile's id`);
  return { id, name: localizedOf(raw["name"], "name", id), summary: localizedOf(raw["summary"], "summary", id), rules: levelsOf(raw["rules"], id), profile };
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
