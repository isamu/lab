import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { parseGenres, presetLevelsOf, presetProfileOf, withRuleOffs, type GenreData, type PresetLevels } from "./genre-parse.ts";
import { loadRuleOffs } from "./rule-offs.ts";

const PACKAGE = join(dirname(fileURLToPath(import.meta.url)), "..");
const GENRES_FILE = join(PACKAGE, "genres.yaml");
const RULES_DIR = join(PACKAGE, "rules");

const loaded: { value: GenreData | undefined } = { value: undefined };

/** The bundled genres.yaml, with the offs the rule files set (off_for). Read once. */
export const loadGenres = (): GenreData => {
  if (loaded.value !== undefined) return loaded.value;
  try {
    loaded.value = withRuleOffs(parseGenres(parse(readFileSync(GENRES_FILE, "utf8"))), loadRuleOffs(RULES_DIR));
  } catch (error) {
    throw new Error(`cannot read ${GENRES_FILE}: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
  }
  return loaded.value;
};

export const presetLevels = (genre: string): PresetLevels => presetLevelsOf(loadGenres(), genre);

export const presetProfile = (genre: string): string | undefined => presetProfileOf(loadGenres(), genre);
