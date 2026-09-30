// The genre reference is read with chaff's own parser, so every genre, level and profile on the site is the one chaff uses.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "yaml";
import { parseGenres, presetLevelsOf } from "../../../packages/chaff/src/genre-parse.ts";
import { rules, type Localized } from "./rules";

// astro build runs in text/site.
const GENRES_FILE = resolve(process.cwd(), "..", "packages", "chaff", "genres.yaml");

export type GenreEntry = {
  readonly id: string;
  readonly name: Localized;
  readonly summary: Localized;
  /** The rules the genre does not check, in rule order. */
  readonly off: readonly string[];
  /** The experimental rules the genre turns on. */
  readonly on: readonly string[];
  readonly profile: string | undefined;
};

export type GenreGroupEntry = { readonly id: string; readonly name: Localized; readonly genres: readonly GenreEntry[] };

const both = (localized: Readonly<Record<string, string>>): Localized => ({ ja: localized["ja"] ?? "", en: localized["en"] ?? "" });

const data = parseGenres(parse(readFileSync(GENRES_FILE, "utf8")));
const experimental = new Set(rules.filter((rule) => rule.status === "experimental").map((rule) => rule.id));
const order = rules.map((rule) => rule.id);
const inRuleOrder = (ids: readonly string[]): string[] => ids.toSorted((left, right) => order.indexOf(left) - order.indexOf(right));

const entryOf = (genre: (typeof data.genres)[number]): GenreEntry => {
  const levels = Object.entries(presetLevelsOf(data, genre.id));
  return {
    id: genre.id,
    name: both(genre.name),
    summary: both(genre.summary),
    off: inRuleOrder(levels.filter(([, level]) => level === "off").map(([id]) => id)),
    on: inRuleOrder(levels.filter(([id, level]) => level !== "off" && experimental.has(id)).map(([id]) => id)),
    profile: genre.profile,
  };
};

export const genreGroups: readonly GenreGroupEntry[] = data.groups
  .map((group) => ({
    id: group.id,
    name: both(group.name),
    genres: data.genres.filter((genre) => genre.id.startsWith(`${group.id}/`)).map(entryOf),
  }))
  .filter((group) => group.genres.length > 0);
