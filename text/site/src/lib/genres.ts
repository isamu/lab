// The genre reference is read with chaff's own parser, so every genre, level and profile on the site is the one chaff uses.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "yaml";
import { parseGenres, presetLevelsOf, withRuleOffs } from "../../../packages/chaff/src/genre-parse.ts";
import { loadRuleOffs } from "../../../packages/chaff/src/rule-offs.ts";
import { standingIn, type GenreStanding } from "../../../packages/chaff/src/rule-genres.ts";
import { rules, type Localized, type Rule } from "./rules";

// astro build runs in text/site.
const PACKAGE = resolve(process.cwd(), "..", "packages", "chaff");
const GENRES_FILE = resolve(PACKAGE, "genres.yaml");

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

const data = withRuleOffs(parseGenres(parse(readFileSync(GENRES_FILE, "utf8"))), loadRuleOffs(resolve(PACKAGE, "rules")));
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

export type RuleInGenre = { readonly genre: string; readonly name: Localized; readonly standing: GenreStanding };

/** How one rule stands in every genre, in the order chaff genres lists them. */
export const standingsOf = (rule: Pick<Rule, "id" | "status" | "useFor" | "optIn">): readonly RuleInGenre[] =>
  data.genres.map((genre) => ({
    genre: genre.id,
    name: both(genre.name),
    standing: standingIn({ id: rule.id, status: rule.status, use_for: rule.useFor, ...(rule.optIn ? { opt_in: true } : {}) }, genre.id, presetLevelsOf(data, genre.id)),
  }));
